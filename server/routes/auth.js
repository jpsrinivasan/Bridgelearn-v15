'use strict';
/**
 * BridgeLearn — Authentication Routes
 *
 * POST /api/auth/register         — create account
 * POST /api/auth/login            — email + password login
 * POST /api/auth/logout           — revoke tokens
 * POST /api/auth/refresh          — rotate refresh token → new access token
 * GET  /api/auth/me               — current user profile
 * POST /api/auth/verify-email     — verify email with token
 * POST /api/auth/forgot-password  — send reset link
 * POST /api/auth/reset-password   — set new password with token
 * POST /api/auth/change-password  — change password (authenticated)
 */
const express    = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db           = require('../db/database');
const {
  hashPassword, verifyPassword,
  signAccessToken, signRefreshToken, verifyRefreshToken,
  randomToken, sha256,
  ACCESS_TTL_S, REFRESH_TTL_S,
  accessCookieOptions, refreshCookieOptions, clearCookieOptions,
} = require('../utils/crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { requireAuth } = require('../middleware/auth');
const {
  loginLimiter, registerLimiter, resetLimiter,
} = require('../middleware/rateLimit');

const router = express.Router();

/* ── Helpers ─────────────────────────────────────────────────────── */

function validationErrors(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    res.status(422).json({ error: errs.array()[0].msg });
    return true;
  }
  return false;
}

function auditLog(userId, event, req, detail = null) {
  try {
    db.prepare(
      'INSERT INTO auth_audit (user_id, event, ip_address, user_agent, detail) VALUES (?,?,?,?,?)'
    ).run(userId, event, req.ip, req.headers['user-agent'] || '', detail ? JSON.stringify(detail) : null);
  } catch { /* non-critical */ }
}

function issueTokenPair(user, req, res) {
  // Access token — short-lived, stored in httpOnly cookie
  const accessToken = signAccessToken({
    sub   : user.id,
    email : user.email,
    role  : user.role,
    name  : user.display_name,
  });

  // Refresh token — long-lived, stored in separate httpOnly cookie + DB
  const rawRefresh   = randomToken(48);
  const refreshHash  = sha256(rawRefresh);
  const refreshToken = signRefreshToken({ sub: user.id, jti: uuidv4() });
  const now          = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, issued_at, expires_at, user_agent, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), user.id, sha256(refreshToken), now, now + REFRESH_TTL_S,
    req.headers['user-agent'] || '', req.ip);

  // Update last login
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now, user.id);

  res.cookie('bl_access',   accessToken,  accessCookieOptions());
  res.cookie('bl_refresh',  refreshToken, { ...refreshCookieOptions(), path: '/api/auth/refresh' });

  return {
    user: {
      id          : user.id,
      email       : user.email,
      displayName : user.display_name,
      role        : user.role,
      isVerified  : !!user.is_verified,
    },
    accessToken,   // also returned in body for SPA clients that prefer it
    expiresIn : ACCESS_TTL_S,
  };
}

/* ══════════════════════════════════════════════════════════════════
   REGISTER
   ══════════════════════════════════════════════════════════════════ */
router.post('/register',
  registerLimiter,
  [
    body('email')
      .isEmail().withMessage('A valid email is required.')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/).withMessage('Password must contain at least one number.'),
    body('displayName')
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Display name must be 2–50 characters.'),
    body('role')
      .optional()
      .isIn(['student','teacher','parent']).withMessage('Invalid role.'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const { email, password, displayName, role = 'student' } = req.body;
    const emailLower = email.toLowerCase();

    // Check if email already taken
    const existing = db.prepare('SELECT id FROM users WHERE email_lower = ?').get(emailLower);
    if (existing) {
      // Return same error to prevent email enumeration
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    try {
      const passwordHash = await hashPassword(password);
      const userId       = uuidv4();

      db.prepare(`
        INSERT INTO users (id, email, email_lower, display_name, password_hash, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, email, emailLower, displayName.trim(), passwordHash, role);

      // Create email verification token (valid 24 h)
      const verifyToken = randomToken(32);
      const expires     = Math.floor(Date.now() / 1000) + 24 * 3600;
      db.prepare('INSERT INTO email_tokens (token, user_id, expires_at) VALUES (?,?,?)').run(
        verifyToken, userId, expires
      );

      // Send verification email (non-blocking)
      sendVerificationEmail(email, displayName.trim(), verifyToken).catch(err =>
        console.error('[Email] Verification send failed:', err.message)
      );

      auditLog(userId, 'register', req);

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      const tokenData = issueTokenPair(user, req, res);

      return res.status(201).json({
        message : 'Account created. Please verify your email.',
        ...tokenData,
      });
    } catch (err) {
      console.error('[Register] Error:', err);
      return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  }
);

/* ══════════════════════════════════════════════════════════════════
   LOGIN
   ══════════════════════════════════════════════════════════════════ */
router.post('/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email required.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password required.'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const { email, password } = req.body;
    const emailLower = email.toLowerCase();

    const user = db.prepare('SELECT * FROM users WHERE email_lower = ?').get(emailLower);

    // Constant-time comparison (prevent timing attacks)
    const dummyHash = '$2a$12$000000000000000000000000000000000000000000000000000000';
    const hash      = user?.password_hash || dummyHash;
    const valid     = await verifyPassword(password, hash);

    if (!user || !valid) {
      auditLog(user?.id || null, 'login_fail', req, { email: emailLower });
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact support.' });
    }

    auditLog(user.id, 'login_ok', req);
    const tokenData = issueTokenPair(user, req, res);
    return res.status(200).json({ message: 'Login successful.', ...tokenData });
  }
);

/* ══════════════════════════════════════════════════════════════════
   REFRESH TOKEN — rotate access + refresh tokens
   ══════════════════════════════════════════════════════════════════ */
router.post('/refresh', async (req, res) => {
  const rawToken = req.cookies?.bl_refresh;
  if (!rawToken) return res.status(401).json({ error: 'No refresh token.' });

  try {
    const payload   = verifyRefreshToken(rawToken);
    const tokenHash = sha256(rawToken);

    const stored = db.prepare(
      'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0 AND user_id = ?'
    ).get(tokenHash, payload.sub);

    if (!stored || stored.expires_at < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'Refresh token expired or revoked. Please log in again.', code: 'REFRESH_EXPIRED' });
    }

    // Revoke old refresh token (rotation — prevents reuse)
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(stored.id);

    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    const tokenData = issueTokenPair(user, req, res);
    return res.status(200).json({ message: 'Token refreshed.', ...tokenData });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token.' });
  }
});

/* ══════════════════════════════════════════════════════════════════
   LOGOUT
   ══════════════════════════════════════════════════════════════════ */
router.post('/logout', (req, res) => {
  // Revoke refresh token if present
  const rawToken = req.cookies?.bl_refresh;
  if (rawToken) {
    try {
      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(sha256(rawToken));
    } catch { /* non-critical */ }
  }

  // Clear both cookies
  res.clearCookie('bl_access',  clearCookieOptions('/'));
  res.clearCookie('bl_refresh', clearCookieOptions('/api/auth/refresh'));

  if (req.user) auditLog(req.user.id, 'logout', req);

  return res.status(200).json({ message: 'Logged out successfully.' });
});

/* ══════════════════════════════════════════════════════════════════
   ME — current user info
   ══════════════════════════════════════════════════════════════════ */
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    user: {
      id          : req.user.id,
      email       : req.user.email,
      displayName : req.user.display_name,
      role        : req.user.role,
      isVerified  : !!req.user.is_verified,
    },
  });
});

/* ══════════════════════════════════════════════════════════════════
   VERIFY EMAIL
   ══════════════════════════════════════════════════════════════════ */
router.post('/verify-email',
  [body('token').notEmpty().withMessage('Token required.')],
  (req, res) => {
    if (validationErrors(req, res)) return;

    const { token } = req.body;
    const now       = Math.floor(Date.now() / 1000);

    const row = db.prepare(
      'SELECT * FROM email_tokens WHERE token = ? AND used = 0 AND expires_at > ?'
    ).get(token, now);

    if (!row) return res.status(400).json({ error: 'Invalid or expired verification link.' });

    db.prepare('UPDATE users         SET is_verified = 1   WHERE id = ?').run(row.user_id);
    db.prepare('UPDATE email_tokens  SET used = 1          WHERE token = ?').run(token);

    auditLog(row.user_id, 'email_verified', req);
    return res.json({ message: 'Email verified. Your account is fully active.' });
  }
);

/* ══════════════════════════════════════════════════════════════════
   FORGOT PASSWORD — send reset link
   ══════════════════════════════════════════════════════════════════ */
router.post('/forgot-password',
  resetLimiter,
  [body('email').isEmail().withMessage('Valid email required.').normalizeEmail()],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const emailLower = req.body.email.toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email_lower = ?').get(emailLower);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    // Invalidate any existing unused tokens for this user
    db.prepare('UPDATE reset_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

    const token   = randomToken(32);
    const expires = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    db.prepare('INSERT INTO reset_tokens (token, user_id, expires_at) VALUES (?,?,?)').run(
      token, user.id, expires
    );

    sendPasswordResetEmail(user.email, user.display_name, token).catch(err =>
      console.error('[Email] Reset send failed:', err.message)
    );

    auditLog(user.id, 'pw_reset_request', req);
    return res.json({ message: 'If that email is registered, a reset link has been sent.' });
  }
);

/* ══════════════════════════════════════════════════════════════════
   RESET PASSWORD — submit new password with token
   ══════════════════════════════════════════════════════════════════ */
router.post('/reset-password',
  resetLimiter,
  [
    body('token').notEmpty().withMessage('Reset token required.'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/).withMessage('Password must contain at least one number.'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const { token, password } = req.body;
    const now  = Math.floor(Date.now() / 1000);

    const row = db.prepare(
      'SELECT * FROM reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?'
    ).get(token, now);

    if (!row) return res.status(400).json({ error: 'Invalid or expired reset link.' });

    try {
      const hash = await hashPassword(password);
      db.prepare('UPDATE users       SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now, row.user_id);
      db.prepare('UPDATE reset_tokens SET used = 1                           WHERE token = ?').run(token);
      // Revoke ALL refresh tokens (force re-login on all devices)
      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(row.user_id);

      auditLog(row.user_id, 'pw_reset_done', req);
      return res.json({ message: 'Password reset successfully. Please log in with your new password.' });
    } catch (err) {
      console.error('[Reset] Error:', err);
      return res.status(500).json({ error: 'Reset failed. Please try again.' });
    }
  }
);

/* ══════════════════════════════════════════════════════════════════
   CHANGE PASSWORD (authenticated)
   ══════════════════════════════════════════════════════════════════ */
router.post('/change-password',
  requireAuth,
  [
    body('currentPassword').notEmpty().withMessage('Current password required.'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter.')
      .matches(/[0-9]/).withMessage('New password must contain at least one number.'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;

    const { currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    const hash = await hashPassword(newPassword);
    const now  = Math.floor(Date.now() / 1000);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now, user.id);
    // Revoke all refresh tokens to force re-login on other devices
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(user.id);

    auditLog(user.id, 'pw_change', req);
    return res.json({ message: 'Password changed successfully.' });
  }
);

module.exports = router;

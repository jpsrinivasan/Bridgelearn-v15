'use strict';
/**
 * BridgeLearn — Auth middleware
 * Verifies JWT access token from:
 *   1. httpOnly cookie 'bl_access'  (preferred — XSS-safe)
 *   2. Authorization: Bearer <token> header (for API clients)
 */
const { verifyAccessToken } = require('../utils/crypto');
const db = require('../db/database');

/* ── requireAuth ─────────────────────────────────────────────────── */
function requireAuth(req, res, next) {
  let token = req.cookies?.bl_access;

  // Fallback: Authorization header
  if (!token) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) token = header.slice(7);
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = verifyAccessToken(token);

    // Confirm user still exists and is active (DB hit ~0.1ms with SQLite)
    const user = db.prepare(
      'SELECT id, email, display_name, role, is_active FROM users WHERE id = ?'
    ).get(payload.sub);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid session token.' });
  }
}

/* ── requireRole ─────────────────────────────────────────────────── */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
}

/* ── optionalAuth (attach user if token present, but don't block) ── */
function optionalAuth(req, res, next) {
  let token = req.cookies?.bl_access;
  if (!token) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) token = header.slice(7);
  }
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      const user = db.prepare(
        'SELECT id, email, display_name, role, is_active FROM users WHERE id = ?'
      ).get(payload.sub);
      if (user?.is_active) req.user = user;
    } catch { /* silent */ }
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };

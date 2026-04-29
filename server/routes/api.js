'use strict';
/**
 * BridgeLearn — Protected API Routes
 *
 * All routes here require a valid access token.
 *
 * GET  /api/user/profile        — read profile
 * PUT  /api/user/profile        — update profile
 * GET  /api/user/progress       — read learning progress
 * PUT  /api/user/progress       — save learning progress
 * GET  /api/user/gamification   — XP / badges / streak
 * PUT  /api/user/gamification   — save gamification state
 * GET  /api/admin/users         — admin: list users
 * GET  /api/admin/audit         — admin: recent audit events
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(requireAuth, apiLimiter);

/* ── User data storage (JSON blob per user) ─────────────────────── */
// Simple key-value store in SQLite for user-specific JSON data

function ensureUserDataTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_data (
      user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key      TEXT NOT NULL,
      value    TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, key)
    )
  `);
}
ensureUserDataTable();

const getUserData = db.prepare('SELECT value FROM user_data WHERE user_id = ? AND key = ?');
const setUserData = db.prepare(`
  INSERT INTO user_data (user_id, key, value, updated_at)
  VALUES (?, ?, ?, unixepoch())
  ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

/* ── Profile ─────────────────────────────────────────────────────── */

router.get('/user/profile', (req, res) => {
  const row = getUserData.get(req.user.id, 'profile');
  const profile = row ? JSON.parse(row.value) : {};
  return res.json({ profile });
});

router.put('/user/profile',
  [body().isObject().withMessage('Body must be a JSON object.')],
  (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(422).json({ error: errs.array()[0].msg });

    // Sanitise — only allow known fields
    const allowed = ['name','age','country','avatar','theme','ageGroup','setupDone',
                     'tutorChar','voiceEnabled','muteAudio','parentPin'];
    const safe = {};
    for (const k of allowed) if (req.body[k] !== undefined) safe[k] = req.body[k];

    setUserData.run(req.user.id, 'profile', JSON.stringify(safe));
    return res.json({ message: 'Profile saved.', profile: safe });
  }
);

/* ── Learning progress ───────────────────────────────────────────── */

router.get('/user/progress', (req, res) => {
  const row = getUserData.get(req.user.id, 'progress');
  return res.json({ progress: row ? JSON.parse(row.value) : {} });
});

router.put('/user/progress', (req, res) => {
  if (typeof req.body !== 'object') return res.status(422).json({ error: 'Invalid body.' });
  setUserData.run(req.user.id, 'progress', JSON.stringify(req.body));
  return res.json({ message: 'Progress saved.' });
});

/* ── Gamification ────────────────────────────────────────────────── */

router.get('/user/gamification', (req, res) => {
  const row = getUserData.get(req.user.id, 'gamification');
  return res.json({ gamification: row ? JSON.parse(row.value) : {} });
});

router.put('/user/gamification', (req, res) => {
  if (typeof req.body !== 'object') return res.status(422).json({ error: 'Invalid body.' });
  setUserData.run(req.user.id, 'gamification', JSON.stringify(req.body));
  return res.json({ message: 'Gamification saved.' });
});

/* ════════════════════════════════════════════════════════════════
   ADMIN ROUTES
   ════════════════════════════════════════════════════════════════ */

router.get('/admin/users', requireRole('admin'), (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1'));
  const limit = Math.min(100, parseInt(req.query.limit || '20'));
  const offset = (page - 1) * limit;

  const users = db.prepare(`
    SELECT id, email, display_name, role, is_verified, is_active, created_at, last_login
    FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;

  return res.json({ users, total, page, pages: Math.ceil(total / limit) });
});

router.get('/admin/audit', requireRole('admin'), (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit || '50'));
  const events = db.prepare(`
    SELECT a.*, u.email FROM auth_audit a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT ?
  `).all(limit);
  return res.json({ events });
});

module.exports = router;

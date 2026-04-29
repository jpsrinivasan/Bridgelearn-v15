-- BridgeLearn V15 — Authentication Database Schema
-- SQLite — run via: node db/init.js

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Users ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT    PRIMARY KEY,          -- UUID v4
  email         TEXT    NOT NULL UNIQUE,
  email_lower   TEXT    NOT NULL UNIQUE,      -- for case-insensitive lookup
  display_name  TEXT    NOT NULL DEFAULT '',
  password_hash TEXT,                         -- bcrypt hash (NULL for OAuth users)
  role          TEXT    NOT NULL DEFAULT 'student'  CHECK(role IN ('student','teacher','parent','admin')),
  is_verified   INTEGER NOT NULL DEFAULT 0,   -- email verified?
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login    INTEGER
);

-- ── Email-verification tokens ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_tokens (
  token       TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0
);

-- ── Password-reset tokens ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reset_tokens (
  token       TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0
);

-- ── Refresh tokens (JWT rotation) ────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT    PRIMARY KEY,            -- UUID
  user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,        -- SHA-256 of the raw token
  issued_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at  INTEGER NOT NULL,
  revoked     INTEGER NOT NULL DEFAULT 0,
  user_agent  TEXT,
  ip_address  TEXT
);

-- ── Audit log (login attempts, password changes) ──────────────────
CREATE TABLE IF NOT EXISTS auth_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT    REFERENCES users(id) ON DELETE SET NULL,
  event       TEXT    NOT NULL,               -- 'login_ok','login_fail','pw_reset',...
  ip_address  TEXT,
  user_agent  TEXT,
  detail      TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email_lower);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens ON refresh_tokens(user_id, revoked);
CREATE INDEX IF NOT EXISTS idx_audit_user     ON auth_audit(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_event    ON auth_audit(event, created_at);

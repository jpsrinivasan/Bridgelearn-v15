'use strict';
/**
 * BridgeLearn — Cryptographic helpers
 * All token generation uses Node.js crypto (CSPRNG).
 */
const crypto    = require('crypto');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');

/* ── Constants ────────────────────────────────────────────────────── */
const BCRYPT_ROUNDS   = 12;        // ~250ms on modern hardware
const ACCESS_TTL_S    = 15 * 60;   // 15 minutes
const REFRESH_TTL_S   = 7 * 24 * 3600; // 7 days

/* ── Token generation ────────────────────────────────────────────── */

/** Cryptographically random hex token of given byte length */
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** SHA-256 hash (for storing refresh tokens in DB without storing raw value) */
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/* ── Password helpers ────────────────────────────────────────────── */

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

/* ── JWT helpers ─────────────────────────────────────────────────── */

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm : 'HS256',
    expiresIn : ACCESS_TTL_S,
    issuer    : 'bridgelearn',
    audience  : 'bridgelearn-app',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    algorithm : 'HS256',
    expiresIn : REFRESH_TTL_S,
    issuer    : 'bridgelearn',
    audience  : 'bridgelearn-app',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms : ['HS256'],
    issuer     : 'bridgelearn',
    audience   : 'bridgelearn-app',
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    algorithms : ['HS256'],
    issuer     : 'bridgelearn',
    audience   : 'bridgelearn-app',
  });
}

/* ── Cookie helpers ──────────────────────────────────────────────── */
const COOKIE_BASE = {
  httpOnly : true,
  secure   : process.env.NODE_ENV === 'production',
  sameSite : 'strict',
  path     : '/',
};

function accessCookieOptions() {
  return { ...COOKIE_BASE, maxAge: ACCESS_TTL_S * 1000 };
}

function refreshCookieOptions() {
  return { ...COOKIE_BASE, maxAge: REFRESH_TTL_S * 1000, path: '/api/auth/refresh' };
}

function clearCookieOptions(path = '/') {
  return { ...COOKIE_BASE, path, maxAge: 0 };
}

module.exports = {
  BCRYPT_ROUNDS, ACCESS_TTL_S, REFRESH_TTL_S,
  randomToken, sha256,
  hashPassword, verifyPassword,
  signAccessToken, signRefreshToken,
  verifyAccessToken, verifyRefreshToken,
  accessCookieOptions, refreshCookieOptions, clearCookieOptions,
};

'use strict';
/**
 * BridgeLearn V15 — Authentication Server
 *
 * Start: npm start  (or: node --watch server.js for dev)
 *
 * Environment variables — copy .env.example to .env and fill in:
 *   PORT, JWT_SECRET, JWT_REFRESH_SECRET, SMTP_*, APP_URL
 */

/* ── Load .env before anything else ──────────────────────────────── */
const path = require('path');
const fs   = require('fs');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  // Minimal dotenv parser (avoids adding a dependency)
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    const key = k?.trim();
    if (key && !key.startsWith('#') && !process.env[key]) {
      process.env[key] = v.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
}

/* ── Validate required secrets ───────────────────────────────────── */
const REQUIRED = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error('\n❌ Missing required environment variables:', missing.join(', '));
  console.error('   Copy server/.env.example to server/.env and set the values.\n');
  process.exit(1);
}

/* ── Express setup ───────────────────────────────────────────────── */
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes   = require('./routes/auth');
const apiRoutes    = require('./routes/api');

const app  = express();
const PORT = parseInt(process.env.PORT || '3001');

/* ── Security headers ────────────────────────────────────────────── */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc : ["'self'"],
      scriptSrc  : ["'self'"],
      styleSrc   : ["'self'", "'unsafe-inline'"],
      imgSrc     : ["'self'", 'data:', 'https:'],
      connectSrc : ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

/* ── CORS — allow requests from the SPA origin ───────────────────── */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5175,http://localhost:3000')
  .split(',').map(s => s.trim());

app.use(cors({
  origin      : (origin, cb) => {
    // Allow same-origin and configured origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials : true,              // needed for httpOnly cookies
  methods     : ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

/* ── Body parsing ────────────────────────────────────────────────── */
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

/* ── Trust proxy (for correct IP behind nginx/load balancer) ─────── */
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

/* ── Request logging (dev only) ──────────────────────────────────── */
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

/* ── Health check ────────────────────────────────────────────────── */
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

/* ── Routes ──────────────────────────────────────────────────────── */
app.use('/api/auth', authRoutes);
app.use('/api',      apiRoutes);

/* ── 404 handler ─────────────────────────────────────────────────── */
app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

/* ── Global error handler ────────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  console.error('[Server Error]', err.message);
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

/* ── Start ───────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║  🌉  BridgeLearn Auth Server             ║
║  Port : ${PORT.toString().padEnd(34)}║
║  Mode : ${(process.env.NODE_ENV || 'development').padEnd(34)}║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;

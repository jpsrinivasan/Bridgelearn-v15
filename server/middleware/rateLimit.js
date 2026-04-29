'use strict';
const rateLimit = require('express-rate-limit');

/* ── Brute-force protection on auth endpoints ─────────────────────
   - login: 10 attempts per 15 minutes per IP
   - register: 5 per hour per IP
   - password reset: 5 per hour per IP
   - general API: 200 req / minute per IP
*/

const loginLimiter = rateLimit({
  windowMs        : 15 * 60 * 1000,  // 15 minutes
  max             : 10,
  message         : { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders : true,
  legacyHeaders   : false,
  skipSuccessfulRequests: true,       // only count failed logins
});

const registerLimiter = rateLimit({
  windowMs        : 60 * 60 * 1000,  // 1 hour
  max             : 5,
  message         : { error: 'Too many registration attempts. Please wait before trying again.' },
  standardHeaders : true,
  legacyHeaders   : false,
});

const resetLimiter = rateLimit({
  windowMs        : 60 * 60 * 1000,  // 1 hour
  max             : 5,
  message         : { error: 'Too many password reset requests. Please wait before trying again.' },
  standardHeaders : true,
  legacyHeaders   : false,
});

const apiLimiter = rateLimit({
  windowMs        : 60 * 1000,       // 1 minute
  max             : 200,
  message         : { error: 'Too many requests. Please slow down.' },
  standardHeaders : true,
  legacyHeaders   : false,
});

module.exports = { loginLimiter, registerLimiter, resetLimiter, apiLimiter };

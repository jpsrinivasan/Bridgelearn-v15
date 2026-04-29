'use strict';
/**
 * BridgeLearn — Email sender
 * Uses nodemailer. Set SMTP_* env vars for production.
 * Falls back to console logging in development (no SMTP configured).
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    // Production: real SMTP (e.g. SendGrid, Postmark, SES)
    transporter = nodemailer.createTransport({
      host   : process.env.SMTP_HOST,
      port   : parseInt(process.env.SMTP_PORT || '587'),
      secure : process.env.SMTP_SECURE === 'true',
      auth   : {
        user : process.env.SMTP_USER,
        pass : process.env.SMTP_PASS,
      },
    });
  } else {
    // Development: log emails to console instead of sending
    transporter = {
      sendMail(msg) {
        console.log('\n📧 [DEV EMAIL] ─────────────────────────');
        console.log('  To     :', msg.to);
        console.log('  Subject:', msg.subject);
        console.log('  Body   :', msg.text || msg.html);
        console.log('─────────────────────────────────────────\n');
        return Promise.resolve({ messageId: 'dev-' + Date.now() });
      },
    };
  }
  return transporter;
}

/* ── Email templates ─────────────────────────────────────────────── */

async function sendVerificationEmail(to, name, token) {
  const url  = `${process.env.APP_URL || 'http://localhost:5175'}/verify-email?token=${token}`;
  return getTransporter().sendMail({
    from    : `"BridgeLearn" <${process.env.SMTP_FROM || 'noreply@bridgelearn.app'}>`,
    to,
    subject : 'Verify your BridgeLearn email ✉️',
    text    : `Hi ${name},\n\nPlease verify your email:\n${url}\n\nThis link expires in 24 hours.\n\n— BridgeLearn Team`,
    html    : `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#6c63ff">🌉 BridgeLearn</h2>
        <p>Hi <b>${name}</b>,</p>
        <p>Please verify your email address to activate your account.</p>
        <a href="${url}" style="display:inline-block;background:#6c63ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Verify Email
        </a>
        <p style="color:#888;font-size:13px;margin-top:24px">
          This link expires in 24 hours.<br>If you didn't register, you can ignore this email.
        </p>
      </div>`,
  });
}

async function sendPasswordResetEmail(to, name, token) {
  const url  = `${process.env.APP_URL || 'http://localhost:5175'}/reset-password?token=${token}`;
  return getTransporter().sendMail({
    from    : `"BridgeLearn" <${process.env.SMTP_FROM || 'noreply@bridgelearn.app'}>`,
    to,
    subject : 'Reset your BridgeLearn password 🔐',
    text    : `Hi ${name},\n\nReset your password here:\n${url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\n— BridgeLearn Team`,
    html    : `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#6c63ff">🌉 BridgeLearn</h2>
        <p>Hi <b>${name}</b>,</p>
        <p>Someone requested a password reset for your account.</p>
        <a href="${url}" style="display:inline-block;background:#f5576c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
        <p style="color:#888;font-size:13px;margin-top:24px">
          This link expires in 1 hour.<br>If you didn't request this, your account is safe — just ignore this email.
        </p>
      </div>`,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };

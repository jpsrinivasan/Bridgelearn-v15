'use strict';
/**
 * BridgeLearn — SQLite database singleton
 * Uses better-sqlite3 (synchronous API — safe for single-process Node.js)
 */
const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH  = path.join(__dirname, '..', 'data', 'bridgelearn.db');
const SQL_PATH = path.join(__dirname, 'schema.sql');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH, {
  // verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
});

// Performance settings
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// Run schema on first start
const schema = fs.readFileSync(SQL_PATH, 'utf8');
db.exec(schema);

module.exports = db;

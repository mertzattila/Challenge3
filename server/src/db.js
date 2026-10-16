'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// We use Node's built-in SQLite (node:sqlite, DatabaseSync). It is pure built-in
// — no native compilation step — which avoids better-sqlite3's build failures on
// newer Node versions. The prepared-statement API (.prepare().run/get/all) matches
// what the route modules expect.

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'smartshift.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/** Create tables if they do not exist. */
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS availability (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date        TEXT NOT NULL,
      start_time  TEXT NOT NULL,
      end_time    TEXT NOT NULL,
      is_on_call  INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS groups (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      date           TEXT NOT NULL,
      start_time     TEXT NOT NULL,
      end_time       TEXT NOT NULL,
      duration_hours REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id           INTEGER NOT NULL,
      employee_id        INTEGER,
      status             TEXT NOT NULL DEFAULT 'unassigned',
      manually_overridden INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (group_id)    REFERENCES groups(id)    ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS work_hours (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      group_id    INTEGER,
      date        TEXT NOT NULL,
      hours       REAL NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id)    REFERENCES groups(id)    ON DELETE SET NULL
    );
  `);
}

/** Seed a few employees if the table is empty. */
function seedEmployees() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM employees').get().c;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO employees (name) VALUES (?)');
    const names = ['Alice', 'Bob', 'Carla', 'David'];
    names.forEach((n) => insert.run(n));
  }
}

/**
 * node:sqlite's DatabaseSync has no .transaction() helper (unlike better-sqlite3).
 * Provide a small equivalent so route code can wrap multi-statement writes.
 */
function transaction(fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
}

function init() {
  initSchema();
  seedEmployees();
}

module.exports = { db, init, transaction, DB_PATH };

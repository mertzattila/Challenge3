'use strict';

const express = require('express');
const { db, transaction } = require('../db');

const router = express.Router();

function toMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
}

function groupRowToDto(r) {
  return {
    id: r.id,
    name: r.name,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    durationHours: r.duration_hours,
  };
}

/**
 * Parse pasted spreadsheet data into group objects.
 * Accepts either an array of {name,date,start,end} objects, an array of arrays,
 * or raw TSV/CSV text. Returns { groups, errors }.
 * Expected columns: name, date (YYYY-MM-DD), start (HH:MM), end (HH:MM).
 */
function parseRows(rows) {
  const errors = [];
  const parsed = [];

  let records = [];
  if (typeof rows === 'string') {
    records = rows
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\t|,/).map((c) => c.trim()));
  } else if (Array.isArray(rows)) {
    records = rows.map((r) => {
      if (Array.isArray(r)) return r;
      if (r && typeof r === 'object') return [r.name, r.date, r.start ?? r.startTime, r.end ?? r.endTime];
      return [r];
    });
  } else {
    return { groups: [], errors: ['rows must be a string or an array'] };
  }

  // Skip a header row if present (first cell looks like a label).
  if (records.length && /name/i.test(records[0][0] || '')) {
    records = records.slice(1);
  }

  records.forEach((cells, idx) => {
    const [name, date, start, end] = cells;
    const rowNum = idx + 1;
    if (!name || !date || !start || !end) {
      errors.push(`Row ${rowNum}: expected 4 columns (name, date, start, end), got "${cells.join(' | ')}"`);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Row ${rowNum}: date "${date}" must be YYYY-MM-DD`);
      return;
    }
    if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) {
      errors.push(`Row ${rowNum}: times "${start}"/"${end}" must be HH:MM`);
      return;
    }
    const duration = (toMinutes(end) - toMinutes(start)) / 60;
    if (duration <= 0) {
      errors.push(`Row ${rowNum}: end time must be after start time`);
      return;
    }
    parsed.push({ name, date, startTime: start, endTime: end, durationHours: duration });
  });

  return { groups: parsed, errors };
}

// POST /api/groups/import  {rows}  -> imported groups (replaces existing group set)
router.post('/import', (req, res) => {
  const { rows } = req.body || {};
  if (rows === undefined) {
    return res.status(400).json({ error: 'rows is required (TSV/CSV text or array)' });
  }

  const { groups, errors } = parseRows(rows);
  if (groups.length === 0) {
    return res
      .status(400)
      .json({ error: 'No valid rows found', details: errors });
  }

  // Fresh import: clear old groups + their assignments, then insert.
  const insert = db.prepare(
    'INSERT INTO groups (name, date, start_time, end_time, duration_hours) VALUES (?,?,?,?,?)'
  );
  const tx = transaction((list) => {
    db.prepare('DELETE FROM assignments').run();
    db.prepare('DELETE FROM groups').run();
    const inserted = [];
    for (const g of list) {
      const info = insert.run(g.name, g.date, g.startTime, g.endTime, g.durationHours);
      inserted.push(db.prepare('SELECT * FROM groups WHERE id = ?').get(info.lastInsertRowid));
    }
    return inserted;
  });

  const inserted = tx(groups).map(groupRowToDto);
  res.status(201).json({ groups: inserted, warnings: errors });
});

// GET /api/groups -> all groups (handy for the frontend)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM groups ORDER BY date, start_time').all();
  res.json(rows.map(groupRowToDto));
});

module.exports = router;

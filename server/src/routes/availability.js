'use strict';

const express = require('express');
const { db } = require('../db');

const router = express.Router();

function rowToDto(r) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    isOnCall: !!r.is_on_call,
  };
}

// GET /api/availability/all  (MANAGER) -> availability grouped by employee
// NOTE: declared BEFORE '/' so '/all' is not swallowed by the scoped GET.
router.get('/all', (req, res) => {
  const employees = db.prepare('SELECT id, name FROM employees ORDER BY id').all();
  const avail = db.prepare('SELECT * FROM availability ORDER BY date, start_time').all();
  const grouped = employees.map((e) => ({
    employeeId: e.id,
    name: e.name,
    availability: avail.filter((a) => a.employee_id === e.id).map(rowToDto),
  }));
  res.json(grouped);
});

// GET /api/availability?employeeId=  -> only that employee's rows (privacy boundary)
router.get('/', (req, res) => {
  const employeeId = Number(req.query.employeeId);
  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId query parameter is required' });
  }
  const rows = db
    .prepare('SELECT * FROM availability WHERE employee_id = ? ORDER BY date, start_time')
    .all(employeeId);
  res.json(rows.map(rowToDto));
});

// POST /api/availability  {employeeId, date, startTime, endTime, isOnCall}
router.post('/', (req, res) => {
  const { employeeId, date, startTime, endTime, isOnCall } = req.body || {};
  if (!employeeId || !date || !startTime || !endTime) {
    return res
      .status(400)
      .json({ error: 'employeeId, date, startTime and endTime are required' });
  }
  const info = db
    .prepare(
      'INSERT INTO availability (employee_id, date, start_time, end_time, is_on_call) VALUES (?,?,?,?,?)'
    )
    .run(employeeId, date, startTime, endTime, isOnCall ? 1 : 0);
  const row = db.prepare('SELECT * FROM availability WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToDto(row));
});

// PUT /api/availability/:id  {date, startTime, endTime, isOnCall}
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM availability WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'availability not found' });

  const date = req.body.date ?? existing.date;
  const startTime = req.body.startTime ?? existing.start_time;
  const endTime = req.body.endTime ?? existing.end_time;
  const isOnCall =
    req.body.isOnCall === undefined ? existing.is_on_call : req.body.isOnCall ? 1 : 0;

  db.prepare(
    'UPDATE availability SET date = ?, start_time = ?, end_time = ?, is_on_call = ? WHERE id = ?'
  ).run(date, startTime, endTime, isOnCall, id);

  const row = db.prepare('SELECT * FROM availability WHERE id = ?').get(id);
  res.json(rowToDto(row));
});

// DELETE /api/availability/:id
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM availability WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'availability not found' });
  res.json({ ok: true });
});

module.exports = router;

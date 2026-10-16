'use strict';

/**
 * Demo data seeder — rich dataset for the final demonstration.
 *
 * Fills the database with a full week of availability (varied patterns + on-call),
 * ~18 group bookings across 5 days, a generated schedule, and submitted work hours.
 * Designed to illustrate every rule:
 *   - uneven availability (fairness is visible)
 *   - same-day groups < 4h apart (four-hour preference)
 *   - groups nobody can cover (unassigned)
 *   - on-call employees
 *
 * Usage:  node scripts/seedDemo.js   (or:  npm run seed)
 * RESETS availability, groups, assignments, work_hours. Ensures the employee
 * roster below exists (adds any that are missing) without duplicating.
 */

const { db, init, transaction } = require('../src/db');
const generateSchedule = require('../scheduler/generateSchedule');

init();

// --- Employee roster -------------------------------------------------------
// Ensure these employees exist (the base app seeds the first four; we add more
// for a fuller demo). We never duplicate an existing name.
const ROSTER = ['Alice', 'Bob', 'Carla', 'David', 'Elena', 'Farid', 'Gina', 'Hugo'];

const ensureEmployees = transaction(() => {
  const existing = db.prepare('SELECT name FROM employees').all().map((r) => r.name);
  const insert = db.prepare('INSERT INTO employees (name) VALUES (?)');
  ROSTER.forEach((name) => {
    if (!existing.includes(name)) insert.run(name);
  });
});
ensureEmployees();

const idByName = {};
db.prepare('SELECT id, name FROM employees').all().forEach((e) => {
  idByName[e.name] = e.id;
});

// --- Demo week dates (fixed for reproducibility) ---------------------------
const DAYS = {
  MON: '2026-10-19',
  TUE: '2026-10-20',
  WED: '2026-10-21',
  THU: '2026-10-22',
  FRI: '2026-10-23',
};

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

// --- Availability ----------------------------------------------------------
// [employeeName, date, start, end, isOnCall]
// Deliberately varied so fairness/normalized-load differences are visible.
const availabilitySpec = [
  // Alice — available every day, long hours (the "always around" person)
  ['Alice', DAYS.MON, '08:00', '18:00', 0],
  ['Alice', DAYS.TUE, '08:00', '18:00', 0],
  ['Alice', DAYS.WED, '08:00', '18:00', 0],
  ['Alice', DAYS.THU, '08:00', '18:00', 0],
  ['Alice', DAYS.FRI, '08:00', '18:00', 0],
  // Bob — mornings mostly
  ['Bob', DAYS.MON, '08:00', '13:00', 0],
  ['Bob', DAYS.TUE, '08:00', '13:00', 0],
  ['Bob', DAYS.THU, '08:00', '14:00', 0],
  // Carla — afternoons/evenings
  ['Carla', DAYS.MON, '13:00', '21:00', 0],
  ['Carla', DAYS.WED, '12:00', '20:00', 0],
  ['Carla', DAYS.FRI, '14:00', '22:00', 0],
  // David — only one evening, on-call
  ['David', DAYS.TUE, '16:00', '22:00', 1],
  // Elena — three mid-days
  ['Elena', DAYS.TUE, '09:00', '17:00', 0],
  ['Elena', DAYS.WED, '09:00', '17:00', 0],
  ['Elena', DAYS.THU, '09:00', '17:00', 0],
  // Farid — part-time, on-call Friday
  ['Farid', DAYS.WED, '10:00', '15:00', 0],
  ['Farid', DAYS.FRI, '08:00', '12:00', 1],
  // Gina — evenings, on-call Monday
  ['Gina', DAYS.MON, '17:00', '22:00', 1],
  ['Gina', DAYS.THU, '15:00', '21:00', 0],
  // Hugo — two full days
  ['Hugo', DAYS.TUE, '08:00', '18:00', 0],
  ['Hugo', DAYS.FRI, '08:00', '18:00', 0],
];

// --- Groups ----------------------------------------------------------------
// [name, date, start, end]
// Several same-day clusters for the four-hour rule; a couple late-night ones
// that nobody can cover -> unassigned.
const groupSpec = [
  // Monday
  ['Morning Yoga', DAYS.MON, '09:00', '10:30'],
  ['Midday Spin', DAYS.MON, '12:00', '13:00'],
  ['Afternoon Pilates', DAYS.MON, '13:30', '15:00'],
  ['Evening Boxing', DAYS.MON, '18:00', '19:30'],
  ['Late Night Club', DAYS.MON, '22:30', '23:30'], // likely unassigned
  // Tuesday
  ['Tue Bootcamp', DAYS.TUE, '09:00', '10:30'],
  ['Tue Lunch HIIT', DAYS.TUE, '12:00', '13:00'],
  ['Tue Afternoon Flow', DAYS.TUE, '14:00', '15:30'],
  ['Tue Evening Dance', DAYS.TUE, '18:00', '19:30'],
  // Wednesday
  ['Wed Stretch', DAYS.WED, '09:00', '10:00'],
  ['Wed Core', DAYS.WED, '11:00', '12:00'],
  ['Wed Evening Yoga', DAYS.WED, '18:00', '19:30'],
  // Thursday
  ['Thu Pilates', DAYS.THU, '10:00', '11:30'],
  ['Thu Spin', DAYS.THU, '12:30', '13:30'],
  ['Thu Evening Zumba', DAYS.THU, '19:00', '20:30'],
  // Friday
  ['Fri Morning Run', DAYS.FRI, '08:30', '10:00'],
  ['Fri Lunch Yoga', DAYS.FRI, '12:00', '13:00'],
  ['Fri Night Social', DAYS.FRI, '23:00', '23:59'], // likely unassigned
];

const seed = transaction(() => {
  db.prepare('DELETE FROM work_hours').run();
  db.prepare('DELETE FROM assignments').run();
  db.prepare('DELETE FROM groups').run();
  db.prepare('DELETE FROM availability').run();

  const insAvail = db.prepare(
    'INSERT INTO availability (employee_id, date, start_time, end_time, is_on_call) VALUES (?,?,?,?,?)'
  );
  availabilitySpec.forEach(([name, date, start, end, onCall]) => {
    insAvail.run(idByName[name], date, start, end, onCall);
  });

  const insGroup = db.prepare(
    'INSERT INTO groups (name, date, start_time, end_time, duration_hours) VALUES (?,?,?,?,?)'
  );
  groupSpec.forEach(([name, date, start, end]) => {
    const dur = (toMinutes(end) - toMinutes(start)) / 60;
    insGroup.run(name, date, start, end, dur);
  });
});
seed();

// --- Generate schedule from seeded data (same path the API uses) -----------
const employees = db.prepare('SELECT id, name FROM employees ORDER BY id').all();
const avail = db.prepare('SELECT * FROM availability').all().map((a) => ({
  id: a.id,
  employeeId: a.employee_id,
  date: a.date,
  startTime: a.start_time,
  endTime: a.end_time,
  isOnCall: !!a.is_on_call,
}));
const grps = db.prepare('SELECT * FROM groups ORDER BY date, start_time').all().map((g) => ({
  id: g.id,
  name: g.name,
  date: g.date,
  startTime: g.start_time,
  endTime: g.end_time,
  durationHours: g.duration_hours,
}));

const result = generateSchedule({ employees, availability: avail, groups: grps });

const writeAssignments = transaction(() => {
  db.prepare('DELETE FROM assignments').run();
  const ins = db.prepare(
    'INSERT INTO assignments (group_id, employee_id, status, manually_overridden) VALUES (?,?,?,?)'
  );
  result.assignments.forEach((a) => ins.run(a.groupId, a.employeeId, 'assigned', 0));
  result.unassigned.forEach((gid) => ins.run(gid, null, 'unassigned', 0));
});
writeAssignments();

// --- Submit work hours for most assigned groups (so history looks real) -----
const insHours = db.prepare(
  'INSERT INTO work_hours (employee_id, group_id, date, hours) VALUES (?,?,?,?)'
);
const assignedRows = db
  .prepare("SELECT * FROM assignments WHERE status = 'assigned' ORDER BY id")
  .all();
assignedRows.forEach((a, i) => {
  // Submit actual hours for ~70% of assignments to leave some "not yet reported".
  if (!a.employee_id || i % 10 === 7 || i % 10 === 9) return;
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(a.group_id);
  if (!g) return;
  // Occasionally log slightly different actual hours than scheduled, for realism.
  const jitter = i % 5 === 0 ? 0.5 : 0;
  insHours.run(a.employee_id, g.id, g.date, Number((g.duration_hours + jitter).toFixed(2)));
});

// --- Report ----------------------------------------------------------------
const groupName = (id) => db.prepare('SELECT name FROM groups WHERE id = ?').get(id)?.name;
const empName = (id) =>
  id ? db.prepare('SELECT name FROM employees WHERE id = ?').get(id)?.name : '—';

const unassigned = db
  .prepare("SELECT group_id FROM assignments WHERE status = 'unassigned'")
  .all();
const hoursCount = db.prepare('SELECT COUNT(*) AS c FROM work_hours').get().c;

console.log('\nRich demo data seeded.\n');
console.log('Assignments:');
assignedRows.forEach((a) => {
  console.log(`  ${groupName(a.group_id).padEnd(20)} -> ${empName(a.employee_id)}`);
});
unassigned.forEach((u) => console.log(`  ${groupName(u.group_id).padEnd(20)} -> UNASSIGNED`));
console.log(
  `\n${employees.length} employees, ${availabilitySpec.length} availability rows, ` +
    `${groupSpec.length} groups (${assignedRows.length} assigned, ${unassigned.length} unassigned), ` +
    `${hoursCount} work-hour records.\n`
);

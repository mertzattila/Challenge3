'use strict';

/**
 * Demo data seeder.
 *
 * Fills the database with realistic availability, group bookings, a generated
 * schedule, and some submitted work hours — so the UI shows a populated,
 * working system for the demo. Designed to illustrate every rule:
 *   - uneven availability (fairness is visible)
 *   - same-day groups < 4h apart (four-hour preference)
 *   - at least one group nobody can cover (unassigned)
 *   - an on-call employee
 *
 * Usage:  node scripts/seedDemo.js
 * This RESETS availability, groups, assignments, and work_hours (not employees).
 */

const { db, init, transaction } = require('../src/db');
const generateSchedule = require('../scheduler/generateSchedule');

init();

// Dates for the demo week (fixed so the demo is reproducible).
const D1 = '2026-10-20'; // Mon
const D2 = '2026-10-21'; // Tue
const D3 = '2026-10-22'; // Wed

// Employee ids from the default seed: Alice=1, Bob=2, Carla=3, David=4.
const ALICE = 1;
const BOB = 2;
const CARLA = 3;
const DAVID = 4;

// Availability: [employeeId, date, start, end, isOnCall]
// Alice is available a lot; David barely (+ on-call) — makes fairness visible.
const availability = [
  [ALICE, D1, '08:00', '18:00', 0],
  [ALICE, D2, '08:00', '18:00', 0],
  [ALICE, D3, '08:00', '18:00', 0],
  [BOB, D1, '09:00', '14:00', 0],
  [BOB, D2, '09:00', '20:00', 0],
  [CARLA, D1, '12:00', '20:00', 0],
  [CARLA, D3, '08:00', '13:00', 0],
  [DAVID, D2, '16:00', '22:00', 1], // on-call, evening only
];

// Groups: [name, date, start, end]
// D1 has three same-day groups to exercise the four-hour preference.
// "Night Owl Club" at 21:00 D1 is coverable by nobody -> unassigned.
const groups = [
  ['Morning Yoga', D1, '09:00', '10:30'],
  ['Lunch Spin', D1, '12:00', '13:00'],
  ['Afternoon Pilates', D1, '13:30', '15:00'],
  ['Night Owl Club', D1, '21:00', '22:30'],
  ['Tue Bootcamp', D2, '10:00', '11:30'],
  ['Tue Evening Dance', D2, '18:00', '19:30'],
  ['Wed Stretch', D3, '09:00', '10:00'],
];

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

const seed = transaction(() => {
  // Reset everything except employees.
  db.prepare('DELETE FROM work_hours').run();
  db.prepare('DELETE FROM assignments').run();
  db.prepare('DELETE FROM groups').run();
  db.prepare('DELETE FROM availability').run();

  const insAvail = db.prepare(
    'INSERT INTO availability (employee_id, date, start_time, end_time, is_on_call) VALUES (?,?,?,?,?)'
  );
  availability.forEach((a) => insAvail.run(...a));

  const insGroup = db.prepare(
    'INSERT INTO groups (name, date, start_time, end_time, duration_hours) VALUES (?,?,?,?,?)'
  );
  groups.forEach(([name, date, start, end]) => {
    const dur = (toMinutes(end) - toMinutes(start)) / 60;
    insGroup.run(name, date, start, end, dur);
  });
});

seed();

// Generate the schedule from the seeded data (same path the API uses).
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

// Add a couple of submitted work-hours so the work-history view isn't empty.
const insHours = db.prepare(
  'INSERT INTO work_hours (employee_id, group_id, date, hours) VALUES (?,?,?,?)'
);
// Give the first assignment of two employees a recorded actual-hours entry.
const assignedRows = db
  .prepare("SELECT * FROM assignments WHERE status = 'assigned' ORDER BY id")
  .all();
assignedRows.slice(0, 3).forEach((a) => {
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(a.group_id);
  if (g && a.employee_id) {
    insHours.run(a.employee_id, g.id, g.date, g.duration_hours);
  }
});

// Report.
const groupName = (id) => db.prepare('SELECT name FROM groups WHERE id = ?').get(id)?.name;
const empName = (id) =>
  id ? db.prepare('SELECT name FROM employees WHERE id = ?').get(id)?.name : '—';

console.log('\nDemo data seeded.\n');
console.log('Assignments:');
assignedRows.forEach((a) => {
  console.log(`  ${groupName(a.group_id)}  ->  ${empName(a.employee_id)}`);
});
const unassigned = db
  .prepare("SELECT group_id FROM assignments WHERE status = 'unassigned'")
  .all();
unassigned.forEach((u) => console.log(`  ${groupName(u.group_id)}  ->  UNASSIGNED`));
console.log(
  `\n${assignedRows.length} assigned, ${unassigned.length} unassigned, ` +
    `${availability.length} availability rows, ${groups.length} groups.\n`
);

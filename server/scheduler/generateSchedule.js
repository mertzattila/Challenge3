'use strict';

/**
 * TRIVIAL GREEDY STUB — Person A placeholder.
 *
 * Person B replaces this file with the real optimization-based scheduler
 * (normalized fairness + four-hour preference + local search). The signature
 * MUST stay the same so the /api/schedule/generate endpoint keeps working.
 *
 * generateSchedule({ employees, availability, groups }) -> { assignments, unassigned }
 *   employees:    [{ id, name }]
 *   availability: [{ id, employeeId, date, startTime, endTime, isOnCall }]
 *   groups:       [{ id, name, date, startTime, endTime, durationHours }]
 *   returns:
 *     assignments: [{ groupId, employeeId, status:'assigned', manuallyOverridden:false }]
 *     unassigned:  [groupId, ...]
 */

/** "HH:MM" -> minutes since midnight. */
function toMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Does interval [aStart,aEnd) contain [bStart,bEnd)? (same date assumed by caller) */
function covers(availStart, availEnd, groupStart, groupEnd) {
  return toMinutes(availStart) <= toMinutes(groupStart) && toMinutes(availEnd) >= toMinutes(groupEnd);
}

/** Do two [start,end) intervals overlap? */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

module.exports = function generateSchedule({ employees, availability, groups }) {
  const assignments = [];
  const unassigned = [];

  // Track what each employee is already hosting, per date, to enforce the
  // "no more than two overlapping groups at once" hard rule.
  const assignedByEmployee = new Map(); // employeeId -> [{date, startTime, endTime}]

  // Simple fairness tie-breaker: prefer the employee with the fewest assignments so far.
  const loadCount = new Map(); // employeeId -> number of groups
  employees.forEach((e) => {
    loadCount.set(e.id, 0);
    assignedByEmployee.set(e.id, []);
  });

  // Hardest-to-fill first: fewer candidate employees => assign earlier.
  const candidateCount = (g) =>
    employees.filter((e) =>
      availability.some(
        (a) =>
          a.employeeId === e.id &&
          a.date === g.date &&
          covers(a.startTime, a.endTime, g.startTime, g.endTime)
      )
    ).length;

  const ordered = [...groups].sort((a, b) => candidateCount(a) - candidateCount(b));

  for (const g of ordered) {
    const candidates = employees
      .filter((e) =>
        availability.some(
          (a) =>
            a.employeeId === e.id &&
            a.date === g.date &&
            covers(a.startTime, a.endTime, g.startTime, g.endTime)
        )
      )
      .filter((e) => {
        // No more than two overlapping groups at the same time.
        const current = assignedByEmployee.get(e.id).filter((x) => x.date === g.date);
        const overlapping = current.filter((x) =>
          overlaps(x.startTime, x.endTime, g.startTime, g.endTime)
        );
        return overlapping.length < 2;
      })
      .sort((a, b) => loadCount.get(a.id) - loadCount.get(b.id)); // fairness tie-break

    if (candidates.length === 0) {
      unassigned.push(g.id);
      continue;
    }

    const chosen = candidates[0];
    assignments.push({
      groupId: g.id,
      employeeId: chosen.id,
      status: 'assigned',
      manuallyOverridden: false,
    });
    loadCount.set(chosen.id, loadCount.get(chosen.id) + 1);
    assignedByEmployee.get(chosen.id).push({
      date: g.date,
      startTime: g.startTime,
      endTime: g.endTime,
    });
  }

  return { assignments, unassigned };
};

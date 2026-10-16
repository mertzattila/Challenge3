'use strict';

// Small shared validation helpers so every route produces consistent,
// human-readable error messages (UX requirement: quality of error feedback).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

function isValidDate(d) {
  return typeof d === 'string' && DATE_RE.test(d);
}

function isValidTime(t) {
  if (typeof t !== 'string' || !TIME_RE.test(t)) return false;
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function toMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Validate a time window. Returns an error string, or null if valid.
 */
function validateWindow(date, startTime, endTime) {
  if (!isValidDate(date)) return `date "${date}" must be in YYYY-MM-DD format`;
  if (!isValidTime(startTime)) return `startTime "${startTime}" must be HH:MM`;
  if (!isValidTime(endTime)) return `endTime "${endTime}" must be HH:MM`;
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    return 'endTime must be after startTime';
  }
  return null;
}

module.exports = { isValidDate, isValidTime, toMinutes, validateWindow };

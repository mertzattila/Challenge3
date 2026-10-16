/**
 * API layer — all fetch calls go through here.
 * During development without a backend, set VITE_USE_MOCK=true
 * or the calls will fall through to the real server via the Vite proxy.
 */

const BASE = '';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Employees
  getEmployees: () => request('GET', '/api/employees'),

  // Availability
  getMyAvailability: (employeeId) =>
    request('GET', `/api/availability?employeeId=${employeeId}`),
  getAllAvailability: () => request('GET', '/api/availability/all'),
  addAvailability: (data) => request('POST', '/api/availability', data),
  updateAvailability: (id, data) => request('PUT', `/api/availability/${id}`, data),
  deleteAvailability: (id) => request('DELETE', `/api/availability/${id}`),

  // Groups
  getGroups: () => request('GET', '/api/groups'),
  importGroups: (rows) => request('POST', '/api/groups/import', { rows }),

  // Schedule
  generateSchedule: () => request('POST', '/api/schedule/generate'),
  overrideAssignment: (id, employeeId) =>
    request('PUT', `/api/assignments/${id}`, { employeeId }),

  // Assignments
  getMyAssignments: (employeeId) =>
    request('GET', `/api/assignments/mine?employeeId=${employeeId}`),

  // Work hours
  submitHours: (data) => request('POST', '/api/work-hours', data),
  getMyHours: (employeeId) =>
    request('GET', `/api/work-hours/mine?employeeId=${employeeId}`),
  getAllHours: () => request('GET', '/api/work-hours/all'),
};

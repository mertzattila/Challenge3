import { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../useStore';

export default function EmployeeSchedule() {
  const { currentEmployee } = useStore();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getMyAssignments(currentEmployee.id)
      .then(setAssignments)
      .catch((ex) => setError(ex.message))
      .finally(() => setLoading(false));
  }, [currentEmployee.id]);

  if (loading) return <p>Loading schedule…</p>;

  return (
    <div>
      <h2>My Schedule</h2>
      <p className="hint">Groups assigned to you by the manager.</p>
      {error && <div className="alert alert-error">{error}</div>}
      {assignments.length === 0 ? (
        <p className="hint">No assignments yet.</p>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Date</th>
                <th>From</th>
                <th>Until</th>
                <th>Duration (h)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.groupId}>
                  <td>{a.name}</td>
                  <td>{a.date}</td>
                  <td>{a.startTime}</td>
                  <td>{a.endTime}</td>
                  <td>{a.durationHours}</td>
                  <td>
                    <span className={`badge ${a.manuallyOverridden ? 'badge-override' : 'badge-assigned'}`}>
                      {a.manuallyOverridden ? 'Manual' : 'Auto'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

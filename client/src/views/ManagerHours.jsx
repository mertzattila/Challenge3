import { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../useStore';

export default function ManagerHours() {
  const { employees } = useStore();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getAllHours()
      .then(setRecords)
      .catch((ex) => setError(ex.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading work hours…</p>;

  const empName = (id) => {
    const e = employees.find((x) => x.id === id);
    return e ? e.name : `Employee #${id}`;
  };

  // Group by employee for the stats
  const statsByEmp = employees.map((emp) => {
    const rows = records.filter((r) => r.employeeId === emp.id);
    const total = rows.reduce((s, r) => s + Number(r.hours), 0);
    return { ...emp, rows, total };
  });

  return (
    <div>
      <h2>Work Hours — All Employees</h2>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-row">
        {statsByEmp.map((emp) => (
          <div key={emp.id} className="stat-card">
            <div className="stat-name">{emp.name}</div>
            <div className="stat-value">{emp.total.toFixed(1)} h</div>
            <div className="stat-label">{emp.rows.length} submission(s)</div>
          </div>
        ))}
      </div>

      {records.length === 0 ? (
        <p className="hint">No work hours submitted yet.</p>
      ) : (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>All Submissions</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Group</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{empName(r.employeeId)}</td>
                  <td>{r.date}</td>
                  <td>{r.groupId ? `#${r.groupId}` : '—'}</td>
                  <td>{r.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

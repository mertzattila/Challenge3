import { useEffect, useState } from 'react';
import { api } from '../api';

export default function ManagerAvailability() {
  const [data, setData] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    api
      .getAllAvailability()
      .then(setData)
      .catch((ex) => setError(ex.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <p>Loading availability…</p>;

  const onCallToday = data.flatMap((emp) =>
    emp.availability.filter((a) => a.isOnCall).map((a) => ({ ...a, name: emp.name }))
  );

  return (
    <div>
      <h2>Employee Availability</h2>

      {error && <div className="alert alert-error">{error}</div>}

      {onCallToday.length > 0 && (
        <div className="card card-oncall">
          <h3>🟡 On-Call Employees</h3>
          <p className="hint">These employees have marked themselves available for last-minute assignments.</p>
          <div className="oncall-grid">
            {onCallToday.map((a) => (
              <div key={a.id} className="oncall-chip">
                <strong>{a.name}</strong>
                <span>{a.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <p className="hint">No availability data yet.</p>
      ) : (
        data.map((emp) => (
          <div key={emp.employeeId} className="card" style={{ marginTop: '1rem' }}>
            <h3>{emp.name}</h3>
            {emp.availability.length === 0 ? (
              <p className="hint">No availability entered.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>Until</th>
                    <th>On-call</th>
                  </tr>
                </thead>
                <tbody>
                  {emp.availability.map((a) => (
                    <tr key={a.id}>
                      <td>{a.date}</td>
                      <td>{a.startTime}</td>
                      <td>{a.endTime}</td>
                      <td>{a.isOnCall ? <span className="badge badge-oncall">On-call</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}
    </div>
  );
}

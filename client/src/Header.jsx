import { useStore } from './useStore';

export default function Header({ activeTab, setActiveTab }) {
  const { role, currentEmployee, logout } = useStore();

  const managerTabs = [
    { id: 'availability', label: '👥 Availability' },
    { id: 'import', label: '📥 Import Groups' },
    { id: 'schedule', label: '📋 Schedule' },
    { id: 'hours', label: '⏱ Work Hours' },
  ];

  const employeeTabs = [
    { id: 'my-availability', label: '🗓 My Availability' },
    { id: 'my-schedule', label: '📋 My Schedule' },
    { id: 'my-hours', label: '⏱ My Hours' },
  ];

  const tabs = role === 'manager' ? managerTabs : employeeTabs;

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-brand">
          <span className="brand-icon">📅</span>
          <span className="brand-name">SmartShift</span>
          <span className={`role-badge ${role === 'manager' ? 'badge-manager' : 'badge-employee'}`}>
            {role === 'manager' ? 'Manager' : currentEmployee?.name}
          </span>
        </div>
        <nav className="header-nav">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`nav-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button className="btn btn-ghost btn-sm" onClick={logout}>
          Switch Role
        </button>
      </div>
    </header>
  );
}

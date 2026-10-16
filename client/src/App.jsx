import { useState } from 'react';
import { StoreProvider, useStore } from './useStore';
import LoginScreen from './LoginScreen';
import Header from './Header';
import EmployeeAvailability from './views/EmployeeAvailability';
import EmployeeSchedule from './views/EmployeeSchedule';
import EmployeeHours from './views/EmployeeHours';
import ManagerAvailability from './views/ManagerAvailability';
import ManagerImport from './views/ManagerImport';
import ManagerSchedule from './views/ManagerSchedule';
import ManagerHours from './views/ManagerHours';

function AppInner() {
  const { role } = useStore();
  const [activeTab, setActiveTab] = useState(null);
  const [lastRole, setLastRole] = useState(null);

  // Reset tab when role changes
  if (role !== lastRole) {
    setLastRole(role);
    if (role === 'manager') setActiveTab('availability');
    else if (role === 'employee') setActiveTab('my-availability');
    else setActiveTab(null);
  }

  if (!role) return <LoginScreen />;

  function renderView() {
    if (role === 'manager') {
      switch (activeTab) {
        case 'availability': return <ManagerAvailability />;
        case 'import':       return <ManagerImport />;
        case 'schedule':     return <ManagerSchedule />;
        case 'hours':        return <ManagerHours />;
        default:             return <ManagerAvailability />;
      }
    }
    if (role === 'employee') {
      switch (activeTab) {
        case 'my-availability': return <EmployeeAvailability />;
        case 'my-schedule':     return <EmployeeSchedule />;
        case 'my-hours':        return <EmployeeHours />;
        default:                return <EmployeeAvailability />;
      }
    }
    return null;
  }

  return (
    <div className="app">
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => setActiveTab(tab)}
      />
      <main className="main-content">
        <div className="container">
          {renderView()}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}

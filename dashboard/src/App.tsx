import { useEffect, useState } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { api } from './api';

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { authenticated } = await api.checkAuth();
      setAuthenticated(authenticated);
    } catch {
      setAuthenticated(false);
    }
  };

  const handleLogin = () => {
    setAuthenticated(true);
  };

  const handleLogout = async () => {
    await api.logout();
    setAuthenticated(false);
  };

  if (authenticated === null) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#718096'
      }}>
        Lädt...
      </div>
    );
  }

  return authenticated ? (
    <Dashboard onLogout={handleLogout} />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

export default App;

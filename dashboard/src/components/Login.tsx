import { useState, FormEvent } from 'react';
import { api } from '../api';
import './Login.css';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.login(password);
      onLogin();
    } catch (err) {
      setError('Falsches Passwort');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🤖 ImmoBot</h1>
          <p>Dashboard Login</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort eingeben"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading || !password}>
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}

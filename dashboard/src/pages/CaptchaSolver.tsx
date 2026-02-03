import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CaptchaSolver.css';

interface CaptchaState {
  active: boolean;
  timestamp?: string;
  imageUrl?: string;
  resolved?: boolean;
}

export function CaptchaSolver() {
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null);
  const [solution, setSolution] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCaptcha();
    const interval = setInterval(fetchCaptcha, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchCaptcha = async () => {
    try {
      const response = await fetch('/api/dashboard/captcha/current', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch CAPTCHA');
      }

      const data = await response.json();
      setCaptcha(data);

      if (!data.active) {
        // No active CAPTCHA, redirect to dashboard after 3 seconds
        setTimeout(() => navigate('/'), 3000);
      }
    } catch (error) {
      console.error('Error fetching CAPTCHA:', error);
      setError('Fehler beim Laden des CAPTCHAs');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/dashboard/captcha/solve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ solution }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit solution');
      }

      setSuccess(true);
      setSolution('');

      // Redirect after 2 seconds
      setTimeout(() => navigate('/'), 2000);
    } catch (error) {
      console.error('Error submitting solution:', error);
      setError('Fehler beim Absenden der Lösung');
    } finally {
      setSubmitting(false);
    }
  };

  if (!captcha) {
    return (
      <div className="captcha-solver">
        <div className="captcha-loading">
          <div className="spinner"></div>
          <p>Lade CAPTCHA...</p>
        </div>
      </div>
    );
  }

  if (!captcha.active) {
    return (
      <div className="captcha-solver">
        <div className="captcha-none">
          <h2>✅ Kein aktives CAPTCHA</h2>
          <p>Der Bot läuft normal weiter.</p>
          <p className="redirect-info">Weiterleitung zum Dashboard...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="captcha-solver">
        <div className="captcha-success">
          <h2>✅ Lösung übermittelt!</h2>
          <p>Der Bot wird jetzt mit Ihrer Lösung fortfahren.</p>
          <p className="redirect-info">Weiterleitung zum Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="captcha-solver">
      <div className="captcha-header">
        <h1>🤖 CAPTCHA lösen</h1>
        <p className="captcha-timestamp">
          Erkannt: {captcha.timestamp ? new Date(captcha.timestamp).toLocaleString('de-DE') : 'Unbekannt'}
        </p>
      </div>

      <div className="captcha-content">
        {captcha.imageUrl && (
          <div className="captcha-image-container">
            <img
              src={captcha.imageUrl}
              alt="CAPTCHA"
              className="captcha-image"
            />
          </div>
        )}

        <div className="captcha-instructions">
          <h3>📝 Anleitung:</h3>
          <ol>
            <li>Schauen Sie sich das CAPTCHA-Bild oben an</li>
            <li>Identifizieren Sie die richtigen Felder (z.B. alle Ampeln, alle Busse, etc.)</li>
            <li>Geben Sie die Nummern der Felder ein, getrennt durch Kommas</li>
            <li>Beispiel: <code>1,3,5,7</code> für Felder 1, 3, 5 und 7</li>
          </ol>

          <div className="grid-reference">
            <h4>Felder-Nummerierung (3x3 Grid):</h4>
            <div className="grid-example">
              <div className="grid-cell">1</div>
              <div className="grid-cell">2</div>
              <div className="grid-cell">3</div>
              <div className="grid-cell">4</div>
              <div className="grid-cell">5</div>
              <div className="grid-cell">6</div>
              <div className="grid-cell">7</div>
              <div className="grid-cell">8</div>
              <div className="grid-cell">9</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="captcha-form">
          <label htmlFor="solution">Lösung (z.B. 1,3,5):</label>
          <input
            type="text"
            id="solution"
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder="z.B. 1,3,5,7"
            disabled={submitting}
            required
          />

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={submitting || !solution.trim()}>
            {submitting ? 'Übermittle...' : '✅ Lösung absenden'}
          </button>

          <button
            type="button"
            className="cancel-button"
            onClick={() => navigate('/')}
            disabled={submitting}
          >
            Zurück zum Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}

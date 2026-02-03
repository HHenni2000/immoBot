import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CaptchaAlert.css';

export function CaptchaAlert() {
  const [active, setActive] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkCaptcha();
    const interval = setInterval(checkCaptcha, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const checkCaptcha = async () => {
    try {
      const response = await fetch('/api/dashboard/captcha/current', {
        credentials: 'include',
      });

      if (!response.ok) return;

      const data = await response.json();
      setActive(data.active && !data.resolved);
    } catch (error) {
      console.error('Error checking CAPTCHA:', error);
    }
  };

  if (!active) return null;

  return (
    <div className="captcha-alert">
      <div className="captcha-alert-content">
        <span className="captcha-alert-icon">⚠️</span>
        <div className="captcha-alert-text">
          <strong>CAPTCHA wartet auf Lösung!</strong>
          <p>Der Bot ist pausiert. Bitte lösen Sie das CAPTCHA.</p>
        </div>
        <button
          className="captcha-alert-button"
          onClick={() => navigate('/captcha')}
        >
          CAPTCHA lösen →
        </button>
      </div>
    </div>
  );
}

import { Status } from '../types';
import './StatusHero.css';

interface StatusHeroProps {
  status: Status;
}

const statusEmoji = {
  active: '🟢',
  night: '🌙',
  paused: '⏸️',
  error: '🔴',
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `vor ${days} Tag${days === 1 ? '' : 'en'}`;
  if (hours > 0) return `vor ${hours} Stunde${hours === 1 ? '' : 'n'}`;
  if (minutes > 0) return `vor ${minutes} Minute${minutes === 1 ? '' : 'n'}`;
  return 'gerade eben';
};

export function StatusHero({ status }: StatusHeroProps) {
  return (
    <div className={`status-hero status-${status.status}`}>
      <div className="status-main">
        <span className="status-icon">{statusEmoji[status.status]}</span>
        <div className="status-text">
          <h2>{status.statusText}</h2>
          {status.lastActivity && (
            <p className="last-activity">
              Letzte Aktivität: {formatTimestamp(status.lastActivity.timestamp)} -{' '}
              {status.lastActivity.text}
            </p>
          )}
        </div>
      </div>
      
      {status.nightMode.enabled && (
        <div className="status-info">
          <small>
            🌙 Nachtmodus: {status.nightMode.startHour}:00 - {status.nightMode.endHour}:00 Uhr
            {' · '}
            ⏱️ Check-Intervall: ~{status.checkInterval} Min
          </small>
        </div>
      )}
    </div>
  );
}

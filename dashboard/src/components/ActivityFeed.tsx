import { useState } from 'react';
import { Activity } from '../types';
import { api } from '../api';
import './ActivityFeed.css';

interface ActivityFeedProps {
  activities: Activity[];
}

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

const activityEmoji = {
  found: '🔍',
  applied: '✅',
  error: '❌',
};

const activityText = {
  found: 'Neues Angebot gefunden',
  applied: 'Bewerbung versendet',
  error: 'Fehler bei Bewerbung',
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);

  const handleActivityClick = (activity: Activity) => {
    if (activity.pdfPath) {
      const filename = activity.pdfPath.split('/').pop() || '';
      setSelectedPdf(api.getFileUrl(filename));
    }
  };

  const closePdfModal = () => {
    setSelectedPdf(null);
  };

  return (
    <>
      <div className="activity-feed">
        <h2 className="feed-title">Letzte Aktivitäten</h2>
        <div className="activity-list">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`activity-item ${activity.pdfPath ? 'clickable' : ''}`}
              onClick={() => handleActivityClick(activity)}
            >
              <div className="activity-icon">{activityEmoji[activity.type]}</div>
              <div className="activity-content">
                <div className="activity-header">
                  <span className="activity-type">{activityText[activity.type]}</span>
                  <span className="activity-time">{formatTimestamp(activity.timestamp)}</span>
                </div>
                <div className="activity-details">
                  {activity.title && <strong className="activity-title">{activity.title}</strong>}
                  {activity.address && <div className="activity-address">{activity.address}</div>}
                  {(activity.size || activity.price || activity.rooms) && (
                    <div className="activity-meta">
                      {activity.size && <span>{activity.size}</span>}
                      {activity.size && activity.price && <span> · </span>}
                      {activity.price && <span>{activity.price}</span>}
                      {activity.rooms && <span> · {activity.rooms}</span>}
                    </div>
                  )}
                </div>
                {activity.errorMessage && (
                  <div className="activity-error">
                    <small>{activity.errorMessage}</small>
                  </div>
                )}
                {activity.pdfPath && (
                  <div className="activity-link">
                    <small>📄 Screenshot/PDF anzeigen</small>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedPdf && (
        <div className="pdf-modal" onClick={closePdfModal}>
          <div className="pdf-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="pdf-close" onClick={closePdfModal}>
              ✕
            </button>
            <iframe src={selectedPdf} title="Screenshot" />
          </div>
        </div>
      )}
    </>
  );
}

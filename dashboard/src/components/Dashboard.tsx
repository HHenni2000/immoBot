import { useEffect, useState } from 'react';
import { api } from '../api';
import { Stats, Status, Activity, Warning } from '../types';
import { StatusHero } from './StatusHero';
import { StatCard } from './StatCard';
import { ActivityFeed } from './ActivityFeed';
import { Warnings } from './Warnings';
import { CaptchaAlert } from './CaptchaAlert';
import './Dashboard.css';

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [statsData, statusData, activitiesData, warningsData] = await Promise.all([
        api.getStats(),
        api.getStatus(),
        api.getActivities(10),
        api.getWarnings(),
      ]);

      setStats(statsData);
      setStatus(statusData);
      setActivities(activitiesData);
      setWarnings(warningsData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    loadData();
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Lädt Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>🤖 ImmoBot Dashboard</h1>
          <div className="header-actions">
            <button onClick={handleRefresh} className="btn-refresh" title="Aktualisieren">
              🔄
            </button>
            <button onClick={onLogout} className="btn-logout">
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <CaptchaAlert />
        
        {status && <StatusHero status={status} />}

        {stats && (
          <div className="stats-grid">
            <StatCard
              title="Gesamt gefunden"
              value={stats.totalFound}
              subtitle="seit Bot-Start"
              icon="📊"
            />
            <StatCard
              title="Letzte 24h"
              value={stats.foundLast24h}
              subtitle="neue Angebote"
              icon="⏰"
            />
            <StatCard
              title="Ø pro Tag"
              value={stats.avgPerDay}
              subtitle="durchschnittlich"
              icon="📈"
            />
          </div>
        )}

        {warnings.length > 0 && <Warnings warnings={warnings} />}

        {activities.length > 0 && <ActivityFeed activities={activities} />}
      </main>

      <footer className="dashboard-footer">
        <p>ImmoBot © 2026 - Automatische Wohnungssuche</p>
      </footer>
    </div>
  );
}

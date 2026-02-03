import './StatCard.css';

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
}

export function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <h3>{title}</h3>
        <div className="stat-value">{value}</div>
        <p className="stat-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}

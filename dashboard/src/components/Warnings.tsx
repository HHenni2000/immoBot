import { Warning } from '../types';
import './Warnings.css';

interface WarningsProps {
  warnings: Warning[];
}

const warningEmoji = {
  error: '⚠️',
  captcha: '🤖',
  info: 'ℹ️',
};

const warningClass = {
  error: 'warning-error',
  captcha: 'warning-captcha',
  info: 'warning-info',
};

export function Warnings({ warnings }: WarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="warnings-container">
      {warnings.map((warning, index) => (
        <div key={index} className={`warning-item ${warningClass[warning.type]}`}>
          <span className="warning-icon">{warningEmoji[warning.type]}</span>
          <span className="warning-message">{warning.message}</span>
        </div>
      ))}
    </div>
  );
}

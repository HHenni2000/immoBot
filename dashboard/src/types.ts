export interface Stats {
  totalFound: number;
  foundLast24h: number;
  avgPerDay: number;
}

export interface Status {
  status: 'active' | 'night' | 'paused' | 'error';
  statusText: string;
  lastActivity: {
    timestamp: string;
    text: string;
  } | null;
  nextCheckIn?: number | null; // Minuten bis zum nächsten Check
  nightMode: {
    enabled: boolean;
    startHour: number;
    endHour: number;
    isActive: boolean;
  };
  checkInterval: number;
}

export interface Activity {
  id: string;
  timestamp: string;
  type: 'found' | 'applied' | 'error';
  title: string;
  address: string;
  price: string;
  size: string;
  rooms?: string;
  url: string;
  pdfPath?: string;
  errorMessage?: string;
}

export interface Warning {
  type: 'error' | 'captcha' | 'info';
  message: string;
  timestamp: string;
}

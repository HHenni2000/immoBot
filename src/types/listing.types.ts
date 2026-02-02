export interface Listing {
  id: string;
  title: string;
  address: string;
  price: string;
  size: string;
  rooms?: string;
  url: string;
  imageUrl?: string;
  firstSeen: Date;
  appliedAt?: Date;
  pdfPath?: string;
  status: ListingStatus;
  errorMessage?: string;
}

export type ListingStatus = 'new' | 'applied' | 'error' | 'skipped';

export interface ListingFromPage {
  id: string;
  title: string;
  address: string;
  price: string;
  size: string;
  rooms?: string;
  url: string;
  imageUrl?: string;
}

export interface CheckLog {
  id?: number;
  checkedAt: Date;
  listingsFound: number;
  newListings: number;
  success: boolean;
  errorMessage?: string;
}

export interface ApplicationResult {
  success: boolean;
  listingId: string;
  pdfPath?: string;
  errorMessage?: string;
}

export interface BotConfig {
  is24Email: string;
  is24Password: string;
  is24SearchUrl: string;
  emailHost: string;
  emailPort: number;
  emailUser: string;
  emailPassword: string;
  emailTo: string;
  baseIntervalMinutes: number;
  randomOffsetPercent: number;
  nightModeEnabled: boolean;
  nightStartHour: number;
  nightEndHour: number;
  messageGreeting: string;
  messageCustom: string;
  headless: boolean;
  skipWarmup: boolean;
  captchaPauseMinutes: number;
  dataDir: string;
  logsDir: string;
}

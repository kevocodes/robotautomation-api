export interface DeiBookingAuthResponse {
  links?: Array<{ href: string; title?: string }>;
  message?: string | null;
  sessionToken?: string;
  sessionExpires?: string;
  userId?: string;
  isAuthenticated?: boolean;
  version?: string;
}

export interface DeiBookingSession {
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface CachedDeiBookingSession {
  token: string;
  userId: string;
  expiresAtIso: string;
}

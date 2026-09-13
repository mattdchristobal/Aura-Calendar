export type Role = 'admin' | 'member' | 'viewer';

export type CalendarProvider =
  | 'microsoft'
  | 'exchange'
  | 'google'
  | 'apple'
  | 'caldav'
  | 'webcal'
  | 'yahoo'
  | 'custom_ics'
  | 'zapier';

export interface ZapierLogEntry {
  id: string;
  timestamp: string;
  type: 'inbound' | 'outbound' | 'test';
  status: 'success' | 'error';
  eventTitle: string;
  details: string;
  payloadSnippet?: string;
}

export interface ZapierConfig {
  apiKey: string;
  catchHookUrl?: string;
  enabled: boolean;
  syncDirection: 'two-way' | 'inbound-only' | 'outbound-only';
  defaultCategoryId: string;
  outlookAccountEmail?: string;
  lastSyncedAt?: string;
  syncedEventsCount?: number;
  logs: ZapierLogEntry[];
}

export interface ConnectedAccount {
  id: string;
  provider: CalendarProvider;
  email: string;
  name: string;
  calendarName?: string;
  serverUrl?: string;
  username?: string;
  password?: string;
  icsUrl?: string;
  zapierWebhookUrl?: string;
  zapierCatchHookUrl?: string;
  zapierApiKey?: string;
  autoSync: boolean;
  syncDirection: 'two-way' | 'import-only' | 'export-only';
  syncIntervalMinutes?: number;
  status?: 'connected' | 'syncing' | 'error' | 'paused';
  lastSyncedAt?: string;
  syncedEventCount?: number;
  color?: string;
  categoryId?: string;
  calendars?: Array<{ id: string; name: string; color?: string; visible: boolean }>;
  createdAt: string;
  errorMessage?: string;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string;
  createdAt: string;
  active: boolean;
  createdByAdmin?: string;
  connectedAccounts?: ConnectedAccount[];
}

export interface Category {
  id: string;
  name: string;
  color: string; // Tailwind color key e.g. 'blue'
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  badgeClass: string;
  description?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm (24h)
  endTime: string; // HH:mm (24h)
  categoryId: string;
  tags?: string[]; // Event tags e.g. ["Urgent", "Meeting", "Catechesis"]
  tema?: string; // e.g. "Tema 1", "Tema 2", "Tema 3" or custom admin temas
  temas?: string[]; // Multiple assigned temas e.g. ["Tema 1", "Tema 2"]
  userId: string; // Owner user ID
  createdBy: string; // Username/Name
  isAllDay?: boolean;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  priority?: 'low' | 'medium' | 'high';
  attendees?: string[];
  reminders?: number[]; // Minutes before
  notes?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  source?: 'local' | 'external';
  sourceAccountId?: string;
  sourceAccountEmail?: string;
  externalEventId?: string;
  customizedByAdmin?: boolean;
  adminEditedAt?: string;
  adminEditedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ViewType = 'year' | 'month' | 'week' | 'sunday' | 'day' | 'anuncios';

export interface AnnouncementFlyer {
  id: string;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  dateDayOfWeek: string;  // e.g. "SATURDAY,"
  dateMonthDay: string;   // e.g. "AUGUST 24th"
  timeText: string;        // e.g. "9:00 PM"
  locationText?: string;
  highlightsTitle: string;
  highlights: string[];
  
  // Custom Logo & Image
  logoUrl?: string;        // Base64 data URL or external URL
  logoText: string;        // e.g. "EVENT LOGO"
  showLogo?: boolean;
  pictureUrl?: string;     // Base64 data URL or image URL
  showPicture?: boolean;

  // Contact info
  phone?: string;
  email?: string;
  website?: string;
  address?: string;

  // Theme & Appearance
  theme: 'purple-diamond' | 'indigo-night' | 'emerald-gold' | 'crimson-ruby' | 'ocean-blue';
  accentColor?: string;
  showQrOnFlyer?: boolean;

  createdAt: string;
  updatedAt: string;
  linkedEventId?: string;
}

export interface SharedCalendar {
  id: string;
  code: string; // unique access code (case-insensitive e.g. "TEAM-2026", "VIP-PASS")
  title: string; // e.g. "Marketing Team Calendar", "Q3 Board Briefings"
  description?: string;
  targetGroup?: string; // e.g. "Marketing Department", "Public Group", "External Clients"
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  isActive: boolean;
  filterCategories?: string[]; // category IDs included; if empty or undefined, includes all categories
  filterTema?: string; // specific tema or "all"
  allowGuestsToExport?: boolean; // allow iCal/print export for guests
  expiresAt?: string; // optional ISO expiration string
  viewCount?: number;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: 'indigo' | 'emerald' | 'violet' | 'amber' | 'cyan';
  density: 'compact' | 'comfortable' | 'spacious';
  firstDayOfWeek: 0 | 1; // 0 for Sunday, 1 for Monday
  temas?: string[]; // Admin managed list of temas (default: ['Tema 1', 'Tema 2', 'Tema 3'])
  publicBaseUrl?: string; // Optional custom public domain or Cloud Run deployment URL for QR codes
  notifications: {
    email: boolean;
    desktop: boolean;
    sound: boolean;
    leadTimeMinutes: number;
  };
  sync: {
    autoSync: boolean;
    intervalMinutes: number;
    lastSyncedAt?: string;
    defaultExportFormat: 'ical' | 'json';
    outlookIcsUrl?: string;
    outlookCalendarName?: string;
    outlookAutoSync?: boolean;
    outlookLastSyncedAt?: string;
    outlookSyncedCount?: number;
    outlookDefaultCategoryId?: string;
    unlinkOutlook?: boolean;
  };
}

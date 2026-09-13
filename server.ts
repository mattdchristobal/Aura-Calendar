import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import QRCode from "qrcode";
import { parseIcsContent, normalizeIcsUrl } from "./src/utils/icsParser";
import defaultOutlookConfig from "./src/data/outlook-config.json";
import { SEED_EVENTS } from "./src/data/seedEvents";

interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  avatarColor: string;
  createdAt: string;
  active: boolean;
  createdByAdmin?: string;
  connectedAccounts?: ConnectedAccount[];
}

interface ConnectedAccount {
  id: string;
  provider: 'google' | 'apple' | 'custom';
  email: string;
  name: string;
  autoSync: boolean;
  syncDirection: 'two-way' | 'one-way-import' | 'one-way-export';
  lastSyncedAt?: string;
  createdAt: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  categoryId: string;
  tags?: string[];
  tema?: string;
  temas?: string[];
  userId: string;
  createdBy: string;
  isAllDay?: boolean;
  priority?: 'low' | 'medium' | 'high';
  attendees?: string[];
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  reminders?: number[];
  notes?: string;
  source?: string;
  sourceAccountId?: string;
  sourceAccountEmail?: string;
  externalEventId?: string;
  customizedByAdmin?: boolean;
  adminEditedAt?: string;
  adminEditedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  density: 'compact' | 'comfortable' | 'spacious';
  firstDayOfWeek: number;
  temas?: string[];
  notifications: {
    email: boolean;
    desktop: boolean;
    sound: boolean;
    leadTimeMinutes: number;
  };
  sync: {
    autoSync: boolean;
    intervalMinutes: number;
    lastSyncedAt: string;
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

interface Category {
  id: string;
  name: string;
  color: string;
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  badgeClass: string;
}

interface SharedCalendar {
  id: string;
  code: string;
  title: string;
  description?: string;
  targetGroup?: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  isActive: boolean;
  filterCategories?: string[];
  filterTema?: string;
  allowGuestsToExport?: boolean;
  expiresAt?: string;
  viewCount?: number;
}

interface ZapierLogEntry {
  id: string;
  timestamp: string;
  type: 'inbound' | 'outbound' | 'test';
  status: 'success' | 'error';
  eventTitle: string;
  details: string;
  payloadSnippet?: string;
}

interface ZapierConfig {
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

interface AnnouncementFlyer {
  id: string;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  dateDayOfWeek: string;
  dateMonthDay: string;
  timeText: string;
  locationText?: string;
  highlightsTitle: string;
  highlights: string[];
  logoUrl?: string;
  logoText: string;
  showLogo?: boolean;
  pictureUrl?: string;
  showPicture?: boolean;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  theme: 'purple-diamond' | 'indigo-night' | 'emerald-gold' | 'crimson-ruby' | 'ocean-blue';
  accentColor?: string;
  showQrOnFlyer?: boolean;
  createdAt: string;
  updatedAt: string;
  linkedEventId?: string;
}

const DEFAULT_SERVER_ANNOUNCEMENT: AnnouncementFlyer = {
  id: 'announcement-default-1',
  title: 'EVENT TITLE',
  eyebrow: "DON'T MISS OUT!",
  subtitle: 'Family-Friendly Event',
  dateDayOfWeek: 'SATURDAY,',
  dateMonthDay: 'AUGUST 24th',
  timeText: '9:00 PM',
  locationText: 'Main Community Center, Hall A',
  highlightsTitle: 'HIGHLIGHTS OF THE EVENT:',
  highlights: [
    'Highlight 1, e.g., Live Music by XYZ Band',
    'Highlight 2, e.g., Interactive Workshops',
    'Highlight 3, e.g., Delicious Food & Drinks',
    'And much more!'
  ],
  logoText: 'EVENT LOGO',
  showLogo: true,
  pictureUrl: '',
  showPicture: false,
  phone: '123-456-789',
  email: 'info@email.com',
  website: 'www.websitename.com',
  address: 'Lorem ipsum St, City State, Zip Code, 12345',
  theme: 'purple-diamond',
  showQrOnFlyer: false,
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: new Date().toISOString()
};

const DEFAULT_ANNOUNCEMENT: AnnouncementFlyer = DEFAULT_SERVER_ANNOUNCEMENT;

interface DatabaseSchema {
  users: User[];
  events: CalendarEvent[];
  settings: UserSettings;
  categories: Category[];
  shares?: SharedCalendar[];
  zapier?: ZapierConfig;
  announcements?: AnnouncementFlyer[];
  deletedEventIds?: string[];
  deletedCategoryIds?: string[];
  deletedUserIds?: string[];
}

const SEED_CATEGORIES: Category[] = [
  {
    id: 'work',
    name: 'Work & Projects',
    color: 'blue',
    hex: '#3B82F6',
    bgClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-l-4 border-l-blue-500',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20'
  },
  {
    id: 'urgent',
    name: 'Urgent & Deadlines',
    color: 'rose',
    hex: '#F43F5E',
    bgClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    textClass: 'text-rose-700 dark:text-rose-300',
    borderClass: 'border-l-4 border-l-rose-500',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20'
  },
  {
    id: 'personal',
    name: 'Personal Life',
    color: 'emerald',
    hex: '#10B981',
    bgClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-l-4 border-l-emerald-500',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20'
  },
  {
    id: 'team',
    name: 'Team & Meetings',
    color: 'violet',
    hex: '#8B5CF6',
    bgClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/50',
    textClass: 'text-violet-700 dark:text-violet-300',
    borderClass: 'border-l-4 border-l-violet-500',
    dotClass: 'bg-violet-500',
    badgeClass: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20'
  },
  {
    id: 'health',
    name: 'Health & Wellbeing',
    color: 'amber',
    hex: '#F59E0B',
    bgClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-l-4 border-l-amber-500',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20'
  },
  {
    id: 'client',
    name: 'Client Strategy',
    color: 'cyan',
    hex: '#06B6D4',
    bgClass: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50',
    textClass: 'text-cyan-700 dark:text-cyan-300',
    borderClass: 'border-l-4 border-l-cyan-500',
    dotClass: 'bg-cyan-500',
    badgeClass: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/20'
  },
  {
    id: 'social',
    name: 'Family & Social',
    color: 'fuchsia',
    hex: '#D946EF',
    bgClass: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/50',
    textClass: 'text-fuchsia-700 dark:text-fuchsia-300',
    borderClass: 'border-l-4 border-l-fuchsia-500',
    dotClass: 'bg-fuchsia-500',
    badgeClass: 'bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/20'
  }
];

// Initial seed data - start with empty users so all users register fresh
const SEED_USERS: User[] = [];

const SEED_SETTINGS: UserSettings = {
  theme: 'light',
  accentColor: 'indigo',
  density: 'comfortable',
  firstDayOfWeek: 0,
  temas: ['Tema 1', 'Tema 2', 'Tema 3'],
  notifications: {
    email: true,
    desktop: true,
    sound: true,
    leadTimeMinutes: 15
  },
  sync: {
    autoSync: true,
    intervalMinutes: 10,
    lastSyncedAt: new Date().toISOString(),
    defaultExportFormat: 'ical'
  }
};

// Data persistence management
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');

// Dedicated Outlook ICS persistent storage (immune to republish / container restarts)
const OUTLOOK_CONFIG_FILE = path.join(DATA_DIR, 'outlook-config.json');
const SRC_DATA_DIR = path.join(process.cwd(), 'src', 'data');
const SRC_OUTLOOK_CONFIG_FILE = path.join(SRC_DATA_DIR, 'outlook-config.json');
const ROOT_OUTLOOK_CONFIG_FILE = path.join(process.cwd(), 'outlook-config.json');

interface PersistentOutlookStore {
  outlookIcsUrl: string;
  outlookCalendarName?: string;
  outlookDefaultCategoryId?: string;
  outlookAutoSync?: boolean;
  outlookLastSyncedAt?: string;
  outlookSyncedCount?: number;
  unlinked?: boolean;
  updatedAt?: string;
}

function loadPersistentOutlookConfig(): PersistentOutlookStore | null {
  const possiblePaths = [
    OUTLOOK_CONFIG_FILE,
    SRC_OUTLOOK_CONFIG_FILE,
    ROOT_OUTLOOK_CONFIG_FILE
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        if (raw && raw.trim()) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.unlinked === true) {
            return { outlookIcsUrl: '', unlinked: true };
          }
          if (parsed && typeof parsed.outlookIcsUrl === 'string' && parsed.outlookIcsUrl.trim()) {
            return parsed;
          }
        }
      }
    } catch (e) {}
  }

  // Fallback to bundled configuration if not explicitly unlinked
  if (defaultOutlookConfig && !(defaultOutlookConfig as any).unlinked && (defaultOutlookConfig as any).outlookIcsUrl) {
    return defaultOutlookConfig as PersistentOutlookStore;
  }
  return null;
}

function savePersistentOutlookConfig(cfg: PersistentOutlookStore) {
  try {
    if (!cfg || !cfg.outlookIcsUrl || !cfg.outlookIcsUrl.trim()) return;
    const payload = JSON.stringify({ ...cfg, unlinked: false, updatedAt: new Date().toISOString() }, null, 2);

    // 1. Save to data/
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(OUTLOOK_CONFIG_FILE, payload, 'utf-8');

    // 2. Save to src/data/ (bundled with repo/build assets)
    if (!fs.existsSync(SRC_DATA_DIR)) {
      fs.mkdirSync(SRC_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SRC_OUTLOOK_CONFIG_FILE, payload, 'utf-8');

    // 3. Save to root directory
    fs.writeFileSync(ROOT_OUTLOOK_CONFIG_FILE, payload, 'utf-8');
  } catch (err) {
    console.error("[Outlook Persistent Config] Error saving configuration:", err);
  }
}

function deletePersistentOutlookConfig() {
  const tombstone = JSON.stringify({
    unlinked: true,
    outlookIcsUrl: '',
    updatedAt: new Date().toISOString()
  }, null, 2);

  const possiblePaths = [
    OUTLOOK_CONFIG_FILE,
    SRC_OUTLOOK_CONFIG_FILE,
    ROOT_OUTLOOK_CONFIG_FILE
  ];
  for (const p of possiblePaths) {
    try {
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, tombstone, 'utf-8');
    } catch (e) {}
  }
}

function normalizeEventTitle(t?: string): string {
  return (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deduplicateServerEvents(eventsList: CalendarEvent[], deletedSet?: Set<string>): CalendarEvent[] {
  if (!Array.isArray(eventsList)) return [];
  const resultMap = new Map<string, CalendarEvent>();
  const extKeyMap = new Map<string, string>();

  for (const rawEvt of eventsList) {
    if (!rawEvt || !rawEvt.id) continue;
    if (deletedSet && deletedSet.has(rawEvt.id)) continue;
    if (rawEvt.externalEventId && deletedSet && deletedSet.has(rawEvt.externalEventId)) continue;
    if (['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5', 'evt-6', 'evt-7', 'evt-8', 'evt-9', 'evt-10'].includes(rawEvt.id)) continue;

    const isExternal = rawEvt.source === 'external' || rawEvt.sourceAccountId === 'outlook-ics';
    const extKey = isExternal && rawEvt.externalEventId ? `${rawEvt.externalEventId}|${rawEvt.startDate || ''}` : '';

    let targetKey = resultMap.has(rawEvt.id) ? rawEvt.id : '';
    // Only resolve external duplicate events if they are external imports with identical externalEventId + date
    if (!targetKey && extKey && extKeyMap.has(extKey)) {
      targetKey = extKeyMap.get(extKey)!;
    }

    if (targetKey && resultMap.has(targetKey)) {
      const existing = resultMap.get(targetKey)!;
      const rawTime = rawEvt.updatedAt ? new Date(rawEvt.updatedAt).getTime() : 0;
      const existTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const isRawNewer = rawTime >= existTime;

      let merged: CalendarEvent;
      if (rawEvt.customizedByAdmin && !existing.customizedByAdmin) {
        merged = { ...existing, ...rawEvt, id: existing.id, updatedAt: rawEvt.updatedAt || new Date().toISOString() };
      } else if (!rawEvt.customizedByAdmin && existing.customizedByAdmin && isExternal) {
        // Retain admin customizations over uncustomized external ICS re-syncs
        merged = {
          ...rawEvt,
          ...existing,
          id: existing.id,
          categoryId: existing.categoryId,
          tags: existing.tags,
          temas: existing.temas,
          tema: existing.tema,
          title: existing.title,
          notes: existing.notes,
          priority: existing.priority,
          customizedByAdmin: true,
          adminEditedAt: existing.adminEditedAt,
          adminEditedBy: existing.adminEditedBy
        };
      } else if (isRawNewer) {
        // Raw incoming event is newer: its fields take precedence
        merged = {
          ...existing,
          ...rawEvt,
          id: existing.id,
          updatedAt: rawEvt.updatedAt || existing.updatedAt || new Date().toISOString()
        };
      } else {
        // Existing event is newer
        merged = {
          ...rawEvt,
          ...existing,
          id: existing.id
        };
      }
      resultMap.set(targetKey, merged);
    } else {
      resultMap.set(rawEvt.id, rawEvt);
      if (extKey) extKeyMap.set(extKey, rawEvt.id);
    }
  }

  return Array.from(resultMap.values());
}

function isOutlookEvent(e: Partial<CalendarEvent> | null | undefined): boolean {
  if (!e) return false;
  if (e.sourceAccountId === 'outlook-ics') return true;
  if (e.source === 'outlook') return true;
  if (typeof e.id === 'string' && (e.id.startsWith('ext-ics-') || e.id.startsWith('outlook-'))) return true;
  if (typeof e.notes === 'string' && e.notes.includes('Outlook Shared Calendar')) return true;
  return false;
}

function initDb(): DatabaseSchema {
  let loadedDb: Partial<DatabaseSchema> | null = null;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Try reading primary DB file
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      if (raw.trim()) {
        try {
          loadedDb = JSON.parse(raw);
        } catch (e) {
          console.error("Corrupted DB_FILE, attempting backup recovery:", e);
        }
      }
    }

    // If primary failed or empty, fallback to backup file if available
    if ((!loadedDb || !loadedDb.users) && fs.existsSync(DB_BACKUP_FILE)) {
      const rawBackup = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
      if (rawBackup.trim()) {
        try {
          loadedDb = JSON.parse(rawBackup);
        } catch (e) {
          console.error("Corrupted DB_BACKUP_FILE:", e);
        }
      }
    }
  } catch (err) {
    console.error("Error reading database file, attempting recovery:", err);
  }

  if (loadedDb && Array.isArray(loadedDb.users)) {
    // 1a. Preserve deleted user accounts
    const finalDeletedUserIds: string[] = Array.isArray(loadedDb.deletedUserIds)
      ? loadedDb.deletedUserIds.filter((id): id is string => typeof id === 'string')
      : [];
    const finalDeletedUserSet = new Set(finalDeletedUserIds);

    // 1b. Preserve registered accounts, filtering out deleted accounts and legacy seed accounts
    const userMap = new Map<string, User>();
    for (const u of loadedDb.users) {
      if (
        u &&
        u.id &&
        !finalDeletedUserSet.has(u.id) &&
        !['u_marcus', 'u_john', 'u_sarah', 'u_admin', 'u_admin_default'].includes(u.id) &&
        !['admin@executivetech.com'].includes((u.email || '').toLowerCase()) &&
        !(u.email || '').toLowerCase().includes('@outlook.com')
      ) {
        userMap.set(u.id, u);
      }
    }

    const finalUsers: User[] = Array.from(userMap.values());

    // 2a. User settings & Outlook ICS Link determination
    const loadedTemas = Array.isArray(loadedDb.settings?.temas) && loadedDb.settings.temas.length > 0
      ? loadedDb.settings.temas
      : ['Tema 1', 'Tema 2', 'Tema 3'];

    const loadedSync = (loadedDb.settings?.sync || {}) as Partial<UserSettings['sync']>;
    const persistentOutlook = loadPersistentOutlookConfig();

    // Check if explicitly unlinked or no ICS link provided
    const isExplicitlyUnlinked = loadedSync.unlinkOutlook === true || persistentOutlook?.unlinked === true;

    // Resolve Outlook ICS Link: prioritize existing DB setting, fall back to persistent config vault if not unlinked
    let resolvedOutlookUrl = '';
    if (!isExplicitlyUnlinked) {
      resolvedOutlookUrl = (
        (loadedSync.outlookIcsUrl && loadedSync.outlookIcsUrl.trim()) ||
        (persistentOutlook?.outlookIcsUrl && persistentOutlook.outlookIcsUrl.trim()) ||
        ''
      );
    }
    const hasActiveOutlookIcs = Boolean(resolvedOutlookUrl && !isExplicitlyUnlinked);

    const resolvedCalName = isExplicitlyUnlinked
      ? ''
      : (loadedSync.outlookCalendarName || persistentOutlook?.outlookCalendarName || 'Outlook Shared Calendar');

    const resolvedCategoryId = (
      loadedSync.outlookDefaultCategoryId ||
      persistentOutlook?.outlookDefaultCategoryId ||
      'client'
    );

    const resolvedAutoSync = (
      loadedSync.outlookAutoSync ??
      persistentOutlook?.outlookAutoSync ??
      true
    );

    const finalSettings: UserSettings = {
      ...SEED_SETTINGS,
      ...(loadedDb.settings || {}),
      temas: loadedTemas,
      sync: {
        ...SEED_SETTINGS.sync,
        ...loadedSync,
        unlinkOutlook: isExplicitlyUnlinked,
        outlookIcsUrl: resolvedOutlookUrl,
        outlookCalendarName: resolvedCalName,
        outlookDefaultCategoryId: resolvedCategoryId,
        outlookAutoSync: resolvedAutoSync,
        outlookLastSyncedAt: isExplicitlyUnlinked ? undefined : (loadedSync.outlookLastSyncedAt || persistentOutlook?.outlookLastSyncedAt),
        outlookSyncedCount: isExplicitlyUnlinked ? 0 : (loadedSync.outlookSyncedCount ?? persistentOutlook?.outlookSyncedCount)
      },
      notifications: {
        ...SEED_SETTINGS.notifications,
        ...(loadedDb.settings?.notifications || {})
      }
    };

    // 2b. Preserve deleted categories (active categories are never deleted)
    const activeLoadedCatIds = new Set((loadedDb.categories || []).map((c: any) => c?.id).filter(Boolean));
    const finalDeletedCategoryIds: string[] = Array.isArray(loadedDb.deletedCategoryIds)
      ? loadedDb.deletedCategoryIds.filter((id): id is string => typeof id === 'string' && !activeLoadedCatIds.has(id))
      : [];
    const finalDeletedCategorySet = new Set(finalDeletedCategoryIds);

    // 3. Preserve categories or seed defaults
    const finalCategories: Category[] = Array.isArray(loadedDb.categories) && loadedDb.categories.length > 0
      ? loadedDb.categories.filter(c => c && c.id)
      : SEED_CATEGORIES.filter(c => !finalDeletedCategorySet.has(c.id));

    const primaryCatId = (finalCategories[0] && finalCategories[0].id) || 'new';
    const activeCatIds = new Set(finalCategories.map(c => c.id));

    // 4. Preserve user events, filtering out legacy demo events, deleted events, and Outlook events if no active ICS link
    const rawEvents: CalendarEvent[] = Array.isArray(loadedDb.events)
      ? loadedDb.events.filter(e => {
          if (!e || !e.id) return false;
          if (['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5', 'evt-6', 'evt-7', 'evt-8', 'evt-9', 'evt-10'].includes(e.id)) return false;
          // STRICT RULE: Do not keep any Outlook events if no ICS link is configured
          if (!hasActiveOutlookIcs && isOutlookEvent(e)) return false;
          return true;
        })
      : [];
    const seedEventIds = new Set((Array.isArray(SEED_EVENTS) ? SEED_EVENTS : []).map(e => e.id));
    const seedExternalIds = new Set((Array.isArray(SEED_EVENTS) ? SEED_EVENTS : []).map(e => e.externalEventId).filter(Boolean));
    const activeEventIds = new Set(rawEvents.map(e => e.id));
    const activeExternalIds = new Set(rawEvents.map(e => e.externalEventId).filter(Boolean));

    const finalDeletedIds: string[] = Array.isArray(loadedDb.deletedEventIds)
      ? loadedDb.deletedEventIds.filter((id): id is string => 
          typeof id === 'string' && 
          !id.startsWith('del_sig_') && 
          !activeEventIds.has(id) && 
          !activeExternalIds.has(id) && 
          !seedEventIds.has(id) && 
          !seedExternalIds.has(id)
        )
      : [];
    const finalDeletedSet = new Set(finalDeletedIds);

    // Only merge SEED_EVENTS if an active Outlook ICS link is present or if they are non-Outlook events
    let allMergedEvents: CalendarEvent[] = [...rawEvents];
    if (hasActiveOutlookIcs && Array.isArray(SEED_EVENTS) && SEED_EVENTS.length > 0) {
      const existingIds = new Set(rawEvents.map(e => e.id));
      const existingExternalIds = new Set(rawEvents.map(e => e.externalEventId).filter(Boolean));
      
      const seedToAdd = SEED_EVENTS.filter(e => {
        if (!e || !e.id) return false;
        if (existingIds.has(e.id)) return false;
        if (e.externalEventId && existingExternalIds.has(e.externalEventId)) return false;
        return true;
      });
      allMergedEvents.push(...seedToAdd);
    }

    // Map any event with deleted category (e.g. legacy 'client') or unknown category to primary active category
    allMergedEvents = allMergedEvents.map(e => {
      const isMissingOrDeletedCat = !e.categoryId || e.categoryId === 'client' || !activeCatIds.has(e.categoryId);
      if (isMissingOrDeletedCat) {
        return { ...e, categoryId: primaryCatId };
      }
      return e;
    });

    let finalEvents: CalendarEvent[] = deduplicateServerEvents(allMergedEvents, finalDeletedSet);
    if (!hasActiveOutlookIcs) {
      finalEvents = finalEvents.filter(e => !isOutlookEvent(e));
    }

    if (resolvedOutlookUrl && !isExplicitlyUnlinked) {
      savePersistentOutlookConfig({
        outlookIcsUrl: resolvedOutlookUrl,
        outlookCalendarName: resolvedCalName,
        outlookDefaultCategoryId: resolvedCategoryId,
        outlookAutoSync: resolvedAutoSync,
        outlookLastSyncedAt: finalSettings.sync.outlookLastSyncedAt,
        outlookSyncedCount: finalSettings.sync.outlookSyncedCount
      });
    }

    // 5. Preserve shares
    const finalShares: SharedCalendar[] = Array.isArray(loadedDb.shares)
      ? loadedDb.shares
      : [];

    // 6. Preserve or initialize Zapier Microsoft Outlook sync configuration
    const defaultZapier: ZapierConfig = {
      apiKey: `zap_${crypto.randomBytes(8).toString('hex')}`,
      catchHookUrl: '',
      enabled: true,
      syncDirection: 'two-way',
      defaultCategoryId: 'work',
      outlookAccountEmail: 'outlook-calendar@zapier.sync',
      lastSyncedAt: new Date().toISOString(),
      syncedEventsCount: 0,
      logs: []
    };

    const finalZapier: ZapierConfig = {
      ...defaultZapier,
      ...(loadedDb.zapier || {}),
      logs: Array.isArray(loadedDb.zapier?.logs) ? loadedDb.zapier.logs : []
    };

    const finalAnnouncements: AnnouncementFlyer[] = Array.isArray(loadedDb.announcements) && loadedDb.announcements.length > 0
      ? loadedDb.announcements
      : [DEFAULT_ANNOUNCEMENT];

    const finalDb: DatabaseSchema = {
      users: finalUsers,
      events: finalEvents,
      settings: finalSettings,
      categories: finalCategories,
      shares: finalShares,
      zapier: finalZapier,
      announcements: finalAnnouncements,
      deletedEventIds: finalDeletedIds,
      deletedCategoryIds: finalDeletedCategoryIds,
      deletedUserIds: finalDeletedUserIds
    };

    saveDb(finalDb);
    return finalDb;
  }

  // Fresh initial database if no prior database exists
  const persistentOutlook = loadPersistentOutlookConfig();
  const seedSync = { ...SEED_SETTINGS.sync };
  if (persistentOutlook && !persistentOutlook.unlinked && persistentOutlook.outlookIcsUrl && persistentOutlook.outlookIcsUrl.trim()) {
    seedSync.outlookIcsUrl = persistentOutlook.outlookIcsUrl.trim();
    seedSync.outlookCalendarName = persistentOutlook.outlookCalendarName || 'Outlook Shared Calendar';
    seedSync.outlookDefaultCategoryId = persistentOutlook.outlookDefaultCategoryId || 'client';
    seedSync.outlookAutoSync = persistentOutlook.outlookAutoSync ?? true;
    seedSync.outlookLastSyncedAt = persistentOutlook.outlookLastSyncedAt;
    seedSync.outlookSyncedCount = persistentOutlook.outlookSyncedCount;
  } else if (persistentOutlook?.unlinked) {
    seedSync.outlookIcsUrl = '';
    seedSync.unlinkOutlook = true;
    seedSync.outlookSyncedCount = 0;
  }

  const initialDb: DatabaseSchema = {
    users: [],
    events: Array.isArray(SEED_EVENTS) && SEED_EVENTS.length > 0 ? SEED_EVENTS : [],
    settings: {
      ...SEED_SETTINGS,
      sync: seedSync
    },
    categories: SEED_CATEGORIES,
    shares: [],
    zapier: {
      apiKey: `zap_${crypto.randomBytes(8).toString('hex')}`,
      catchHookUrl: '',
      enabled: true,
      syncDirection: 'two-way',
      defaultCategoryId: 'work',
      outlookAccountEmail: 'outlook-calendar@zapier.sync',
      lastSyncedAt: new Date().toISOString(),
      syncedEventsCount: 0,
      logs: []
    },
    announcements: [DEFAULT_ANNOUNCEMENT],
    deletedEventIds: [],
    deletedCategoryIds: [],
    deletedUserIds: []
  };

  saveDb(initialDb);
  return initialDb;
}

function saveDb(dbData: DatabaseSchema) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const jsonStr = JSON.stringify(dbData, null, 2);
    // Write primary database file
    fs.writeFileSync(DB_FILE, jsonStr, 'utf-8');
    // Also maintain a backup file for high resilience across container restarts / redeployments
    fs.writeFileSync(DB_BACKUP_FILE, jsonStr, 'utf-8');

    // Automatically replicate Outlook config or enforce tombstone if unlinked
    if (dbData.settings?.sync?.unlinkOutlook === true || !dbData.settings?.sync?.outlookIcsUrl?.trim()) {
      deletePersistentOutlookConfig();
    } else if (dbData.settings?.sync?.outlookIcsUrl && dbData.settings.sync.outlookIcsUrl.trim()) {
      savePersistentOutlookConfig({
        outlookIcsUrl: dbData.settings.sync.outlookIcsUrl.trim(),
        outlookCalendarName: dbData.settings.sync.outlookCalendarName,
        outlookDefaultCategoryId: dbData.settings.sync.outlookDefaultCategoryId,
        outlookAutoSync: dbData.settings.sync.outlookAutoSync,
        outlookLastSyncedAt: dbData.settings.sync.outlookLastSyncedAt,
        outlookSyncedCount: dbData.settings.sync.outlookSyncedCount
      });
    }
  } catch (err) {
    console.error("Error saving database file:", err);
  }
}

let db = initDb();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust reverse proxy for correct protocol, host and client IP resolution
  app.set('trust proxy', true);

  // Global CORS and Preflight handler
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, X-Requested-With, Accept, *");
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.text({ type: ['text/*', 'application/xml', 'application/xhtml+xml'], limit: '10mb' }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      usersCount: db.users.length,
      eventsCount: db.events.length,
      categoriesCount: db.categories?.length || 0,
      sharesCount: db.shares?.length || 0
    });
  });

  // Full synchronization endpoint
  app.get("/api/sync", (req, res) => {
    const deletedSet = new Set(db.deletedEventIds || []);
    const deletedCatSet = new Set(db.deletedCategoryIds || []);
    const deletedUserSet = new Set(db.deletedUserIds || []);
    const cleanEvents = deduplicateServerEvents(db.events || [], deletedSet);
    db.events = cleanEvents;
    res.json({
      users: (db.users || []).filter(u => u && u.id && !deletedUserSet.has(u.id)),
      events: cleanEvents,
      settings: db.settings,
      categories: (db.categories || SEED_CATEGORIES).filter(c => c && c.id && !deletedCatSet.has(c.id)),
      shares: db.shares || [],
      zapier: db.zapier,
      deletedEventIds: db.deletedEventIds || [],
      deletedCategoryIds: db.deletedCategoryIds || [],
      deletedUserIds: db.deletedUserIds || []
    });
  });

  app.post("/api/sync", (req, res) => {
    const {
      users: incomingUsers,
      events: incomingEvents,
      settings: incomingSettings,
      categories: incomingCategories,
      shares: incomingShares,
      zapier: incomingZapier,
      deletedEventIds: incomingDeletedIds,
      deletedCategoryIds: incomingDeletedCategoryIds,
      deletedUserIds: incomingDeletedUserIds
    } = req.body || {};

    if (incomingZapier && typeof incomingZapier === 'object') {
      db.zapier = { ...db.zapier, ...incomingZapier };
    }

    if (!db.deletedEventIds) db.deletedEventIds = [];
    if (!db.deletedCategoryIds) db.deletedCategoryIds = [];
    if (!db.deletedUserIds) db.deletedUserIds = [];

    // Merge incoming deletedEventIds (strictly excluding any events being actively saved or present in db.events)
    const incomingEventIds = new Set((incomingEvents || []).map((e: any) => e.id).filter(Boolean));
    const activeServerEventIds = new Set((db.events || []).map((e: any) => e.id).filter(Boolean));
    const allActiveEventIds = new Set([...incomingEventIds, ...activeServerEventIds]);

    if (Array.isArray(incomingDeletedIds) && incomingDeletedIds.length > 0) {
      const validDeleted = incomingDeletedIds.filter(
        (id) => typeof id === 'string' && !id.startsWith('del_sig_') && !allActiveEventIds.has(id)
      );
      const delSet = new Set([...db.deletedEventIds, ...validDeleted]);
      db.deletedEventIds = Array.from(delSet);
    }
    // Remove active events and any del_sig_ from db.deletedEventIds
    db.deletedEventIds = db.deletedEventIds.filter(
      (id) => typeof id === 'string' && !id.startsWith('del_sig_') && !allActiveEventIds.has(id)
    );
    const currentDeletedSet = new Set(db.deletedEventIds);

    // Merge incoming deletedCategoryIds (strictly excluding any categories being actively saved or present in db.categories)
    const activeServerCategoryIds = new Set((db.categories || []).map((c: any) => c.id).filter(Boolean));
    const incomingCatIds = new Set((incomingCategories || []).map((c: any) => c.id).filter(Boolean));
    const allActiveCategoryIds = new Set([...activeServerCategoryIds, ...incomingCatIds]);

    if (db.deletedCategoryIds && db.deletedCategoryIds.length > 0) {
      db.deletedCategoryIds = db.deletedCategoryIds.filter((id) => !allActiveCategoryIds.has(id));
    }
    if (Array.isArray(incomingDeletedCategoryIds) && incomingDeletedCategoryIds.length > 0) {
      const validDeleted = incomingDeletedCategoryIds.filter((id) => !allActiveCategoryIds.has(id));
      const delCatSet = new Set([...db.deletedCategoryIds, ...validDeleted]);
      db.deletedCategoryIds = Array.from(delCatSet);
    }
    const currentDeletedCatSet = new Set(db.deletedCategoryIds);

    // Merge incoming deletedUserIds
    if (Array.isArray(incomingDeletedUserIds) && incomingDeletedUserIds.length > 0) {
      const delUserSet = new Set([...db.deletedUserIds, ...incomingDeletedUserIds]);
      db.deletedUserIds = Array.from(delUserSet);
    }
    const currentDeletedUserSet = new Set(db.deletedUserIds);
    
    // Merge users with password preservation (strictly excluding deleted users)
    if (Array.isArray(incomingUsers) && incomingUsers.length > 0) {
      const userMap = new Map<string, User>();
      db.users.forEach((u) => { if (u.id && !currentDeletedUserSet.has(u.id)) userMap.set(u.id, u); });
      incomingUsers.forEach((u: User) => {
        if (u && u.id && !currentDeletedUserSet.has(u.id)) {
          const existing = userMap.get(u.id);
          const merged: User = {
            ...existing,
            ...u,
            password: u.password ? u.password.trim() : existing?.password || 'password123'
          };
          userMap.set(u.id, merged);
        }
      });
      db.users = Array.from(userMap.values());
    } else {
      db.users = db.users.filter(u => u && u.id && !currentDeletedUserSet.has(u.id));
    }

    // Merge events (strictly filtering out any deleted events and deduplicating)
    if (Array.isArray(incomingEvents) && incomingEvents.length > 0) {
      const combined = [...db.events, ...incomingEvents];
      db.events = deduplicateServerEvents(combined, currentDeletedSet);
    } else {
      db.events = deduplicateServerEvents(db.events, currentDeletedSet);
    }

    if (incomingSettings) {
      const incomingSync = incomingSettings.sync;
      if (incomingSync?.unlinkOutlook === true || (incomingSync?.outlookIcsUrl !== undefined && !incomingSync.outlookIcsUrl.trim())) {
        deletePersistentOutlookConfig();
        if (incomingSettings.sync) {
          incomingSettings.sync.outlookIcsUrl = '';
          incomingSettings.sync.unlinkOutlook = true;
          incomingSettings.sync.outlookSyncedCount = 0;
        }
      }
      db.settings = { ...db.settings, ...incomingSettings };
    }

    // If no Outlook ICS link is configured, ensure no Outlook events remain in the database
    if (!db.settings?.sync?.outlookIcsUrl?.trim() || db.settings?.sync?.unlinkOutlook === true) {
      db.events = (db.events || []).filter(e => !isOutlookEvent(e));
    }

    if (Array.isArray(incomingCategories)) {
      const catMap = new Map<string, Category>();
      (db.categories || []).forEach((c) => { if (c && c.id && !currentDeletedCatSet.has(c.id)) catMap.set(c.id, c); });
      incomingCategories.forEach((c: Category) => {
        if (c && c.id) {
          catMap.set(c.id, c);
          if (db.deletedCategoryIds) {
            db.deletedCategoryIds = db.deletedCategoryIds.filter((id) => id !== c.id);
          }
        }
      });
      db.categories = Array.from(catMap.values());
    } else if (db.categories) {
      db.categories = db.categories.filter((c: Category) => c && c.id && !currentDeletedCatSet.has(c.id));
    }

    if (Array.isArray(incomingShares)) {
      const shareMap = new Map<string, SharedCalendar>();
      (db.shares || []).forEach((s) => { if (s.id) shareMap.set(s.id, s); });
      incomingShares.forEach((s: SharedCalendar) => { if (s && s.id) shareMap.set(s.id, s); });
      db.shares = Array.from(shareMap.values());
    }

    saveDb(db);
    res.json({
      users: db.users,
      events: db.events.filter(e => e && e.id && !currentDeletedSet.has(e.id)),
      settings: db.settings,
      categories: db.categories,
      shares: db.shares || [],
      deletedEventIds: db.deletedEventIds,
      deletedCategoryIds: db.deletedCategoryIds,
      deletedUserIds: db.deletedUserIds
    });
  });

  // Dedicated endpoint to bulk restore and sync registered accounts from client's permanent vault
  app.post("/api/users/bulk-sync", (req, res) => {
    const { users: incomingUsers } = req.body || {};
    const currentDeletedUserSet = new Set(db.deletedUserIds || []);

    if (Array.isArray(incomingUsers) && incomingUsers.length > 0) {
      const userMap = new Map<string, User>();
      db.users.forEach((u) => { if (u.id && !currentDeletedUserSet.has(u.id)) userMap.set(u.id, u); });
      incomingUsers.forEach((u: User) => {
        if (
          u &&
          u.id &&
          !currentDeletedUserSet.has(u.id) &&
          !['u_marcus', 'u_john', 'u_sarah', 'u_admin', 'u_admin_default'].includes(u.id) &&
          !['admin@executivetech.com'].includes((u.email || '').toLowerCase())
        ) {
          const cleanUser = (u.username || '').toLowerCase().replace(/^@+/, '');
          const existingById = userMap.get(u.id);
          const existingByUsername = Array.from(userMap.values()).find(
            (other) => (other.username || '').toLowerCase().replace(/^@+/, '') === cleanUser
          );
          const existing = existingById || existingByUsername;
          const merged: User = {
            ...existing,
            ...u,
            username: cleanUser || u.username,
            password: u.password ? u.password.trim() : existing?.password || 'password123',
            active: u.active !== false
          };
          userMap.set(u.id, merged);
        }
      });
      db.users = Array.from(userMap.values());
      saveDb(db);
    }
    return res.json({ success: true, users: db.users });
  });

  // Credential recovery memory store for temporary reset codes
  const recoveryCodes = new Map<string, { code: string; expiresAt: number; username: string }>();

  // RECOVER CREDENTIALS (USERNAME + RESET CODE) ENDPOINT
  app.post("/api/auth/recover-credentials", (req, res) => {
    const { email, identifier } = req.body || {};
    const input = (email || identifier || '').toString().trim();
    if (!input) {
      return res.status(400).json({ error: "Please enter your registered email address or username." });
    }

    const cleanInput = input.toLowerCase().replace(/^@+/, '');
    const targetUser = db.users.find((u) => {
      const uEmail = (u.email || '').trim().toLowerCase();
      const uName = (u.username || '').trim().toLowerCase().replace(/^@+/, '');
      const uDisplayName = (u.name || '').trim().toLowerCase();
      const uId = (u.id || '').trim().toLowerCase();
      return uEmail === cleanInput || uName === cleanInput || uDisplayName === cleanInput || uId === cleanInput;
    });

    if (!targetUser) {
      return res.status(404).json({
        error: `No registered account found with "${input}". Please check your spelling or register a new account.`
      });
    }

    // Generate a 6-digit recovery code valid for 30 minutes
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const userEmailKey = (targetUser.email || targetUser.username).toLowerCase();
    recoveryCodes.set(userEmailKey, {
      code,
      expiresAt: Date.now() + 30 * 60 * 1000,
      username: targetUser.username
    });

    return res.json({
      success: true,
      message: `Account credentials retrieved for ${targetUser.name || targetUser.username}.`,
      username: targetUser.username,
      name: targetUser.name || targetUser.username,
      email: targetUser.email,
      recoveryCode: code
    });
  });

  // RESET PASSWORD ENDPOINT
  app.post("/api/auth/reset-password", (req, res) => {
    const { email, identifier, newPassword, recoveryCode } = req.body || {};
    const input = (email || identifier || '').toString().trim();
    if (!input || !newPassword) {
      return res.status(400).json({ error: "Email or username and new password are required." });
    }

    const cleanInput = input.toLowerCase().replace(/^@+/, '');
    const targetUser = db.users.find((u) => {
      const uEmail = (u.email || '').trim().toLowerCase();
      const uName = (u.username || '').trim().toLowerCase().replace(/^@+/, '');
      const uDisplayName = (u.name || '').trim().toLowerCase();
      const uId = (u.id || '').trim().toLowerCase();
      return uEmail === cleanInput || uName === cleanInput || uDisplayName === cleanInput || uId === cleanInput;
    });

    if (!targetUser) {
      return res.status(404).json({ error: `No registered account found matching "${input}".` });
    }

    if (newPassword.toString().trim().length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters long." });
    }

    // Check recovery code if provided
    if (recoveryCode) {
      const userEmailKey = (targetUser.email || targetUser.username).toLowerCase();
      const stored = recoveryCodes.get(userEmailKey);
      if (stored && stored.code !== recoveryCode.toString().trim() && Date.now() <= stored.expiresAt) {
        return res.status(400).json({ error: "Invalid recovery verification code. Please check the code." });
      }
    }

    // Update user password
    targetUser.password = newPassword.toString().trim();
    saveDb(db);
    recoveryCodes.delete((targetUser.email || targetUser.username).toLowerCase());

    return res.json({
      success: true,
      message: `Password updated successfully for account "${targetUser.username}". You can now sign in.`,
      username: targetUser.username,
      user: targetUser
    });
  });

  // PURGE AND RESET USERS
  app.post("/api/admin/reset-users", (req, res) => {
    db.users = [];
    saveDb(db);
    return res.json({
      success: true,
      message: "User database successfully reset.",
      users: []
    });
  });

  // AUTH REGISTER ENDPOINT
  app.post("/api/auth/register", (req, res) => {
    const { username, email, password, name, role, avatarColor } = req.body || {};
    if (!username && !email) {
      return res.status(400).json({ error: "Username and email are required." });
    }
    if (!password || password.toString().trim().length < 3) {
      return res.status(400).json({ error: "Password must be at least 3 characters long." });
    }

    const cleanUsername = (username || (email ? email.split('@')[0] : '')).toString().trim().toLowerCase().replace(/^@+/, '');
    const cleanEmail = (email || `${cleanUsername}@company.com`).toString().trim().toLowerCase();

    // Check for username collision
    const existingUsername = db.users.find(
      (u) => (u.username || '').trim().toLowerCase().replace(/^@+/, '') === cleanUsername
    );
    if (existingUsername) {
      return res.status(409).json({
        error: `Username "${cleanUsername}" is already taken. Please choose another username or sign in.`
      });
    }

    // Check for email collision
    const existingEmail = db.users.find(
      (u) => (u.email || '').trim().toLowerCase() === cleanEmail
    );
    if (existingEmail) {
      return res.status(409).json({
        error: `Email "${cleanEmail}" is already registered. Please sign in or use another email.`
      });
    }

    const displayName = name && name.trim() ? name.trim() : (cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1));
    // Any user who signs up for this app directly is an admin
    const assignedRole = 'admin';
    const assignedAvatar = avatarColor || 'bg-indigo-600';

    const newUserObj: User = {
      id: `u_${Date.now()}`,
      username: cleanUsername,
      password: password.toString().trim(),
      name: displayName,
      email: cleanEmail,
      role: assignedRole,
      avatarColor: assignedAvatar,
      active: true,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUserObj);
    saveDb(db);

    return res.status(201).json({
      success: true,
      user: newUserObj,
      message: `Account created successfully! Welcome, ${displayName}.`
    });
  });

  // AUTH LOGIN ENDPOINT
  app.post("/api/auth/login", (req, res) => {
    const { identifier, username, email, password } = req.body || {};
    const input = (identifier || username || email || '').toString().trim();
    if (!input || !password) {
      return res.status(400).json({ error: "Please enter your username or email and password." });
    }

    const cleanInput = input.toLowerCase().replace(/^@+/, '');

    const targetUser = db.users.find((u) => {
      const uName = (u.username || '').trim().toLowerCase().replace(/^@+/, '');
      const uEmail = (u.email || '').trim().toLowerCase();
      const uDisplayName = (u.name || '').trim().toLowerCase();
      const uId = (u.id || '').trim().toLowerCase();
      return uName === cleanInput || uEmail === cleanInput || uDisplayName === cleanInput || uId === cleanInput;
    });

    if (!targetUser) {
      return res.status(404).json({
        error: `No account found with username or email "${input}". Please check your spelling or sign up first.`,
        canRegister: true,
        identifier: input
      });
    }

    if (!targetUser.active) {
      return res.status(403).json({
        error: `Account "${targetUser.username}" has been deactivated. Please contact an administrator.`
      });
    }

    const expectedPass = (targetUser.password ?? 'password123').toString().trim();
    const providedPass = password.toString().trim();

    if (expectedPass !== providedPass && targetUser.password !== password) {
      return res.status(401).json({
        error: "Incorrect password. Please try again or use Forgot Password to reset."
      });
    }

    return res.json({
      success: true,
      user: targetUser,
      message: `Welcome back, ${targetUser.name || targetUser.username}!`
    });
  });

  // QUICK REGISTER AND SIGN IN COMPATIBILITY ENDPOINT
  app.post("/api/auth/quick-register", (req, res) => {
    const { identifier, email, username, password, name, role } = req.body || {};
    const input = (identifier || email || username || '').toString().trim();
    if (!input || !password) {
      return res.status(400).json({ error: "Username/email and password are required." });
    }

    const cleanInput = input.toLowerCase().replace(/^@+/, '');
    const isEmailInput = cleanInput.includes('@');
    const cleanUsername = (username || (isEmailInput ? cleanInput.split('@')[0] : cleanInput)).trim().toLowerCase().replace(/^@+/, '');
    const cleanEmail = (email || (isEmailInput ? cleanInput : `${cleanUsername}@company.com`)).trim().toLowerCase();

    // Check if account already exists
    const existing = db.users.find(
      (u) =>
        (u.username && u.username.trim().toLowerCase().replace(/^@+/, '') === cleanUsername) ||
        (u.email && u.email.trim().toLowerCase() === cleanEmail)
    );

    if (existing) {
      existing.password = password.toString().trim();
      existing.active = true;
      if (name) existing.name = name.trim();
      saveDb(db);
      return res.json({
        success: true,
        user: existing,
        message: `Account "${existing.username}" updated and signed in.`
      });
    }

    const displayName = name ? name.trim() : (cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1));
    const assignedRole = role === 'admin' ? 'admin' : role === 'viewer' ? 'viewer' : (db.users.length === 0 ? 'admin' : 'member');
    const userObj: User = {
      id: `u_${Date.now()}`,
      username: cleanUsername,
      password: password.toString().trim(),
      name: displayName,
      email: cleanEmail,
      role: assignedRole,
      avatarColor: 'bg-indigo-600',
      active: true,
      createdAt: new Date().toISOString()
    };

    db.users.push(userObj);
    saveDb(db);

    return res.status(201).json({
      success: true,
      user: userObj,
      isNew: true,
      message: `Account created successfully! Signed in as ${displayName}.`
    });
  });

  // USERS REST ENDPOINTS
  app.get("/api/users", (req, res) => {
    res.json(db.users);
  });

  app.post("/api/users", (req, res) => {
    const newUser = req.body;
    if (!newUser || (!newUser.username && !newUser.email)) {
      return res.status(400).json({ error: "Username or email is required" });
    }

    const cleanUsername = (newUser.username || newUser.email.split('@')[0]).trim().toLowerCase().replace(/^@+/, '');
    const cleanEmail = (newUser.email || `${cleanUsername}@executivetech.com`).trim().toLowerCase();

    // Check if account already exists - if so, update/return it rather than breaking
    const existingIdx = db.users.findIndex(
      (u) =>
        (u.username && u.username.trim().toLowerCase().replace(/^@+/, '') === cleanUsername) ||
        (u.email && u.email.trim().toLowerCase() === cleanEmail) ||
        (newUser.id && u.id === newUser.id)
    );

    if (existingIdx >= 0) {
      const existing = db.users[existingIdx];
      existing.name = newUser.name?.trim() || existing.name;
      if (newUser.password) existing.password = newUser.password.trim();
      if (newUser.role) existing.role = newUser.role;
      existing.active = newUser.active !== false;
      saveDb(db);
      return res.status(200).json(existing);
    }

    const userObj: User = {
      id: newUser.id || `u_${Date.now()}`,
      username: cleanUsername,
      password: newUser.password ? newUser.password.trim() : 'password123',
      name: newUser.name?.trim() || cleanUsername,
      email: cleanEmail,
      role: newUser.role === 'admin' ? 'admin' : newUser.role === 'viewer' ? 'viewer' : 'member',
      avatarColor: newUser.avatarColor || (newUser.role === 'admin' ? 'bg-indigo-600' : 'bg-emerald-600'),
      active: newUser.active !== false,
      createdAt: newUser.createdAt || new Date().toISOString(),
      createdByAdmin: newUser.createdByAdmin
    };

    if (db.deletedUserIds) {
      db.deletedUserIds = db.deletedUserIds.filter(id => id !== userObj.id);
    }
    db.users.push(userObj);
    saveDb(db);
    res.status(201).json(userObj);
  });

  app.put("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    const updates = req.body;
    const index = db.users.findIndex((u) => u.id === userId);

    if (index === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    const current = db.users[index];

    // Check if updated username is already taken by another user
    if (updates.username) {
      const cleanUsername = updates.username.trim().toLowerCase().replace(/^@+/, '');
      const usernameExists = db.users.some(
        (u) => u.id !== userId && (u.username || '').trim().toLowerCase().replace(/^@+/, '') === cleanUsername
      );
      if (usernameExists) {
        return res.status(409).json({ error: `Username "${cleanUsername}" is already taken.` });
      }
    }

    // Check if updated email is already taken by another user
    if (updates.email) {
      const cleanEmail = updates.email.trim().toLowerCase();
      const emailExists = db.users.some(
        (u) => u.id !== userId && (u.email || '').trim().toLowerCase() === cleanEmail
      );
      if (emailExists) {
        return res.status(409).json({ error: `Email "${cleanEmail}" is already registered by another account.` });
      }
    }

    const updatedUser: User = {
      ...current,
      ...updates,
      id: current.id // Ensure ID remains immutable
    };

    if (updates.name) {
      updatedUser.name = updates.name.trim();
    }
    if (updates.username) {
      updatedUser.username = updates.username.trim().toLowerCase().replace(/^@+/, '');
    }
    if (updates.email) {
      updatedUser.email = updates.email.trim().toLowerCase();
    }
    if (updates.password) {
      updatedUser.password = updates.password.trim();
    }
    if (updates.avatarColor) {
      updatedUser.avatarColor = updates.avatarColor;
    }
    if (updates.role) {
      updatedUser.role = updates.role === 'admin' ? 'admin' : updates.role === 'viewer' ? 'viewer' : 'member';
    }

    db.users[index] = updatedUser;
    saveDb(db);
    res.json(updatedUser);
  });

  app.delete("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!db.deletedUserIds) db.deletedUserIds = [];
    if (!db.deletedUserIds.includes(userId)) {
      db.deletedUserIds.push(userId);
    }

    db.users = db.users.filter((u) => u.id !== userId);
    saveDb(db);
    res.json({ success: true, deletedId: userId });
  });

  // Forward local event changes to Zapier Catch Hook for Microsoft Outlook
  async function forwardEventToZapier(event: Partial<CalendarEvent>, action: 'create' | 'update' | 'delete') {
    try {
      if (!db.zapier || !db.zapier.enabled || !db.zapier.catchHookUrl) return;
      const catchHook = db.zapier.catchHookUrl.trim();
      if (!catchHook.startsWith('http')) return;
      if (db.zapier.syncDirection === 'inbound-only') return;
      if (event.source === 'microsoft-zapier') return; // Prevent echo loop

      const zapierPayload = {
        action,
        event: {
          id: event.id,
          title: event.title || 'Untitled Event',
          subject: event.title || 'Untitled Event', // Outlook field
          startDate: event.startDate || '',
          endDate: event.endDate || event.startDate || '',
          startTime: event.startTime || '09:00',
          endTime: event.endTime || '10:00',
          startDateTime: event.startDate ? `${event.startDate}T${event.startTime || '09:00'}:00` : '',
          endDateTime: (event.endDate || event.startDate) ? `${event.endDate || event.startDate}T${event.endTime || '10:00'}:00` : '',
          location: event.location || '',
          description: event.description || '',
          body: event.description || '', // Outlook field
          isAllDay: !!event.isAllDay,
          attendees: event.attendees || [],
          categoryId: event.categoryId || 'work',
          tema: event.tema || ''
        },
        sentAt: new Date().toISOString()
      };

      const response = await fetch(catchHook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zapierPayload)
      });

      const logEntry: ZapierLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        type: 'outbound',
        status: response.ok ? 'success' : 'error',
        eventTitle: event.title || 'Calendar Event',
        details: `Dispatched to Zapier catch hook (HTTP ${response.status})`
      };

      if (!db.zapier.logs) db.zapier.logs = [];
      db.zapier.logs.unshift(logEntry);
      if (db.zapier.logs.length > 30) db.zapier.logs = db.zapier.logs.slice(0, 30);
      saveDb(db);
    } catch (err: any) {
      console.warn("Could not dispatch event to Zapier catch hook:", err.message);
    }
  }

  // EVENTS REST ENDPOINTS
  app.get("/api/events", (req, res) => {
    const deletedSet = new Set(db.deletedEventIds || []);
    const cleanEvents = deduplicateServerEvents(db.events || [], deletedSet);
    db.events = cleanEvents;
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json(cleanEvents);
  });

  app.post("/api/events", (req, res) => {
    const payload = req.body;
    if (!db.deletedEventIds) db.deletedEventIds = [];

    if (Array.isArray(payload)) {
      const incomingIds = new Set(payload.map((e: any) => e.id).filter(Boolean));
      if (db.deletedEventIds.length > 0) {
        db.deletedEventIds = db.deletedEventIds.filter((id) => !incomingIds.has(id));
      }
      const deletedSet = new Set(db.deletedEventIds);
      const combined = [...db.events, ...payload];
      db.events = deduplicateServerEvents(combined, deletedSet);
      saveDb(db);
      return res.status(201).json(db.events);
    }

    const newEvt = payload as CalendarEvent;
    if (!newEvt.id) {
      newEvt.id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }
    newEvt.updatedAt = newEvt.updatedAt || new Date().toISOString();

    // Re-creation or edit removes from deletedEventIds
    if (db.deletedEventIds.length > 0) {
      db.deletedEventIds = db.deletedEventIds.filter(
        (id) => id !== newEvt.id && (!newEvt.externalEventId || id !== newEvt.externalEventId) && !id.startsWith('del_sig_')
      );
    }

    const idx = db.events.findIndex((e) => e.id === newEvt.id);
    if (idx >= 0) {
      db.events[idx] = { ...db.events[idx], ...newEvt };
    } else {
      db.events.push(newEvt);
    }
    const deletedSet = new Set(db.deletedEventIds);
    db.events = deduplicateServerEvents(db.events, deletedSet);
    saveDb(db);

    // Forward to Zapier asynchronously for Microsoft Outlook synchronization
    forwardEventToZapier(newEvt, idx >= 0 ? 'update' : 'create').catch(() => {});

    res.status(201).json(newEvt);
  });

  app.put("/api/events/:id", (req, res) => {
    const evtId = req.params.id;
    const updates = req.body;
    if (!db.deletedEventIds) db.deletedEventIds = [];

    // Explicitly un-delete this event if previously deleted
    if (db.deletedEventIds.length > 0) {
      db.deletedEventIds = db.deletedEventIds.filter(
        (id) => id !== evtId && (!updates.externalEventId || id !== updates.externalEventId) && !id.startsWith('del_sig_')
      );
    }
    const index = db.events.findIndex((e) => e.id === evtId);
    const nowIso = new Date().toISOString();

    let savedEvt: CalendarEvent;
    if (index === -1) {
      // If not found, insert
      savedEvt = { ...updates, id: evtId, updatedAt: updates.updatedAt || nowIso };
      db.events.push(savedEvt);
    } else {
      savedEvt = {
        ...db.events[index],
        ...updates,
        id: evtId,
        updatedAt: updates.updatedAt || nowIso
      };
      db.events[index] = savedEvt;
    }

    // Ensure active event is not in deletedEventIds
    db.deletedEventIds = db.deletedEventIds.filter(
      (id) => id !== evtId && (!savedEvt.externalEventId || id !== savedEvt.externalEventId) && !id.startsWith('del_sig_')
    );
    const deletedSet = new Set(db.deletedEventIds);
    db.events = deduplicateServerEvents(db.events, deletedSet);
    saveDb(db);

    const finalEvt = db.events.find((e) => e.id === evtId) || savedEvt;
    forwardEventToZapier(finalEvt, index >= 0 ? 'update' : 'create').catch(() => {});

    res.json(finalEvt);
  });

  app.delete(["/api/events/:id", "/api/events"], (req, res) => {
    const rawId = req.params.id || req.body?.id || (req.query.id as string);
    const body = req.body || {};
    const externalId = body.externalEventId || (req.query.externalEventId as string);

    if (!db.deletedEventIds) db.deletedEventIds = [];

    const toDeleteIds = new Set<string>();
    if (rawId) toDeleteIds.add(rawId);
    if (externalId) toDeleteIds.add(externalId);

    // Collect matching events in db.events
    const matchingEvents: CalendarEvent[] = [];
    db.events.forEach((e) => {
      let isMatch = false;
      if (rawId && (e.id === rawId || e.externalEventId === rawId)) isMatch = true;
      if (externalId && (e.externalEventId === externalId || e.id === externalId)) isMatch = true;
      if (isMatch) {
        matchingEvents.push(e);
        toDeleteIds.add(e.id);
        if (e.externalEventId) toDeleteIds.add(e.externalEventId);
      }
    });

    toDeleteIds.forEach((id) => {
      if (id && !id.startsWith('del_sig_') && !db.deletedEventIds.includes(id)) {
        db.deletedEventIds.push(id);
      }
    });

    const deletedSet = new Set(db.deletedEventIds);
    db.events = deduplicateServerEvents(db.events, deletedSet);
    saveDb(db);

    matchingEvents.forEach((found) => {
      forwardEventToZapier(found, 'delete').catch(() => {});
    });

    res.json({ success: true, deletedIds: Array.from(toDeleteIds), count: matchingEvents.length });
  });

  // SETTINGS REST ENDPOINTS
  app.get("/api/settings", (req, res) => {
    res.json(db.settings);
  });

  app.put("/api/settings", (req, res) => {
    const incomingSync = (req.body?.sync || {}) as Partial<UserSettings['sync']>;
    const existingSync = (db.settings?.sync || {}) as Partial<UserSettings['sync']>;

    // Check if administrator explicitly requested to unlink Outlook
    const explicitUnlink = incomingSync?.unlinkOutlook === true;

    let finalOutlookIcsUrl = existingSync.outlookIcsUrl || '';
    let finalUnlink = existingSync.unlinkOutlook;
    if (explicitUnlink) {
      finalOutlookIcsUrl = '';
      finalUnlink = true;
      deletePersistentOutlookConfig();
    } else if (incomingSync?.outlookIcsUrl && incomingSync.outlookIcsUrl.trim()) {
      finalOutlookIcsUrl = incomingSync.outlookIcsUrl.trim();
      finalUnlink = false;
      savePersistentOutlookConfig({
        outlookIcsUrl: finalOutlookIcsUrl,
        outlookCalendarName: incomingSync.outlookCalendarName || existingSync.outlookCalendarName,
        outlookDefaultCategoryId: incomingSync.outlookDefaultCategoryId || existingSync.outlookDefaultCategoryId,
        outlookAutoSync: incomingSync.outlookAutoSync ?? existingSync.outlookAutoSync
      });
    }

    db.settings = {
      ...db.settings,
      ...req.body,
      sync: {
        ...existingSync,
        ...(incomingSync || {}),
        unlinkOutlook: finalUnlink,
        outlookIcsUrl: finalOutlookIcsUrl,
        outlookCalendarName: incomingSync?.outlookCalendarName || existingSync.outlookCalendarName || 'Outlook Shared Calendar',
        outlookDefaultCategoryId: incomingSync?.outlookDefaultCategoryId || existingSync.outlookDefaultCategoryId || 'client',
        outlookAutoSync: incomingSync?.outlookAutoSync ?? existingSync.outlookAutoSync ?? true
      }
    };

    if (finalUnlink || !finalOutlookIcsUrl) {
      db.events = (db.events || []).filter(e => !isOutlookEvent(e));
    }

    saveDb(db);
    res.json(db.settings);
  });

  // DEDICATED OUTLOOK INTEGRATION REST ENDPOINTS
  app.get("/api/settings/outlook", (req, res) => {
    const sync = (db.settings?.sync || {}) as Partial<UserSettings['sync']>;
    const isUnlinked = sync.unlinkOutlook === true;
    const effectiveUrl = isUnlinked ? '' : (sync.outlookIcsUrl || '');
    res.json({
      configured: Boolean(effectiveUrl && effectiveUrl.trim()),
      outlookIcsUrl: effectiveUrl,
      outlookCalendarName: isUnlinked ? '' : (sync.outlookCalendarName || 'Outlook Shared Calendar'),
      outlookDefaultCategoryId: sync.outlookDefaultCategoryId || 'client',
      outlookAutoSync: sync.outlookAutoSync ?? true,
      outlookLastSyncedAt: isUnlinked ? undefined : sync.outlookLastSyncedAt,
      outlookSyncedCount: isUnlinked ? 0 : (sync.outlookSyncedCount || 0),
      unlinked: isUnlinked
    });
  });

  app.post("/api/settings/outlook", async (req, res) => {
    try {
      const { url, calendarName, categoryId, autoSync, triggerSync } = req.body || {};
      if (!url || !url.trim()) {
        return res.status(400).json({ success: false, error: "Outlook ICS URL is required." });
      }
      const cleanUrl = url.trim().replace(/^webcal:\/\//i, 'https://');
      const calName = (calendarName || db.settings?.sync?.outlookCalendarName || 'Outlook Shared Calendar').trim();
      const targetCatId = categoryId || db.settings?.sync?.outlookDefaultCategoryId || 'client';
      const auto = autoSync !== undefined ? Boolean(autoSync) : (db.settings?.sync?.outlookAutoSync ?? true);

      if (!db.settings) db.settings = {} as any;
      if (!db.settings.sync) db.settings.sync = {} as any;

      db.settings.sync.unlinkOutlook = false;
      db.settings.sync.outlookIcsUrl = cleanUrl;
      db.settings.sync.outlookCalendarName = calName;
      db.settings.sync.outlookDefaultCategoryId = targetCatId;
      db.settings.sync.outlookAutoSync = auto;

      savePersistentOutlookConfig({
        outlookIcsUrl: cleanUrl,
        outlookCalendarName: calName,
        outlookDefaultCategoryId: targetCatId,
        outlookAutoSync: auto
      });

      saveDb(db);

      let syncResult = null;
      if (triggerSync !== false) {
        syncResult = await performOutlookIcsSync(cleanUrl, targetCatId, calName);
      }

      return res.json({
        success: true,
        message: "Outlook calendar integration locked and saved permanently.",
        settings: db.settings,
        syncResult
      });
    } catch (err: any) {
      console.error("[Save Outlook Config] Error:", err);
      return res.status(500).json({ success: false, error: err?.message || "Failed to save Outlook configuration." });
    }
  });

  app.delete("/api/settings/outlook", (req, res) => {
    try {
      if (!db.settings) db.settings = {} as any;
      if (!db.settings.sync) db.settings.sync = {} as any;

      db.settings.sync.outlookIcsUrl = '';
      db.settings.sync.outlookCalendarName = '';
      db.settings.sync.unlinkOutlook = true;
      db.settings.sync.outlookLastSyncedAt = undefined;
      db.settings.sync.outlookSyncedCount = 0;

      // Remove events imported from Outlook feed
      db.events = (db.events || []).filter(e => e && e.sourceAccountId !== 'outlook-ics');

      deletePersistentOutlookConfig();
      saveDb(db);

      return res.json({
        success: true,
        message: "Outlook calendar integration unlinked by administrator."
      });
    } catch (err: any) {
      console.error("[Unlink Outlook] Error:", err);
      return res.status(500).json({ success: false, error: err?.message || "Failed to unlink Outlook calendar." });
    }
  });

  // CATEGORIES REST ENDPOINTS
  app.get("/api/categories", (req, res) => {
    const delSet = new Set(db.deletedCategoryIds || []);
    res.json((db.categories || SEED_CATEGORIES).filter(c => c && c.id && !delSet.has(c.id)));
  });

  app.post("/api/categories", (req, res) => {
    const payload = req.body;
    const delSet = new Set(db.deletedCategoryIds || []);
    if (Array.isArray(payload)) {
      const incomingIds = new Set(payload.map((c: any) => c.id).filter(Boolean));
      if (db.deletedCategoryIds) {
        db.deletedCategoryIds = db.deletedCategoryIds.filter(id => !incomingIds.has(id));
      }
      const catMap = new Map<string, Category>();
      (db.categories || []).forEach((c) => { if (c && c.id && !db.deletedCategoryIds?.includes(c.id)) catMap.set(c.id, c); });
      payload.forEach((c: Category) => { if (c && c.id) catMap.set(c.id, c); });
      db.categories = Array.from(catMap.values());
      saveDb(db);
      return res.status(201).json(db.categories);
    }
    const newCat = payload as Category;
    if (!newCat.id) {
      newCat.id = `cat_${Date.now()}`;
    }
    if (db.deletedCategoryIds) {
      db.deletedCategoryIds = db.deletedCategoryIds.filter(id => id !== newCat.id);
    }
    if (!db.categories) db.categories = [...SEED_CATEGORIES];
    const existingIdx = db.categories.findIndex((c) => c.id === newCat.id);
    if (existingIdx >= 0) {
      db.categories[existingIdx] = newCat;
    } else {
      db.categories.push(newCat);
    }
    saveDb(db);
    res.status(201).json(newCat);
  });

  app.put("/api/categories/:id", (req, res) => {
    const catId = req.params.id;
    const updates = req.body as Category;
    if (db.deletedCategoryIds) {
      db.deletedCategoryIds = db.deletedCategoryIds.filter(id => id !== catId);
    }
    if (!db.categories) db.categories = [...SEED_CATEGORIES];
    const idx = db.categories.findIndex((c) => c.id === catId);
    if (idx === -1) {
      const newCat = { ...updates, id: catId };
      db.categories.push(newCat);
      saveDb(db);
      return res.json(newCat);
    }
    db.categories[idx] = { ...db.categories[idx], ...updates, id: catId };
    saveDb(db);
    res.json(db.categories[idx]);
  });

  app.delete("/api/categories/:id", (req, res) => {
    const catId = req.params.id;
    if (!db.deletedCategoryIds) db.deletedCategoryIds = [];
    if (!db.deletedCategoryIds.includes(catId)) {
      db.deletedCategoryIds.push(catId);
    }
    if (!db.categories) db.categories = [...SEED_CATEGORIES];
    db.categories = db.categories.filter((c) => c.id !== catId);
    saveDb(db);
    res.json({ success: true, deletedId: catId, remainingCount: db.categories.length });
  });

  // ==========================================
  // ANNOUNCEMENTS FLYERS REST ENDPOINTS
  // ==========================================
  app.get("/api/announcements", (req, res) => {
    res.json(db.announcements || [DEFAULT_ANNOUNCEMENT]);
  });

  app.get("/api/announcements/:id", (req, res) => {
    const list = db.announcements || [DEFAULT_ANNOUNCEMENT];
    const { id } = req.params;
    if (!id || id === 'active') {
      return res.json(list[0] || DEFAULT_ANNOUNCEMENT);
    }
    const found = list.find((a) => a.id === id);
    res.json(found || list[0] || DEFAULT_ANNOUNCEMENT);
  });

  app.post("/api/announcements", (req, res) => {
    try {
      const payload = req.body;
      if (!payload) return res.status(400).json({ error: "Missing payload" });
      if (Array.isArray(payload)) {
        db.announcements = payload;
        saveDb(db);
        return res.json(db.announcements);
      }
      const newAnnouncement: AnnouncementFlyer = {
        ...DEFAULT_ANNOUNCEMENT,
        ...payload,
        id: payload.id || `flyer-${Date.now()}`,
        updatedAt: new Date().toISOString()
      };
      if (!db.announcements) db.announcements = [];
      const idx = db.announcements.findIndex((a) => a.id === newAnnouncement.id);
      if (idx >= 0) {
        db.announcements[idx] = newAnnouncement;
      } else {
        db.announcements.unshift(newAnnouncement);
      }
      saveDb(db);
      res.status(201).json(newAnnouncement);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to save announcement" });
    }
  });

  app.put("/api/announcements/:id", (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body || {};
      if (!db.announcements) db.announcements = [DEFAULT_ANNOUNCEMENT];
      const idx = db.announcements.findIndex((a) => a.id === id);
      if (idx === -1) {
        const created: AnnouncementFlyer = {
          ...DEFAULT_ANNOUNCEMENT,
          ...updates,
          id,
          updatedAt: new Date().toISOString()
        };
        db.announcements.unshift(created);
        saveDb(db);
        return res.json(created);
      }
      db.announcements[idx] = {
        ...db.announcements[idx],
        ...updates,
        id,
        updatedAt: new Date().toISOString()
      };
      saveDb(db);
      res.json(db.announcements[idx]);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update announcement" });
    }
  });

  app.delete("/api/announcements/:id", (req, res) => {
    const { id } = req.params;
    if (!db.announcements) db.announcements = [DEFAULT_ANNOUNCEMENT];
    db.announcements = db.announcements.filter((a) => a.id !== id);
    if (db.announcements.length === 0) {
      db.announcements = [DEFAULT_ANNOUNCEMENT];
    }
    saveDb(db);
    res.json({ success: true, count: db.announcements.length });
  });

  // ==========================================
  // SHARED CALENDARS REST ENDPOINTS
  // ==========================================

  // Get all shared calendars (for management)
  app.get("/api/shares", (req, res) => {
    res.json(db.shares || []);
  });

  // Create new shared calendar
  app.post("/api/shares", (req, res) => {
    try {
      const payload = req.body || {};
      const {
        title,
        description = '',
        targetGroup = 'General Group',
        createdByUserId = 'system',
        createdByName = 'Admin',
        filterCategories = [],
        filterTema = 'all',
        allowGuestsToExport = true,
        expiresAt,
        isActive = true
      } = payload;

      let code = (payload.code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if (!code) {
        // Generate friendly random code like TEAM-4821 or CAL-9284
        const randNum = Math.floor(1000 + Math.random() * 9000);
        code = `CAL-${randNum}`;
      }

      if (!db.shares) db.shares = [];

      // Check if code exists, if so, make unique unless updating
      const existingCode = db.shares.find((s) => s.code.toUpperCase() === code.toUpperCase());
      if (existingCode && (!payload.id || existingCode.id !== payload.id)) {
        code = `${code}-${Math.floor(10 + Math.random() * 90)}`;
      }

      const newShare: SharedCalendar = {
        id: payload.id || `share_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        code,
        title: title && title.trim() ? title.trim() : `Shared Calendar (${code})`,
        description: description.trim(),
        targetGroup: targetGroup.trim(),
        createdByUserId,
        createdByName,
        createdAt: new Date().toISOString(),
        isActive: isActive !== false,
        filterCategories: Array.isArray(filterCategories) ? filterCategories : [],
        filterTema: filterTema || 'all',
        allowGuestsToExport: allowGuestsToExport !== false,
        expiresAt: expiresAt || undefined,
        viewCount: 0
      };

      const existingIdx = db.shares.findIndex((s) => s.id === newShare.id);
      if (existingIdx >= 0) {
        db.shares[existingIdx] = newShare;
      } else {
        db.shares.push(newShare);
      }

      saveDb(db);
      return res.status(201).json(newShare);
    } catch (err: any) {
      console.error("Error creating shared calendar:", err);
      return res.status(500).json({ error: err?.message || "Failed to create shared calendar." });
    }
  });

  // Update existing shared calendar
  app.put("/api/shares/:id", (req, res) => {
    const shareId = req.params.id;
    const updates = req.body || {};
    if (!db.shares) db.shares = [];

    const idx = db.shares.findIndex((s) => s.id === shareId);
    if (idx === -1) {
      return res.status(404).json({ error: "Shared calendar link not found." });
    }

    if (updates.code) {
      updates.code = updates.code.toString().trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    }

    db.shares[idx] = {
      ...db.shares[idx],
      ...updates,
      id: shareId
    };

    saveDb(db);
    return res.json(db.shares[idx]);
  });

  // Delete shared calendar
  app.delete("/api/shares/:id", (req, res) => {
    const shareId = req.params.id;
    if (!db.shares) db.shares = [];
    db.shares = db.shares.filter((s) => s.id !== shareId);
    saveDb(db);
    return res.json({ success: true, deletedId: shareId });
  });

  // PUBLIC: Resolve & verify share code, return filtered events (no account required)
  app.get("/api/shares/code/:code", (req, res) => {
    const inputCode = (req.params.code || '').trim().toUpperCase();
    if (!inputCode) {
      return res.status(400).json({ error: "Please provide a valid share code." });
    }

    if (!db.shares) db.shares = [];

    const share = db.shares.find((s) => s.code.toUpperCase() === inputCode);
    if (!share) {
      return res.status(404).json({
        error: `No calendar share found with code "${inputCode}". Please check the code and try again.`
      });
    }

    if (!share.isActive) {
      return res.status(403).json({
        error: `The calendar share "${share.title}" (Code: ${share.code}) has been paused or deactivated by the organizer.`
      });
    }

    if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
      return res.status(410).json({
        error: `This calendar share link has expired on ${new Date(share.expiresAt).toLocaleDateString()}.`
      });
    }

    // Increment view count
    share.viewCount = (share.viewCount || 0) + 1;
    saveDb(db);

    // Filter events according to share permissions
    let filteredEvents = db.events || [];
    if (Array.isArray(share.filterCategories) && share.filterCategories.length > 0) {
      filteredEvents = filteredEvents.filter((e) => share.filterCategories!.includes(e.categoryId));
    }
    if (share.filterTema && share.filterTema !== 'all') {
      filteredEvents = filteredEvents.filter((e) => {
        const eventTemas = Array.isArray(e.temas) && e.temas.length > 0 ? e.temas : (e.tema ? [e.tema] : []);
        return eventTemas.includes(share.filterTema!);
      });
    }

    // Filter categories to only relevant ones or all
    let relevantCategories = db.categories || SEED_CATEGORIES;
    if (Array.isArray(share.filterCategories) && share.filterCategories.length > 0) {
      relevantCategories = relevantCategories.filter((c) => share.filterCategories!.includes(c.id));
      if (relevantCategories.length === 0) {
        relevantCategories = db.categories || SEED_CATEGORIES;
      }
    }

    return res.json({
      success: true,
      share,
      events: filteredEvents,
      categories: relevantCategories,
      settings: db.settings
    });
  });

  // PUBLIC: Verify share code via POST body
  app.post("/api/shares/verify", (req, res) => {
    const { code } = req.body || {};
    const inputCode = (code || '').toString().trim().toUpperCase();
    if (!inputCode) {
      return res.status(400).json({ error: "Please enter a share code." });
    }

    if (!db.shares) db.shares = [];

    const share = db.shares.find((s) => s.code.toUpperCase() === inputCode);
    if (!share) {
      return res.status(404).json({
        error: `No calendar share found with code "${inputCode}". Please verify the code and try again.`
      });
    }

    if (!share.isActive) {
      return res.status(403).json({
        error: `This calendar share is currently paused by the organizer.`
      });
    }

    if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
      return res.status(410).json({
        error: `This calendar share link expired on ${new Date(share.expiresAt).toLocaleDateString()}.`
      });
    }

    // Increment view count
    share.viewCount = (share.viewCount || 0) + 1;
    saveDb(db);

    let filteredEvents = db.events || [];
    if (Array.isArray(share.filterCategories) && share.filterCategories.length > 0) {
      filteredEvents = filteredEvents.filter((e) => share.filterCategories!.includes(e.categoryId));
    }
    if (share.filterTema && share.filterTema !== 'all') {
      filteredEvents = filteredEvents.filter((e) => {
        const eventTemas = Array.isArray(e.temas) && e.temas.length > 0 ? e.temas : (e.tema ? [e.tema] : []);
        return eventTemas.includes(share.filterTema!);
      });
    }

    let relevantCategories = db.categories || SEED_CATEGORIES;
    if (Array.isArray(share.filterCategories) && share.filterCategories.length > 0) {
      relevantCategories = relevantCategories.filter((c) => share.filterCategories!.includes(c.id));
      if (relevantCategories.length === 0) {
        relevantCategories = db.categories || SEED_CATEGORIES;
      }
    }

    return res.json({
      success: true,
      share,
      events: filteredEvents,
      categories: relevantCategories,
      settings: db.settings
    });
  });

  // PUBLIC: Get category metadata and scheduled events for QR / PDF browser viewing (No login required)
  app.get("/api/public/category/:categoryId", (req, res) => {
    const { categoryId } = req.params;
    const cleanId = (categoryId || '').trim();
    if (!cleanId) {
      return res.status(400).json({ error: "Missing category ID" });
    }

    const categories = db.categories || SEED_CATEGORIES;
    const category = categories.find(
      (c) => c.id.toLowerCase() === cleanId.toLowerCase() || c.name.toLowerCase() === cleanId.toLowerCase()
    );

    if (!category) {
      return res.status(404).json({ error: `Category "${cleanId}" not found.` });
    }

    const matchingEvents = (db.events || []).filter((e) => e.categoryId === category.id);

    return res.json({
      success: true,
      category,
      categories: categories,
      events: matchingEvents,
      settings: db.settings
    });
  });

  // ==========================================
  // ZAPIER + MICROSOFT OUTLOOK SYNC ENDPOINTS
  // ==========================================

  function parseOutlookDateTime(input: any): { date: string; time: string } {
    const now = new Date();
    const defaultDate = now.toISOString().split('T')[0];
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:00`;

    if (!input) return { date: defaultDate, time: defaultTime };

    let raw = '';
    if (typeof input === 'string') {
      raw = input.trim();
    } else if (typeof input === 'object') {
      raw = input.dateTime || input.date || input.time || input.raw || '';
    } else {
      raw = String(input);
    }

    if (!raw) return { date: defaultDate, time: defaultTime };

    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`
      };
    }

    const dateMatch = raw.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
    const timeMatch = raw.match(/(\d{1,2}:\d{2})/);

    const matchedDate = dateMatch ? dateMatch[1].replace(/\//g, '-') : defaultDate;
    const matchedTime = timeMatch ? (timeMatch[1].length === 4 ? `0${timeMatch[1]}` : timeMatch[1]) : defaultTime;

    return { date: matchedDate, time: matchedTime };
  }

  // Helper to determine the true external public base URL (Cloud Run or preview URL, never localhost)
  function getPublicBaseUrl(req?: express.Request): string {
    if (process.env.APP_URL) {
      return process.env.APP_URL.replace(/\/+$/, '');
    }
    if (process.env.NG_ALLOWED_HOSTS) {
      const allowed = process.env.NG_ALLOWED_HOSTS.split(' ')[0].trim();
      if (allowed && !allowed.includes('localhost') && !allowed.includes('127.0.0.1')) {
        return `https://${allowed}`.replace(/\/+$/, '');
      }
    }
    if (req) {
      const fHost = req.get('x-forwarded-host') || req.get('x-original-host');
      const fProto = req.get('x-forwarded-proto') || 'https';
      if (fHost && !fHost.includes('localhost') && !fHost.includes('127.0.0.1')) {
        return `${fProto}://${fHost}`.replace(/\/+$/, '');
      }
      const host = req.get('host');
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1') && !host.includes('0.0.0.0')) {
        const proto = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        return `${proto}://${host}`.replace(/\/+$/, '');
      }
    }
    return 'https://ais-dev-7l4infuif524ncheylrol3-488950738317.us-east1.run.app';
  }

  // Get current Zapier configuration and status
  app.get("/api/zapier/config", (req, res) => {
    if (!db.zapier) {
      db.zapier = {
        apiKey: `zap_${crypto.randomBytes(8).toString('hex')}`,
        catchHookUrl: '',
        enabled: true,
        syncDirection: 'two-way',
        defaultCategoryId: 'work',
        outlookAccountEmail: 'outlook-calendar@zapier.sync',
        lastSyncedAt: new Date().toISOString(),
        syncedEventsCount: 0,
        logs: []
      };
      saveDb(db);
    }

    const baseUrl = getPublicBaseUrl(req);
    const webhookUrl = `${baseUrl}/api/webhooks/zapier?apiKey=${db.zapier.apiKey}`;

    res.json({
      success: true,
      config: db.zapier,
      webhookUrl,
      baseUrl
    });
  });

  // Update Zapier configuration
  app.post("/api/zapier/config", (req, res) => {
    try {
      const updates = req.body || {};
      if (!db.zapier) {
        db.zapier = {
          apiKey: `zap_${crypto.randomBytes(8).toString('hex')}`,
          catchHookUrl: '',
          enabled: true,
          syncDirection: 'two-way',
          defaultCategoryId: 'work',
          outlookAccountEmail: 'outlook-calendar@zapier.sync',
          lastSyncedAt: new Date().toISOString(),
          syncedEventsCount: 0,
          logs: []
        };
      }

      if (updates.regenerateKey) {
        db.zapier.apiKey = `zap_${crypto.randomBytes(8).toString('hex')}`;
      } else if (updates.apiKey && typeof updates.apiKey === 'string') {
        db.zapier.apiKey = updates.apiKey.trim();
      }

      if (updates.catchHookUrl !== undefined) {
        db.zapier.catchHookUrl = String(updates.catchHookUrl || '').trim();
      }
      if (updates.enabled !== undefined) {
        db.zapier.enabled = !!updates.enabled;
      }
      if (updates.syncDirection) {
        db.zapier.syncDirection = updates.syncDirection;
      }
      if (updates.defaultCategoryId) {
        db.zapier.defaultCategoryId = updates.defaultCategoryId;
      }
      if (updates.outlookAccountEmail) {
        db.zapier.outlookAccountEmail = updates.outlookAccountEmail.trim();
      }

      saveDb(db);

      const baseUrl = getPublicBaseUrl(req);
      const webhookUrl = `${baseUrl}/api/webhooks/zapier?apiKey=${db.zapier.apiKey}`;

      res.json({
        success: true,
        config: db.zapier,
        webhookUrl
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to update Zapier config" });
    }
  });

  // Test Outbound Zapier Webhook (Pushes a sample Microsoft Outlook calendar event to Zapier Catch Hook)
  app.post("/api/zapier/test-outbound", async (req, res) => {
    try {
      const hookUrl = (req.body?.catchHookUrl || db.zapier?.catchHookUrl || '').trim();
      if (!hookUrl || !hookUrl.startsWith('http')) {
        return res.status(400).json({
          error: "Please enter a valid Zapier Catch Hook URL (e.g. https://hooks.zapier.com/hooks/catch/...)"
        });
      }

      const samplePayload = {
        action: 'create',
        source: 'Executive Calendar App',
        targetApp: 'Microsoft Outlook Calendar',
        event: {
          id: `test-evt-${Date.now()}`,
          title: 'Strategic Planning with Microsoft Outlook (Zapier Test)',
          subject: 'Strategic Planning with Microsoft Outlook (Zapier Test)',
          startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          startTime: '10:00',
          endTime: '11:00',
          startDateTime: `${new Date(Date.now() + 86400000).toISOString().split('T')[0]}T10:00:00`,
          endDateTime: `${new Date(Date.now() + 86400000).toISOString().split('T')[0]}T11:00:00`,
          location: 'Microsoft Teams Meeting / Headquarters',
          description: 'This is a sample test event dispatched to your Zapier Catch Hook to verify automated creation in Microsoft Outlook Calendar.',
          body: 'This is a sample test event dispatched to your Zapier Catch Hook to verify automated creation in Microsoft Outlook Calendar.',
          isAllDay: false,
          attendees: ['outlook-user@company.com'],
          categoryId: 'work'
        },
        sentAt: new Date().toISOString()
      };

      const zapRes = await fetch(hookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload)
      });

      const isOk = zapRes.ok;
      const logEntry: ZapierLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        type: 'test',
        status: isOk ? 'success' : 'error',
        eventTitle: 'Test Event to Zapier',
        details: `Dispatched sample event to ${hookUrl.slice(0, 45)}... (Status: ${zapRes.status} ${zapRes.statusText})`
      };

      if (!db.zapier) {
        db.zapier = {
          apiKey: `zap_${crypto.randomBytes(8).toString('hex')}`,
          catchHookUrl: '',
          enabled: true,
          syncDirection: 'two-way',
          defaultCategoryId: 'work',
          outlookAccountEmail: 'outlook-calendar@zapier.sync',
          lastSyncedAt: new Date().toISOString(),
          syncedEventsCount: 0,
          logs: []
        };
      }
      if (!db.zapier.logs) db.zapier.logs = [];
      db.zapier.logs.unshift(logEntry);
      if (db.zapier.logs.length > 30) db.zapier.logs = db.zapier.logs.slice(0, 30);
      saveDb(db);

      return res.json({
        success: isOk,
        status: zapRes.status,
        message: isOk
          ? "Sample event was successfully accepted by your Zapier Catch Hook! You can now test your Microsoft Outlook action in Zapier."
          : `Zapier responded with HTTP ${zapRes.status} ${zapRes.statusText}. Please verify the URL.`,
        sampleEvent: samplePayload.event
      });
    } catch (err: any) {
      return res.status(500).json({
        error: `Could not connect to Zapier Catch Hook: ${err?.message || 'Network error'}`
      });
    }
  });

  // Simulate Inbound Outlook event from Zapier (for instant visual testing without waiting)
  app.post("/api/zapier/simulate-inbound", (req, res) => {
    try {
      const tomorrow = new Date(Date.now() + 86400000);
      const tomorrowDate = tomorrow.toISOString().split('T')[0];

      const customTitle = req.body?.title || 'Outlook: Q4 Product Strategy & Client Review';
      const customLocation = req.body?.location || 'Microsoft Teams Meeting';
      const customTime = req.body?.time || '14:00';
      const customEndTime = req.body?.endTime || '15:00';

      const simulatedEvent: CalendarEvent = {
        id: `evt-zapier-${Date.now()}`,
        title: customTitle,
        description: 'Synchronized from Microsoft Outlook via Zapier automation hook.',
        location: customLocation,
        startDate: tomorrowDate,
        endDate: tomorrowDate,
        startTime: customTime,
        endTime: customEndTime,
        categoryId: db.zapier?.defaultCategoryId || 'work',
        userId: 'system',
        createdBy: 'Microsoft Outlook (via Zapier)',
        isAllDay: false,
        priority: 'high',
        attendees: ['outlook-team@company.com', 'client@partner.com'],
        source: 'microsoft-zapier',
        sourceAccountId: 'acc_zapier_outlook',
        sourceAccountEmail: db.zapier?.outlookAccountEmail || 'outlook-calendar@zapier.sync',
        externalEventId: `ms-outlook-${Date.now()}`
      };

      if (!db.events) db.events = [];
      db.events.push(simulatedEvent);

      if (!db.zapier) {
        db.zapier = {
          apiKey: `zap_${crypto.randomBytes(8).toString('hex')}`,
          catchHookUrl: '',
          enabled: true,
          syncDirection: 'two-way',
          defaultCategoryId: 'work',
          outlookAccountEmail: 'outlook-calendar@zapier.sync',
          lastSyncedAt: new Date().toISOString(),
          syncedEventsCount: 0,
          logs: []
        };
      }

      db.zapier.lastSyncedAt = new Date().toISOString();
      db.zapier.syncedEventsCount = (db.zapier.syncedEventsCount || 0) + 1;

      const logEntry: ZapierLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        type: 'inbound',
        status: 'success',
        eventTitle: simulatedEvent.title,
        details: `Simulated inbound event received from Microsoft Outlook (Tomorrow at ${customTime})`
      };
      if (!db.zapier.logs) db.zapier.logs = [];
      db.zapier.logs.unshift(logEntry);
      if (db.zapier.logs.length > 30) db.zapier.logs = db.zapier.logs.slice(0, 30);

      saveDb(db);

      return res.json({
        success: true,
        event: simulatedEvent,
        message: 'Microsoft Outlook event was simulated and added to your calendar!'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Simulation failed' });
    }
  });

  // Clear Zapier delivery logs
  app.post("/api/zapier/logs/clear", (req, res) => {
    if (db.zapier) {
      db.zapier.logs = [];
      saveDb(db);
    }
    res.json({ success: true, message: "Zapier logs cleared." });
  });

  // GET & OPTIONS Webhook Verification and Health Check Endpoint
  // Allows testing the endpoint directly in a browser or through Zapier pre-flight checks
  app.options(["/api/webhooks/zapier", "/api/zapier/webhook", "/api/webhooks/outlook"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, *");
    return res.sendStatus(204);
  });

  app.get(["/api/webhooks/zapier", "/api/zapier/webhook", "/api/webhooks/outlook"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, *");

    const providedApiKey =
      (req.headers['x-api-key'] as string) ||
      (req.headers['authorization'] ? (req.headers['authorization'] as string).replace(/^Bearer\s+/i, '') : null) ||
      (req.query.apiKey as string) ||
      (req.query.api_key as string) ||
      (req.query.key as string);

    const isAuthorized = !db.zapier?.apiKey || !providedApiKey || providedApiKey === db.zapier.apiKey;

    return res.status(200).json({
      status: "online",
      service: "Microsoft Outlook Zapier Webhook Bridge",
      ready: true,
      authenticated: isAuthorized,
      methodExpected: "POST",
      instructions: "Configure your Zap action as 'Webhooks by Zapier (POST)' pointing to this URL with payload type 'json'.",
      samplePayload: {
        subject: "Q3 Strategy Meeting",
        startDateTime: "2026-09-08T14:00:00Z",
        endDateTime: "2026-09-08T15:00:00Z",
        location: "Microsoft Teams",
        description: "Quarterly review meeting"
      },
      currentConfig: {
        syncDirection: db.zapier?.syncDirection || 'two-way',
        defaultCategory: db.zapier?.defaultCategoryId || 'work',
        outlookEmail: db.zapier?.outlookAccountEmail || 'outlook-calendar@zapier.sync'
      },
      timestamp: new Date().toISOString()
    });
  });

  // INBOUND WEBHOOK HANDLER FOR ZAPIER (Microsoft Outlook -> Zapier -> App)
  app.post(["/api/webhooks/zapier", "/api/zapier/webhook", "/api/webhooks/outlook"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, *");

    try {
      if (!db.zapier) {
        db.zapier = {
          apiKey: `zap_${crypto.randomBytes(8).toString('hex')}`,
          catchHookUrl: '',
          enabled: true,
          syncDirection: 'two-way',
          defaultCategoryId: 'work',
          outlookAccountEmail: 'outlook-calendar@zapier.sync',
          lastSyncedAt: new Date().toISOString(),
          syncedEventsCount: 0,
          logs: []
        };
      }

      // Check API Key security
      const providedApiKey =
        (req.headers['x-api-key'] as string) ||
        (req.headers['authorization'] ? (req.headers['authorization'] as string).replace(/^Bearer\s+/i, '') : null) ||
        (req.query.apiKey as string) ||
        (req.query.api_key as string) ||
        (req.query.key as string) ||
        (typeof req.body === 'object' && req.body ? (req.body.apiKey || req.body.api_key) : null);

      if (db.zapier.apiKey && providedApiKey && providedApiKey !== db.zapier.apiKey) {
        const errorLog: ZapierLogEntry = {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          type: 'inbound',
          status: 'error',
          eventTitle: 'Unauthorized Webhook Attempt',
          details: 'Rejected inbound Zapier call: Invalid API Key provided.'
        };
        if (!db.zapier.logs) db.zapier.logs = [];
        db.zapier.logs.unshift(errorLog);
        saveDb(db);

        return res.status(401).json({
          error: "Unauthorized. Invalid Zapier webhook API Key.",
          hint: "Check the ?apiKey= parameter or x-api-key header against the key in your app's Zapier settings."
        });
      }

      // Parse payload if passed as raw text/form
      let payload = req.body || {};
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = { subject: payload };
        }
      }

      const nowIso = new Date().toISOString();

      const rawItems = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.events)
        ? payload.events
        : [payload.event || payload];

      // Check if this was a Zapier connection test/ping
      const isTestPing =
        !payload ||
        Object.keys(payload).length === 0 ||
        (payload.test !== undefined && !payload.subject && !payload.title) ||
        (rawItems.length === 1 &&
          (!rawItems[0] ||
            Object.keys(rawItems[0]).length === 0 ||
            (!rawItems[0].subject &&
              !rawItems[0].title &&
              !rawItems[0].summary &&
              !rawItems[0].name &&
              !rawItems[0].start &&
              !rawItems[0].startDateTime)));

      if (isTestPing) {
        const pingLog: ZapierLogEntry = {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowIso,
          type: 'inbound',
          status: 'success',
          eventTitle: 'Zapier Connection Test Ping',
          details: 'Successfully verified connection from Zapier. Webhook endpoint is active and listening.'
        };
        if (!db.zapier.logs) db.zapier.logs = [];
        db.zapier.logs.unshift(pingLog);
        db.zapier.lastSyncedAt = nowIso;
        saveDb(db);

        return res.status(200).json({
          success: true,
          status: "connected",
          message: "Zapier webhook connection verified successfully! Your calendar is ready to receive Microsoft Outlook events.",
          receivedAt: nowIso
        });
      }

      const processedEvents: any[] = [];

      for (const item of rawItems) {
        if (!item || typeof item !== 'object') continue;

        const action = (item.action || payload.action || 'create').toLowerCase();
        const externalId = String(
          item.id || item.eventId || item.externalEventId || item.outlookId || item.ItemId || item.itemId || ''
        ).trim();

        const title = String(
          item.subject || item.title || item.summary || item.name || 'Microsoft Outlook Event'
        ).trim();

        if (action === 'delete' || item.deleted === true) {
          if (!db.deletedEventIds) db.deletedEventIds = [];
          const toDelete = db.events.filter(
            (e) =>
              (externalId && e.externalEventId === externalId) ||
              (e.source === 'microsoft-zapier' && e.title.toLowerCase() === title.toLowerCase())
          );

          toDelete.forEach((evt) => {
            if (!db.deletedEventIds!.includes(evt.id)) {
              db.deletedEventIds!.push(evt.id);
            }
          });

          db.events = db.events.filter((e) => !toDelete.some((d) => d.id === e.id));
          saveDb(db);

          const logEntry: ZapierLogEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: nowIso,
            type: 'inbound',
            status: 'success',
            eventTitle: title,
            details: `Deleted Microsoft Outlook event via Zapier (External ID: ${externalId || 'title match'})`
          };
          if (!db.zapier.logs) db.zapier.logs = [];
          db.zapier.logs.unshift(logEntry);
          processedEvents.push({ action: 'deleted', title, externalId });
          continue;
        }

        const parsedStart = parseOutlookDateTime(item.start || item.startDateTime || item.startDate || item.start_date || item.start_time);
        const parsedEnd = parseOutlookDateTime(item.end || item.endDateTime || item.endDate || item.end_date || item.end_time || item.start || item.startDate);

        let startDate = parsedStart.date;
        let startTime = item.startTime || parsedStart.time || '09:00';
        let endDate = parsedEnd.date;
        let endTime = item.endTime || parsedEnd.time || '10:00';

        if (endDate < startDate) {
          endDate = startDate;
        }

        const description = String(
          item.description || item.body || item.bodyPreview || item.notes || item.content || ''
        ).trim();

        let location = '';
        if (typeof item.location === 'object' && item.location) {
          location = item.location.displayName || item.location.name || item.location.address || '';
        } else if (typeof item.location === 'string') {
          location = item.location.trim();
        }

        const categoryId = item.categoryId || item.category || db.zapier.defaultCategoryId || 'work';
        const isAllDay = !!(item.isAllDay || item.allDay);

        const existingIdx = db.events.findIndex(
          (e) =>
            (externalId && e.externalEventId === externalId) ||
            (e.source === 'microsoft-zapier' && e.title === title && e.startDate === startDate && e.startTime === startTime)
        );

        const targetId = existingIdx >= 0 ? db.events[existingIdx].id : `evt-zapier-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        const newEvent: CalendarEvent = {
          id: targetId,
          title,
          description,
          location,
          startDate,
          endDate,
          startTime,
          endTime,
          categoryId,
          userId: 'system',
          createdBy: 'Microsoft Outlook (via Zapier)',
          isAllDay,
          priority: item.priority || 'medium',
          attendees: Array.isArray(item.attendees) ? item.attendees : [],
          source: 'microsoft-zapier',
          sourceAccountId: 'acc_zapier_outlook',
          sourceAccountEmail: db.zapier.outlookAccountEmail || 'outlook-calendar@zapier.sync',
          externalEventId: externalId || undefined
        };

        if (existingIdx >= 0) {
          db.events[existingIdx] = { ...db.events[existingIdx], ...newEvent };
        } else {
          db.events.push(newEvent);
        }

        if (db.deletedEventIds && db.deletedEventIds.includes(targetId)) {
          db.deletedEventIds = db.deletedEventIds.filter((id) => id !== targetId);
        }

        processedEvents.push(newEvent);
      }

      db.zapier.lastSyncedAt = nowIso;
      db.zapier.syncedEventsCount = (db.zapier.syncedEventsCount || 0) + processedEvents.length;

      const logEntry: ZapierLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        type: 'inbound',
        status: 'success',
        eventTitle: processedEvents[0]?.title || 'Batch Outlook Events',
        details: `Received ${processedEvents.length} event(s) from Microsoft Outlook via Zapier`
      };
      if (!db.zapier.logs) db.zapier.logs = [];
      db.zapier.logs.unshift(logEntry);
      if (db.zapier.logs.length > 30) db.zapier.logs = db.zapier.logs.slice(0, 30);

      saveDb(db);

      return res.status(200).json({
        success: true,
        count: processedEvents.length,
        events: processedEvents,
        message: `Successfully synchronized ${processedEvents.length} Microsoft Outlook event(s) via Zapier.`
      });
    } catch (err: any) {
      console.error("Error handling Zapier webhook:", err);
      return res.status(500).json({
        error: err?.message || "Internal server error processing Zapier webhook."
      });
    }
  });

  // PUBLIC: Direct HTML/PDF Document View for scanning QR codes (Clean document view with Event Title, Date, Time only + Next Month Navigation)
  // PUBLIC: Direct HTML/PDF Document View for scanning QR codes (Clean document view with Event Title, Date, Time only + Next Month Navigation)
  const renderCategoryPdfHtml = (category: any, events: any[], allCategories: any[], qrDataUrl?: string, requestedMonth?: string) => {
    const cleanDeduplicated = deduplicateServerEvents(events || []);
    const sortedEvents = [...cleanDeduplicated].sort((a, b) => {
      const aKey = (a.startDate || '') + (a.startTime || '');
      const bKey = (b.startDate || '') + (b.startTime || '');
      return aKey.localeCompare(bKey);
    });

    const escapeHtml = (str: string) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const formatTime12h = (timeStr?: string) => {
      if (!timeStr) return '';
      const [hStr, mStr] = timeStr.split(':');
      let h = parseInt(hStr, 10);
      const m = mStr || '00';
      if (isNaN(h)) return timeStr;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return `${h}:${m} ${ampm}`;
    };

    const formatDate = (dateStr?: string) => {
      if (!dateStr) return 'Unscheduled';
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    };

    const getMonthName = (ymStr: string) => {
      const parts = ymStr.split('-');
      if (parts.length === 2) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      return ymStr;
    };

    const isAll = category.id === 'all' || category.id === 'overview';
    const categoriesMap = new Map((allCategories || []).map((c: any) => [c.id, c]));

    // Determine initial month on server so HTML is pre-rendered immediately for any scanner or browser
    const now = new Date();
    const currentYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let initialMonth = currentYMD;
    if (requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)) {
      initialMonth = requestedMonth;
    } else {
      const hasCurrent = sortedEvents.some(e => (e.startDate || '').startsWith(currentYMD));
      if (!hasCurrent && sortedEvents.length > 0) {
        const future = sortedEvents.filter(e => (e.startDate || '').slice(0, 7) > currentYMD);
        if (future.length > 0 && future[0].startDate) {
          initialMonth = future[0].startDate.slice(0, 7);
        } else {
          const past = [...sortedEvents].reverse().filter(e => (e.startDate || '').slice(0, 7) < currentYMD);
          if (past.length > 0 && past[0].startDate) {
            initialMonth = past[0].startDate.slice(0, 7);
          }
        }
      }
    }

    const initialMonthEvents = sortedEvents.filter(e => (e.startDate || '').startsWith(initialMonth));
    const availableMonths = Array.from(new Set(sortedEvents.map(e => (e.startDate || '').slice(0, 7)).filter(Boolean))).sort();

    // Pre-render Mini Calendar HTML
    const parts = initialMonth.split('-');
    const calYear = parseInt(parts[0], 10);
    const calMonth = parseInt(parts[1], 10);
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
    const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const eventCounts: { [d: string]: number } = {};
    sortedEvents.forEach(e => {
      if (e.startDate && e.startDate.startsWith(initialMonth)) {
        eventCounts[e.startDate] = (eventCounts[e.startDate] || 0) + 1;
      }
    });
    const totalMonthEvents = Object.values(eventCounts).reduce((a, b) => a + b, 0);

    let preRenderedMiniCalHtml = `
      <div class="mini-cal-header">
        <div class="mini-cal-title">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${escapeHtml(category.hex || '#4f46e5')};"></span>
          ${escapeHtml(getMonthName(initialMonth))} (${totalMonthEvents} event${totalMonthEvents === 1 ? '' : 's'})
        </div>
      </div>
      <div class="mini-cal-grid-wrapper">
        <div class="mini-cal-days-header">
          <div class="mini-cal-day-label">S</div>
          <div class="mini-cal-day-label">M</div>
          <div class="mini-cal-day-label">T</div>
          <div class="mini-cal-day-label">W</div>
          <div class="mini-cal-day-label">T</div>
          <div class="mini-cal-day-label">F</div>
          <div class="mini-cal-day-label">S</div>
        </div>
        <div class="mini-cal-days-grid">
    `;
    for (let i = 0; i < firstDayOfWeek; i++) {
      preRenderedMiniCalHtml += `<div class="mini-cal-cell empty"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const count = eventCounts[dStr] || 0;
      const isTodayDate = dStr === todayYMD;
      let cellClasses = 'mini-cal-cell';
      if (count > 0) cellClasses += ' has-events';
      if (isTodayDate) cellClasses += ' today-cell';
      preRenderedMiniCalHtml += `<div class="${cellClasses}" onclick="toggleDayFilter('${dStr}')"><span>${d}</span>${count > 0 ? `<span class="mini-cal-dot" style="background:${escapeHtml(category.hex || '#4f46e5')};"></span>` : ''}</div>`;
    }
    preRenderedMiniCalHtml += `</div></div>`;

    // Pre-render Events List HTML
    let preRenderedEventsHtml = '';
    if (initialMonthEvents.length === 0) {
      let monthButtonsHtml = '';
      if (availableMonths.length > 0) {
        monthButtonsHtml = `
          <div style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed #e2e8f0;">
            <div style="font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 10px;">📅 Scheduled Events Available In Other Months:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
              ${availableMonths.map(m => `<a href="?month=${m}" onclick="setMonth('${m}'); return false;" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 9999px; background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; text-decoration: none; display: inline-block;">${escapeHtml(getMonthName(m))}</a>`).join('')}
            </div>
          </div>
        `;
      }
      preRenderedEventsHtml = `
        <div style="text-align: center; padding: 36px 20px; background: #f8fafc; border-radius: 16px; border: 1px dashed #cbd5e1; margin-top: 10px;">
          <div style="font-size: 28px; margin-bottom: 8px;">📅</div>
          <h3 style="font-size: 14px; font-weight: 800; color: #1e293b; margin: 0 0 4px 0;">No Events in ${escapeHtml(getMonthName(initialMonth))}</h3>
          <p style="font-size: 13px; color: #64748b; margin: 0;">There are no scheduled events for this month.</p>
          ${monthButtonsHtml}
        </div>
      `;
    } else {
      const grouped: { [d: string]: any[] } = {};
      initialMonthEvents.forEach(e => {
        const d = e.startDate || 'No Date';
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(e);
      });

      for (const dateKey of Object.keys(grouped)) {
        const dateFormatted = formatDate(dateKey);
        const count = grouped[dateKey].length;
        preRenderedEventsHtml += `<div class="date-header"><span>📅 ${escapeHtml(dateFormatted)}</span><span style="font-size:11px; font-weight:600; color:#94a3b8; margin-left:auto;">${count} event${count === 1 ? '' : 's'}</span></div>`;
        preRenderedEventsHtml += `<div style="margin-bottom: 12px;">`;

        for (const evt of grouped[dateKey]) {
          let timeDisplay = 'All-Day';
          if (!evt.isAllDay && evt.startTime) {
            timeDisplay = formatTime12h(evt.startTime);
            if (evt.endTime) {
              timeDisplay += ' – ' + formatTime12h(evt.endTime);
            }
          }
          const cat = categoriesMap.get(evt.categoryId) || { hex: category.hex || '#4f46e5' };
          const evtColor = cat.hex || category.hex || '#4f46e5';
          let noteSnippet = '';
          const notesText = evt.notes || evt.description || '';
          if (notesText && notesText.trim()) {
            noteSnippet = `<div style="font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.4;">📝 ${escapeHtml(notesText)}</div>`;
          }

          preRenderedEventsHtml += `
            <div class="event-row" style="border-left: 4px solid ${escapeHtml(evtColor)};">
              <div style="flex:1;">
                <h3 class="event-title">${escapeHtml(evt.title || 'Untitled Event')}</h3>
                ${noteSnippet}
              </div>
              <div class="event-datetime">
                <span class="event-date">${escapeHtml(dateFormatted)}</span>
                <span class="event-time">⏰ ${escapeHtml(timeDisplay)}</span>
              </div>
            </div>
          `;
        }
        preRenderedEventsHtml += `</div>`;
      }
    }

    // Pre-render Notes Section
    const eventsWithNotes = initialMonthEvents.filter(e => Boolean((e.notes || e.description || '').trim()));
    let preRenderedNotesHtml = '';
    if (eventsWithNotes.length === 0) {
      preRenderedNotesHtml = `<div class="notes-empty">No notes for ${escapeHtml(getMonthName(initialMonth))}.</div>`;
    } else {
      for (const e of eventsWithNotes) {
        const dateFormatted = formatDate(e.startDate);
        let timeStr = '';
        if (!e.isAllDay && e.startTime) {
          timeStr = ' • ' + formatTime12h(e.startTime);
        }
        const notesContent = e.notes || e.description || '';
        preRenderedNotesHtml += `
          <div class="note-card">
            <div class="note-card-header">
              <span class="note-event-title">${escapeHtml(e.title)}</span>
              <span class="note-event-date">${escapeHtml(dateFormatted + timeStr)}</span>
            </div>
            <div class="note-card-body">${escapeHtml(notesContent)}</div>
          </div>
        `;
      }
    }

    // Serialize events to JSON for client-side month navigation script
    const eventsJson = JSON.stringify(
      sortedEvents.map(e => {
        const cat = categoriesMap.get(e.categoryId) || { name: 'General', hex: '#6366f1' };
        return {
          id: e.id,
          title: e.title || 'Untitled Event',
          startDate: e.startDate || '',
          endDate: e.endDate || '',
          startTime: e.startTime || '',
          endTime: e.endTime || '',
          isAllDay: Boolean(e.isAllDay),
          categoryId: e.categoryId || '',
          categoryName: cat.name || '',
          categoryHex: cat.hex || '#6366f1',
          notes: e.notes || e.description || '',
          description: e.description || ''
        };
      })
    );

    const categoriesListJson = JSON.stringify(
      (allCategories || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        hex: c.hex || '#6366f1'
      }))
    );

    const safeCategoryName = escapeHtml((category.name || 'category').trim().replace(/[^a-zA-Z0-9_-]/g, '_'));

    const qrBlockHtml = qrDataUrl ? `
      <div class="doc-header-qr no-print" style="display: flex; align-items: center; gap: 8px; margin-left: 12px; padding: 4px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
        <img src="${qrDataUrl}" alt="Scan QR Code" style="width: 48px; height: 48px; border-radius: 6px; display: block;" />
        <div style="font-size: 10px; line-height: 1.25; color: #64748b;">
          <strong style="color: #0f172a; display: block;">Public QR Link</strong>
          <span>Scan on any phone</span>
        </div>
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(category.name)} Schedule</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .document-container {
      max-width: 760px;
      margin: 20px auto 48px auto;
      padding: 0 16px;
    }
    .document-sheet {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 32px 36px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04);
    }
    .month-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 8px 14px;
      margin-bottom: 20px;
    }
    .month-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      letter-spacing: -0.2px;
    }
    .month-nav-arrow {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #1e293b;
      font-size: 20px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      user-select: none;
      line-height: 1;
      -webkit-tap-highlight-color: transparent;
    }
    .month-nav-arrow:hover {
      background: #f1f5f9;
      color: #0f172a;
      border-color: #94a3b8;
      transform: scale(1.04);
    }
    .month-nav-arrow:active {
      transform: scale(0.96);
    }

    /* Small Month Calendar Styles */
    .mini-cal-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px 20px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .mini-cal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .mini-cal-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mini-cal-grid-wrapper {
      max-width: 320px;
      margin: 0 auto;
    }
    .mini-cal-days-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      text-align: center;
      margin-bottom: 4px;
    }
    .mini-cal-day-label {
      font-size: 10px;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      padding: 2px 0;
    }
    .mini-cal-days-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      text-align: center;
    }
    .mini-cal-cell {
      height: 32px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      position: relative;
      background: transparent;
      border: 1px solid transparent;
      cursor: default;
      transition: all 0.1s ease;
    }
    .mini-cal-cell.empty {
      visibility: hidden;
    }
    .mini-cal-cell.has-events {
      background: #ffffff;
      color: #0f172a;
      font-weight: 800;
      border-color: #cbd5e1;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .mini-cal-cell.has-events:hover {
      border-color: #4f46e5;
      background: #eef2ff;
    }
    .mini-cal-cell.active-day {
      background: #4f46e5 !important;
      color: #ffffff !important;
      font-weight: 800;
      border-color: #4f46e5 !important;
      box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);
    }
    .mini-cal-cell.today-cell {
      border: 1.5px solid #6366f1;
    }
    .mini-cal-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      margin-top: 1px;
    }

    /* Event Row Layout: Title, Date, Time */
    .event-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 4px solid ${escapeHtml(category.hex || '#4f46e5')};
      margin-bottom: 8px;
      transition: all 0.1s ease;
      page-break-inside: avoid;
    }
    .event-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      line-height: 1.4;
    }
    .event-datetime {
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: right;
      flex-shrink: 0;
    }
    .event-date {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
    }
    .event-time {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 4px 8px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
    .date-header {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      margin: 18px 0 8px 2px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .date-header::after {
      content: "";
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }

    /* Notes Section at Bottom of Page */
    .notes-section {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
    }
    .notes-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #334155;
      margin-bottom: 14px;
    }
    .notes-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .note-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 16px;
    }
    .note-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
    }
    .note-event-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .note-event-date {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      white-space: nowrap;
    }
    .note-card-body {
      font-size: 13px;
      color: #334155;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .notes-empty {
      padding: 16px 20px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 12px;
      font-size: 13px;
      color: #94a3b8;
      text-align: center;
    }

    .doc-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }
    .doc-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .category-indicator-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .doc-category-name {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.3px;
    }
    .doc-header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .live-sync-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #065f46;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 4px 10px;
      border-radius: 9999px;
      user-select: none;
    }
    .live-sync-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
      animation: livePulse 2s infinite;
    }
    @keyframes livePulse {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.25); opacity: 1; box-shadow: 0 0 6px #10b981; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }
    .btn-refresh-schedule {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 6px 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-refresh-schedule:hover {
      background: #ffffff;
      border-color: #94a3b8;
      color: #0f172a;
    }
    .btn-print-schedule {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
      background: #4f46e5;
      border: 1px solid #4338ca;
      border-radius: 10px;
      padding: 6px 14px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-print-schedule:hover {
      background: #4338ca;
    }
    .print-only {
      display: none;
    }

    @media print {
      body { background: #ffffff !important; font-size: 12pt; }
      .no-print { display: none !important; }
      .print-only { display: block !important; }
      .doc-print-header { margin-bottom: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
      .doc-print-header h1 { font-size: 20pt; margin: 0 0 4px 0; color: #000; }
      .document-container { margin: 0 !important; max-width: 100% !important; padding: 0 !important; }
      .document-sheet { border: none !important; box-shadow: none !important; padding: 0 !important; border-radius: 0 !important; }
      .mini-cal-card { background: #ffffff !important; border: 1px solid #cbd5e1 !important; }
      .event-row { border: 1px solid #cbd5e1 !important; border-left: 4px solid ${escapeHtml(category.hex || '#000000')} !important; margin-bottom: 6px !important; padding: 10px 14px !important; }
      @page { margin: 15mm; size: auto; }
    }
    @media (max-width: 640px) {
      .document-sheet { padding: 20px 14px; }
      .event-row { flex-direction: column; align-items: flex-start; gap: 8px; }
      .event-datetime { width: 100%; justify-content: space-between; }
    }
  </style>
</head>
<body>

  <div class="document-container">
    <div class="document-sheet">

      <!-- Top Header & Live Sync Status Bar -->
      <div class="doc-header-row no-print">
        <div class="doc-header-left">
          <span class="category-indicator-dot" style="background:${escapeHtml(category.hex || '#4f46e5')};"></span>
          <h1 class="doc-category-name">${escapeHtml(category.name)}</h1>
        </div>
        <div class="doc-header-right">
          ${qrBlockHtml}
          <div class="live-sync-pill" id="liveSyncStatus">
            <span class="live-sync-dot"></span>
            <span id="liveSyncText">Live Schedule</span>
          </div>
          <button onclick="fetchLatestLiveEvents(true)" class="btn-refresh-schedule" title="Check for live updates">
            <span id="refreshIcon">&#8635;</span> Refresh
          </button>
          <a href="/pdf/${encodeURIComponent(category.id)}/calendar.ics" class="btn-refresh-schedule" style="text-decoration: none;" title="Add these events to your phone's Calendar (Apple / Google / Outlook)">
            📅 Add to Calendar
          </a>
          <button onclick="window.print()" class="btn-print-schedule" title="Print or save as PDF">
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      <div class="print-only doc-print-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
        <div>
          <h1 style="margin: 0 0 4px 0; font-size: 20pt; color: #000;">${escapeHtml(category.name)} Schedule</h1>
          <div style="font-size: 10pt; color: #475569;">Real-Time Church Calendar • Scan QR Code to view latest updates on any phone</div>
        </div>
        ${qrDataUrl ? `
          <div style="text-align: center;">
            <img src="${qrDataUrl}" alt="QR Code" style="width: 72px; height: 72px; display: block; border: 1px solid #cbd5e1; border-radius: 4px;" />
            <div style="font-size: 8pt; font-weight: 700; color: #334155; margin-top: 2px;">SCAN TO VIEW</div>
          </div>
        ` : ''}
      </div>

      <!-- Month Navigation Controls Bar (Arrows Only) -->
      <div class="month-bar no-print">
        <button onclick="goToPrevMonth()" class="month-nav-arrow" id="prevMonthBtn" title="Previous Month" aria-label="Previous Month">&#8592;</button>

        <div class="month-title" id="monthDisplay">
          <span id="currentMonthText">${escapeHtml(getMonthName(initialMonth))}</span>
        </div>

        <button onclick="goToNextMonth()" class="month-nav-arrow" id="nextMonthBtn" title="Next Month" aria-label="Next Month">&#8594;</button>
      </div>

      <!-- Small Month Calendar Overview Box -->
      <div class="mini-cal-card" id="miniCalContainer">
        ${preRenderedMiniCalHtml}
      </div>

      <!-- Events List Container (Title, Date, Time) -->
      <div id="eventsListContainer">
        ${preRenderedEventsHtml}
      </div>

      <!-- Notes Section at Bottom of Page -->
      <div class="notes-section" id="notesSection">
        <div class="notes-header">
          <span>📝 Notes</span>
        </div>
        <div id="notesContainer" class="notes-container">
          ${preRenderedNotesHtml}
        </div>
      </div>

    </div>
  </div>

  <script>
    let allEvents = ${eventsJson};
    const categoriesList = ${categoriesListJson};
    const isAllMode = ${isAll ? 'true' : 'false'};
    const categoryHex = "${escapeHtml(category.hex || '#4f46e5')}";
    const targetCategoryId = "${escapeHtml(category.id)}";
    const categoriesMapObj = ${categoriesListJson}.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

    let selectedCategoryFilter = 'all';

    // Determine initial month: from URL ?month=YYYY-MM, or first event month, or current month
    const urlParams = new URLSearchParams(window.location.search);
    const urlMonth = urlParams.get('month');

    function getCurrentOrFirstMonth() {
      if (urlMonth && /^\d{4}-\d{2}$/.test(urlMonth)) {
        return urlMonth;
      }
      if (allEvents.length === 0) {
        const today = new Date();
        return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
      }

      const today = new Date();
      const thisYMD = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');

      // 1. If current month has events, show current month
      const hasCurrentMonthEvents = allEvents.some(e => (e.startDate || '').startsWith(thisYMD));
      if (hasCurrentMonthEvents) {
        return thisYMD;
      }

      // 2. Otherwise find the first upcoming month that has events
      const futureEvents = allEvents
        .filter(e => (e.startDate || '').slice(0, 7) > thisYMD)
        .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      if (futureEvents.length > 0 && futureEvents[0].startDate) {
        return futureEvents[0].startDate.slice(0, 7);
      }

      // 3. Otherwise find the most recent past month that has events
      const pastEvents = allEvents
        .filter(e => (e.startDate || '').slice(0, 7) < thisYMD)
        .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
      if (pastEvents.length > 0 && pastEvents[0].startDate) {
        return pastEvents[0].startDate.slice(0, 7);
      }

      return thisYMD;
    }

    let activeMonth = getCurrentOrFirstMonth();
    let selectedDayFilter = null;
    let searchQuery = '';

    function formatTime(timeStr) {
      if (!timeStr) return '';
      const parts = timeStr.split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1] || '00';
      if (isNaN(h)) return timeStr;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return h + ':' + m + ' ' + ampm;
    }

    function formatDate(dateStr) {
      if (!dateStr) return 'Unscheduled';
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    }

    function getMonthName(ymStr) {
      const parts = ymStr.split('-');
      if (parts.length === 2) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      return ymStr;
    }

    function computeNextMonth(ymStr) {
      const parts = ymStr.split('-');
      let y = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      return y + '-' + String(m).padStart(2, '0');
    }

    function computePrevMonth(ymStr) {
      const parts = ymStr.split('-');
      let y = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      return y + '-' + String(m).padStart(2, '0');
    }

    function renderMiniCalendar() {
      const calContainer = document.getElementById('miniCalContainer');
      if (!calContainer) return;

      const parts = activeMonth.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);

      const daysInMonth = new Date(year, month, 0).getDate();
      const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

      const today = new Date();
      const todayYMD = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

      // Map event counts per day
      const eventCounts = {};
      allEvents.forEach(e => {
        if (e.startDate && e.startDate.startsWith(activeMonth)) {
          eventCounts[e.startDate] = (eventCounts[e.startDate] || 0) + 1;
        }
      });

      const monthTitle = getMonthName(activeMonth);
      const totalMonthEvents = Object.values(eventCounts).reduce((a, b) => a + b, 0);

      let html = '<div class="mini-cal-header">' +
        '<div class="mini-cal-title">' +
        '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:' + categoryHex + ';"></span> ' +
        monthTitle + ' (' + totalMonthEvents + ' events)' +
        '</div>';

      if (selectedDayFilter) {
        html += '<button onclick="clearDayFilter()" class="no-print" style="border:1px solid #cbd5e1; background:#ffffff; font-size:11px; font-weight:700; color:#4f46e5; border-radius:6px; padding:3px 8px; cursor:pointer;">' +
          '✕ Clear Day Filter (' + selectedDayFilter + ')' +
          '</button>';
      }

      html += '</div>';

      html += '<div class="mini-cal-grid-wrapper">';
      
      // Day names header
      html += '<div class="mini-cal-days-header">';
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
        html += '<div class="mini-cal-day-label">' + d + '</div>';
      });
      html += '</div>';

      // Day numbers grid
      html += '<div class="mini-cal-days-grid">';

      // Empty lead days
      for (let i = 0; i < firstDayOfWeek; i++) {
        html += '<div class="mini-cal-cell empty"></div>';
      }

      // Month days
      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = year + '-' + String(month).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const count = eventCounts[dStr] || 0;
        const isToday = dStr === todayYMD;
        const isSelected = selectedDayFilter === dStr;

        let cellClasses = 'mini-cal-cell';
        if (count > 0) cellClasses += ' has-events';
        if (isToday) cellClasses += ' today-cell';
        if (isSelected) cellClasses += ' active-day';

        const clickHandler = count > 0 ? 'onclick="toggleDayFilter(\\'' + dStr + '\\')"' : '';

        html += '<div class="' + cellClasses + '" ' + clickHandler + ' title="' + (count > 0 ? count + ' event(s) on ' + dStr : dStr) + '">';
        html += '<span>' + d + '</span>';
        if (count > 0) {
          const dotBg = isSelected ? '#ffffff' : categoryHex;
          html += '<span class="mini-cal-dot" style="background:' + dotBg + ';"></span>';
        }
        html += '</div>';
      }

      html += '</div></div>';
      calContainer.innerHTML = html;
    }

    function toggleDayFilter(dateStr) {
      if (selectedDayFilter === dateStr) {
        selectedDayFilter = null;
      } else {
        selectedDayFilter = dateStr;
      }
      renderView();
    }

    function clearDayFilter() {
      selectedDayFilter = null;
      renderView();
    }

    function renderView() {
      const monthTitle = getMonthName(activeMonth);
      const monthTextEl = document.getElementById('currentMonthText');
      if (monthTextEl) monthTextEl.innerText = monthTitle;
      document.title = "${escapeHtml(category.name)} Schedule - " + monthTitle;

      const nextMonthStr = computeNextMonth(activeMonth);
      const nextMonthName = getMonthName(nextMonthStr);
      const nextBtn = document.getElementById('nextMonthBtn');
      if (nextBtn) {
        nextBtn.innerHTML = '&#8594;';
        nextBtn.title = 'Go to ' + nextMonthName;
      }

      const prevMonthStr = computePrevMonth(activeMonth);
      const prevMonthName = getMonthName(prevMonthStr);
      const prevBtn = document.getElementById('prevMonthBtn');
      if (prevBtn) {
        prevBtn.innerHTML = '&#8592;';
        prevBtn.title = 'Go to ' + prevMonthName;
      }

      // Render the mini-calendar overview
      renderMiniCalendar();

      // Filter events belonging to active month & day filter
      const monthEvents = allEvents.filter(e => {
        if (!(e.startDate || '').startsWith(activeMonth)) return false;
        if (selectedDayFilter && e.startDate !== selectedDayFilter) return false;
        return true;
      });

      const container = document.getElementById('eventsListContainer');

      if (monthEvents.length === 0) {
        let emptyMsg = 'There are no scheduled events for this month.';
        if (selectedDayFilter) {
          emptyMsg = 'No events scheduled on ' + formatDate(selectedDayFilter) + '.';
        }

        const availableMonths = Array.from(new Set(allEvents.map(e => (e.startDate || '').slice(0, 7)).filter(Boolean))).sort();
        let monthButtonsHtml = '';
        if (availableMonths.length > 0) {
          monthButtonsHtml = '<div style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed #e2e8f0;">' +
            '<div style="font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 10px;">📅 Scheduled Events Available In Other Months:</div>' +
            '<div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">' +
            availableMonths.map(m => '<button onclick="setMonth(\\'' + m + '\\')" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 9999px; background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; cursor: pointer;">' + getMonthName(m) + '</button>').join('') +
            '</div></div>';
        }

        container.innerHTML = '<div style="text-align: center; padding: 36px 20px; background: #f8fafc; border-radius: 16px; border: 1px dashed #cbd5e1; margin-top: 10px;">' +
          '<div style="font-size: 28px; margin-bottom: 8px;">📅</div>' +
          '<h3 style="font-size: 14px; font-weight: 800; color: #1e293b; margin: 0 0 4px 0;">No Events in ' + monthTitle + '</h3>' +
          '<p style="font-size: 13px; color: #64748b; margin: 0;">' + emptyMsg + '</p>' +
          (selectedDayFilter ? 
            '<div style="margin-top: 14px;"><button onclick="clearDayFilter()" style="border:1px solid #cbd5e1; background:#ffffff; font-size:12px; font-weight:700; color:#4f46e5; border-radius:8px; padding:6px 12px; cursor:pointer;"><span>Show All ' + monthTitle + ' Events</span></button></div>' : ''
          ) +
          monthButtonsHtml +
          '</div>';
      } else {
        // Group by date for clear organization
        const grouped = {};
        monthEvents.forEach(e => {
          const d = e.startDate || 'No Date';
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push(e);
        });

        let html = '';
        Object.keys(grouped).forEach(dateKey => {
          const dateFormatted = formatDate(dateKey);
          const count = grouped[dateKey].length;
          html += '<div class="date-header"><span>📅 ' + dateFormatted + '</span><span style="font-size:11px; font-weight:600; color:#94a3b8; margin-left:auto;">' + count + ' event' + (count === 1 ? '' : 's') + '</span></div>';
          html += '<div style="margin-bottom: 12px;">';
          
          grouped[dateKey].forEach(evt => {
            let timeDisplay = 'All-Day';
            if (!evt.isAllDay && evt.startTime) {
              timeDisplay = formatTime(evt.startTime);
              if (evt.endTime) {
                timeDisplay += ' – ' + formatTime(evt.endTime);
              }
            }

            const evtColor = evt.categoryHex || categoryHex;
            let noteSnippet = '';
            if (evt.notes && evt.notes.trim()) {
              noteSnippet = '<div style="font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.4;">📝 ' + escapeText(evt.notes) + '</div>';
            }

            html += '<div class="event-row" style="border-left: 4px solid ' + evtColor + ';">' +
              '<div style="flex:1;">' +
                '<h3 class="event-title">' + escapeText(evt.title) + '</h3>' +
                noteSnippet +
              '</div>' +
              '<div class="event-datetime">' +
                '<span class="event-date">' + dateFormatted + '</span>' +
                '<span class="event-time">⏰ ' + timeDisplay + '</span>' +
              '</div>' +
            '</div>';
          });

          html += '</div>';
        });

        container.innerHTML = html;
      }

      // Render Notes Section at bottom of page
      const notesContainer = document.getElementById('notesContainer');
      if (notesContainer) {
        const eventsWithNotes = monthEvents.filter(e => Boolean(e.notes && e.notes.trim()));
        if (eventsWithNotes.length === 0) {
          notesContainer.innerHTML = '<div class="notes-empty">No notes for ' + monthTitle + '.</div>';
        } else {
          let notesHtml = '';
          eventsWithNotes.forEach(e => {
            const dateFormatted = formatDate(e.startDate);
            let timeStr = '';
            if (!e.isAllDay && e.startTime) {
              timeStr = ' • ' + formatTime(e.startTime);
            }
            notesHtml += '<div class="note-card">' +
              '<div class="note-card-header">' +
                '<span class="note-event-title">' + escapeText(e.title) + '</span>' +
                '<span class="note-event-date">' + dateFormatted + timeStr + '</span>' +
              '</div>' +
              '<div class="note-card-body">' + escapeText(e.notes) + '</div>' +
            '</div>';
          });
          notesContainer.innerHTML = notesHtml;
        }
      }
    }

    function escapeText(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function goToNextMonth() {
      activeMonth = computeNextMonth(activeMonth);
      selectedDayFilter = null;
      updateUrl();
      renderView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function goToPrevMonth() {
      activeMonth = computePrevMonth(activeMonth);
      selectedDayFilter = null;
      updateUrl();
      renderView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateUrl() {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('month', activeMonth);
        window.history.pushState({}, '', url.toString());
      } catch (e) {}
    }

    // Initial render
    renderView();

    // Auto-trigger print or save-as-pdf if requested (?print=1 or ?autoprint=1)
    if (urlParams.get('print') === '1' || urlParams.get('autoprint') === '1') {
      setTimeout(() => {
        window.print();
      }, 700);
    }

    let isFetchingLive = false;
    let lastEventsHash = JSON.stringify(allEvents.map(e => (e.id || '') + (e.startDate || '') + (e.startTime || '') + (e.title || '') + (e.notes || '')));

    async function fetchLatestLiveEvents(manual) {
      if (isFetchingLive) return;
      isFetchingLive = true;
      const refreshIcon = document.getElementById('refreshIcon');
      if (manual && refreshIcon) {
        refreshIcon.style.display = 'inline-block';
        refreshIcon.style.transform = 'rotate(180deg)';
        refreshIcon.style.transition = 'transform 0.4s ease';
      }

      try {
        const res = await fetch('/api/events?t=' + Date.now(), {
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const freshEvents = await res.json();
        if (Array.isArray(freshEvents)) {
          const matching = isAllMode
            ? freshEvents
            : freshEvents.filter(e => e && (e.categoryId === targetCategoryId || targetCategoryId === 'all'));

          const effectiveMatching = (matching.length === 0 && freshEvents.length > 0 && (categoriesList.length <= 1 || targetCategoryId === 'new' || targetCategoryId === 'client'))
            ? freshEvents
            : matching;

          const newHash = JSON.stringify(effectiveMatching.map(e => (e.id || '') + (e.startDate || '') + (e.startTime || '') + (e.title || '') + (e.notes || '')));

          if (newHash !== lastEventsHash || manual) {
            lastEventsHash = newHash;
            allEvents = effectiveMatching.map(e => {
              const cat = categoriesMapObj[e.categoryId] || { name: 'General', hex: categoryHex };
              return {
                id: e.id,
                title: e.title || 'Untitled Event',
                startDate: e.startDate || '',
                endDate: e.endDate || '',
                startTime: e.startTime || '',
                endTime: e.endTime || '',
                isAllDay: Boolean(e.isAllDay),
                categoryId: e.categoryId || '',
                categoryName: cat.name || '',
                categoryHex: cat.hex || categoryHex,
                notes: e.notes || e.description || '',
                description: e.description || ''
              };
            }).sort((a, b) => {
              const aKey = (a.startDate || '') + (a.startTime || '');
              const bKey = (b.startDate || '') + (b.startTime || '');
              return aKey.localeCompare(bKey);
            });

            renderView();

            const statusEl = document.getElementById('liveSyncText');
            if (statusEl) {
              statusEl.innerText = 'Updated just now';
              setTimeout(() => {
                if (statusEl) statusEl.innerText = 'Live Schedule';
              }, 2500);
            }
          }
        }
      } catch (err) {
        console.warn('Live sync fetch error:', err);
      } finally {
        isFetchingLive = false;
        if (manual && refreshIcon) {
          setTimeout(() => {
            if (refreshIcon) refreshIcon.style.transform = 'none';
          }, 400);
        }
      }
    }

    // Auto-poll continuously every 3.5 seconds so scanned QR code pages update immediately
    setInterval(() => fetchLatestLiveEvents(false), 3500);

    // Refresh immediately when phone screen turns on or tab refocuses
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        fetchLatestLiveEvents(false);
      }
    });
    window.addEventListener('focus', () => fetchLatestLiveEvents(false));
  </script>
</body>
</html>`;
  };

  /**
   * Helper function ensuring colors used for QR code rendering have deep contrast against white
   * so every smartphone camera (iOS Camera, Google Lens, Samsung Camera) can lock onto finder patterns.
   */
  function ensureCameraScannableColor(hexColor?: string): string {
    if (!hexColor || hexColor === '#000000' || hexColor === '#0f172a') {
      return '#0f172a';
    }
    let clean = hexColor.replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map((c) => c + c).join('');
    }
    if (clean.length !== 6) return '#0f172a';

    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (luminance > 0.25) {
      const factor = 0.35;
      const dr = Math.round(r * 255 * factor).toString(16).padStart(2, '0');
      const dg = Math.round(g * 255 * factor).toString(16).padStart(2, '0');
      const db = Math.round(b * 255 * factor).toString(16).padStart(2, '0');
      return `#${dr}${dg}${db}`;
    }
    return hexColor;
  }

  // Dedicated direct URL for QR scanner: /pdf/:categoryId and /public/pdf/:categoryId
  // Supports both path params and query parameters (?category=work or ?cat=work)
  app.get(["/pdf/:categoryId", "/public/pdf/:categoryId", "/pdf", "/public/pdf"], async (req, res) => {
    const rawId = req.params.categoryId || (req.query.category as string) || (req.query.cat as string) || 'all';
    const cleanId = (rawId || '').trim();
    const isAll = cleanId.toLowerCase() === 'all' || cleanId.toLowerCase() === 'overview';
    const categories = db.categories || SEED_CATEGORIES;
    const category = isAll
      ? {
          id: 'all',
          name: 'All Categories Overview',
          hex: '#4f46e5',
          description: 'Master calendar schedule combining all categories and ministries'
        }
      : categories.find(
          (c) => c.id.toLowerCase() === cleanId.toLowerCase() || c.name.toLowerCase() === cleanId.toLowerCase()
        ) || {
          id: cleanId,
          name: cleanId,
          hex: '#4f46e5',
          description: cleanId
        };

    let baseOrigin = ((db.settings as any)?.publicBaseUrl || '').trim().replace(/\/+$/, '');
    if (!baseOrigin) {
      let host = req.get("x-forwarded-host") || req.get("host") || "localhost:3000";
      // CRITICAL: Replace 'ais-dev-' with 'ais-pre-' so scanning the QR code from ANY external phone/device
      // directs the browser to the public shared environment without requiring AI Studio developer login!
      if (host.includes('ais-dev-')) {
        host = host.replace('ais-dev-', 'ais-pre-');
      }
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      baseOrigin = `${protocol}://${host}`;
    }
    const targetUrl = isAll
      ? `${baseOrigin}/pdf/all`
      : `${baseOrigin}/pdf/${encodeURIComponent(category.id)}`;

    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 480,
        margin: 3, // Standard quiet zone for phone cameras
        errorCorrectionLevel: 'M', // 15% error correction yields larger, clearer modules
        color: {
          dark: ensureCameraScannableColor(category.hex),
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.warn('Could not generate server-side QR data URL:', err);
    }

    const deletedSet = new Set(db.deletedEventIds || []);
    const cleanAllEvents = deduplicateServerEvents(db.events || [], deletedSet);
    db.events = cleanAllEvents;

    let matchingEvents = isAll
      ? cleanAllEvents
      : cleanAllEvents.filter((e) => {
          if (e.categoryId === category.id) return true;
          if (category.name && e.categoryId && e.categoryId.toLowerCase() === category.name.toLowerCase()) return true;
          return false;
        });

    // Resilient fallback: if category has 0 events, but events exist in the database,
    // or if this is the primary/only category, show all events so scanned phone cameras never see an empty schedule!
    if (matchingEvents.length === 0 && cleanAllEvents.length > 0) {
      if (categories.length <= 1 || cleanId.toLowerCase() === 'new' || cleanId.toLowerCase() === 'client') {
        matchingEvents = cleanAllEvents;
      }
    }

    const requestedMonth = (req.query.month as string) || (req.query.m as string) || undefined;
    const html = renderCategoryPdfHtml(category, matchingEvents, categories, qrDataUrl, requestedMonth);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.send(html);
  });

  // Dedicated endpoint to download QR code image in PNG format: /api/qr/:categoryId.png
  app.get(["/api/qr/:categoryId.png", "/qr/:categoryId.png"], async (req, res) => {
    try {
      const { categoryId } = req.params;
      const cleanId = (categoryId || '').trim();
      const isAll = cleanId.toLowerCase() === 'all' || cleanId.toLowerCase() === 'overview';
      const categories = db.categories || SEED_CATEGORIES;
      const category = isAll
        ? { id: 'all', name: 'All Categories Overview', hex: '#4f46e5' }
        : categories.find(
            (c) => c.id.toLowerCase() === cleanId.toLowerCase() || c.name.toLowerCase() === cleanId.toLowerCase()
          ) || { id: cleanId, name: cleanId, hex: '#4f46e5' };

      let baseOrigin = ((db.settings as any)?.publicBaseUrl || '').trim().replace(/\/+$/, '');
      if (!baseOrigin) {
        let host = req.get("x-forwarded-host") || req.get("host") || "localhost:3000";
        if (host.includes('ais-dev-')) {
          host = host.replace('ais-dev-', 'ais-pre-');
        }
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        baseOrigin = `${protocol}://${host}`;
      }
      const targetUrl = isAll
        ? `${baseOrigin}/pdf/all`
        : `${baseOrigin}/pdf/${encodeURIComponent(category.id)}`;

      // Generate ultra high-resolution 1024x1024 PNG buffer with camera-scannable color
      const pngBuffer = await QRCode.toBuffer(targetUrl, {
        type: 'png',
        width: 1024,
        margin: 3,
        errorCorrectionLevel: 'M',
        color: {
          dark: ensureCameraScannableColor(category.hex),
          light: '#ffffff'
        }
      });

      const safeName = (category.name || 'category').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}_QR_Code.png"`);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.send(pngBuffer);
    } catch (err: any) {
      console.error("Failed to generate QR PNG:", err);
      return res.status(500).send("Error generating QR code PNG");
    }
  });

  // Dedicated endpoint to check if public URL is live and reachable externally
  app.get("/api/check-public-url", async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).json({ reachable: false, error: "Missing url parameter" });
      }
      const parsed = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ reachable: false, error: "Invalid protocol" });
      }

      const isAiStudioDomain = parsed.hostname.includes('ais-dev-') || parsed.hostname.includes('ais-pre-');

      // Probe target with GET to follow redirect chain and detect Google AI Studio login proxy
      const checkRes = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000)
      });

      const finalUrl = checkRes.url || targetUrl;
      const isAuthBridge = finalUrl.includes('__cookie_check.html') || 
                           finalUrl.includes('applet-auth-bridge') || 
                           finalUrl.includes('accounts.google.com') ||
                           finalUrl.includes('aistudio.google.com');

      if (isAiStudioDomain || isAuthBridge) {
        return res.json({
          reachable: false,
          isAiStudioPreview: true,
          status: checkRes.status,
          message: "This link is currently inside Google AI Studio's preview environment, which blocks camera scanning with a Google login requirement and turns off when your computer closes. Deploy your app to Cloud Run (top-right menu) to obtain your 24/7 public link with no login required."
        });
      }

      return res.json({
        reachable: checkRes.status >= 200 && checkRes.status < 400,
        isAiStudioPreview: false,
        status: checkRes.status,
        statusText: checkRes.statusText,
        finalUrl
      });
    } catch (err: any) {
      return res.json({
        reachable: false,
        error: err.message || 'Connection failed'
      });
    }
  });

  // Dedicated endpoint returning canonical public URLs and environment configuration
  app.get("/api/public-info", (req, res) => {
    let host = req.get("x-forwarded-host") || req.get("host") || "localhost:3000";
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const devOrigin = `${protocol}://${host}`;
    const isAiStudio = devOrigin.includes('ais-dev-') || devOrigin.includes('ais-pre-');
    let sharedOrigin = devOrigin;
    if (sharedOrigin.includes('ais-dev-')) {
      sharedOrigin = sharedOrigin.replace('ais-dev-', 'ais-pre-');
    }
    const customOrigin = ((db.settings as any)?.publicBaseUrl || '').trim().replace(/\/+$/, '');
    const isDeployed = !isAiStudio && (host.includes('run.app') || Boolean(customOrigin));
    res.json({
      devOrigin,
      sharedOrigin,
      customOrigin,
      effectiveOrigin: customOrigin || (isDeployed ? devOrigin : sharedOrigin),
      isCustom: Boolean(customOrigin),
      isAiStudio,
      isDeployed
    });
  });


  // Server-side CORS Proxy endpoint for external calendar ICS feeds
  app.get("/api/ics-proxy", async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).json({ error: "Missing url parameter" });
      }

      const url = normalizeIcsUrl(targetUrl);
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return res.status(400).json({ error: "Invalid protocol. Must be http:// or https://" });
      }

      const fetchRes = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (compatible; AuraCalendarSync/2.0)",
          "Accept": "text/calendar, text/plain, */*",
          "Cache-Control": "no-cache"
        }
      });

      if (!fetchRes.ok) {
        if (fetchRes.status === 401 || fetchRes.status === 403) {
          return res.status(fetchRes.status).json({
            error: `Access denied by Outlook/remote server (${fetchRes.status}). Please ensure the calendar is published with "Can view all details" in Outlook Shared Calendars.`
          });
        }
        return res.status(fetchRes.status).json({ error: `Server returned HTTP ${fetchRes.status}` });
      }

      const icsText = await fetchRes.text();
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(icsText);
    } catch (err: any) {
      console.error("Error fetching ICS feed:", err);
      res.status(500).json({ error: err?.message || "Failed to fetch ICS feed" });
    }
  });

  // Server-side helper to synchronize Outlook ICS feed into db.events
  async function performOutlookIcsSync(overrideUrl?: string, categoryId?: string, calName?: string): Promise<{ success: boolean; count: number; error?: string; message?: string }> {
    try {
      if (!overrideUrl && db.settings?.sync?.unlinkOutlook === true) {
        return { success: false, count: 0, message: "Outlook calendar integration is unlinked." };
      }
      const targetUrl = overrideUrl || db.settings?.sync?.outlookIcsUrl;
      if (!targetUrl || !targetUrl.trim()) {
        return { success: false, count: 0, error: "No Outlook ICS calendar link configured." };
      }

      const cleanUrl = normalizeIcsUrl(targetUrl);
      if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
        return { success: false, count: 0, error: "Invalid calendar link protocol. Must be https:// or http://." };
      }

      const fetchRes = await fetch(cleanUrl, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (compatible; AuraCalendarSync/2.0)",
          "Accept": "text/calendar, text/plain, */*",
          "Cache-Control": "no-cache"
        }
      });

      if (!fetchRes.ok) {
        if (fetchRes.status === 401 || fetchRes.status === 403) {
          return { success: false, count: 0, error: "Access denied by Outlook server. Please ensure the calendar is published with 'Can view all details' in Outlook Settings -> Shared calendars." };
        }
        return { success: false, count: 0, error: `Outlook server returned HTTP ${fetchRes.status}.` };
      }

      const icsText = await fetchRes.text();
      if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
        return { success: false, count: 0, error: "Retrieved content is not a valid iCalendar (.ics) feed. Check that the link points to a published Outlook calendar." };
      }

      const adminUser: any = db.users.find(u => u.role === 'admin') || db.users[0] || {
        id: 'admin-1',
        name: 'Administrator',
        username: 'admin',
        email: 'admin@auracalendar.com',
        role: 'admin',
        avatarColor: 'bg-indigo-600',
        createdAt: new Date().toISOString(),
        active: true
      };

      const parsed = parseIcsContent(icsText, adminUser);
      if (!parsed || parsed.length === 0) {
        return { success: true, count: 0, message: "Connected to Outlook calendar, but no upcoming events were found in the feed." };
      }

      const targetCatId = categoryId || db.settings?.sync?.outlookDefaultCategoryId || (db.categories[0]?.id || 'work');
      const calendarDisplayName = calName || db.settings?.sync?.outlookCalendarName || 'Outlook Shared Calendar';
      const deletedSet = new Set(db.deletedEventIds || []);

      // Filter out deleted events
      const validIncoming = parsed.filter(e => {
        if (!e || !e.id) return false;
        if (deletedSet.has(e.id)) return false;
        if (e.externalEventId && deletedSet.has(e.externalEventId)) return false;
        return true;
      });

      // Match against existing events to update in place and preserve admin customizations
      const existingEvents = (db.events || []).filter(e => {
        if (!e || !e.id) return false;
        if (deletedSet.has(e.id)) return false;
        if (e.externalEventId && deletedSet.has(e.externalEventId)) return false;
        return true;
      });
      const handledExistingIds = new Set<string>();
      const mergedList: CalendarEvent[] = [];

      for (const incoming of validIncoming) {
        const normIncomingTitle = normalizeEventTitle(incoming.title);
        const match = existingEvents.find(ex => {
          if (ex.id === incoming.id) return true;
          if (ex.externalEventId && incoming.externalEventId && ex.externalEventId === incoming.externalEventId && ex.startDate === incoming.startDate) return true;
          if (ex.id.startsWith(incoming.externalEventId || '___') && ex.startDate === incoming.startDate) return true;
          if (ex.startDate === incoming.startDate) {
            const normExTitle = normalizeEventTitle(ex.title);
            if (normExTitle && normIncomingTitle && normExTitle === normIncomingTitle) return true;
          }
          return false;
        });

        if (match) {
          handledExistingIds.add(match.id);
          if (match.customizedByAdmin) {
            mergedList.push({
              ...incoming,
              id: match.id,
              categoryId: match.categoryId,
              tags: match.tags,
              temas: match.temas,
              tema: match.tema,
              title: match.title,
              priority: match.priority,
              location: match.location,
              description: match.description || incoming.description,
              notes: match.notes,
              customizedByAdmin: true,
              adminEditedAt: match.adminEditedAt,
              adminEditedBy: match.adminEditedBy,
              source: 'external',
              sourceAccountId: 'outlook-ics'
            });
          } else {
            mergedList.push({
              ...incoming,
              id: match.id,
              categoryId: match.categoryId || targetCatId,
              source: 'external',
              sourceAccountId: 'outlook-ics',
              notes: `Imported via Outlook Shared Calendar (${calendarDisplayName})`
            });
          }
        } else {
          // New event from Outlook
          mergedList.push({
            ...incoming,
            categoryId: targetCatId,
            source: 'external',
            sourceAccountId: 'outlook-ics',
            notes: `Imported via Outlook Shared Calendar (${calendarDisplayName})`
          });
        }
      }

      // Retain all existing events that were not matched (manual events or events from other sources)
      for (const ex of existingEvents) {
        if (!handledExistingIds.has(ex.id)) {
          mergedList.push(ex);
        }
      }

      const deduplicated = deduplicateServerEvents(mergedList, deletedSet);
      db.events = deduplicated;

      // Update sync settings
      const nowIso = new Date().toISOString();
      if (!db.settings) db.settings = {} as any;
      if (!db.settings.sync) db.settings.sync = {} as any;
      db.settings.sync.outlookIcsUrl = cleanUrl;
      db.settings.sync.outlookLastSyncedAt = nowIso;
      db.settings.sync.outlookSyncedCount = validIncoming.length;
      if (calName) db.settings.sync.outlookCalendarName = calName;
      if (categoryId) db.settings.sync.outlookDefaultCategoryId = categoryId;

      saveDb(db);
      console.log(`[Outlook Sync] Successfully synchronized ${validIncoming.length} event(s) at ${nowIso}`);

      return {
        success: true,
        count: validIncoming.length,
        message: `Successfully synchronized ${validIncoming.length} Outlook event(s).`
      };
    } catch (err: any) {
      console.error("[Outlook Sync] Error:", err);
      return { success: false, count: 0, error: err?.message || "Internal error syncing Outlook calendar." };
    }
  }

  // Trigger on-demand Outlook Calendar Synchronization
  app.post("/api/sync/outlook", async (req, res) => {
    try {
      const { url, categoryId, calendarName } = req.body || {};
      const result = await performOutlookIcsSync(url, categoryId, calendarName);
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json({
        ...result,
        events: db.events,
        lastSyncedAt: db.settings?.sync?.outlookLastSyncedAt
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "Sync failed" });
    }
  });

  // Live RFC 5545 iCalendar Subscription Feed for calendar clients
  function generateServerIcs(events: CalendarEvent[], calTitle: string = 'Executive Pro Calendar'): string {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ProCalendar//ExecutiveSync//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${(calTitle || 'Pro Calendar').replace(/[\r\n]/g, ' ')}`,
      'X-WR-TIMEZONE:UTC'
    ];

    for (const evt of events) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${evt.id || Date.now()}@procalendar`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);

      const startClean = (evt.startDate || '').replace(/-/g, '');
      const endClean = (evt.endDate || evt.startDate || '').replace(/-/g, '');
      const startTimeClean = (evt.startTime || '09:00').replace(/:/g, '') + '00';
      const endTimeClean = (evt.endTime || '10:00').replace(/:/g, '') + '00';

      if (evt.isAllDay) {
        lines.push(`DTSTART;VALUE=DATE:${startClean}`);
        lines.push(`DTEND;VALUE=DATE:${endClean}`);
      } else {
        lines.push(`DTSTART:${startClean}T${startTimeClean}`);
        lines.push(`DTEND:${endClean}T${endTimeClean}`);
      }

      lines.push(`SUMMARY:${(evt.title || 'Untitled Event').replace(/[\r\n]/g, ' ')}`);
      if (evt.description) {
        lines.push(`DESCRIPTION:${evt.description.replace(/\n/g, '\\n')}`);
      }
      if (evt.location) {
        lines.push(`LOCATION:${evt.location.replace(/[\r\n]/g, ' ')}`);
      }
      const eventTemas = Array.isArray(evt.temas) && evt.temas.length > 0 ? evt.temas : (evt.tema ? [evt.tema] : []);
      if (eventTemas.length > 0) {
        lines.push(`CATEGORIES:${eventTemas.join(',')}`);
      }
      lines.push('STATUS:CONFIRMED');
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  // Dedicated endpoint to download iCalendar (.ics) for category schedule
  app.get(["/api/calendar/category/:categoryId.ics", "/pdf/:categoryId/calendar.ics"], (req, res) => {
    try {
      const rawParam = req.params.categoryId || 'all';
      const cleanId = rawParam.replace(/\.ics$/, '').trim();
      const isAll = cleanId.toLowerCase() === 'all' || cleanId.toLowerCase() === 'overview';
      const categories = db.categories || SEED_CATEGORIES;
      const category = isAll
        ? { id: 'all', name: 'All Categories Master Schedule' }
        : categories.find(c => c.id.toLowerCase() === cleanId.toLowerCase() || c.name.toLowerCase() === cleanId.toLowerCase())
          || { id: cleanId, name: cleanId };

      const cleanAllEvents = deduplicateServerEvents(db.events || []);
      const targetEvents = isAll
        ? cleanAllEvents
        : cleanAllEvents.filter(e => e.categoryId === category.id || (category.name && e.categoryId?.toLowerCase() === category.name.toLowerCase()));

      const ics = generateServerIcs(targetEvents, `${category.name} Schedule`);
      const safeName = (category.name || 'calendar').replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.ics"`);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.send(ics);
    } catch (err: any) {
      console.error("Error generating category calendar feed:", err);
      return res.status(500).send("Error generating category calendar feed");
    }
  });

  app.get(["/api/calendar/feed/:userId.ics", "/api/calendar/feed/:userId", "/api/calendar/feed.ics", "/api/calendar/feed"], (req, res) => {
    try {
      const rawParam = req.params.userId || (req.query.userId as string) || (req.query.user as string) || '';
      const userId = rawParam.replace(/\.ics$/, '').trim();

      let targetEvents = db.events;
      let calName = "Executive Calendar";

      if (userId && userId !== 'all') {
        const user = db.users.find((u) => 
          u.id === userId || 
          u.username?.toLowerCase() === userId.toLowerCase() || 
          u.email?.toLowerCase() === userId.toLowerCase()
        );
        if (user) {
          targetEvents = db.events.filter((e) => 
            e.userId === user.id || 
            (e.attendees && e.attendees.some(att => att.toLowerCase() === (user.name || user.username).toLowerCase()))
          );
          calName = `${user.name || user.username}'s Schedule`;
        }
      }

      const ics = generateServerIcs(targetEvents, calName);
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="calendar.ics"`);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.send(ics);
    } catch (err: any) {
      console.error("Error generating calendar feed:", err);
      return res.status(500).send("Error generating calendar feed");
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Background periodic synchronization for Outlook calendar (every 5 minutes)
  const OUTLOOK_SYNC_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(async () => {
    try {
      if (
        db.settings?.sync?.outlookIcsUrl &&
        db.settings.sync.outlookIcsUrl.trim() &&
        !db.settings.sync.unlinkOutlook &&
        db.settings?.sync?.outlookAutoSync !== false
      ) {
        console.log("[Outlook Periodic Sync] Running scheduled background sync...");
        await performOutlookIcsSync();
      }
    } catch (e) {
      console.warn("[Outlook Periodic Sync] Error during background sync:", e);
    }
  }, OUTLOOK_SYNC_INTERVAL_MS);

  // Initial sync check 5 seconds after server boots
  setTimeout(async () => {
    try {
      if (
        db.settings?.sync?.outlookIcsUrl &&
        db.settings.sync.outlookIcsUrl.trim() &&
        !db.settings.sync.unlinkOutlook &&
        db.settings?.sync?.outlookAutoSync !== false
      ) {
        console.log("[Outlook Boot Sync] Initial sync check on server start...");
        await performOutlookIcsSync();
      }
    } catch (e) {
      console.warn("[Outlook Boot Sync] Error:", e);
    }
  }, 5000);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();


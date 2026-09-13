import { AnnouncementFlyer, CalendarEvent } from '../types';

export const DEFAULT_ANNOUNCEMENT: AnnouncementFlyer = {
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

export const ANNOUNCEMENT_THEMES = [
  {
    id: 'purple-diamond',
    name: 'Purple Diamond (Original Flyer)',
    previewColor: '#7e22ce',
    accentColor: '#fbbf24',
    gradient: 'from-[#2e0854] via-[#581c87] to-[#120324]',
    cardBorder: 'border-purple-400/30',
    glowColor: 'rgba(168, 85, 247, 0.4)',
    accentText: 'text-amber-400'
  },
  {
    id: 'indigo-night',
    name: 'Midnight Indigo',
    previewColor: '#4f46e5',
    accentColor: '#38bdf8',
    gradient: 'from-[#0f172a] via-[#1e1b4b] to-[#020617]',
    cardBorder: 'border-indigo-400/30',
    glowColor: 'rgba(99, 102, 241, 0.4)',
    accentText: 'text-sky-400'
  },
  {
    id: 'emerald-gold',
    name: 'Royal Emerald & Gold',
    previewColor: '#059669',
    accentColor: '#f59e0b',
    gradient: 'from-[#064e3b] via-[#047857] to-[#022c22]',
    cardBorder: 'border-emerald-400/30',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    accentText: 'text-amber-300'
  },
  {
    id: 'crimson-ruby',
    name: 'Crimson Ruby',
    previewColor: '#e11d48',
    accentColor: '#fde047',
    gradient: 'from-[#4c0519] via-[#881337] to-[#1c0209]',
    cardBorder: 'border-rose-400/30',
    glowColor: 'rgba(244, 63, 94, 0.4)',
    accentText: 'text-yellow-300'
  },
  {
    id: 'ocean-blue',
    name: 'Deep Ocean Blue',
    previewColor: '#0284c7',
    accentColor: '#34d399',
    gradient: 'from-[#082f49] via-[#0369a1] to-[#031d30]',
    cardBorder: 'border-sky-400/30',
    glowColor: 'rgba(14, 165, 233, 0.4)',
    accentText: 'text-emerald-300'
  }
];

const STORAGE_KEYS = {
  ANNOUNCEMENTS: 'pro_calendar_announcements_v7',
  ACTIVE_ANNOUNCEMENT_ID: 'pro_calendar_active_announcement_id_v7'
};

/**
 * Loads all announcement flyers from localStorage, defaulting to the template
 */
export function loadAnnouncementsFromStorage(): AnnouncementFlyer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error loading announcements from storage:', e);
  }
  return [DEFAULT_ANNOUNCEMENT];
}

/**
 * Saves all announcement flyers to localStorage
 */
export function saveAnnouncementsToStorage(announcements: AnnouncementFlyer[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
  } catch (e) {
    console.warn('Error saving announcements to storage:', e);
  }
}

/**
 * Retrieves the currently active announcement
 */
export function getActiveAnnouncement(): AnnouncementFlyer {
  const list = loadAnnouncementsFromStorage();
  try {
    const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE_ANNOUNCEMENT_ID);
    if (activeId) {
      const found = list.find((a) => a.id === activeId);
      if (found) return found;
    }
  } catch (e) {}
  return list[0] || DEFAULT_ANNOUNCEMENT;
}

/**
 * Sets the active announcement id in localStorage
 */
export function setActiveAnnouncementId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ANNOUNCEMENT_ID, id);
  } catch (e) {}
}

import { getCustomPublicBaseUrl } from './qrUtils';

/**
 * Constructs the canonical public web browser URL for viewing an announcement flyer.
 * Automatically prioritizes verified custom 24/7 production domain so that external
 * smartphone cameras can scan the QR code and land on the live announcement without login!
 */
export function getAnnouncementPublicUrl(announcementId?: string, customBaseUrl?: string): string {
  try {
    const configuredCustom = customBaseUrl || getCustomPublicBaseUrl();
    const isCustom = !!configuredCustom && configuredCustom.trim().length > 0;
    let base = isCustom ? configuredCustom!.trim().replace(/\/+$/, '') : window.location.origin;
    if (!isCustom) {
      if (base.includes('ais-dev-')) {
        base = base.replace('ais-dev-', 'ais-pre-');
      }
      const currentHost = window.location.hostname;
      const isSharedSubdomain = currentHost.includes('ais-pre-') || currentHost.includes('run.app');
      if (!isSharedSubdomain && currentHost.includes('ai.studio')) {
        const match = currentHost.match(/^(?:https?:\/\/)?([a-z0-9-]+)\./i);
        const appletId = match ? match[1] : '';
        if (appletId) {
          base = `https://ais-pre-${appletId}.run.app`;
        }
      }
    }
    const id = announcementId || getActiveAnnouncement().id;
    return `${base}/anuncio/${encodeURIComponent(id)}`;
  } catch (e) {
    return window.location?.href || '';
  }
}

/**
 * Converts a CalendarEvent into an AnnouncementFlyer format
 */
export function createAnnouncementFromEvent(
  event: CalendarEvent,
  baseTemplate?: AnnouncementFlyer
): AnnouncementFlyer {
  const template = baseTemplate || DEFAULT_ANNOUNCEMENT;
  
  // Format the date into DayOfWeek and MonthDay
  let dateDayOfWeek = 'DATE,';
  let dateMonthDay = 'TBD';
  try {
    if (event.startDate) {
      const parts = event.startDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const weekday = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() + ',';
        const monthDay = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase();
        dateDayOfWeek = weekday;
        dateMonthDay = monthDay;
      }
    }
  } catch (e) {}

  let timeText = event.startTime || '9:00 AM';
  if (event.startTime) {
    try {
      const [h, m] = event.startTime.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const h12 = hour % 12 || 12;
      timeText = `${h12}:${m} ${ampm}`;
    } catch (e) {}
  }

  const newHighlights = event.description
    ? event.description
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 5)
    : template.highlights;

  return {
    ...template,
    id: `announcement-evt-${Date.now()}`,
    title: event.title.toUpperCase(),
    subtitle: event.location || template.subtitle,
    dateDayOfWeek,
    dateMonthDay,
    timeText,
    locationText: event.location || template.locationText,
    highlights: newHighlights.length > 0 ? newHighlights : template.highlights,
    linkedEventId: event.id,
    updatedAt: new Date().toISOString()
  };
}

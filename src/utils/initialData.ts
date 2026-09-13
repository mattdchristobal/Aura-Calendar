import { User, CalendarEvent, UserSettings } from '../types';

export const INITIAL_USERS: User[] = [];

export const DEFAULT_TEMAS = ['Tema 1', 'Tema 2', 'Tema 3'];

export const INITIAL_SETTINGS: UserSettings = {
  theme: 'light',
  accentColor: 'indigo',
  density: 'comfortable',
  firstDayOfWeek: 0, // Sunday
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

export function getSeededEvents(): CalendarEvent[] {
  return [];
}

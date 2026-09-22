import { User, CalendarEvent, UserSettings } from '../types';
import { SEED_EVENTS } from '../data/seedEvents';

export const INITIAL_USERS: User[] = [
  {
    id: "u_1788714177193",
    username: "admin",
    password: "admin123",
    name: "admin",
    email: "testin@gmail.com",
    role: "admin",
    avatarColor: "bg-indigo-600",
    active: true,
    createdAt: "2026-09-06T17:02:57.193Z"
  }
];

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
  return [...SEED_EVENTS];
}

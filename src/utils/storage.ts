import { User, CalendarEvent, UserSettings, Category, SharedCalendar, ConnectedAccount } from '../types';
import { INITIAL_USERS, INITIAL_SETTINGS, getSeededEvents } from './initialData';
import { DEFAULT_CATEGORIES } from './categories';
import { SEED_EVENTS } from '../data/seedEvents';

const KEYS = {
  VERSION: 'pro_calendar_storage_ver_7',
  USERS: 'pro_calendar_users_v7',
  PERMANENT_VAULT: 'pro_calendar_permanent_vault_v7',
  CREDENTIALS_VAULT: 'pro_calendar_credentials_vault_v7',
  CURRENT_USER: 'pro_calendar_current_user_v7',
  LAST_IDENTIFIER: 'pro_calendar_last_identifier_v7',
  EVENTS: 'pro_calendar_events_v7',
  SETTINGS: 'pro_calendar_settings_v7',
  CATEGORIES: 'pro_calendar_categories_v7',
  SHARES: 'pro_calendar_shares_v7',
  PERMANENT_EVENTS_VAULT: 'pro_calendar_permanent_events_vault_v7',
  PERMANENT_SETTINGS_VAULT: 'pro_calendar_permanent_settings_vault_v7',
  PERMANENT_CATEGORIES_VAULT: 'pro_calendar_permanent_categories_vault_v7',
  PERMANENT_SHARES_VAULT: 'pro_calendar_permanent_shares_vault_v7',
  DELETED_EVENT_IDS: 'pro_calendar_deleted_event_ids_v7',
  DELETED_CATEGORY_IDS: 'pro_calendar_deleted_category_ids_v7',
  DELETED_USER_IDS: 'pro_calendar_deleted_user_ids_v7',
  OUTLOOK_PERMANENT_VAULT: 'pro_calendar_permanent_outlook_vault_v7'
};

export function isOutlookEvent(evt: Partial<CalendarEvent> | null | undefined): boolean {
  if (!evt) return false;
  if (evt.sourceAccountId === 'outlook-ics') return true;
  if ((evt as any).source === 'outlook') return true;
  if (typeof evt.id === 'string' && (evt.id.startsWith('ext-ics-') || evt.id.startsWith('outlook-'))) return true;
  if (typeof evt.notes === 'string' && evt.notes.includes('Outlook Shared Calendar')) return true;
  return false;
}

// Automatic non-destructive migration and preservation across app publications & updates
(function migrateAndPreserveAllHistoricalData() {
  try {
    const deletedRaw = localStorage.getItem(KEYS.DELETED_EVENT_IDS);
    const deletedSet = new Set<string>();
    if (deletedRaw) {
      try {
        const parsed = JSON.parse(deletedRaw);
        if (Array.isArray(parsed)) parsed.forEach((id) => { if (typeof id === 'string') deletedSet.add(id); });
      } catch (e) {}
    }

    const deletedCatRaw = localStorage.getItem(KEYS.DELETED_CATEGORY_IDS);
    const deletedCatSet = new Set<string>();
    if (deletedCatRaw) {
      try {
        const parsed = JSON.parse(deletedCatRaw);
        if (Array.isArray(parsed)) parsed.forEach((id) => { if (typeof id === 'string') deletedCatSet.add(id); });
      } catch (e) {}
    }

    // Check if an Outlook ICS link is genuinely configured and not unlinked
    let hasValidOutlookLink = false;
    try {
      const sRaw = localStorage.getItem(KEYS.SETTINGS) || localStorage.getItem(KEYS.PERMANENT_SETTINGS_VAULT);
      if (sRaw) {
        const sObj = JSON.parse(sRaw);
        if (
          sObj?.sync?.outlookIcsUrl &&
          typeof sObj.sync.outlookIcsUrl === 'string' &&
          sObj.sync.outlookIcsUrl.trim() &&
          !sObj.sync.unlinkOutlook
        ) {
          hasValidOutlookLink = true;
        }
      }
    } catch (e) {}

    // 1. Migrate & preserve all historical events across all versions into permanent vault
    const legacyEventKeys = [
      'pro_calendar_events',
      'pro_calendar_events_v2',
      'pro_calendar_events_v3',
      'pro_calendar_events_v5',
      'pro_calendar_events_v6',
      'pro_calendar_events_v7',
      KEYS.EVENTS,
      KEYS.PERMANENT_EVENTS_VAULT,
      'events',
      'calendar_events'
    ];
    const eventMap = new Map<string, CalendarEvent>();
    for (const k of legacyEventKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((e: any) => {
              if (
                e &&
                e.id &&
                !deletedSet.has(e.id) &&
                !['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5', 'evt-6', 'evt-7', 'evt-8', 'evt-9', 'evt-10'].includes(e.id)
              ) {
                // Do not migrate Outlook-imported events if no ICS link is configured
                if (!hasValidOutlookLink && isOutlookEvent(e)) {
                  return;
                }
                const prev = eventMap.get(e.id);
                eventMap.set(e.id, { ...prev, ...e });
              }
            });
          }
        }
      } catch (e) {}
    }
    if (eventMap.size > 0 || !hasValidOutlookLink) {
      const allEvents = Array.from(eventMap.values());
      localStorage.setItem(KEYS.EVENTS, JSON.stringify(allEvents));
      localStorage.setItem(KEYS.PERMANENT_EVENTS_VAULT, JSON.stringify(allEvents));
    }

    // 2. Migrate & preserve user settings
    const legacySettingsKeys = [
      'pro_calendar_settings_v7',
      KEYS.SETTINGS,
      KEYS.PERMANENT_SETTINGS_VAULT,
      'pro_calendar_settings_v5',
      'pro_calendar_settings_v2',
      'pro_calendar_settings',
      'settings'
    ];
    for (const k of legacySettingsKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const existing = localStorage.getItem(KEYS.SETTINGS);
            if (!existing) {
              localStorage.setItem(KEYS.SETTINGS, JSON.stringify(parsed));
              localStorage.setItem(KEYS.PERMANENT_SETTINGS_VAULT, JSON.stringify(parsed));
            }
            break;
          }
        }
      } catch (e) {}
    }

    // 3. Migrate & preserve categories, strictly excluding any deleted categories
    const legacyCatKeys = [
      KEYS.CATEGORIES,
      KEYS.PERMANENT_CATEGORIES_VAULT,
      'pro_calendar_categories_v7',
      'pro_calendar_categories_v5',
      'pro_calendar_categories',
      'categories'
    ];
    for (const k of legacyCatKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed.filter((c: any) => c && c.id && !deletedCatSet.has(c.id));
            const existing = localStorage.getItem(KEYS.CATEGORIES);
            if (!existing && filtered.length > 0) {
              localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(filtered));
              localStorage.setItem(KEYS.PERMANENT_CATEGORIES_VAULT, JSON.stringify(filtered));
            }
            break;
          }
        }
      } catch (e) {}
    }

    localStorage.setItem(KEYS.VERSION, 'v7_permanent_safe');
  } catch (e) {
    console.warn('Migration note:', e);
  }
})();

export interface StoredCredential {
  id: string;
  username: string;
  email: string;
  password?: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  avatarColor: string;
  createdAt: string;
  active: boolean;
  connectedAccounts?: ConnectedAccount[];
}

export function saveLastIdentifier(identifier: string): void {
  try {
    if (identifier) {
      localStorage.setItem(KEYS.LAST_IDENTIFIER, identifier.trim());
    }
  } catch (e) {}
}

export function loadLastIdentifier(): string {
  try {
    return localStorage.getItem(KEYS.LAST_IDENTIFIER) || '';
  } catch (e) {
    return '';
  }
}

// Returns all registered user accounts stored on this device
export function getAllRegisteredAccounts(): StoredCredential[] {
  try {
    const deletedUserSet = loadDeletedUserIds();
    const list: StoredCredential[] = [];
    const seenIds = new Set<string>();

    const rawCreds = localStorage.getItem(KEYS.CREDENTIALS_VAULT);
    if (rawCreds) {
      const credsMap: Record<string, StoredCredential> = JSON.parse(rawCreds);
      for (const val of Object.values(credsMap)) {
        if (
          val &&
          val.id &&
          !deletedUserSet.has(val.id) &&
          !seenIds.has(val.id) &&
          !['u_marcus', 'u_john', 'u_sarah', 'u_admin', 'u_admin_default', 'u_cmckerigma'].includes(val.id) &&
          !['admin@executivetech.com', 'cmckerigma@example.com'].includes((val.email || '').toLowerCase())
        ) {
          seenIds.add(val.id);
          list.push(val);
        }
      }
    }

    const vault = loadPermanentVault();
    vault.forEach((u) => {
      if (
        u &&
        u.id &&
        !deletedUserSet.has(u.id) &&
        !seenIds.has(u.id) &&
        !['u_marcus', 'u_john', 'u_sarah', 'u_admin', 'u_admin_default', 'u_cmckerigma'].includes(u.id) &&
        !['admin@executivetech.com', 'cmckerigma@example.com'].includes((u.email || '').toLowerCase())
      ) {
        seenIds.add(u.id);
        list.push({
          id: u.id,
          username: u.username,
          email: u.email || '',
          password: u.password,
          name: u.name || u.username,
          role: u.role,
          avatarColor: u.avatarColor || 'bg-indigo-600',
          createdAt: u.createdAt || new Date().toISOString(),
          active: u.active !== false,
          connectedAccounts: u.connectedAccounts
        });
      }
    });

    return list;
  } catch (e) {
    console.warn('Error reading registered accounts:', e);
    return [];
  }
}

// Load permanent vault accounts
export function loadPermanentVault(): User[] {
  try {
    const deletedUserSet = loadDeletedUserIds();
    const raw = localStorage.getItem(KEYS.PERMANENT_VAULT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (u) =>
            u &&
            u.id &&
            !deletedUserSet.has(u.id) &&
            !['u_marcus', 'u_john', 'u_sarah', 'u_admin', 'u_admin_default', 'u_cmckerigma'].includes(u.id) &&
            !['admin@executivetech.com', 'cmckerigma@example.com'].includes((u.email || '').toLowerCase())
        );
      }
    }
  } catch (e) {
    console.warn('Error reading permanent vault:', e);
  }
  return [];
}

// Save accounts to permanent vault
export function savePermanentVault(users: User[]): void {
  try {
    const deletedUserSet = loadDeletedUserIds();
    const existing = loadPermanentVault().filter((u) => u && u.id && !deletedUserSet.has(u.id));
    const map = new Map<string, User>();
    existing.forEach((u) => { if (u && u.id && !deletedUserSet.has(u.id)) map.set(u.id, u); });
    users.forEach((u) => {
      if (
        u &&
        u.id &&
        !deletedUserSet.has(u.id) &&
        !['u_marcus', 'u_john', 'u_sarah', 'u_admin', 'u_cmckerigma'].includes(u.id) &&
        !['admin@executivetech.com', 'cmckerigma@example.com'].includes((u.email || '').toLowerCase())
      ) {
        const prev = map.get(u.id);
        map.set(u.id, { ...prev, ...u });
      }
    });
    localStorage.setItem(KEYS.PERMANENT_VAULT, JSON.stringify(Array.from(map.values())));
  } catch (e) {
    console.error('Error saving permanent vault:', e);
  }
}

// Store credential with password into permanent vault
export function preserveUserCredential(user: User, password?: string): void {
  try {
    const userToSave: User = {
      ...user,
      password: password ? password.trim() : (user.password || 'password123')
    };

    if (userToSave.username) {
      saveLastIdentifier(userToSave.username);
    } else if (userToSave.email) {
      saveLastIdentifier(userToSave.email);
    }

    savePermanentVault([userToSave]);

    const rawCreds = localStorage.getItem(KEYS.CREDENTIALS_VAULT);
    const credsMap: Record<string, StoredCredential> = rawCreds ? JSON.parse(rawCreds) : {};
    
    // Remove any previous keys mapped to this user's id so changed emails/usernames don't leave stale lookup entries
    for (const [k, val] of Object.entries(credsMap)) {
      if (val && val.id === userToSave.id) {
        delete credsMap[k];
      }
    }

    const cred: StoredCredential = {
      id: userToSave.id,
      username: userToSave.username.toLowerCase(),
      email: (userToSave.email || '').toLowerCase(),
      password: userToSave.password,
      name: userToSave.name,
      role: userToSave.role,
      avatarColor: userToSave.avatarColor,
      createdAt: userToSave.createdAt,
      active: userToSave.active,
      connectedAccounts: userToSave.connectedAccounts
    };

    credsMap[userToSave.username.toLowerCase()] = cred;
    if (userToSave.email) {
      credsMap[userToSave.email.toLowerCase()] = cred;
    }
    credsMap[userToSave.id] = cred;

    localStorage.setItem(KEYS.CREDENTIALS_VAULT, JSON.stringify(credsMap));

    const currentUsers = loadUsers();
    const updated = [...currentUsers.filter((u) => u.id !== userToSave.id && u.username.toLowerCase() !== userToSave.username.toLowerCase()), userToSave];
    saveUsers(updated);
  } catch (e) {
    console.error('Error preserving user credentials:', e);
  }
}

// Retrieve credential by username or email
export function getStoredCredential(identifier: string): StoredCredential | null {
  try {
    const clean = identifier.trim().toLowerCase().replace(/^@+/, '');
    const rawCreds = localStorage.getItem(KEYS.CREDENTIALS_VAULT);
    if (rawCreds) {
      const credsMap: Record<string, StoredCredential> = JSON.parse(rawCreds);
      if (credsMap[clean]) return credsMap[clean];
      
      for (const val of Object.values(credsMap)) {
        if (
          val.username.toLowerCase() === clean ||
          val.email.toLowerCase() === clean ||
          val.id === clean
        ) {
          return val;
        }
      }
    }

    const vault = loadPermanentVault();
    const found = vault.find(
      (u) =>
        u.username.toLowerCase().replace(/^@+/, '') === clean ||
        (u.email || '').toLowerCase() === clean ||
        u.id === clean
    );
    if (found) {
      return {
        id: found.id,
        username: found.username,
        email: found.email,
        password: found.password,
        name: found.name,
        role: found.role,
        avatarColor: found.avatarColor,
        createdAt: found.createdAt,
        active: found.active,
        connectedAccounts: found.connectedAccounts
      };
    }
  } catch (e) {
    console.warn('Error reading stored credential:', e);
  }
  return null;
}

export function loadUsers(): User[] {
  const deletedUserSet = loadDeletedUserIds();
  const map = new Map<string, User>();

  // 1. Initial baseline (strictly excluding deleted users)
  INITIAL_USERS.forEach((u) => {
    if (u && u.id && !deletedUserSet.has(u.id)) {
      map.set(u.id, u);
    }
  });

  // 2. Permanent vault accounts (strictly excluding deleted users)
  const vaultUsers = loadPermanentVault();
  vaultUsers.forEach((u) => {
    if (u && u.id && !deletedUserSet.has(u.id)) {
      const prev = map.get(u.id);
      map.set(u.id, { ...prev, ...u });
    }
  });

  // 3. Regular users storage
  try {
    const raw = localStorage.getItem(KEYS.USERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((u) => {
          if (
            u &&
            u.id &&
            !deletedUserSet.has(u.id) &&
            !['u_marcus', 'u_john', 'u_sarah', 'u_admin', 'u_admin_default', 'u_cmckerigma'].includes(u.id) &&
            !['admin@executivetech.com', 'cmckerigma@example.com'].includes((u.email || '').toLowerCase())
          ) {
            const prev = map.get(u.id);
            map.set(u.id, { ...prev, ...u });
          }
        });
      }
    }
  } catch (e) {
    console.warn('Error loading users from storage:', e);
  }

  return Array.from(map.values()).filter((u) => u && u.id && !deletedUserSet.has(u.id));
}

export function resetUsersStorage(customUsers?: User[]): User[] {
  const usersToSet = customUsers && customUsers.length > 0 ? customUsers : [];
  try {
    localStorage.removeItem(KEYS.USERS);
    localStorage.removeItem(KEYS.PERMANENT_VAULT);
    localStorage.removeItem(KEYS.CREDENTIALS_VAULT);
    saveUsers(usersToSet);
  } catch (e) {}
  return usersToSet;
}

export function saveUsers(users: User[]): void {
  try {
    const deletedUserSet = loadDeletedUserIds();
    const cleanUsers = users.filter(
      (u) =>
        u &&
        u.id &&
        !deletedUserSet.has(u.id) &&
        !['u_marcus', 'u_john', 'u_sarah', 'u_admin', 'u_admin_default', 'u_cmckerigma'].includes(u.id) &&
        !['admin@executivetech.com', 'cmckerigma@example.com'].includes((u.email || '').toLowerCase())
    );
    
    localStorage.setItem(KEYS.USERS, JSON.stringify(cleanUsers));
    savePermanentVault(cleanUsers);
  } catch (e) {
    console.error('Error saving users:', e);
  }
}

export function loadCurrentUser(users: User[]): User | null {
  try {
    const raw = localStorage.getItem(KEYS.CURRENT_USER);
    if (raw && raw !== 'null' && raw !== '""') {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.id || parsed.username || parsed.email)) {
        const found = users.find(
          (u) =>
            u.id === parsed.id ||
            (u.username && parsed.username && u.username.toLowerCase() === parsed.username.toLowerCase()) ||
            (u.email && parsed.email && u.email.toLowerCase() === parsed.email.toLowerCase())
        );
        if (found && found.active) return found;
        if (parsed.active !== false && parsed.id && !['u_marcus', 'u_john', 'u_sarah', 'u_admin', 'u_admin_default', 'u_cmckerigma'].includes(parsed.id)) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Error loading current user:', e);
  }
  
  return null;
}

export function saveCurrentUser(user: User | null): void {
  try {
    if (!user) {
      localStorage.removeItem(KEYS.CURRENT_USER);
    } else {
      localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    }
  } catch (e) {
    console.error('Error saving current user:', e);
  }
}

export function loadDeletedUserIds(): Set<string> {
  const set = new Set<string>();
  try {
    const raw = localStorage.getItem(KEYS.DELETED_USER_IDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          if (typeof id === 'string') set.add(id);
        });
      }
    }
  } catch (e) {}
  return set;
}

export function recordDeletedUserId(userId: string): void {
  try {
    const set = loadDeletedUserIds();
    set.add(userId);
    localStorage.setItem(KEYS.DELETED_USER_IDS, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function recordDeletedUserIds(userIds: string[]): void {
  try {
    const set = loadDeletedUserIds();
    userIds.forEach((id) => {
      if (typeof id === 'string') set.add(id);
    });
    localStorage.setItem(KEYS.DELETED_USER_IDS, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function clearDeletedUserId(userId: string): void {
  try {
    const set = loadDeletedUserIds();
    if (set.has(userId)) {
      set.delete(userId);
      localStorage.setItem(KEYS.DELETED_USER_IDS, JSON.stringify(Array.from(set)));
    }
  } catch (e) {}
}

export function deleteUserPermanently(userId: string): void {
  try {
    // 1. Record ID in deleted users set so it is never re-loaded or re-synced
    recordDeletedUserId(userId);

    // 2. Remove from regular USERS storage
    try {
      const rawUsers = localStorage.getItem(KEYS.USERS);
      if (rawUsers) {
        const parsed = JSON.parse(rawUsers);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((u: any) => u && u.id !== userId);
          localStorage.setItem(KEYS.USERS, JSON.stringify(filtered));
        }
      }
    } catch (e) {}

    // 3. Purge completely from PERMANENT_VAULT
    try {
      const rawVault = localStorage.getItem(KEYS.PERMANENT_VAULT);
      if (rawVault) {
        const parsed = JSON.parse(rawVault);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((u: any) => u && u.id !== userId);
          localStorage.setItem(KEYS.PERMANENT_VAULT, JSON.stringify(filtered));
        }
      }
    } catch (e) {}

    // 4. Purge completely from CREDENTIALS_VAULT
    try {
      const rawCreds = localStorage.getItem(KEYS.CREDENTIALS_VAULT);
      if (rawCreds) {
        const credsMap: Record<string, StoredCredential> = JSON.parse(rawCreds);
        for (const [key, cred] of Object.entries(credsMap)) {
          if (cred && (cred.id === userId || key === userId)) {
            delete credsMap[key];
          }
        }
        localStorage.setItem(KEYS.CREDENTIALS_VAULT, JSON.stringify(credsMap));
      }
    } catch (e) {}

    // 5. Clear current user session if it was this user
    try {
      const curRaw = localStorage.getItem(KEYS.CURRENT_USER);
      if (curRaw) {
        const cur = JSON.parse(curRaw);
        if (cur && cur.id === userId) {
          localStorage.removeItem(KEYS.CURRENT_USER);
        }
      }
    } catch (e) {}
  } catch (e) {
    console.error('Error permanently deleting user from storage:', e);
  }
}

export function loadDeletedEventIds(): Set<string> {
  const set = new Set<string>();
  try {
    const raw = localStorage.getItem(KEYS.DELETED_EVENT_IDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          if (typeof id === 'string' && !id.startsWith('del_sig_')) {
            set.add(id);
          }
        });
      }
    }
  } catch (e) {}
  return set;
}

export function recordDeletedEventId(eventId: string): void {
  if (!eventId || typeof eventId !== 'string' || eventId.startsWith('del_sig_')) return;
  try {
    const set = loadDeletedEventIds();
    set.add(eventId);
    localStorage.setItem(KEYS.DELETED_EVENT_IDS, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function recordDeletedEventIds(eventIds: string[]): void {
  try {
    const set = loadDeletedEventIds();
    eventIds.forEach((id) => {
      if (typeof id === 'string' && !id.startsWith('del_sig_')) set.add(id);
    });
    localStorage.setItem(KEYS.DELETED_EVENT_IDS, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function saveDeletedEventIds(ids: string[]): void {
  try {
    const clean = ids.filter((id) => typeof id === 'string' && !id.startsWith('del_sig_'));
    localStorage.setItem(KEYS.DELETED_EVENT_IDS, JSON.stringify(clean));
  } catch (e) {}
}

export function clearDeletedEventId(eventId: string, extraSig?: string): void {
  if (!eventId || typeof eventId !== 'string') return;
  try {
    const set = loadDeletedEventIds();
    let changed = false;
    if (set.has(eventId)) {
      set.delete(eventId);
      changed = true;
    }
    if (extraSig && set.has(extraSig)) {
      set.delete(extraSig);
      changed = true;
    }
    if (changed) {
      localStorage.setItem(KEYS.DELETED_EVENT_IDS, JSON.stringify(Array.from(set)));
    }
  } catch (e) {}
}

export function normalizeEventTitle(t: string): string {
  return (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deduplicateCalendarEvents(eventsList: CalendarEvent[]): CalendarEvent[] {
  if (!Array.isArray(eventsList)) return [];
  const deletedSet = loadDeletedEventIds();
  const demoIds = new Set(['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5', 'evt-6', 'evt-7', 'evt-8', 'evt-9', 'evt-10']);

  // Clean and filter out deleted/invalid/demo events
  const validEvents = eventsList.filter((e) => {
    if (!e || typeof e !== 'object' || !e.id) return false;
    if (deletedSet.has(e.id)) return false;
    if (e.externalEventId && deletedSet.has(e.externalEventId)) return false;
    if (demoIds.has(e.id)) return false;
    return true;
  });

  const resultMap = new Map<string, CalendarEvent>();
  const extKeyToResultKey = new Map<string, string>();

  for (const rawEvt of validEvents) {
    let cleanId = rawEvt.id;
    if (cleanId.includes('_dup') && !cleanId.includes('-occ-')) {
      cleanId = cleanId.replace(/_dup\d+$/, '');
    }
    const evt: CalendarEvent = { ...rawEvt, id: cleanId };

    const isExternal = evt.source === 'external' || evt.sourceAccountId === 'outlook-ics';
    const extKey = isExternal && evt.externalEventId ? `${evt.externalEventId}|${evt.startDate || ''}` : '';

    // Check if this event matches an existing entry by ID or by external feed UID
    let targetKey = resultMap.has(evt.id) ? evt.id : '';
    if (!targetKey && extKey && extKeyToResultKey.has(extKey)) {
      targetKey = extKeyToResultKey.get(extKey)!;
    }

    if (targetKey && resultMap.has(targetKey)) {
      const existing = resultMap.get(targetKey)!;
      const evtTime = evt.updatedAt ? new Date(evt.updatedAt).getTime() : 0;
      const existTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const isEvtNewer = evtTime >= existTime;

      // Prioritize admin customizations
      if (evt.customizedByAdmin && !existing.customizedByAdmin) {
        resultMap.set(targetKey, {
          ...existing,
          ...evt,
          id: existing.id,
          updatedAt: evt.updatedAt || new Date().toISOString()
        });
      } else if (!evt.customizedByAdmin && existing.customizedByAdmin && isExternal) {
        // Keep existing admin customizations over uncustomized external ICS syncs
        resultMap.set(targetKey, {
          ...evt,
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
        });
      } else if (isEvtNewer) {
        // Incoming event is newer: keep incoming updates
        resultMap.set(targetKey, {
          ...existing,
          ...evt,
          id: existing.id,
          updatedAt: evt.updatedAt || existing.updatedAt || new Date().toISOString()
        });
      } else {
        // Existing event is newer
        resultMap.set(targetKey, {
          ...evt,
          ...existing,
          id: existing.id
        });
      }
    } else {
      // New distinct event
      resultMap.set(evt.id, evt);
      if (extKey) extKeyToResultKey.set(extKey, evt.id);
    }
  }

  return Array.from(resultMap.values());
}

export function ensureUniqueEventIds(eventsList: CalendarEvent[]): CalendarEvent[] {
  return deduplicateCalendarEvents(eventsList);
}

export function loadEvents(): CalendarEvent[] {
  const deletedSet = loadDeletedEventIds();
  const loadedList: CalendarEvent[] = [];

  // 1. Check permanent vault first
  try {
    const rawVault = localStorage.getItem(KEYS.PERMANENT_EVENTS_VAULT);
    if (rawVault) {
      const parsed = JSON.parse(rawVault);
      if (Array.isArray(parsed)) {
        loadedList.push(...parsed);
      }
    }
  } catch (e) {
    console.warn('Error reading permanent events vault:', e);
  }

  // 2. Check primary events key
  try {
    const raw = localStorage.getItem(KEYS.EVENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        loadedList.push(...parsed);
      }
    }
  } catch (e) {
    console.warn('Error loading events:', e);
  }

  const cleaned = deduplicateCalendarEvents(loadedList);

  // Check if an Outlook ICS link is actually active in settings
  const currentSettings = loadSettings();
  const hasActiveOutlookIcs = Boolean(
    currentSettings.sync?.outlookIcsUrl &&
    currentSettings.sync.outlookIcsUrl.trim() &&
    !currentSettings.sync.unlinkOutlook
  );

  // If no Outlook link is configured, never return or retain Outlook events
  const filtered = hasActiveOutlookIcs
    ? cleaned
    : cleaned.filter((e) => !isOutlookEvent(e));

  // If loading had duplicate records, deleted items, or unlinked Outlook events, self-heal localStorage
  try {
    if (loadedList.length !== filtered.length) {
      localStorage.setItem(KEYS.EVENTS, JSON.stringify(filtered));
      localStorage.setItem(KEYS.PERMANENT_EVENTS_VAULT, JSON.stringify(filtered));
    }
  } catch (e) {}

  return filtered;
}

export function saveEvents(events: CalendarEvent[]): void {
  try {
    const currentSettings = loadSettings();
    const hasActiveOutlookIcs = Boolean(
      currentSettings.sync?.outlookIcsUrl &&
      currentSettings.sync.outlookIcsUrl.trim() &&
      !currentSettings.sync.unlinkOutlook
    );
    const validEvents = hasActiveOutlookIcs
      ? events
      : events.filter((e) => !isOutlookEvent(e));
    const cleanEvents = deduplicateCalendarEvents(validEvents);
    localStorage.setItem(KEYS.EVENTS, JSON.stringify(cleanEvents));
    localStorage.setItem(KEYS.PERMANENT_EVENTS_VAULT, JSON.stringify(cleanEvents));
  } catch (e) {
    console.error('Error saving events:', e);
  }
}

export function deleteEventFromStorage(eventId: string): void {
  try {
    recordDeletedEventId(eventId);
    const existingEvents = loadEvents();
    const target = existingEvents.find((e) => e.id === eventId);
    if (target?.externalEventId) {
      recordDeletedEventId(target.externalEventId);
    }

    const current = existingEvents.filter(
      (e) =>
        e.id !== eventId &&
        (!target?.externalEventId || e.externalEventId !== target.externalEventId)
    );
    localStorage.setItem(KEYS.EVENTS, JSON.stringify(current));
    localStorage.setItem(KEYS.PERMANENT_EVENTS_VAULT, JSON.stringify(current));

    // Clean from legacy keys as well to ensure it cannot be resurrected
    const legacyKeys = [
      'pro_calendar_events',
      'pro_calendar_events_v2',
      'pro_calendar_events_v3',
      'pro_calendar_events_v5',
      'pro_calendar_events_v6',
      'pro_calendar_events_v7',
      'events',
      'calendar_events'
    ];
    for (const lk of legacyKeys) {
      try {
        const raw = localStorage.getItem(lk);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(
              (e: any) =>
                e &&
                e.id !== eventId &&
                (!target?.externalEventId || e.externalEventId !== target.externalEventId)
            );
            localStorage.setItem(lk, JSON.stringify(filtered));
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error('Error deleting event from storage:', e);
  }
}

export interface PersistentOutlookConfig {
  outlookIcsUrl: string;
  outlookCalendarName?: string;
  outlookDefaultCategoryId?: string;
  outlookAutoSync?: boolean;
  outlookLastSyncedAt?: string;
  outlookSyncedCount?: number;
}

export function saveOutlookSyncConfig(config: PersistentOutlookConfig): void {
  try {
    if (config && config.outlookIcsUrl && config.outlookIcsUrl.trim()) {
      localStorage.setItem(KEYS.OUTLOOK_PERMANENT_VAULT, JSON.stringify(config));
    }
  } catch (e) {}
}

export function loadOutlookSyncConfig(): PersistentOutlookConfig | null {
  try {
    const raw = localStorage.getItem(KEYS.OUTLOOK_PERMANENT_VAULT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.outlookIcsUrl === 'string' && parsed.outlookIcsUrl.trim()) {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
}

export function clearOutlookSyncConfig(): void {
  try {
    localStorage.removeItem(KEYS.OUTLOOK_PERMANENT_VAULT);
    // Also clean up any cached settings so they don't resurrect the link
    const raw = localStorage.getItem(KEYS.SETTINGS);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.sync) {
          parsed.sync.outlookIcsUrl = '';
          parsed.sync.unlinkOutlook = true;
          parsed.sync.outlookSyncedCount = 0;
          localStorage.setItem(KEYS.SETTINGS, JSON.stringify(parsed));
        }
      } catch (e) {}
    }
    const rawVault = localStorage.getItem(KEYS.PERMANENT_SETTINGS_VAULT);
    if (rawVault) {
      try {
        const parsed = JSON.parse(rawVault);
        if (parsed?.sync) {
          parsed.sync.outlookIcsUrl = '';
          parsed.sync.unlinkOutlook = true;
          parsed.sync.outlookSyncedCount = 0;
          localStorage.setItem(KEYS.PERMANENT_SETTINGS_VAULT, JSON.stringify(parsed));
        }
      } catch (e) {}
    }

    // Purge any Outlook events from storage
    const curEventsRaw = localStorage.getItem(KEYS.EVENTS);
    if (curEventsRaw) {
      try {
        const evts = JSON.parse(curEventsRaw);
        if (Array.isArray(evts)) {
          const nonOutlook = evts.filter((e) => !isOutlookEvent(e));
          localStorage.setItem(KEYS.EVENTS, JSON.stringify(nonOutlook));
          localStorage.setItem(KEYS.PERMANENT_EVENTS_VAULT, JSON.stringify(nonOutlook));
        }
      } catch (e) {}
    }
  } catch (e) {}
}

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS) || localStorage.getItem(KEYS.PERMANENT_SETTINGS_VAULT);
    let parsed: any = null;
    if (raw) {
      parsed = JSON.parse(raw);
    }
    const temas = Array.isArray(parsed?.temas) && parsed.temas.length > 0 ? parsed.temas : ['Tema 1', 'Tema 2', 'Tema 3'];
    const baseSettings = parsed ? { ...INITIAL_SETTINGS, ...parsed, temas } : { ...INITIAL_SETTINGS };

    // Outlook ICS Link Self-Healing & Preservation:
    // Only retrieve from the permanent Outlook vault if NOT explicitly unlinked!
    const isUnlinked = baseSettings.sync?.unlinkOutlook === true;
    if (!isUnlinked) {
      const vaultConfig = loadOutlookSyncConfig();
      if (vaultConfig && vaultConfig.outlookIcsUrl) {
        if (!baseSettings.sync?.outlookIcsUrl || !baseSettings.sync.outlookIcsUrl.trim()) {
          baseSettings.sync = {
            ...baseSettings.sync,
            outlookIcsUrl: vaultConfig.outlookIcsUrl,
            outlookCalendarName: vaultConfig.outlookCalendarName || baseSettings.sync?.outlookCalendarName || 'Outlook Shared Calendar',
            outlookDefaultCategoryId: vaultConfig.outlookDefaultCategoryId || baseSettings.sync?.outlookDefaultCategoryId || 'client',
            outlookAutoSync: vaultConfig.outlookAutoSync ?? baseSettings.sync?.outlookAutoSync ?? true,
            outlookLastSyncedAt: vaultConfig.outlookLastSyncedAt || baseSettings.sync?.outlookLastSyncedAt,
            outlookSyncedCount: vaultConfig.outlookSyncedCount ?? baseSettings.sync?.outlookSyncedCount
          };
        }
      }
    } else {
      // Strictly maintain empty link if unlinked
      if (baseSettings.sync) {
        baseSettings.sync.outlookIcsUrl = '';
      }
    }

    return baseSettings;
  } catch (e) {
    console.warn('Error loading settings:', e);
  }
  saveSettings(INITIAL_SETTINGS);
  return INITIAL_SETTINGS;
}

export function saveSettings(settings: UserSettings): void {
  try {
    // If settings specifies an explicit unlink or empty link, clear the permanent vault
    const isUnlink = settings.sync?.unlinkOutlook === true || (settings.sync?.outlookIcsUrl !== undefined && !settings.sync.outlookIcsUrl.trim());
    if (isUnlink) {
      if (settings.sync) {
        settings.sync.outlookIcsUrl = '';
        settings.sync.unlinkOutlook = true;
      }
      clearOutlookSyncConfig();
    } else if (settings.sync?.outlookIcsUrl && settings.sync.outlookIcsUrl.trim()) {
      // Auto-replicate to the permanent Outlook vault so it survives browser cache and redeploys
      saveOutlookSyncConfig({
        outlookIcsUrl: settings.sync.outlookIcsUrl.trim(),
        outlookCalendarName: settings.sync.outlookCalendarName,
        outlookDefaultCategoryId: settings.sync.outlookDefaultCategoryId,
        outlookAutoSync: settings.sync.outlookAutoSync,
        outlookLastSyncedAt: settings.sync.outlookLastSyncedAt,
        outlookSyncedCount: settings.sync.outlookSyncedCount
      });
    }

    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    localStorage.setItem(KEYS.PERMANENT_SETTINGS_VAULT, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

export function loadDeletedCategoryIds(): Set<string> {
  const set = new Set<string>();
  try {
    const raw = localStorage.getItem(KEYS.DELETED_CATEGORY_IDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          if (typeof id === 'string') set.add(id);
        });
      }
    }
  } catch (e) {}
  return set;
}

export function recordDeletedCategoryId(categoryId: string): void {
  try {
    const set = loadDeletedCategoryIds();
    set.add(categoryId);
    localStorage.setItem(KEYS.DELETED_CATEGORY_IDS, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function recordDeletedCategoryIds(categoryIds: string[]): void {
  try {
    const set = loadDeletedCategoryIds();
    categoryIds.forEach((id) => {
      if (typeof id === 'string') set.add(id);
    });
    localStorage.setItem(KEYS.DELETED_CATEGORY_IDS, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function saveDeletedCategoryIds(categoryIds: string[]): void {
  try {
    localStorage.setItem(KEYS.DELETED_CATEGORY_IDS, JSON.stringify(Array.from(new Set(categoryIds))));
  } catch (e) {}
}

export function clearDeletedCategoryId(categoryId: string): void {
  try {
    const set = loadDeletedCategoryIds();
    if (set.has(categoryId)) {
      set.delete(categoryId);
      localStorage.setItem(KEYS.DELETED_CATEGORY_IDS, JSON.stringify(Array.from(set)));
    }
  } catch (e) {}
}

export function deleteCategoryFromStorage(categoryId: string): void {
  try {
    recordDeletedCategoryId(categoryId);
    const deletedCatSet = loadDeletedCategoryIds();
    
    // Clean all storage keys that might store categories
    const catKeys = [
      KEYS.CATEGORIES,
      KEYS.PERMANENT_CATEGORIES_VAULT,
      'pro_calendar_categories_v7',
      'pro_calendar_categories_v5',
      'pro_calendar_categories',
      'categories'
    ];
    for (const ck of catKeys) {
      try {
        const raw = localStorage.getItem(ck);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((c: any) => c && c.id !== categoryId && !deletedCatSet.has(c.id));
            localStorage.setItem(ck, JSON.stringify(filtered));
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error('Error deleting category from storage:', e);
  }
}

export function loadCategories(): Category[] {
  const deletedCatSet = loadDeletedCategoryIds();
  try {
    const raw = localStorage.getItem(KEYS.CATEGORIES) || localStorage.getItem(KEYS.PERMANENT_CATEGORIES_VAULT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((c: any) => c && c.id && !deletedCatSet.has(c.id));
        if (filtered.length > 0) {
          return filtered;
        }
      }
    }
  } catch (e) {
    console.warn('Error loading categories from storage:', e);
  }
  
  // If first time initialization, seed defaults that haven't been deleted
  const initial = DEFAULT_CATEGORIES.filter((c) => !deletedCatSet.has(c.id));
  if (initial.length > 0) {
    saveCategories(initial);
    return initial;
  }
  return DEFAULT_CATEGORIES;
}

export function saveCategories(categories: Category[]): void {
  const validCategories = (categories || []).filter((c) => c && c.id);
  try {
    const deletedSet = loadDeletedCategoryIds();
    let changed = false;
    validCategories.forEach((c) => {
      if (deletedSet.has(c.id)) {
        deletedSet.delete(c.id);
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(KEYS.DELETED_CATEGORY_IDS, JSON.stringify(Array.from(deletedSet)));
    }
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(validCategories));
    localStorage.setItem(KEYS.PERMANENT_CATEGORIES_VAULT, JSON.stringify(validCategories));
  } catch (e) {
    console.error('Error saving categories:', e);
  }
}

export function resetCategoriesStorage(): Category[] {
  try {
    localStorage.removeItem(KEYS.CATEGORIES);
    localStorage.removeItem(KEYS.PERMANENT_CATEGORIES_VAULT);
    localStorage.removeItem(KEYS.DELETED_CATEGORY_IDS);
    saveCategories(DEFAULT_CATEGORIES);
  } catch (e) {}
  return DEFAULT_CATEGORIES;
}

export function loadSharedCalendars(): SharedCalendar[] {
  try {
    const raw = localStorage.getItem(KEYS.SHARES) || localStorage.getItem(KEYS.PERMANENT_SHARES_VAULT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error loading shared calendars from storage:', e);
  }
  return [];
}

export function saveSharedCalendars(shares: SharedCalendar[]): void {
  try {
    localStorage.setItem(KEYS.SHARES, JSON.stringify(shares));
    localStorage.setItem(KEYS.PERMANENT_SHARES_VAULT, JSON.stringify(shares));
  } catch (e) {
    console.error('Error saving shared calendars:', e);
  }
}

export function getShareByCodeLocal(code: string): SharedCalendar | null {
  try {
    const shares = loadSharedCalendars();
    const clean = code.trim().toUpperCase();
    return shares.find((s) => s.code.toUpperCase() === clean && s.isActive) || null;
  } catch (e) {
    return null;
  }
}

import { User, CalendarEvent, UserSettings, Category, SharedCalendar } from '../types';

export interface SyncData {
  users: User[];
  events: CalendarEvent[];
  settings: UserSettings;
  categories?: Category[];
  shares?: SharedCalendar[];
  deletedEventIds?: string[];
  deletedCategoryIds?: string[];
  deletedUserIds?: string[];
}

export async function fetchSyncData(): Promise<SyncData | null> {
  try {
    const res = await fetch('/api/sync', {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Could not sync with backend server:', err);
    return null;
  }
}

export async function apiPushSyncData(payload: Partial<SyncData>): Promise<SyncData | null> {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Could not push sync data to server:', err);
    return null;
  }
}

export async function apiBulkSyncUsers(users: User[]): Promise<User[] | null> {
  try {
    const res = await fetch('/api/users/bulk-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.users || null;
  } catch (err) {
    console.warn('Could not bulk sync users to server:', err);
    return null;
  }
}

export async function fetchUsers(): Promise<User[] | null> {
  try {
    const res = await fetch('/api/users', {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Could not fetch users from server:', err);
    return null;
  }
}

export async function apiRegister(
  user: {
    username: string;
    email: string;
    password: string;
    name?: string;
    role?: 'admin' | 'member' | 'viewer';
    avatarColor?: string;
  }
): Promise<{ success: boolean; user?: User; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.error || `Registration failed (HTTP ${res.status})` };
    }
    return { success: true, user: data.user, message: data.message };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error connecting to registration service.' };
  }
}

export async function apiLogin(
  identifier: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string; canRegister?: boolean; message?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data?.error || `Login failed (HTTP ${res.status})`,
        canRegister: !!data?.canRegister
      };
    }
    return { success: true, user: data.user, message: data.message };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error connecting to authentication server.' };
  }
}

export async function apiQuickRegister(
  identifier: string,
  password: string,
  name?: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const res = await fetch('/api/auth/quick-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, name })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.error || `Account creation failed (HTTP ${res.status})` };
    }
    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error connecting to registration service.' };
  }
}

export async function apiRecoverCredentials(email: string): Promise<{
  success: boolean;
  username?: string;
  name?: string;
  email?: string;
  recoveryCode?: string;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/recover-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.error || `Recovery failed (HTTP ${res.status})` };
    }
    return {
      success: true,
      username: data.username,
      name: data.name,
      email: data.email,
      recoveryCode: data.recoveryCode,
      message: data.message
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error connecting to recovery service.' };
  }
}

export async function apiResetPassword(
  email: string,
  newPassword: string,
  recoveryCode?: string
): Promise<{ success: boolean; username?: string; user?: User; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword, recoveryCode })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.error || `Password reset failed (HTTP ${res.status})` };
    }
    return {
      success: true,
      username: data.username,
      user: data.user,
      message: data.message
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error connecting to reset service.' };
  }
}

export async function apiResetUsersDatabase(): Promise<{ success: boolean; users?: User[]; error?: string }> {
  try {
    const res = await fetch('/api/admin/reset-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.error || `Reset failed (HTTP ${res.status})` };
    }
    return { success: true, users: data.users };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error resetting user database.' };
  }
}

export async function apiCreateUser(user: Partial<User>, password?: string): Promise<User | null> {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('Error creating user on server:', err);
    throw err;
  }
}

export async function apiUpdateUser(user: User): Promise<User | null> {
  try {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error updating user on server:', err);
    return null;
  }
}

export async function apiDeleteUser(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' }
    });
    return res.ok;
  } catch (err) {
    console.error('Error deleting user on server:', err);
    return false;
  }
}

export async function apiSaveEvent(event: CalendarEvent): Promise<CalendarEvent | null> {
  try {
    const res = await fetch(`/api/events/${event.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error saving event on server:', err);
    return null;
  }
}

export async function apiBulkSaveEvents(events: CalendarEvent[]): Promise<boolean> {
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(events)
    });
    return res.ok;
  } catch (err) {
    console.error('Error bulk saving events on server:', err);
    return false;
  }
}

export async function apiDeleteEvent(
  eventId: string,
  extra?: { externalEventId?: string; title?: string; startDate?: string }
): Promise<boolean> {
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extra || {})
    });
    return res.ok;
  } catch (err) {
    console.error('Error deleting event on server:', err);
    return false;
  }
}

export async function apiSaveSettings(settings: UserSettings): Promise<UserSettings | null> {
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error saving settings on server:', err);
    return null;
  }
}

export async function apiSaveCategory(category: Category): Promise<Category | null> {
  try {
    const res = await fetch(`/api/categories/${category.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error saving category on server:', err);
    return null;
  }
}

export async function apiDeleteCategory(categoryId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/categories/${categoryId}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.error('Error deleting category on server:', err);
    return false;
  }
}

export async function apiBulkSaveCategories(categories: Category[]): Promise<boolean> {
  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categories)
    });
    return res.ok;
  } catch (err) {
    console.error('Error bulk saving categories on server:', err);
    return false;
  }
}

// ==========================================
// SHARED CALENDARS API METHODS
// ==========================================

export async function apiFetchShares(): Promise<SharedCalendar[]> {
  try {
    const res = await fetch('/api/shares', {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Could not fetch shares from server:', err);
    return [];
  }
}

export async function apiCreateShare(share: Partial<SharedCalendar>): Promise<SharedCalendar | null> {
  try {
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(share)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error creating share on server:', err);
    return null;
  }
}

export async function apiUpdateShare(id: string, updates: Partial<SharedCalendar>): Promise<SharedCalendar | null> {
  try {
    const res = await fetch(`/api/shares/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error updating share on server:', err);
    return null;
  }
}

export async function apiDeleteShare(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/shares/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.error('Error deleting share on server:', err);
    return false;
  }
}

export interface SharedCalendarResolveResult {
  success: boolean;
  share?: SharedCalendar;
  events?: CalendarEvent[];
  categories?: Category[];
  settings?: UserSettings;
  error?: string;
}

export async function apiGetShareByCode(code: string): Promise<SharedCalendarResolveResult> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const res = await fetch(`/api/shares/code/${encodeURIComponent(cleanCode)}`, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.error || `Failed to load shared calendar (${res.status})` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error fetching shared calendar.' };
  }
}

export async function apiVerifyShare(code: string): Promise<SharedCalendarResolveResult> {
  try {
    const res = await fetch('/api/shares/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() })
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.error || `Failed to verify share code (${res.status})` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error verifying share code.' };
  }
}

export interface PublicCategoryResult {
  success: boolean;
  category?: Category;
  categories?: Category[];
  events?: CalendarEvent[];
  settings?: UserSettings;
  error?: string;
}

export async function apiGetPublicCategory(categoryId: string): Promise<PublicCategoryResult> {
  try {
    const cleanId = categoryId.trim();
    const res = await fetch(`/api/public/category/${encodeURIComponent(cleanId)}`, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.error || `Category not found (${res.status})` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error fetching category schedule.' };
  }
}

// ==========================================
// ZAPIER + MICROSOFT OUTLOOK SYNC API
// ==========================================

export async function fetchZapierConfig(): Promise<{ success: boolean; config?: any; webhookUrl?: string; baseUrl?: string; error?: string }> {
  try {
    const res = await fetch('/api/zapier/config', {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    console.warn('Could not fetch Zapier configuration:', err);
    return { success: false, error: err?.message || 'Failed to fetch Zapier config' };
  }
}

export async function apiSaveZapierConfig(payload: any): Promise<{ success: boolean; config?: any; webhookUrl?: string; baseUrl?: string; error?: string }> {
  try {
    const res = await fetch('/api/zapier/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save Zapier config' };
  }
}

export async function apiTestZapierOutbound(catchHookUrl?: string): Promise<{ success: boolean; status?: number; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/zapier/test-outbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catchHookUrl })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to test outbound Zapier webhook' };
  }
}

export async function apiSimulateZapierInbound(sample?: any): Promise<{ success: boolean; event?: any; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/zapier/simulate-inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample || {})
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to simulate Zapier inbound event' };
  }
}

export async function apiClearZapierLogs(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/zapier/logs/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to clear Zapier logs' };
  }
}

export async function apiSyncOutlook(params?: {
  url?: string;
  categoryId?: string;
  calendarName?: string;
}): Promise<{
  success: boolean;
  count?: number;
  events?: CalendarEvent[];
  lastSyncedAt?: string;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/sync/outlook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {})
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to reach Outlook sync service.' };
  }
}

export async function apiSaveOutlookConfig(params: {
  url: string;
  calendarName?: string;
  categoryId?: string;
  autoSync?: boolean;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  settings?: UserSettings;
}> {
  try {
    const res = await fetch('/api/settings/outlook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save Outlook configuration on server.' };
  }
}

export async function apiUnlinkOutlook(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/settings/outlook', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to unlink Outlook on server.' };
  }
}





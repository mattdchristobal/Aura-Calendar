import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Role,
  CalendarEvent,
  UserSettings,
  ViewType,
  Category,
  SharedCalendar
} from './types';
import { DEFAULT_CATEGORIES, CATEGORY_COLOR_PRESETS, createCategory } from './utils/categories';
import {
  loadUsers,
  saveUsers,
  loadCurrentUser,
  saveCurrentUser,
  loadEvents,
  saveEvents,
  isOutlookEvent,
  ensureUniqueEventIds,
  deduplicateCalendarEvents,
  normalizeEventTitle,
  deleteEventFromStorage,
  loadDeletedEventIds,
  saveDeletedEventIds,
  recordDeletedEventId,
  recordDeletedEventIds,
  clearDeletedEventId,
  loadSettings,
  saveSettings,
  loadCategories,
  saveCategories,
  loadDeletedCategoryIds,
  saveDeletedCategoryIds,
  recordDeletedCategoryId,
  recordDeletedCategoryIds,
  clearDeletedCategoryId,
  deleteCategoryFromStorage,
  loadSharedCalendars,
  saveSharedCalendars,
  getShareByCodeLocal,
  resetCategoriesStorage,
  preserveUserCredential,
  getStoredCredential,
  loadPermanentVault,
  deleteUserPermanently,
  loadDeletedUserIds,
  recordDeletedUserIds
} from './utils/storage';
import {
  fetchSyncData,
  apiPushSyncData,
  apiCreateUser,
  apiUpdateUser,
  apiDeleteUser,
  apiBulkSyncUsers,
  apiSaveEvent,
  apiBulkSaveEvents,
  apiDeleteEvent,
  apiSaveSettings,
  apiSaveCategory,
  apiDeleteCategory,
  apiBulkSaveCategories,
  apiFetchShares,
  apiCreateShare,
  apiUpdateShare,
  apiDeleteShare,
  apiVerifyShare,
  apiGetShareByCode,
  apiSyncOutlook,
  apiUnlinkOutlook
} from './utils/api';
import { toYMD, getNearestSunday, isEventOnDate } from './utils/dateUtils';
import { exportEventsToIcs, downloadIcsFile, fetchIcsFeed, parseIcsContent } from './utils/icsParser';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MonthView } from './components/MonthView';
import { WeekView } from './components/WeekView';
import { SundayView } from './components/SundayView';
import { YearView } from './components/YearView';
import { EventInspectorWindow } from './components/EventInspectorWindow';
import { EventModal } from './components/EventModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { AuthModal } from './components/AuthModal';
import { LoginPage } from './components/LoginPage';
import { ShareCalendarModal } from './components/ShareCalendarModal';
import { SharedCalendarGuestBanner } from './components/SharedCalendarGuestBanner';
import { CategoryPdfDocumentView } from './components/CategoryPdfDocumentView';
import { CategoryQrModal } from './components/CategoryQrModal';
import { AnunciosView } from './components/AnunciosView';
import { PublicAnnouncementPage } from './components/PublicAnnouncementPage';

export default function App() {
  // State Initialization
  const [users, setUsers] = useState<User[]>(() => loadUsers());
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadCurrentUser(users));
  // Effective user for operations & handlers (if guest, use safe viewer profile)
  const effectiveUser: User = currentUser || {
    id: 'guest_viewer',
    name: 'Guest Viewer',
    username: 'guest',
    email: 'guest@share.local',
    role: 'viewer',
    avatarColor: 'bg-indigo-600',
    active: true
  };
  const [events, setEvents] = useState<CalendarEvent[]>(() => ensureUniqueEventIds(loadEvents()));
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [categories, setCategories] = useState<Category[]>(() => loadCategories());
  const [shares, setShares] = useState<SharedCalendar[]>(() => loadSharedCalendars());
  const [activeSharedCalendar, setActiveSharedCalendar] = useState<SharedCalendar | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareVerifyNotice, setShareVerifyNotice] = useState<string | null>(null);

  // Category QR & PDF Schedule State
  const [isCategoryQrModalOpen, setIsCategoryQrModalOpen] = useState(false);
  const [categoryQrInitialId, setCategoryQrInitialId] = useState<string | undefined>();
  const [pdfCategoryViewId, setPdfCategoryViewId] = useState<string | null>(null);
  const [isPublicAnnouncement, setIsPublicAnnouncement] = useState(false);
  const [publicAnnouncementId, setPublicAnnouncementId] = useState('active');
  const [isOutlookSyncing, setIsOutlookSyncing] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [lastCloudSyncedAt, setLastCloudSyncedAt] = useState<Date | null>(null);

  // Background real-time synchronization with shared backend database
  const syncWithServer = useCallback(async () => {
    try {
      setIsCloudSyncing(true);
      const localUsers = loadUsers();
      const serverData = await fetchSyncData();
      if (serverData) {
        if (Array.isArray(serverData.deletedUserIds) && serverData.deletedUserIds.length > 0) {
          recordDeletedUserIds(serverData.deletedUserIds);
        }
        const clientDeletedUserSet = loadDeletedUserIds();

        if (Array.isArray(serverData.users)) {
          const userMap = new Map<string, User>();
          localUsers.forEach((u) => {
            if (u && u.id && !clientDeletedUserSet.has(u.id)) {
              userMap.set(u.id, u);
            }
          });

          let needsServerPush = false;
          const serverUserIds = new Set(serverData.users.map((u) => u.id));

          serverData.users.forEach((s) => {
            if (
              s &&
              s.id &&
              !clientDeletedUserSet.has(s.id) &&
              !['u_marcus', 'u_john', 'u_sarah', 'u_admin', 'u_admin_default'].includes(s.id) &&
              !['admin@executivetech.com'].includes((s.email || '').toLowerCase())
            ) {
              const local = userMap.get(s.id);
              userMap.set(s.id, {
                ...local,
                ...s,
                password: local?.password || s.password || 'password123'
              });
            }
          });

          // Check if local storage has accounts that the server is missing (excluding deleted users)
          const missingOnServer = localUsers.filter(
            (u) =>
              !serverUserIds.has(u.id) &&
              !clientDeletedUserSet.has(u.id) &&
              !['u_marcus', 'u_john', 'u_sarah', 'u_admin', 'u_admin_default'].includes(u.id) &&
              !['admin@executivetech.com'].includes((u.email || '').toLowerCase())
          );
          if (missingOnServer.length > 0) {
            needsServerPush = true;
          }

          const mergedUsers = Array.from(userMap.values()).filter(
            (u) => u && u.id && !clientDeletedUserSet.has(u.id)
          );
          setUsers(mergedUsers);
          saveUsers(mergedUsers);

          if (needsServerPush) {
            apiBulkSyncUsers(mergedUsers).catch(() => {});
          }
          
          // Refresh active session with latest data without dropping session
          setCurrentUser((prevUser) => {
            if (!prevUser) {
              return null;
            }
            const updated = mergedUsers.find(
              (u) =>
                u.id === prevUser.id ||
                (u.username && prevUser.username && u.username.toLowerCase() === prevUser.username.toLowerCase()) ||
                (u.email && prevUser.email && u.email.toLowerCase() === prevUser.email.toLowerCase())
            );
            if (updated && updated.active) {
              saveCurrentUser(updated);
              return updated;
            }
            if (updated && !updated.active) {
              saveCurrentUser(null);
              return null;
            }
            return prevUser;
          });
        }
        // 1. Settings Merge: determine active user configurations and Outlook ICS link status
        const localSettings = loadSettings();
        const serverSettings: Partial<UserSettings> = (serverData.settings || {}) as Partial<UserSettings>;
        const localSync = localSettings.sync || ({} as UserSettings['sync']);
        const serverSync: Partial<UserSettings['sync']> = (serverSettings.sync || {}) as Partial<UserSettings['sync']>;

        // Intelligent Outlook ICS Link Resolution:
        // Respect explicit unlinking: if either side marked unlinkOutlook: true, keep it unlinked!
        const isExplicitlyUnlinked = localSync.unlinkOutlook === true || serverSync.unlinkOutlook === true;
        let effectiveOutlookIcsUrl = '';
        if (!isExplicitlyUnlinked) {
          effectiveOutlookIcsUrl = (
            (serverSync.outlookIcsUrl && serverSync.outlookIcsUrl.trim()) ||
            (localSync.outlookIcsUrl && localSync.outlookIcsUrl.trim()) ||
            ''
          );
        }
        const hasValidOutlookLink = Boolean(effectiveOutlookIcsUrl && !isExplicitlyUnlinked);

        const mergedSettings: UserSettings = {
          ...localSettings,
          ...serverSettings,
          sync: {
            ...localSync,
            ...serverSync,
            unlinkOutlook: isExplicitlyUnlinked,
            outlookIcsUrl: effectiveOutlookIcsUrl,
            outlookCalendarName: isExplicitlyUnlinked ? '' : (serverSync.outlookCalendarName || localSync.outlookCalendarName || 'Outlook Shared Calendar'),
            outlookDefaultCategoryId: serverSync.outlookDefaultCategoryId || localSync.outlookDefaultCategoryId || 'client',
            outlookAutoSync: serverSync.outlookAutoSync ?? localSync.outlookAutoSync ?? true,
            outlookLastSyncedAt: isExplicitlyUnlinked ? undefined : (serverSync.outlookLastSyncedAt || localSync.outlookLastSyncedAt),
            outlookSyncedCount: isExplicitlyUnlinked ? 0 : (serverSync.outlookSyncedCount ?? localSync.outlookSyncedCount)
          },
          notifications: {
            ...localSettings.notifications,
            ...(serverSettings.notifications || {})
          },
          temas: (localSettings.temas && localSettings.temas.length > 0)
            ? localSettings.temas
            : (serverSettings.temas && serverSettings.temas.length > 0)
              ? serverSettings.temas
              : ['Tema 1', 'Tema 2', 'Tema 3']
        };
        if (localSettings.theme) mergedSettings.theme = localSettings.theme;
        if (localSettings.firstDayOfWeek !== undefined) mergedSettings.firstDayOfWeek = localSettings.firstDayOfWeek;
        if (localSettings.density) mergedSettings.density = localSettings.density;
        
        setSettings(mergedSettings);
        saveSettings(mergedSettings);

        // 2. Events Cloud Reconcile: Server is the canonical cloud authority
        const serverDeletedIds: string[] = Array.isArray(serverData.deletedEventIds)
          ? serverData.deletedEventIds.filter((id: string) => typeof id === 'string' && !id.startsWith('del_sig_'))
          : [];
        const serverDeletedSet = new Set(serverDeletedIds);

        const localDeletedIds = loadDeletedEventIds();
        let localDeletedChanged = false;
        localDeletedIds.forEach((id) => {
          if (id.startsWith('del_sig_')) {
            localDeletedIds.delete(id);
            localDeletedChanged = true;
          }
        });

        const localEvents = loadEvents();
        const serverEvents = Array.isArray(serverData.events) ? serverData.events : [];
        const serverEventMap = new Map<string, CalendarEvent>();

        // Authoritative server events take primary precedence
        serverEvents.forEach((se) => {
          if (!se || !se.id) return;
          if (['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5', 'evt-6', 'evt-7', 'evt-8', 'evt-9', 'evt-10'].includes(se.id)) return;
          // Do not sync Outlook events if no valid ICS link is active
          if (!hasValidOutlookLink && isOutlookEvent(se)) return;

          // If active on server, ensure any stale local tombstone is cleared
          if (localDeletedIds.has(se.id)) {
            localDeletedIds.delete(se.id);
            localDeletedChanged = true;
          }
          if (se.externalEventId && localDeletedIds.has(se.externalEventId)) {
            localDeletedIds.delete(se.externalEventId);
            localDeletedChanged = true;
          }

          serverEventMap.set(se.id, se);
        });

        if (localDeletedChanged) {
          saveDeletedEventIds(Array.from(localDeletedIds));
        }

        // Reconcile with local cache:
        // Local creations/edits are preserved and pushed to cloud
        const offlineEventsToPush: CalendarEvent[] = [];
        localEvents.forEach((le) => {
          if (!le || !le.id) return;
          if (['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5', 'evt-6', 'evt-7', 'evt-8', 'evt-9', 'evt-10'].includes(le.id)) return;
          // Do not push or preserve unlinked Outlook events
          if (!hasValidOutlookLink && isOutlookEvent(le)) return;
          // Only drop if explicitly deleted on the server
          if (serverDeletedSet.has(le.id) || (le.externalEventId && serverDeletedSet.has(le.externalEventId))) {
            return;
          }

          const serverEvt = serverEventMap.get(le.id);
          if (serverEvt) {
            const leTime = le.updatedAt ? new Date(le.updatedAt).getTime() : 0;
            const seTime = serverEvt.updatedAt ? new Date(serverEvt.updatedAt).getTime() : 0;
            if (leTime > seTime) {
              serverEventMap.set(le.id, le);
              offlineEventsToPush.push(le);
            }
          } else {
            // Event exists locally but not yet on server: preserve and push!
            serverEventMap.set(le.id, le);
            offlineEventsToPush.push(le);
          }
        });

        const rawMergedEvents = deduplicateCalendarEvents(
          Array.from(serverEventMap.values()).filter(e => hasValidOutlookLink || !isOutlookEvent(e))
        );
        // Ensure any legacy 'client' events map to active category (e.g. 'new')
        const activeCatList = (Array.isArray(serverData.categories) && serverData.categories.length > 0)
          ? serverData.categories
          : categories;
        const primaryCatId = (activeCatList[0] && activeCatList[0].id) || 'new';
        const activeCatIds = new Set(activeCatList.map((c: any) => c.id));

        const mergedEvents = rawMergedEvents.map((e) => {
          if (!e.categoryId || e.categoryId === 'client' || !activeCatIds.has(e.categoryId)) {
            return { ...e, categoryId: primaryCatId };
          }
          return e;
        });

        setEvents(mergedEvents);
        saveEvents(mergedEvents);

        // Push any offline or newly cached events to server in one bulk request
        const validOfflinePush = offlineEventsToPush.filter(e => hasValidOutlookLink || !isOutlookEvent(e));
        if (validOfflinePush.length > 0) {
          apiBulkSaveEvents(validOfflinePush).catch(() => {});
        }

        // Proactive synchronization
        if (isExplicitlyUnlinked) {
          if (serverSync.outlookIcsUrl) {
            apiUnlinkOutlook().catch(() => {});
          }
        } else if (effectiveOutlookIcsUrl && (!serverSync.outlookIcsUrl || !serverSync.outlookIcsUrl.trim())) {
          apiSaveSettings(mergedSettings).catch(() => {});
        } else if (JSON.stringify(serverData.settings) !== JSON.stringify(mergedSettings)) {
          apiSaveSettings(mergedSettings).catch(() => {});
        }

        // 3. Categories Bidirectional Merge: preserve custom categories and honor deleted categories
        const localCategories = loadCategories();
        const activeLocalCatIds = new Set(localCategories.map((c) => c.id).filter(Boolean));
        const localDeletedCatIds = loadDeletedCategoryIds();

        // CRITICAL: Any category actively present on the server was created/approved by an Admin
        // and must NEVER be treated as deleted locally! Unshield immediately.
        if (Array.isArray(serverData.categories)) {
          serverData.categories.forEach((c) => {
            if (c && c.id) {
              localDeletedCatIds.delete(c.id);
              clearDeletedCategoryId(c.id);
            }
          });
        }

        // Active local categories must also NEVER be treated as deleted
        activeLocalCatIds.forEach((id) => {
          localDeletedCatIds.delete(id);
          clearDeletedCategoryId(id);
        });
        saveDeletedCategoryIds(Array.from(localDeletedCatIds));

        if (Array.isArray(serverData.deletedCategoryIds) && serverData.deletedCategoryIds.length > 0) {
          const activeServerCatIds = new Set((serverData.categories || []).map((c: any) => c?.id).filter(Boolean));
          // Only adopt deletions for categories that are NOT present locally AND not present on server
          const trueDeleted = serverData.deletedCategoryIds.filter(
            (id) => !activeLocalCatIds.has(id) && !activeServerCatIds.has(id)
          );
          recordDeletedCategoryIds(trueDeleted);
          trueDeleted.forEach((id) => localDeletedCatIds.add(id));
        }

        const catMap = new Map<string, Category>();

        // Merge server categories first (authoritative from admin)
        if (Array.isArray(serverData.categories)) {
          serverData.categories.forEach((c) => {
            if (c && c.id && !localDeletedCatIds.has(c.id)) {
              catMap.set(c.id, c);
            }
          });
        }

        // Populate local categories that aren't deleted
        localCategories.forEach((c) => {
          if (c && c.id && !localDeletedCatIds.has(c.id)) {
            if (!catMap.has(c.id)) {
              catMap.set(c.id, c);
            }
          }
        });

        const mergedCategories = Array.from(catMap.values());
        if (mergedCategories.length > 0) {
          setCategories(mergedCategories);
          saveCategories(mergedCategories);

          // Update selectedCategoryIds: preserve existing selections, AND automatically activate newly added categories so they appear immediately on the calendar & filters
          setSelectedCategoryIds((prev) => {
            const validIds = new Set(mergedCategories.map((c) => c.id));
            const prevSet = new Set(prev.filter((id) => validIds.has(id)));
            // Ensure any newly discovered category from server is selected by default
            mergedCategories.forEach((c) => {
              if (!activeLocalCatIds.has(c.id) || prevSet.size === 0) {
                prevSet.add(c.id);
              }
            });
            const result = Array.from(prevSet);
            return result.length > 0 ? result : mergedCategories.map((c) => c.id);
          });

          // Discrepancy push to server ONLY by Admin users to prevent member profiles from overwriting admin changes
          const activeRole = currentUser?.role || (effectiveUser ? effectiveUser.role : undefined);
          const isAdmin = activeRole === 'admin';
          if (isAdmin) {
            const serverCatIds = new Set((serverData.categories || []).map((c) => c.id));
            const hasServerDiscrepancy =
              mergedCategories.some((c) => !serverCatIds.has(c.id)) ||
              (serverData.categories || []).some((c) => localDeletedCatIds.has(c.id));
            if (hasServerDiscrepancy) {
              apiBulkSaveCategories(mergedCategories).catch(() => {});
              apiPushSyncData({
                categories: mergedCategories,
                deletedCategoryIds: Array.from(localDeletedCatIds)
              }).catch(() => {});
            }
          }
        }

        // 4. Shares Merge
        const localShares = loadSharedCalendars();
        const shareMap = new Map<string, SharedCalendar>();
        localShares.forEach((s) => { if (s && s.id) shareMap.set(s.id, s); });
        if (Array.isArray((serverData as any).shares)) {
          (serverData as any).shares.forEach((s: SharedCalendar) => {
            if (s && s.id) {
              const existing = shareMap.get(s.id);
              shareMap.set(s.id, { ...existing, ...s });
            }
          });
        }
        const mergedShares = Array.from(shareMap.values());
        setShares(mergedShares);
        saveSharedCalendars(mergedShares);
      }
    } catch (e) {
      console.warn('Sync error:', e);
    } finally {
      setIsCloudSyncing(false);
      setLastCloudSyncedAt(new Date());
    }
  }, []);

  // Fetch shares from API on startup
  useEffect(() => {
    apiFetchShares()
      .then((serverShares) => {
        if (Array.isArray(serverShares) && serverShares.length > 0) {
          setShares(serverShares);
          saveSharedCalendars(serverShares);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-detect ?share=CODE or ?category=CAT_ID or ?view=pdf or /pdf/:categoryId or /anuncio in URL on first load
  useEffect(() => {
    try {
      // Check pathname first (e.g. /pdf/work or /public/pdf/all or /anuncio or /flyer)
      const pathname = window.location.pathname;
      const anuncioMatch = pathname.match(/^\/(?:public\/)?(?:anuncio|anuncios|announcement|announcements|flyer)\/?(.*)$/);
      if (anuncioMatch) {
        setIsPublicAnnouncement(true);
        setPublicAnnouncementId(decodeURIComponent(anuncioMatch[1] || 'active').trim());
        return;
      }

      const pdfMatch = pathname.match(/^\/(?:public\/)?pdf\/?(.*)$/);
      if (pdfMatch) {
        const catFromPath = decodeURIComponent(pdfMatch[1] || '').trim();
        setPdfCategoryViewId(catFromPath || 'all');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const shareCode = params.get('share') || params.get('code');
      const catParam = params.get('category') || params.get('cat');
      const viewParam = params.get('view');
      const tabParam = params.get('tab');

      if (viewParam === 'anuncio' || viewParam === 'anuncios' || tabParam === 'anuncios') {
        setIsPublicAnnouncement(true);
        return;
      }

      if (shareCode) {
        handleAccessShareCode(shareCode);
      } else if (catParam) {
        setPdfCategoryViewId(catParam);
      } else if (viewParam === 'pdf') {
        const localCats = loadCategories();
        if (localCats.length > 0) {
          setPdfCategoryViewId(localCats[0].id);
        } else {
          setPdfCategoryViewId('all');
        }
      }
    } catch (e) {
      console.warn('URL query parsing error:', e);
    }
  }, []);

  useEffect(() => {
    syncWithServer();
    const interval = setInterval(syncWithServer, 5000);
    const onFocus = () => syncWithServer();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncWithServer]);

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  // Filter & Search
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    () => loadCategories().map((c) => c.id)
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [modalDateYmd, setModalDateYmd] = useState<string | undefined>();
  const [modalTime24, setModalTime24] = useState<string | undefined>();

  // Inspector Drawer (Large Preview Window)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectingEvent, setInspectingEvent] = useState<CalendarEvent | null>(null);
  const [inspectingDateEvents, setInspectingDateEvents] = useState<CalendarEvent[]>([]);
  const [inspectingDate, setInspectingDate] = useState<Date | null>(null);

  // System Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'account' | 'calendar-accounts' | 'notifications' | 'sync' | 'theme' | 'categories' | 'temas' | 'admin'>('account');
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<'users' | 'categories'>('users');
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Apply Theme Mode (Light / Dark)
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System mode
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [settings.theme]);

  // Quick Toggle Dark / Light Theme
  const handleToggleTheme = () => {
    const isCurrentlyDark = document.documentElement.classList.contains('dark') || settings.theme === 'dark';
    const nextTheme: 'light' | 'dark' = isCurrentlyDark ? 'light' : 'dark';
    const root = document.documentElement;
    if (nextTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const updatedSettings: UserSettings = {
      ...settings,
      theme: nextTheme
    };
    handleSaveSettings(updatedSettings);
  };

  // Handle Event Category Filter Toggles
  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // Date Navigation Handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === 'year') {
      d.setFullYear(d.getFullYear() - 1);
    } else if (view === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (view === 'week') {
      d.setDate(d.getDate() - 7);
    } else if (view === 'sunday') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === 'year') {
      d.setFullYear(d.getFullYear() + 1);
    } else if (view === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (view === 'week') {
      d.setDate(d.getDate() + 7);
    } else if (view === 'sunday') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleSelectDate = (date: Date) => {
    setCurrentDate(date);
    // If clicking a date in year view, switch to month or open day agenda
    const dateYmd = toYMD(date);
    const dayEvts = events.filter((e) => isEventOnDate(e, dateYmd));

    if (view === 'year') {
      setView('month');
    } else {
      // Open daily inspector preview
      setInspectingEvent(null);
      setInspectingDate(date);
      setInspectingDateEvents(dayEvts);
      setIsInspectorOpen(true);
    }
  };

  // Open Event Modal Actions
  const handleOpenNewEvent = () => {
    if (currentUser?.role === 'viewer') return;
    setEditingEvent(null);
    setModalDateYmd(toYMD(currentDate));
    setModalTime24('09:00');
    setIsEventModalOpen(true);
  };

  const handleCreateEventForDate = (dateYmd: string) => {
    if (currentUser?.role === 'viewer') return;
    setEditingEvent(null);
    setModalDateYmd(dateYmd);
    setModalTime24('09:00');
    setIsEventModalOpen(true);
  };

  const handleCreateEventForDateTime = (dateYmd: string, time24: string) => {
    if (currentUser?.role === 'viewer') return;
    setEditingEvent(null);
    setModalDateYmd(dateYmd);
    setModalTime24(time24);
    setIsEventModalOpen(true);
  };

  // Inspect Event Action (Opens Large Preview Window)
  const handleSelectEvent = (evt: CalendarEvent) => {
    setInspectingEvent(evt);
    setInspectingDate(new Date(evt.startDate));
    setInspectingDateEvents([evt]);
    setIsInspectorOpen(true);
  };

  // Edit Event from Inspector or List
  const handleEditEvent = (evt: CalendarEvent) => {
    if (currentUser?.role === 'viewer') return;
    setIsInspectorOpen(false);
    setEditingEvent(evt);
    setModalDateYmd(evt.startDate);
    setModalTime24(evt.startTime);
    setIsEventModalOpen(true);
  };

  // Save Event (Create or Update)
  const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
    if (currentUser?.role === 'viewer') return;
    let savedEvt: CalendarEvent;
    let updatedEvents: CalendarEvent[];
    const nowIso = new Date().toISOString();

    if (eventData.id) {
      // Update existing
      const existing = events.find((e) => e.id === eventData.id);
      const isAdmin = (currentUser?.role || effectiveUser.role) === 'admin';

      savedEvt = {
        ...existing,
        ...eventData,
        updatedAt: nowIso,
        ...(isAdmin ? {
          customizedByAdmin: true,
          adminEditedAt: nowIso,
          adminEditedBy: currentUser?.name || effectiveUser.name || 'Administrator'
        } : {})
      } as CalendarEvent;

      updatedEvents = events.map((e) =>
        e.id === eventData.id ? savedEvt : e
      );

      // Keep inspector preview up-to-date
      if (inspectingEvent?.id === savedEvt.id) {
        setInspectingEvent(savedEvt);
      }
      setInspectingDateEvents((prev) =>
        prev.map((e) => (e.id === savedEvt.id ? savedEvt : e))
      );
    } else {
      // Create new
      const newId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      savedEvt = {
        id: newId,
        title: eventData.title || 'Untitled Event',
        startDate: eventData.startDate || toYMD(currentDate),
        endDate: eventData.endDate || eventData.startDate || toYMD(currentDate),
        startTime: eventData.startTime || '09:00',
        endTime: eventData.endTime || '10:00',
        categoryId: eventData.categoryId || 'work',
        userId: currentUser?.id || effectiveUser.id,
        createdBy: currentUser?.name || effectiveUser.name,
        isAllDay: eventData.isAllDay,
        priority: eventData.priority || 'medium',
        location: eventData.location,
        description: eventData.description,
        notes: eventData.notes,
        recurrence: eventData.recurrence || 'none',
        attendees: eventData.attendees || [currentUser?.name || effectiveUser.name],
        createdAt: nowIso,
        updatedAt: nowIso
      };
      updatedEvents = [...events, savedEvt];
    }

    clearDeletedEventId(savedEvt.id);
    if (savedEvt.externalEventId) {
      clearDeletedEventId(savedEvt.externalEventId);
    }
    setEvents(updatedEvents);
    saveEvents(updatedEvents);

    // Persist directly to cloud server
    const serverResult = await apiSaveEvent(savedEvt);
    if (serverResult) {
      setEvents((prev) => {
        const merged = prev.map((e) => (e.id === savedEvt.id ? serverResult : e));
        saveEvents(merged);
        return merged;
      });
    }
  };

  // Delete Event (Admin or Event Creator)
  const handleDeleteEvent = async (eventId: string) => {
    const userRole = currentUser?.role || effectiveUser.role;
    const targetEvt = events.find((e) => e.id === eventId);
    if (userRole !== 'admin' && targetEvt?.userId !== (currentUser?.id || effectiveUser.id)) return;

    recordDeletedEventId(eventId);
    if (targetEvt?.externalEventId) {
      recordDeletedEventId(targetEvt.externalEventId);
    }
    deleteEventFromStorage(eventId);
    setEvents((prev) => {
      const updated = prev.filter(
        (e) =>
          e.id !== eventId &&
          (!targetEvt?.externalEventId || e.externalEventId !== targetEvt.externalEventId)
      );
      saveEvents(updated);
      return updated;
    });

    // Notify server immediately
    await apiDeleteEvent(eventId, {
      externalEventId: targetEvt?.externalEventId
    }).catch(() => {});
    if (targetEvt?.externalEventId) {
      await apiDeleteEvent(targetEvt.externalEventId).catch(() => {});
    }

    setIsInspectorOpen(false);
    setIsEventModalOpen(false);
  };

  // Duplicate Event
  const handleDuplicateEvent = async (evt: CalendarEvent) => {
    if (currentUser?.role === 'viewer') return;
    const nowIso = new Date().toISOString();
    const duplicated: CalendarEvent = {
      ...evt,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${evt.title} (Copy)`,
      createdBy: currentUser?.name || effectiveUser.name,
      userId: currentUser?.id || effectiveUser.id,
      createdAt: nowIso,
      updatedAt: nowIso,
      source: 'local',
      externalEventId: undefined
    };
    clearDeletedEventId(duplicated.id);
    const updated = [...events, duplicated];
    setEvents(updated);
    saveEvents(updated);
    await apiSaveEvent(duplicated);
    setIsInspectorOpen(false);
  };

  // Settings Save
  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    apiSaveSettings(newSettings);
  };

  const handleAddTema = (newTema: string) => {
    const clean = newTema.trim();
    if (!clean) return;
    const currentTemas = settings.temas || ['Tema 1', 'Tema 2', 'Tema 3'];
    if (!currentTemas.includes(clean)) {
      const updated = [...currentTemas, clean];
      handleSaveSettings({
        ...settings,
        temas: updated
      });
    }
  };

  // Admin Actions (Create user, Toggle user, Delete user)
  const handleCreateUserByAdmin = async (
    newUser: Omit<User, 'id' | 'createdAt'>,
    password: string
  ) => {
    try {
      const created = await apiCreateUser(newUser, password);
      if (created) {
        preserveUserCredential(created, password);
        setUsers((prev) => {
          const updated = [...prev.filter((u) => u.id !== created.id), created];
          saveUsers(updated);
          return updated;
        });
        return;
      }
    } catch (err) {
      console.warn('Could not create on server, creating locally:', err);
    }

    const userObj: User = {
      ...newUser,
      password: password.trim(),
      id: `u_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    preserveUserCredential(userObj, password);
    const updatedUsers = [...users, userObj];
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
  };

  const handleToggleUserActive = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    const updatedUser = { ...target, active: !target.active };
    const updated = users.map((u) => (u.id === userId ? updatedUser : u));
    setUsers(updated);
    saveUsers(updated);
    apiUpdateUser(updatedUser);
  };

  const handleDeleteUser = async (userId: string) => {
    // 1. Permanently remove from client storage vaults and record in deletedUserIds
    deleteUserPermanently(userId);

    // 2. Remove from active React state
    const updated = users.filter((u) => u.id !== userId);
    setUsers(updated);
    saveUsers(updated);

    // 3. Reset active user if they were deleted
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(null);
      saveCurrentUser(null);
    }

    // 4. Send API DELETE call and push sync with deletedUserIds
    try {
      await apiDeleteUser(userId);
      apiPushSyncData({ deletedUserIds: [userId] }).catch(() => {});
    } catch (err) {
      console.warn('Error deleting user on server:', err);
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    preserveUserCredential(updatedUser, updatedUser.password);
    const updated = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    setUsers(updated);
    saveUsers(updated);
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      saveCurrentUser(updatedUser);
    }
    apiUpdateUser(updatedUser);
  };

  const handleImportEvents = (newEvents: CalendarEvent[]) => {
    // 1. Collect all unique category IDs from imported events
    const importedCatIds = Array.from(
      new Set(newEvents.map((e) => e.categoryId).filter(Boolean) as string[])
    );

    // 2. Ensure all imported categories exist
    const currentCatIds = new Set(categories.map((c) => c.id));
    const missingCats: Category[] = [];
    importedCatIds.forEach((catId, index) => {
      if (!currentCatIds.has(catId)) {
        const preset = CATEGORY_COLOR_PRESETS[index % CATEGORY_COLOR_PRESETS.length];
        const formattedName = catId.charAt(0).toUpperCase() + catId.slice(1).replace(/-/g, ' ');
        missingCats.push(createCategory(formattedName, preset.key, catId));
      }
    });

    let updatedCategories = categories;
    if (missingCats.length > 0) {
      updatedCategories = [...categories, ...missingCats];
      setCategories(updatedCategories);
      saveCategories(updatedCategories);
      apiBulkSaveCategories(missingCats);
    }

    // 3. Ensure all imported categories are selected in active filters so events appear immediately
    setSelectedCategoryIds((prev) => {
      const next = new Set([...prev, ...importedCatIds]);
      return Array.from(next);
    });

    // 4. Exclude deleted events
    const deletedEventIds = loadDeletedEventIds();
    const activeIncoming = newEvents.filter((e) => {
      if (!e || !e.id) return false;
      if (deletedEventIds.has(e.id)) return false;
      if (e.externalEventId && deletedEventIds.has(e.externalEventId)) return false;
      return true;
    });

    // 5. Match incoming events against existing events to update in place and preserve admin customizations
    const existingById = new Map<string, CalendarEvent>();
    const existingByExt = new Map<string, CalendarEvent>();
    const existingByContent = new Map<string, CalendarEvent>();

    events.forEach((ex) => {
      existingById.set(ex.id, ex);
      if (ex.externalEventId) {
        existingByExt.set(`${ex.externalEventId}_${ex.startDate}_${ex.startTime || ''}`, ex);
        existingByExt.set(`${ex.externalEventId}_${ex.startDate}`, ex);
      }
      if (
        ex.sourceAccountId === 'outlook-ics' ||
        ex.source === 'external' ||
        ex.id.startsWith('ext-ics-') ||
        Boolean(ex.externalEventId)
      ) {
        const norm = normalizeEventTitle(ex.title);
        existingByContent.set(`${norm}_${ex.startDate}_${ex.startTime || ''}`, ex);
        existingByContent.set(`${norm}_${ex.startDate}`, ex);
      }
    });

    const handledExistingIds = new Set<string>();
    const mergedList: CalendarEvent[] = [];

    activeIncoming.forEach((incoming) => {
      // Find matching existing event
      let match = existingById.get(incoming.id);
      if (!match && incoming.externalEventId) {
        match =
          existingByExt.get(`${incoming.externalEventId}_${incoming.startDate}_${incoming.startTime || ''}`) ||
          existingByExt.get(`${incoming.externalEventId}_${incoming.startDate}`);
      }
      if (!match) {
        const norm = normalizeEventTitle(incoming.title);
        match =
          existingByContent.get(`${norm}_${incoming.startDate}_${incoming.startTime || ''}`) ||
          existingByContent.get(`${norm}_${incoming.startDate}`);
      }

      if (match) {
        handledExistingIds.add(match.id);
        // Event exists: keep it strictly in place, preserving any admin customizations
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
            description: match.description,
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
            source: 'external',
            sourceAccountId: 'outlook-ics'
          });
        }
      } else {
        // Genuinely new event from Outlook
        mergedList.push(incoming);
      }
    });

    // Retain all existing events that were not matched (e.g. manual events, other calendar events)
    events.forEach((ex) => {
      if (!handledExistingIds.has(ex.id)) {
        mergedList.push(ex);
      }
    });

    const updated = deduplicateCalendarEvents(mergedList);
    setEvents(updated);
    saveEvents(updated);
    apiBulkSaveEvents(updated);
  };

  // One-click & Automated Outlook Shared Calendar synchronization
  const handleTriggerOutlookSync = useCallback(async () => {
    const outlookUrl = settings.sync?.outlookIcsUrl;
    if (!outlookUrl) return { success: false, error: 'No Outlook calendar link configured.' };

    setIsOutlookSyncing(true);
    try {
      // 1. Try server-side synchronization first
      const serverResult = await apiSyncOutlook({
        url: outlookUrl,
        categoryId: settings.sync?.outlookDefaultCategoryId,
        calendarName: settings.sync?.outlookCalendarName
      });

      if (serverResult.success && Array.isArray(serverResult.events)) {
        const deduplicated = deduplicateCalendarEvents(serverResult.events);
        setEvents(deduplicated);
        saveEvents(deduplicated);
        const nowIso = serverResult.lastSyncedAt || new Date().toISOString();
        setSettings((prev) => {
          const updated = {
            ...prev,
            sync: {
              ...prev.sync,
              outlookLastSyncedAt: nowIso,
              outlookSyncedCount: serverResult.count ?? deduplicated.length
            }
          };
          saveSettings(updated);
          return updated;
        });
        return { success: true, count: serverResult.count };
      }

      // 2. Client-side fallback if server-side is not available
      const icsText = await fetchIcsFeed(outlookUrl);
      if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) {
        throw new Error('Received invalid calendar feed.');
      }
      const targetUser = currentUser || effectiveUser || {
        id: 'admin-1',
        username: 'admin',
        name: 'Admin',
        email: '',
        role: 'admin',
        avatarColor: 'bg-indigo-600',
        createdAt: '',
        active: true
      };
      const parsed = parseIcsContent(icsText, targetUser);
      const targetCatId = settings.sync?.outlookDefaultCategoryId || (categories[0]?.id || 'work');
      const customized: CalendarEvent[] = parsed.map((e) => {
        const existing = events.find(
          (ex) =>
            ex.id === e.id ||
            (ex.externalEventId && ex.externalEventId === e.externalEventId && ex.startDate === e.startDate) ||
            ((ex.sourceAccountId === 'outlook-ics' || ex.source === 'external') &&
              ex.startDate === e.startDate &&
              normalizeEventTitle(ex.title) === normalizeEventTitle(e.title))
        );
        if (existing && existing.customizedByAdmin) {
          return {
            ...e,
            id: existing.id,
            categoryId: existing.categoryId,
            tags: existing.tags,
            temas: existing.temas,
            tema: existing.tema,
            title: existing.title,
            priority: existing.priority,
            location: existing.location,
            description: existing.description,
            notes: existing.notes,
            customizedByAdmin: true,
            adminEditedAt: existing.adminEditedAt,
            adminEditedBy: existing.adminEditedBy,
            source: 'external',
            sourceAccountId: 'outlook-ics'
          };
        }
        return {
          ...e,
          id: existing ? existing.id : e.id,
          categoryId: existing ? existing.categoryId : targetCatId,
          source: 'external',
          sourceAccountId: 'outlook-ics',
          notes: `Imported via Outlook Shared Calendar (${settings.sync?.outlookCalendarName || 'Outlook'})`
        };
      });

      handleImportEvents(customized);
      const nowIso = new Date().toISOString();
      setSettings((prev) => {
        const updated = {
          ...prev,
          sync: {
            ...prev.sync,
            outlookLastSyncedAt: nowIso,
            outlookSyncedCount: customized.length
          }
        };
        saveSettings(updated);
        apiSaveSettings(updated).catch(() => {});
        return updated;
      });
      return { success: true, count: customized.length };
    } catch (err: any) {
      console.warn('Outlook sync error:', err);
      return { success: false, error: err?.message || 'Sync failed' };
    } finally {
      setIsOutlookSyncing(false);
    }
  }, [
    settings.sync?.outlookIcsUrl,
    settings.sync?.outlookDefaultCategoryId,
    settings.sync?.outlookCalendarName,
    currentUser,
    effectiveUser,
    categories,
    events,
    handleImportEvents
  ]);

  // Automated background synchronization: on app launch, every 5 minutes, and on tab focus
  useEffect(() => {
    const outlookUrl = settings.sync?.outlookIcsUrl;
    const shouldAutoSync = settings.sync?.outlookAutoSync !== false;
    if (!outlookUrl || !shouldAutoSync) return;

    // Initial sync shortly after load
    const initTimer = setTimeout(() => {
      handleTriggerOutlookSync();
    }, 1500);

    // Periodic sync every 5 minutes
    const intervalTimer = setInterval(() => {
      handleTriggerOutlookSync();
    }, 5 * 60 * 1000);

    // Sync on tab visibility return if older than 3 minutes
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const lastSync = settings.sync?.outlookLastSyncedAt;
        if (!lastSync || Date.now() - new Date(lastSync).getTime() > 3 * 60 * 1000) {
          handleTriggerOutlookSync();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(initTimer);
      clearInterval(intervalTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    settings.sync?.outlookIcsUrl,
    settings.sync?.outlookAutoSync,
    settings.sync?.outlookLastSyncedAt,
    handleTriggerOutlookSync
  ]);

  // Category Tag Actions
  const handleSaveCategory = async (category: Category) => {
    clearDeletedCategoryId(category.id);
    const updatedDeleted = Array.from(loadDeletedCategoryIds()).filter((id) => id !== category.id);

    let nextCategories: Category[] = [];
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === category.id);
      let updated: Category[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = category;
      } else {
        updated = [...prev, category];
      }
      saveCategories(updated);
      nextCategories = updated;
      return updated;
    });

    // Make sure it's active in selected filter
    setSelectedCategoryIds((prev) => {
      if (!prev.includes(category.id)) {
        return [...prev, category.id];
      }
      return prev;
    });

    try {
      await apiSaveCategory(category);
      if (nextCategories.length > 0) {
        await apiBulkSaveCategories(nextCategories);
        await apiPushSyncData({
          categories: nextCategories,
          deletedCategoryIds: updatedDeleted
        });
      }
    } catch (e) {
      console.warn('Error saving category to server:', e);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    deleteCategoryFromStorage(categoryId);

    const remainingCats = categories.filter((c) => c.id !== categoryId);
    const fallbackCatId = remainingCats.length > 0 ? remainingCats[0].id : 'work';

    setEvents((prev) => {
      const updatedEvents = prev.map((evt) => {
        if (evt.categoryId === categoryId) {
          return { ...evt, categoryId: fallbackCatId };
        }
        return evt;
      });
      saveEvents(updatedEvents);
      apiBulkSaveEvents(updatedEvents).catch(console.error);
      return updatedEvents;
    });

    setCategories(remainingCats);
    saveCategories(remainingCats);

    setSelectedCategoryIds((prev) => prev.filter((id) => id !== categoryId));

    try {
      await apiDeleteCategory(categoryId);
      await apiBulkSaveCategories(remainingCats);
      await apiPushSyncData({
        categories: remainingCats,
        deletedCategoryIds: Array.from(loadDeletedCategoryIds())
      });
    } catch (err) {
      console.warn('Server delete category sync error:', err);
    }
  };

  const handleResetCategories = async () => {
    resetCategoriesStorage();
    setCategories(DEFAULT_CATEGORIES);
    setSelectedCategoryIds(DEFAULT_CATEGORIES.map((c) => c.id));
    await apiBulkSaveCategories(DEFAULT_CATEGORIES);
    await apiPushSyncData({
      categories: DEFAULT_CATEGORIES,
      deletedCategoryIds: []
    });
  };

  // User Switch & Sign Out
  const handleRegisterUser = async (
    username: string,
    name: string,
    password: string,
    email?: string,
    role: Role = 'admin'
  ): Promise<User> => {
    const cleanUsername = username.trim().toLowerCase().replace(/^@+/, '');
    const cleanEmail = (email?.trim() || `${cleanUsername}@executivetech.com`).toLowerCase();
    const avatarColor = role === 'admin' ? 'bg-indigo-600' : 'bg-emerald-600';

    try {
      const created = await apiCreateUser(
        {
          username: cleanUsername,
          name: name.trim() || cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
          email: cleanEmail,
          role: role,
          avatarColor: avatarColor,
          active: true
        },
        password.trim()
      );
      if (created) {
        preserveUserCredential(created, password.trim());
        setUsers((prev) => {
          const updated = [...prev.filter((u) => u.id !== created.id && u.username !== created.username), created];
          saveUsers(updated);
          return updated;
        });
        setCurrentUser(created);
        saveCurrentUser(created);
        return created;
      }
    } catch (err) {
      console.warn('Registration server call failed, creating locally:', err);
    }

    const existing = users.find((u) => u.username?.trim().toLowerCase() === cleanUsername);
    if (existing) {
      preserveUserCredential(existing, password.trim());
      setCurrentUser(existing);
      saveCurrentUser(existing);
      return existing;
    }

    const newUser: User = {
      id: `u_${Date.now()}`,
      username: cleanUsername,
      password: password.trim(),
      name: name.trim() || cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
      email: cleanEmail,
      role: role,
      avatarColor: avatarColor,
      active: true,
      createdAt: new Date().toISOString()
    };

    preserveUserCredential(newUser, password.trim());
    const updatedUsers = [...users.filter((u) => u.id !== newUser.id), newUser];
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    setCurrentUser(newUser);
    saveCurrentUser(newUser);
    return newUser;
  };

  const handleSwitchUser = async (user: User) => {
    setCurrentUser(user);
    saveCurrentUser(user);
    await syncWithServer();
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    saveCurrentUser(null);
    setIsAuthOpen(false);
    setIsAdminOpen(false);
    setIsSettingsOpen(false);
    setIsInspectorOpen(false);
    setIsEventModalOpen(false);
    setActiveSharedCalendar(null);
  };

  // Shared Calendar Handlers
  const handleCreateShare = async (shareData: Partial<SharedCalendar>): Promise<SharedCalendar> => {
    const cleanCode = (shareData.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || `CAL-${Math.floor(1000 + Math.random() * 9000)}`;
    const newShare: SharedCalendar = {
      id: `share_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: cleanCode,
      title: (shareData.title || '').trim() || 'Shared Executive Calendar',
      description: shareData.description || '',
      targetGroup: shareData.targetGroup || 'General Group',
      createdByUserId: currentUser?.id || 'admin',
      createdByName: currentUser?.name || 'Administrator',
      filterCategories: shareData.filterCategories || [],
      filterTema: shareData.filterTema || 'all',
      isActive: shareData.isActive !== false,
      allowGuestsToExport: shareData.allowGuestsToExport !== false,
      createdAt: new Date().toISOString(),
      expiresAt: shareData.expiresAt,
      viewCount: 0
    };

    try {
      const serverCreated = await apiCreateShare(newShare);
      if (serverCreated) {
        setShares((prev) => {
          const updated = [...prev.filter((s) => s.id !== serverCreated.id), serverCreated];
          saveSharedCalendars(updated);
          return updated;
        });
        return serverCreated;
      }
    } catch (e) {
      console.warn('Server create share failed, saving locally:', e);
    }

    setShares((prev) => {
      const updated = [...prev.filter((s) => s.id !== newShare.id), newShare];
      saveSharedCalendars(updated);
      return updated;
    });
    return newShare;
  };

  const handleUpdateShare = async (id: string, updates: Partial<SharedCalendar>) => {
    setShares((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
      saveSharedCalendars(updated);
      return updated;
    });
    try {
      await apiUpdateShare(id, updates);
    } catch (e) {
      console.warn('Server update share error:', e);
    }
  };

  const handleDeleteShare = async (id: string) => {
    setShares((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSharedCalendars(updated);
      return updated;
    });
    try {
      await apiDeleteShare(id);
    } catch (e) {
      console.warn('Server delete share error:', e);
    }
  };

  const handleAccessShareCode = async (code: string): Promise<boolean> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return false;

    // 1. Try server verification first
    try {
      const serverRes = await apiVerifyShare(cleanCode);
      if (serverRes && serverRes.share) {
        setActiveSharedCalendar(serverRes.share);
        if (Array.isArray(serverRes.events) && serverRes.events.length > 0) {
          setEvents(serverRes.events);
          saveEvents(serverRes.events);
        }
        if (Array.isArray(serverRes.categories) && serverRes.categories.length > 0) {
          setCategories(serverRes.categories);
          saveCategories(serverRes.categories);
        }
        return true;
      }
    } catch (e) {
      console.warn('Server share verification failed, checking local:', e);
    }

    // 2. Fallback to local storage share match
    const localMatch = getShareByCodeLocal(cleanCode);
    if (localMatch && localMatch.isActive) {
      setActiveSharedCalendar(localMatch);
      // Increment view count
      handleUpdateShare(localMatch.id, { viewCount: (localMatch.viewCount || 0) + 1 });
      return true;
    }

    return false;
  };

  const handleExitSharedCalendar = () => {
    setActiveSharedCalendar(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('share');
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  };

  // Compute Filtered Events for Active Share Mode
  const displayEvents = activeSharedCalendar
    ? events.filter((e) => {
        // Filter by shared categories if specified
        if (activeSharedCalendar.filterCategories && activeSharedCalendar.filterCategories.length > 0) {
          if (!activeSharedCalendar.filterCategories.includes(e.categoryId)) {
            return false;
          }
        }
        // Filter by shared Tema if specified
        if (activeSharedCalendar.filterTema && activeSharedCalendar.filterTema !== 'all') {
          const eventTemas = Array.isArray(e.temas) && e.temas.length > 0 ? e.temas : (e.tema ? [e.tema] : []);
          if (!eventTemas.includes(activeSharedCalendar.filterTema)) {
            return false;
          }
        }
        return true;
      })
    : events;

  const handleExportSharedIcs = () => {
    const title = activeSharedCalendar?.title || 'Executive Shared Calendar';
    const icsContent = exportEventsToIcs(displayEvents, title);
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.ics`;
    downloadIcsFile(icsContent, filename);
  };

  const handlePrintSharedCalendar = () => {
    window.print();
  };

  const handleOpenCategoryPdf = (categoryId: string) => {
    setPdfCategoryViewId(categoryId);
  };

  const handleCloseCategoryPdf = () => {
    setPdfCategoryViewId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('category');
      url.searchParams.delete('cat');
      url.searchParams.delete('view');
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  };

  // If viewing a public announcement flyer directly (e.g. from QR code scan or /anuncio)
  if (isPublicAnnouncement) {
    return (
      <PublicAnnouncementPage
        announcementId={publicAnnouncementId}
        onOpenCalendar={() => {
          setIsPublicAnnouncement(false);
          try {
            window.history.pushState({}, '', '/');
          } catch (e) {}
        }}
        onOpenLogin={() => {
          setIsPublicAnnouncement(false);
          setIsAuthOpen(true);
        }}
      />
    );
  }

  // If viewing a Category PDF document (e.g. opened via QR code scan or link)
  if (pdfCategoryViewId) {
    const isAll =
      pdfCategoryViewId.toLowerCase() === 'all' || pdfCategoryViewId.toLowerCase() === 'overview';

    const activePdfCat: Category = isAll
      ? {
          id: 'all',
          name: 'All Categories Overview',
          hex: '#4f46e5',
          color: 'indigo',
          bgClass: 'bg-indigo-50 dark:bg-indigo-950/40',
          borderClass: 'border-indigo-200 dark:border-indigo-800',
          textClass: 'text-indigo-700 dark:text-indigo-300',
          badgeClass: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200',
          dotClass: 'bg-indigo-500',
          description: 'Master consolidated calendar combining all categories'
        }
      : categories.find(
          (c) =>
            c.id.toLowerCase() === pdfCategoryViewId.toLowerCase() ||
            c.name.toLowerCase() === pdfCategoryViewId.toLowerCase()
        ) || categories[0];

    if (activePdfCat) {
      let catEvents = isAll ? events : events.filter((e) => e.categoryId === activePdfCat.id);
      if (catEvents.length === 0 && events.length > 0 && (categories.length <= 1 || activePdfCat.id === 'new')) {
        catEvents = events;
      }
      return (
        <CategoryPdfDocumentView
          category={activePdfCat}
          allCategories={categories}
          events={catEvents}
          settings={settings}
          onSelectCategory={(id) => setPdfCategoryViewId(id)}
          onBackToApp={handleCloseCategoryPdf}
          onOpenCalendarView={handleCloseCategoryPdf}
          isGuest={!currentUser}
        />
      );
    }
  }

  // If user is not logged in AND not viewing a shared calendar, show login page
  if (!currentUser && !activeSharedCalendar) {
    return (
      <LoginPage
        users={users}
        shares={shares}
        categories={categories}
        onLogin={(loggedUser) => {
          handleSwitchUser(loggedUser);
        }}
        onRegisterUser={handleRegisterUser}
        onAccessShareCode={handleAccessShareCode}
        onOpenCategoryPdf={handleOpenCategoryPdf}
        onEventsSynced={(newEvents) => {
          setEvents((prev) => {
            const merged = [...prev, ...newEvents];
            saveEvents(merged);
            return merged;
          });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* Shared Calendar Guest Mode Banner */}
      {activeSharedCalendar && (
        <SharedCalendarGuestBanner
          share={activeSharedCalendar}
          onExitSharedView={handleExitSharedCalendar}
          onOpenLogin={() => {
            setActiveSharedCalendar(null);
            setCurrentUser(null);
          }}
          isAuthenticated={Boolean(currentUser)}
          onExportIcs={activeSharedCalendar.allowGuestsToExport !== false ? handleExportSharedIcs : undefined}
          onPrint={handlePrintSharedCalendar}
        />
      )}

      {/* Top Header Bar */}
      <Header
        currentDate={currentDate}
        view={view}
        onViewChange={setView}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onNewEvent={effectiveUser.role !== 'viewer' ? handleOpenNewEvent : () => {}}
        currentUser={effectiveUser}
        onOpenSettings={() => {
          setSettingsTab('account');
          setIsSettingsOpen(true);
          syncWithServer();
        }}
        onOpenAdmin={() => {
          setAdminTab('users');
          setIsAdminOpen(true);
          syncWithServer();
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        onSignOut={currentUser ? handleSignOut : undefined}
        onOpenShare={() => setIsShareModalOpen(true)}
        onOpenCategoryQr={(catId) => {
          setCategoryQrInitialId(catId);
          setIsCategoryQrModalOpen(true);
        }}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        onToggleCategory={handleToggleCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        settings={settings}
        onToggleTheme={handleToggleTheme}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        events={displayEvents}
        onSelectEvent={handleSelectEvent}
        isOutlookSyncing={isOutlookSyncing}
        onSyncOutlook={handleTriggerOutlookSync}
        isCloudSyncing={isCloudSyncing}
        onSyncCloud={() => syncWithServer()}
        lastCloudSyncedAt={lastCloudSyncedAt}
      />

      {/* Main Content Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar */}
        {isSidebarOpen && (
          <Sidebar
            currentDate={currentDate}
            onSelectDate={handleSelectDate}
            categories={categories}
            selectedCategoryIds={selectedCategoryIds}
            onToggleCategory={handleToggleCategory}
            events={displayEvents}
            onSelectEvent={handleSelectEvent}
            onViewChange={setView}
            onNewEvent={effectiveUser.role !== 'viewer' ? handleOpenNewEvent : () => {}}
            currentUser={effectiveUser}
            onOpenAdmin={() => {
              setAdminTab('users');
              setIsAdminOpen(true);
            }}
            onOpenCategoryQr={(catId) => {
              setCategoryQrInitialId(catId);
              setIsCategoryQrModalOpen(true);
            }}
          />
        )}

        {/* View Canvas Area */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative pb-16">
          
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={displayEvents}
              selectedCategoryIds={selectedCategoryIds}
              searchQuery={searchQuery}
              onSelectDate={handleSelectDate}
              onSelectEvent={handleSelectEvent}
              onCreateEventForDate={handleCreateEventForDate}
              onDeleteEvent={currentUser?.role === 'admin' ? handleDeleteEvent : undefined}
              settings={settings}
              categories={categories}
            />
          )}

          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={displayEvents}
              selectedCategoryIds={selectedCategoryIds}
              searchQuery={searchQuery}
              onSelectEvent={handleSelectEvent}
              onCreateEventForDateTime={handleCreateEventForDateTime}
              onDeleteEvent={currentUser?.role === 'admin' ? handleDeleteEvent : undefined}
              settings={settings}
              categories={categories}
            />
          )}

          {view === 'sunday' && (
            <SundayView
              currentDate={currentDate}
              events={displayEvents}
              selectedCategoryIds={selectedCategoryIds}
              searchQuery={searchQuery}
              onSelectEvent={handleSelectEvent}
              onCreateEventForDate={handleCreateEventForDate}
              onDeleteEvent={currentUser?.role === 'admin' ? handleDeleteEvent : undefined}
              onSelectDate={setCurrentDate}
              onClose={() => setView('month')}
              onViewChange={setView}
              categories={categories}
            />
          )}

          {view === 'year' && (
            <YearView
              currentDate={currentDate}
              events={displayEvents}
              selectedCategoryIds={selectedCategoryIds}
              onSelectDate={handleSelectDate}
              onYearChange={(y) => {
                const newD = new Date(currentDate);
                newD.setFullYear(y);
                setCurrentDate(newD);
              }}
              settings={settings}
              categories={categories}
            />
          )}

          {view === 'anuncios' && (
            <AnunciosView
              events={displayEvents}
              currentUser={currentUser}
              onBackToCalendar={() => setView('month')}
            />
          )}

        </main>

      </div>

      {/* Large Event Preview Inspector Window */}
      <EventInspectorWindow
        event={inspectingEvent}
        selectedDateEvents={inspectingDateEvents}
        selectedDate={inspectingDate}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        onEdit={effectiveUser.role !== 'viewer' ? handleEditEvent : () => {}}
        onDelete={currentUser?.role === 'admin' ? handleDeleteEvent : undefined}
        onDuplicate={effectiveUser.role !== 'viewer' ? handleDuplicateEvent : undefined}
        onUpdateEvent={effectiveUser.role === 'admin' ? handleSaveEvent : undefined}
        currentUser={effectiveUser}
        users={users}
        categories={categories}
        onSaveCategory={handleSaveCategory}
      />

      {/* Event Creation & Edit Modal */}
      {currentUser && (
        <EventModal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          initialEvent={editingEvent}
          initialDateYmd={modalDateYmd}
          initialTime24={modalTime24}
          categories={categories}
          users={users}
          currentUser={currentUser}
          temas={settings.temas || ['Tema 1', 'Tema 2', 'Tema 3']}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onAddTema={handleAddTema}
          onOpenAdminCategories={() => {
            setSettingsTab('categories');
            setIsSettingsOpen(true);
          }}
          onOpenTemasSettings={() => {
            setSettingsTab('temas');
            setIsSettingsOpen(true);
          }}
        />
      )}

      {/* User Preferences & Settings Modal */}
      {(currentUser || effectiveUser) && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          events={events}
          categories={categories}
          selectedCategoryIds={selectedCategoryIds}
          onToggleCategory={handleToggleCategory}
          onSaveCategory={handleSaveCategory}
          onDeleteCategory={handleDeleteCategory}
          onResetCategories={handleResetCategories}
          initialTab={settingsTab}
          onOpenAdmin={() => {
            setIsSettingsOpen(false);
            setAdminTab('users');
            setIsAdminOpen(true);
          }}
          currentUser={currentUser || effectiveUser}
          users={users}
          onSignOut={handleSignOut}
          onImportEvents={handleImportEvents}
          onOpenShare={() => setIsShareModalOpen(true)}
          onOpenCategoryQr={() => setIsCategoryQrModalOpen(true)}
          onOpenAuth={() => {
            setIsSettingsOpen(false);
            setIsAuthOpen(true);
          }}
          onUpdateUser={handleUpdateUser}
          onSaveEvent={handleSaveEvent}
          onDeleteEvent={handleDeleteEvent}
        />
      )}

      {/* Admin Management Panel */}
      {(currentUser || effectiveUser) && (
        <AdminPanelModal
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          users={users}
          onCreateUser={handleCreateUserByAdmin}
          onToggleUserActive={handleToggleUserActive}
          onDeleteUser={handleDeleteUser}
          currentUser={currentUser || effectiveUser}
          onImportEvents={handleImportEvents}
          onUpdateUser={handleUpdateUser}
          categories={categories}
          events={events}
          onSaveCategory={handleSaveCategory}
          onDeleteCategory={handleDeleteCategory}
          onResetCategories={handleResetCategories}
          initialTab={adminTab}
          onOpenSettings={(tab) => {
            setSettingsTab(tab || 'categories');
            setIsSettingsOpen(true);
          }}
        />
      )}

      {/* Authentication & User Switcher Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        users={users}
        currentUser={currentUser || effectiveUser}
        onSwitchUser={handleSwitchUser}
        onOpenAdmin={() => {
          setIsAuthOpen(false);
          setAdminTab('users');
          setIsAdminOpen(true);
        }}
      />

      {/* Share Calendar & Access Codes Management Modal */}
      <ShareCalendarModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shares={shares}
        categories={categories}
        settings={settings}
        currentUser={currentUser || effectiveUser}
        events={events}
        onCreateShare={handleCreateShare}
        onUpdateShare={handleUpdateShare}
        onDeleteShare={handleDeleteShare}
        onAccessShareCode={async (code: string) => {
          const ok = await handleAccessShareCode(code);
          return { success: ok, error: ok ? undefined : 'Invalid or inactive share code' };
        }}
      />

      {/* Category QR Codes & Public PDF Schedule Hub Modal */}
      <CategoryQrModal
        isOpen={isCategoryQrModalOpen}
        onClose={() => setIsCategoryQrModalOpen(false)}
        categories={categories}
        events={events}
        currentUser={currentUser}
        initialCategoryId={categoryQrInitialId}
        onOpenCategoryPdfView={(catId) => {
          setCategoryQrInitialId(catId);
          setPdfCategoryViewId(catId);
        }}
      />

    </div>
  );
}

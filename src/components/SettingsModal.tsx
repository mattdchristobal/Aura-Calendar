import React, { useState, useRef, useEffect } from 'react';
import { UserSettings, CalendarEvent, Category, User } from '../types';
import { exportToICal } from '../utils/dateUtils';
import { CATEGORY_COLOR_PRESETS, createCategory, DEFAULT_CATEGORIES } from '../utils/categories';
import { fetchIcsFeed, parseIcsContent, normalizeIcsUrl } from '../utils/icsParser';
import { apiSyncOutlook, apiSaveOutlookConfig, apiUnlinkOutlook } from '../utils/api';
import { saveOutlookSyncConfig, clearOutlookSyncConfig } from '../utils/storage';
import { setCustomPublicBaseUrl } from '../utils/qrUtils';
import {
  X,
  Bell,
  RefreshCw,
  Palette,
  Check,
  Download,
  Upload,
  Sun,
  Moon,
  Monitor,
  Volume2,
  Mail,
  Smartphone,
  Sparkles,
  Tag,
  ShieldCheck,
  Users,
  Calendar as CalendarIcon,
  Layers,
  Plus,
  Trash2,
  Edit2,
  Edit3,
  Save,
  RotateCcw,
  Lock,
  ChevronDown,
  ChevronUp,
  Share2,
  QrCode,
  User as UserIcon,
  Key,
  LogOut,
  Sliders,
  CheckCircle2,
  ExternalLink,
  PlusCircle,
  AlertCircle,
  Link,
  Copy,
  Globe,
  HelpCircle,
  Info,
  ChevronRight,
  Cloud
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings) => void;
  events: CalendarEvent[];
  categories?: Category[];
  selectedCategoryIds?: string[];
  onToggleCategory?: (id: string) => void;
  onSaveCategory?: (category: Category) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onResetCategories?: () => void;
  onOpenAdmin?: () => void;
  currentUser?: User;
  users?: User[];
  onSignOut?: () => void;
  onImportEvents?: (events: CalendarEvent[]) => void;
  onOpenShare?: () => void;
  onOpenCategoryQr?: () => void;
  onOpenAuth?: () => void;
  onUpdateUser?: (user: User) => void;
  onSaveEvent?: (event: Partial<CalendarEvent>) => void;
  onDeleteEvent?: (eventId: string) => void;
  initialTab?: 'account' | 'notifications' | 'sync' | 'theme' | 'categories' | 'temas' | 'admin' | 'calendar-accounts';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  events,
  categories = DEFAULT_CATEGORIES,
  selectedCategoryIds,
  onToggleCategory,
  onSaveCategory,
  onDeleteCategory,
  onResetCategories,
  onOpenAdmin,
  currentUser,
  users = [],
  onSignOut,
  onImportEvents,
  onOpenShare,
  onOpenCategoryQr,
  onOpenAuth,
  onUpdateUser,
  onSaveEvent,
  onDeleteEvent,
  initialTab = 'account'
}) => {
  const resolvedInitialTab = (initialTab === 'admin' || (initialTab as string) === 'calendar-accounts' ? 'account' : initialTab) || 'account';
  const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'sync' | 'theme' | 'categories' | 'temas' | 'admin'>(resolvedInitialTab as any);
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
  const tabDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab === 'admin' ? 'account' : initialTab);
    }
  }, [isOpen, initialTab]);

  const [localSettings, setLocalSettings] = useState<UserSettings>({ ...settings });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  // Outlook Shared Calendar Integration State
  const [outlookIcsInput, setOutlookIcsInput] = useState<string>(
    settings.sync?.outlookIcsUrl || ''
  );
  const [outlookCalendarName, setOutlookCalendarName] = useState<string>(
    settings.sync?.outlookCalendarName || 'Outlook Shared Calendar'
  );
  const [outlookCategoryId, setOutlookCategoryId] = useState<string>(
    settings.sync?.outlookDefaultCategoryId || (categories[0]?.id || 'work')
  );
  const [outlookAutoSync, setOutlookAutoSync] = useState<boolean>(
    settings.sync?.outlookAutoSync ?? true
  );
  const [isOutlookSyncing, setIsOutlookSyncing] = useState<boolean>(false);
  const [outlookSyncStatus, setOutlookSyncStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
    count?: number;
  }>({
    type: settings.sync?.outlookLastSyncedAt ? 'success' : 'idle',
    message: settings.sync?.outlookLastSyncedAt
      ? `Last synced: ${new Date(settings.sync.outlookLastSyncedAt).toLocaleDateString()} at ${new Date(settings.sync.outlookLastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '',
    count: settings.sync?.outlookSyncedCount
  });
  const [showOutlookGuide, setShowOutlookGuide] = useState(false);
  const [copiedFeedLink, setCopiedFeedLink] = useState(false);
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings({ ...settings });
      setOutlookIcsInput(settings.sync?.outlookIcsUrl || '');
      setOutlookCalendarName(settings.sync?.outlookCalendarName || 'Outlook Shared Calendar');
      setOutlookCategoryId(settings.sync?.outlookDefaultCategoryId || (categories[0]?.id || 'work'));
      setOutlookAutoSync(settings.sync?.outlookAutoSync ?? true);
      setIsConfirmingDisconnect(false);
      if (settings.sync?.outlookLastSyncedAt) {
        setOutlookSyncStatus({
          type: 'success',
          message: `Last synced: ${new Date(settings.sync.outlookLastSyncedAt).toLocaleDateString()} at ${new Date(settings.sync.outlookLastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          count: settings.sync?.outlookSyncedCount
        });
      }
    }
  }, [isOpen, settings, categories]);

  // Category Tag Management State
  const [newCatName, setNewCatName] = useState('');
  const [newCatColorKey, setNewCatColorKey] = useState('indigo');
  const [newCatCustomHex, setNewCatCustomHex] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColorKey, setEditCatColorKey] = useState('blue');
  const [editCatCustomHex, setEditCatCustomHex] = useState('');
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [categorySuccessToast, setCategorySuccessToast] = useState('');
  const [categoryErrorMsg, setCategoryErrorMsg] = useState('');

  // Administrators can manage categories and tags (members and viewers have read-only visibility access)
  const canEditCategories = !currentUser || currentUser.role === 'admin';

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryErrorMsg('');
    if (!canEditCategories) {
      setCategoryErrorMsg('Only administrators can create category tags.');
      return;
    }
    if (!newCatName.trim()) {
      setCategoryErrorMsg('Please enter a category tag name.');
      return;
    }

    const trimmed = newCatName.trim();
    if ((categories || []).some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryErrorMsg(`A category tag named "${trimmed}" already exists.`);
      return;
    }

    const cat = createCategory(trimmed, newCatColorKey, undefined, newCatCustomHex || undefined);
    if (onSaveCategory) {
      onSaveCategory(cat);
      setCategorySuccessToast(`Created category tag "${cat.name}" successfully!`);
      setNewCatName('');
      setNewCatCustomHex('');
    }
  };

  const handleStartEditCategory = (cat: Category) => {
    if (!canEditCategories) return;
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatColorKey(cat.color || 'blue');
    setEditCatCustomHex(cat.hex || '');
    setCategoryErrorMsg('');
  };

  const handleSaveEditCategory = () => {
    if (!canEditCategories) return;
    if (!editingCatId) return;
    setCategoryErrorMsg('');
    if (!editCatName.trim()) {
      setCategoryErrorMsg('Category name cannot be empty.');
      return;
    }

    const updated = createCategory(editCatName.trim(), editCatColorKey, editingCatId, editCatCustomHex || undefined);
    if (onSaveCategory) {
      onSaveCategory(updated);
      setCategorySuccessToast(`Updated category tag "${updated.name}" successfully!`);
      setEditingCatId(null);
    }
  };

  const handleConfirmDeleteCategory = () => {
    if (!canEditCategories) return;
    if (!deletingCatId) return;
    const catToDelete = (categories || []).find((c) => c.id === deletingCatId);
    if (!catToDelete) return;

    if ((categories || []).length <= 1) {
      setCategoryErrorMsg('You must have at least one active category tag.');
      return;
    }

    if (onDeleteCategory) {
      onDeleteCategory(deletingCatId);
      setCategorySuccessToast(`Deleted category tag "${catToDelete.name}".`);
      setDeletingCatId(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tabDropdownRef.current && !tabDropdownRef.current.contains(event.target as Node)) {
        setIsTabDropdownOpen(false);
      }
    };
    if (isTabDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTabDropdownOpen]);

  // Temas management state
  const [newTemaInput, setNewTemaInput] = useState('');
  const [editingTemaIndex, setEditingTemaIndex] = useState<number | null>(null);
  const [editingTemaText, setEditingTemaText] = useState('');
  const [temaFeedback, setTemaFeedback] = useState('');

  const currentTemas = Array.isArray(localSettings.temas) && localSettings.temas.length > 0
    ? localSettings.temas
    : ['Tema 1', 'Tema 2', 'Tema 3'];

  const isAdmin = currentUser?.role === 'admin';

  const handleAddTema = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;
    const trimmed = newTemaInput.trim();
    if (!trimmed) return;
    if (currentTemas.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTemaFeedback(`Tema "${trimmed}" already exists.`);
      setTimeout(() => setTemaFeedback(''), 3000);
      return;
    }
    const updated = [...currentTemas, trimmed];
    const newSet = { ...localSettings, temas: updated };
    setLocalSettings(newSet);
    onSaveSettings(newSet);
    setNewTemaInput('');
    setTemaFeedback(`Added "${trimmed}" successfully!`);
    setTimeout(() => setTemaFeedback(''), 3000);
  };

  const handleDeleteTema = (temaToDelete: string) => {
    if (!isAdmin) return;
    const updated = currentTemas.filter((t) => t !== temaToDelete);
    const finalTemas = updated.length > 0 ? updated : ['Tema 1'];
    const newSet = { ...localSettings, temas: finalTemas };
    setLocalSettings(newSet);
    onSaveSettings(newSet);
    setTemaFeedback(`Removed "${temaToDelete}".`);
    setTimeout(() => setTemaFeedback(''), 3000);
  };

  const handleStartEditTema = (index: number, text: string) => {
    if (!isAdmin) return;
    setEditingTemaIndex(index);
    setEditingTemaText(text);
  };

  const handleSaveEditTema = (index: number) => {
    if (!isAdmin) return;
    const trimmed = editingTemaText.trim();
    if (!trimmed) {
      setEditingTemaIndex(null);
      return;
    }
    const updated = [...currentTemas];
    updated[index] = trimmed;
    const newSet = { ...localSettings, temas: updated };
    setLocalSettings(newSet);
    onSaveSettings(newSet);
    setEditingTemaIndex(null);
    setTemaFeedback(`Updated to "${trimmed}".`);
    setTimeout(() => setTemaFeedback(''), 3000);
  };

  const handleResetTemas = () => {
    if (!isAdmin) return;
    const defaultTemas = ['Tema 1', 'Tema 2', 'Tema 3'];
    const newSet = { ...localSettings, temas: defaultTemas };
    setLocalSettings(newSet);
    onSaveSettings(newSet);
    setTemaFeedback('Reset Temas to defaults (Tema 1, Tema 2, Tema 3).');
    setTimeout(() => setTemaFeedback(''), 3000);
  };

  const [importStatus, setImportStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleToggleNotification = (key: keyof UserSettings['notifications']) => {
    if (typeof localSettings.notifications[key] === 'boolean') {
      setLocalSettings({
        ...localSettings,
        notifications: {
          ...localSettings.notifications,
          [key]: !localSettings.notifications[key]
        }
      });
    }
  };

  const handleLeadTimeChange = (minutes: number) => {
    setLocalSettings({
      ...localSettings,
      notifications: {
        ...localSettings.notifications,
        leadTimeMinutes: minutes
      }
    });
  };

  const handleSyncNow = () => {
    setIsSyncing(true);
    setSyncSuccessMsg('');
    setTimeout(() => {
      setIsSyncing(false);
      const nowStr = new Date().toISOString();
      const updated = {
        ...localSettings,
        sync: { ...localSettings.sync, lastSyncedAt: nowStr }
      };
      setLocalSettings(updated);
      onSaveSettings(updated);
      setSyncSuccessMsg('Calendar synced successfully with cloud server!');
    }, 1200);
  };

  // Dedicated handler to save Outlook ICS configuration directly
  const handleSaveOutlookLink = (overrideUrl?: string) => {
    const candidate = overrideUrl !== undefined ? overrideUrl : outlookIcsInput;
    const rawUrl = normalizeIcsUrl(candidate);

    // If user cleared the input and clicked Save, trigger disconnect/unlink
    if (!rawUrl && candidate.trim() === '') {
      handleRemoveOutlook();
      return;
    }

    if (!rawUrl) {
      setOutlookSyncStatus({
        type: 'error',
        message: 'Please paste a valid Outlook shared calendar ICS link (or webcal:// URL).'
      });
      return;
    }

    const targetCategory = outlookCategoryId || (categories[0]?.id || 'work');
    const calName = outlookCalendarName.trim() || 'Outlook Shared Calendar';
    const updatedSyncSettings = {
      ...localSettings.sync,
      unlinkOutlook: false,
      outlookIcsUrl: rawUrl,
      outlookCalendarName: calName,
      outlookDefaultCategoryId: targetCategory,
      outlookAutoSync: outlookAutoSync
    };
    const updatedAllSettings: UserSettings = {
      ...localSettings,
      sync: updatedSyncSettings
    };
    setLocalSettings(updatedAllSettings);
    onSaveSettings(updatedAllSettings);

    // Save to permanent client vault and push to server persistent configuration
    saveOutlookSyncConfig({
      outlookIcsUrl: rawUrl,
      outlookCalendarName: calName,
      outlookDefaultCategoryId: targetCategory,
      outlookAutoSync: outlookAutoSync
    });

    apiSaveOutlookConfig({
      url: rawUrl,
      calendarName: calName,
      categoryId: targetCategory,
      autoSync: outlookAutoSync
    }).catch(() => {});

    setOutlookSyncStatus({
      type: 'success',
      message: 'Outlook ICS link saved and permanently locked! It will not be unlinked on republish.'
    });
  };

  // Handle Sync Outlook Shared Calendar via ICS Link
  const handleSyncOutlook = async () => {
    const rawUrl = normalizeIcsUrl(outlookIcsInput);
    if (!rawUrl) {
      setOutlookSyncStatus({
        type: 'error',
        message: 'Please provide a valid Outlook shared calendar ICS link (or webcal:// URL).'
      });
      return;
    }

    setIsOutlookSyncing(true);
    setOutlookSyncStatus({ type: 'idle', message: 'Connecting to Outlook and syncing calendar events...' });

    const targetCategory = outlookCategoryId || (categories[0]?.id || 'work');
    const calDisplayName = outlookCalendarName.trim() || 'Outlook Shared Calendar';

    try {
      // 1. First attempt fast, server-side sync with automatic RFC 5545 parsing & deduplication
      const serverResult = await apiSyncOutlook({
        url: rawUrl,
        categoryId: targetCategory,
        calendarName: calDisplayName
      });

      if (serverResult.success && Array.isArray(serverResult.events)) {
        if (onImportEvents) {
          onImportEvents(serverResult.events);
        }

        const nowIso = serverResult.lastSyncedAt || new Date().toISOString();
        const updatedSyncSettings = {
          ...localSettings.sync,
          outlookIcsUrl: rawUrl,
          outlookCalendarName: calDisplayName,
          outlookDefaultCategoryId: targetCategory,
          outlookAutoSync: outlookAutoSync,
          outlookLastSyncedAt: nowIso,
          outlookSyncedCount: serverResult.count ?? 0
        };

        const updatedAllSettings: UserSettings = {
          ...localSettings,
          sync: updatedSyncSettings
        };

        setLocalSettings(updatedAllSettings);
        onSaveSettings(updatedAllSettings);

        setOutlookSyncStatus({
          type: 'success',
          message: `Successfully synchronized ${serverResult.count ?? 0} events from Outlook!`,
          count: serverResult.count
        });
        return;
      }

      // 2. Client-side fallback if server-side sync isn't reachable
      const icsText = await fetchIcsFeed(rawUrl);
      if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) {
        throw new Error('Retrieved content is not a valid iCalendar (.ics) feed. Please ensure the link is published with "Can view all details".');
      }

      const parsedEvents = parseIcsContent(icsText, currentUser || {
        id: 'admin-1',
        name: 'Administrator',
        username: 'admin',
        email: 'admin@auracalendar.com',
        role: 'admin',
        avatarColor: 'bg-indigo-600',
        createdAt: new Date().toISOString(),
        active: true
      });

      const customizedEvents: CalendarEvent[] = parsedEvents.map((e) => {
        const existing = events.find(
          (ex) =>
            ex.id === e.id ||
            (ex.externalEventId && ex.externalEventId === e.externalEventId && ex.startDate === e.startDate) ||
            ((ex.sourceAccountId === 'outlook-ics' || ex.source === 'external') &&
              ex.startDate === e.startDate &&
              (ex.title || '').trim().toLowerCase() === (e.title || '').trim().toLowerCase())
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
            notes: existing.notes,
            priority: existing.priority,
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
          categoryId: existing ? existing.categoryId : targetCategory,
          source: 'external',
          sourceAccountId: 'outlook-ics',
          notes: `Imported via Outlook Shared Calendar (${calDisplayName})`
        };
      });

      if (onImportEvents) {
        onImportEvents(customizedEvents);
      }

      const nowIso = new Date().toISOString();
      const updatedSyncSettings = {
        ...localSettings.sync,
        outlookIcsUrl: rawUrl,
        outlookCalendarName: calDisplayName,
        outlookDefaultCategoryId: targetCategory,
        outlookAutoSync: outlookAutoSync,
        outlookLastSyncedAt: nowIso,
        outlookSyncedCount: customizedEvents.length
      };

      const updatedAllSettings: UserSettings = {
        ...localSettings,
        sync: updatedSyncSettings
      };

      setLocalSettings(updatedAllSettings);
      onSaveSettings(updatedAllSettings);

      setOutlookSyncStatus({
        type: 'success',
        message: `Successfully synchronized ${customizedEvents.length} events from Outlook!`,
        count: customizedEvents.length
      });
    } catch (err: any) {
      console.error('Outlook sync error:', err);
      setOutlookSyncStatus({
        type: 'error',
        message: err?.message || 'Failed to fetch Outlook calendar feed. Please ensure the link is published publicly or set to "Can view all details".'
      });
    } finally {
      setIsOutlookSyncing(false);
    }
  };

  // Handle Remove / Disconnect Outlook Calendar
  const handleRemoveOutlook = async () => {
    try {
      setIsOutlookSyncing(true);
      setOutlookIcsInput('');
      const updatedSyncSettings = {
        ...localSettings.sync,
        outlookIcsUrl: '',
        outlookCalendarName: '',
        outlookLastSyncedAt: undefined,
        outlookSyncedCount: 0,
        unlinkOutlook: true
      };
      const updatedAllSettings: UserSettings = {
        ...localSettings,
        sync: updatedSyncSettings
      };
      setLocalSettings(updatedAllSettings);
      onSaveSettings(updatedAllSettings);
      clearOutlookSyncConfig();
      await apiUnlinkOutlook();

      setOutlookSyncStatus({
        type: 'idle',
        message: 'Outlook calendar integration disconnected and unlinked successfully.'
      });
      setIsConfirmingDisconnect(false);
    } catch (err: any) {
      setOutlookSyncStatus({
        type: 'error',
        message: err?.message || 'Failed to unlink Outlook calendar.'
      });
    } finally {
      setIsOutlookSyncing(false);
    }
  };

  // Live RFC 5545 feed URL for Outlook to subscribe to AuraCalendar
  const liveIcsFeedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/calendar/feed/${currentUser?.id || 'all'}.ics`
    : '/api/calendar/feed.ics';

  const handleCopyFeedUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(liveIcsFeedUrl);
      setCopiedFeedLink(true);
      setTimeout(() => setCopiedFeedLink(false), 2500);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const cleaned = normalizeIcsUrl(text);
          setOutlookIcsInput(cleaned);
          handleSaveOutlookLink(cleaned);
          return;
        }
      }
    } catch (e) {
      console.warn('Clipboard read error or permission denied:', e);
    }
    // Reliable fallback for browsers/iframes restricting clipboard read
    try {
      const fallback = window.prompt('Paste your Outlook Calendar ICS link here:');
      if (fallback) {
        const cleaned = normalizeIcsUrl(fallback);
        setOutlookIcsInput(cleaned);
        handleSaveOutlookLink(cleaned);
      }
    } catch (e) {
      // Ignore
    }
  };

  const outlookEventsCount = events.filter((e) => e.sourceAccountId === 'outlook-ics').length;

  const handleExportAllICal = () => {
    const ics = exportToICal(events);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `executive_calendar_export_${new Date().toISOString().split('T')[0]}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(events, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `executive_calendar_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTriggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const importedList = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.events) ? parsed.events : null;
        if (!importedList || !Array.isArray(importedList)) {
          setImportStatus('Invalid file format: No events array found.');
          return;
        }
        const validEvents = importedList.filter((ev: any) => ev && ev.id && ev.title);
        if (validEvents.length === 0) {
          setImportStatus('No valid events found in backup file.');
          return;
        }
        if (onImportEvents) {
          onImportEvents(validEvents);
          setImportStatus(`Successfully restored ${validEvents.length} events!`);
          setTimeout(() => setImportStatus(''), 5000);
        }
      } catch (err: any) {
        setImportStatus(`Failed to import: ${err?.message || 'Invalid JSON'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    const rawUrl = normalizeIcsUrl(outlookIcsInput);
    const targetCategory = outlookCategoryId || (categories[0]?.id || 'work');
    
    // Check if explicitly unlinked
    const isUnlinked = localSettings.sync?.unlinkOutlook === true;
    let finalUrl = '';
    if (!isUnlinked) {
      finalUrl = rawUrl || localSettings.sync?.outlookIcsUrl || '';
    }

    const updatedSyncSettings = {
      ...localSettings.sync,
      unlinkOutlook: isUnlinked,
      outlookIcsUrl: finalUrl,
      outlookCalendarName: isUnlinked ? '' : (outlookCalendarName.trim() || localSettings.sync?.outlookCalendarName || 'Outlook Shared Calendar'),
      outlookDefaultCategoryId: targetCategory,
      outlookAutoSync: outlookAutoSync
    };
    const settingsWithSync: UserSettings = {
      ...localSettings,
      sync: updatedSyncSettings
    };
    // Non-admins cannot modify Temas or Presets, but never force restore unlinked Outlook link
    const safeSettings = !isAdmin ? {
      ...settingsWithSync,
      temas: settings.temas || ['Tema 1', 'Tema 2', 'Tema 3']
    } : settingsWithSync;
    onSaveSettings(safeSettings);
    onClose();
  };

  const tabOptions = [
    {
      id: 'account' as const,
      label: 'Account & Users',
      description: 'Profile, credentials, team directory & permissions',
      icon: Users,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60'
    },
    {
      id: 'sync' as const,
      label: 'Sync & Integrations',
      description: 'Outlook ICS, share codes, QR, iCal & backups',
      icon: RefreshCw,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60'
    },
    {
      id: 'notifications' as const,
      label: 'Notifications & Alerts',
      description: 'Email, desktop alerts, sound & lead time',
      icon: Bell,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60'
    },
    {
      id: 'theme' as const,
      label: 'Theme & Appearance',
      description: 'Accent colors, density & dark mode',
      icon: Palette,
      color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/60'
    },
    {
      id: 'categories' as const,
      label: 'Category Tags',
      description: 'Color markers, visibility & event tags',
      icon: Tag,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60'
    },
    {
      id: 'temas' as const,
      label: 'Temas & Presets',
      description: 'Event tema options & classifications',
      icon: Layers,
      color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60'
    }
  ];

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-100 dark:bg-slate-950 animate-in fade-in duration-200 overflow-hidden">
      {/* Top Header Bar */}
      <header className="px-4 sm:px-8 py-3 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between shrink-0 shadow-2xs z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                Settings & Preferences
              </h1>
              <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Full Screen
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              Account credentials, sync integrations, alert channels & executive presets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {currentUser && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <div className={`w-6 h-6 rounded-lg ${currentUser.avatarColor} text-white flex items-center justify-center font-bold text-xs shadow-2xs`}>
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {currentUser.role}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            className="px-3.5 sm:px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Save Settings</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Settings (Esc)"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation (Desktop / Tablet) */}
        <aside className="w-64 lg:w-72 border-r border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-4 shrink-0 hidden md:flex flex-col justify-between overflow-y-auto">
          <div className="space-y-1.5">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Settings Menu
            </div>
            {tabOptions.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id || (tab.id === 'account' && activeTab === 'admin');
              return (
                <button
                  key={tab.id}
                  id={tab.id === 'account' ? 'settings-menu-account-users-btn' : undefined}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={`w-full flex items-center gap-3 p-2.5 lg:p-3 rounded-2xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : tab.color
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate flex items-center justify-between gap-1">
                      <span>{tab.label}</span>
                    </div>
                    <div className={`text-[10px] truncate ${
                      isSelected
                        ? 'text-indigo-100'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {tab.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* User Status Card in Sidebar */}
          {currentUser && (
            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl ${currentUser.avatarColor} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}>
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {currentUser.email}
                    </div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-500 uppercase">{currentUser.role}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Online
                  </span>
                </div>
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuth();
                    }}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Switch Account</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Content Panel Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-50/70 dark:bg-slate-950/70">
          {/* Mobile Horizontal Tabs */}
          <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
            {tabOptions.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id || (tab.id === 'account' && activeTab === 'admin');
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            {onOpenAuth && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold transition-colors shrink-0"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Switch Account</span>
              </button>
            )}
          </div>

          {/* Scrollable Main Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10">
            <div className="max-w-4xl mx-auto space-y-6">

              {/* TAB 0: ACCOUNT & USERS */}
              {(activeTab === 'account' || activeTab === 'admin') && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Account & Users</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Manage your executive account credentials, role permissions, and collaborator team accounts.
                    </p>
                  </div>

                  {/* Primary Account Card */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl ${currentUser?.avatarColor || 'bg-indigo-600'} text-white flex items-center justify-center text-xl font-black shadow-md`}>
                        {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
                      </div>
                      <div>
                        <div className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          {currentUser?.name || 'Executive User'}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            currentUser?.role === 'admin'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                              : currentUser?.role === 'member'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                          }`}>
                            {currentUser?.role || 'MEMBER'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {currentUser?.email || 'user@example.com'}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active Session • Fully Authenticated</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                      {onOpenAuth && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenAuth();
                          }}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5 text-indigo-500" />
                          Switch Account
                        </button>
                      )}
                      {onSignOut && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSignOut();
                          }}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs border border-rose-200/60 dark:border-rose-900/60 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Organization Category Tags & Member Classification Access */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
                          <Tag className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                              Organization Category Tags
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {(categories && categories.length > 0) ? categories.length : 0} Active Tags
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Active category tags configured by calendar administrators, available across your member profile.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('categories')}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <span>Filter & View Tags</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Category Tags Grid */}
                    {categories && categories.length > 0 ? (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {categories.map((cat) => {
                          const eventCount = events.filter((e) => e.categoryId === cat.id).length;
                          const isSelected = selectedCategoryIds ? selectedCategoryIds.includes(cat.id) : true;
                          return (
                            <div
                              key={cat.id}
                              className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2.5 transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                                  style={{ backgroundColor: cat.hex || '#3B82F6' }}
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {cat.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono truncate">
                                    {eventCount} event{eventCount !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </div>

                              <span
                                className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                                  isSelected
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                }`}
                              >
                                {isSelected ? 'Active' : 'Filtered'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-500">
                        No categories found.
                      </div>
                    )}

                    <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>
                        All team members can schedule and organize events using these categories. Category additions and deletions are synchronized from administrators.
                      </span>
                    </div>
                  </div>

                  {/* Collaborator Accounts & Roles Section */}
                  <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-2xs">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                              Collaborator Accounts & Roles
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {(users && users.length > 0) ? users.length : 1} Registered
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Directory of active collaborators, access privileges, and user roles.
                          </p>
                        </div>
                      </div>

                      {onOpenAdmin && (
                        <button
                          id="settings-menu-manage-users-btn"
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenAdmin();
                          }}
                          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Manage User Accounts</span>
                          <ExternalLink className="w-3 h-3 text-purple-200" />
                        </button>
                      )}
                    </div>

                    {/* Quick Collaborators Roster Grid */}
                    {users && users.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {users.slice(0, 6).map((u) => {
                          const isSelf = u.id === currentUser?.id;
                          return (
                            <div
                              key={u.id}
                              className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                                isSelf
                                  ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/80'
                                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-8 h-8 rounded-xl ${u.avatarColor || 'bg-indigo-600'} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                                  {u.name ? u.name.charAt(0) : 'U'}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                    <span>{u.name}</span>
                                    {isSelf && (
                                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono truncate">
                                    {u.email}
                                  </div>
                                </div>
                              </div>

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                                u.role === 'admin'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                  : u.role === 'member'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                              }`}>
                                {u.role}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Connected Services Quick Overview */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">Calendar Sharing & Access</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Shareable links, read/edit permissions, and custom category access codes.
                      </p>
                      {onOpenShare && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenShare();
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Manage Share Links & Codes</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Role Capabilities Card */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Role Permissions & Capabilities
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>Event Operations</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {currentUser?.role === 'viewer' ? 'Read-only view access' : 'Create, edit, duplicate & delete events'}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>Categories & Tags</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {currentUser?.role === 'admin' ? 'Full category creation & editing' : 'View & filter all category tags'}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          {currentUser?.role === 'admin' ? (
                            <CheckCircle2 className="w-4 h-4 text-purple-500" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-400" />
                          )}
                          <span>Admin Console</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {currentUser?.role === 'admin' ? 'Manage user directory & roles' : 'Restricted to administrators'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

          {/* TAB 1: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Alert Channels
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-indigo-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Email Notifications
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Send event digests and urgent reminders to email
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.notifications.email}
                    onChange={() => handleToggleNotification('email')}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-emerald-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Browser Desktop Alerts
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Pop up desktop alerts prior to upcoming schedule items
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.notifications.desktop}
                    onChange={() => handleToggleNotification('desktop')}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-5 h-5 text-amber-500" />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Sound Effects & Triggers
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Play subtle audio chime when event reminder fires
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.notifications.sound}
                    onChange={() => handleToggleNotification('sound')}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Lead Time Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Default Lead Time Alert
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[5, 15, 30, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleLeadTimeChange(mins)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        localSettings.notifications.leadTimeMinutes === mins
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {mins === 60 ? '1 hour before' : `${mins} mins before`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SYNC PREFERENCES */}
          {activeTab === 'sync' && (
            <div className="space-y-5">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Cloud Auto-Sync Engine
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Automatically sync schedule changes in background
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={localSettings.sync.autoSync}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        sync: { ...localSettings.sync, autoSync: e.target.checked }
                      })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                {localSettings.sync.lastSyncedAt && (
                  <div className="text-[11px] text-slate-400 font-semibold pt-1">
                    Last synced: {new Date(localSettings.sync.lastSyncedAt).toLocaleTimeString()}
                  </div>
                )}

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Calendar Now'}</span>
                  </button>

                  {syncSuccessMsg && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {syncSuccessMsg}
                    </span>
                  )}
                </div>
              </div>

              {/* Outlook Shared Calendar (ICS Link) Integration */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0078D4] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <CalendarIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Outlook Shared Calendar
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#0078D4] dark:bg-blue-900/60 dark:text-blue-200">
                          ICS Link
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Integrate Outlook calendar by pasting its shared ICS URL, or subscribe Outlook to this calendar.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {localSettings.sync?.outlookIcsUrl ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Connected ({outlookEventsCount || localSettings.sync?.outlookSyncedCount || 0} events)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        Not connected
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-section 1: Inbound - Import Outlook ICS Link */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-[#0078D4]" />
                      <span>Outlook Shared Calendar ICS / WebCal URL</span>
                    </label>

                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="text-[11px] font-semibold text-[#0078D4] hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Paste from clipboard</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      id="outlook-ics-link-input"
                      type="text"
                      inputMode="url"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={outlookIcsInput}
                      onChange={(e) => setOutlookIcsInput(e.target.value)}
                      onPaste={(e) => {
                        const pasted = e.clipboardData?.getData('text');
                        if (pasted) {
                          e.preventDefault();
                          const cleaned = normalizeIcsUrl(pasted);
                          setOutlookIcsInput(cleaned);
                          handleSaveOutlookLink(cleaned);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveOutlookLink();
                        }
                      }}
                      placeholder="https://outlook.office365.com/owa/calendar/.../reachcalendar.ics"
                      className="w-full text-xs sm:text-sm font-mono py-2.5 sm:py-3 pl-3.5 pr-32 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs focus:ring-2 focus:ring-[#0078D4]/30 focus:border-[#0078D4] dark:focus:border-[#0078D4] transition-all"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {outlookIcsInput && (
                        <button
                          type="button"
                          onClick={() => {
                            setOutlookIcsInput('');
                          }}
                          className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
                          title="Clear input text"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSaveOutlookLink()}
                        className="px-2.5 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#005A9E] text-white font-bold text-[11px] shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                        title="Save Outlook ICS Link"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>

                  {/* Config row: Nickname & Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Calendar Nickname
                      </label>
                      <input
                        type="text"
                        value={outlookCalendarName}
                        onChange={(e) => setOutlookCalendarName(e.target.value)}
                        placeholder="e.g., Team Outlook Calendar"
                        className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-[#0078D4]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Assign Category
                      </label>
                      <select
                        value={outlookCategoryId}
                        onChange={(e) => setOutlookCategoryId(e.target.value)}
                        className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-[#0078D4]"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Auto-sync Checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="outlookAutoSyncCheckbox"
                      checked={outlookAutoSync}
                      onChange={(e) => setOutlookAutoSync(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0078D4] focus:ring-[#0078D4]"
                    />
                    <label
                      htmlFor="outlookAutoSyncCheckbox"
                      className="text-xs text-slate-600 dark:text-slate-400 select-none cursor-pointer"
                    >
                      Automatically keep synced with Outlook when AuraCalendar opens
                    </label>
                  </div>

                  {/* Action buttons & status */}
                  <div className="pt-2 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSaveOutlookLink()}
                      className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSyncOutlook}
                      disabled={isOutlookSyncing}
                      className="py-2.5 px-4 rounded-xl bg-[#0078D4] hover:bg-[#005A9E] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isOutlookSyncing ? 'animate-spin' : ''}`} />
                      <span>{isOutlookSyncing ? 'Syncing Outlook...' : localSettings.sync?.outlookIcsUrl ? 'Re-sync Outlook Calendar' : 'Save & Sync Calendar Now'}</span>
                    </button>

                    {(localSettings.sync?.outlookIcsUrl || outlookIcsInput) && (
                      isConfirmingDisconnect ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                          <button
                            type="button"
                            onClick={handleRemoveOutlook}
                            disabled={isOutlookSyncing}
                            className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Confirm Disconnect?</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsConfirmingDisconnect(false)}
                            className="py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsConfirmingDisconnect(true)}
                          disabled={isOutlookSyncing}
                          className="py-2.5 px-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Disconnect Link</span>
                        </button>
                      )
                    )}
                  </div>

                  {/* Status Banner */}
                  {outlookSyncStatus.message && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                        outlookSyncStatus.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                          : outlookSyncStatus.type === 'error'
                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                          : 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      {outlookSyncStatus.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : outlookSyncStatus.type === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span>{outlookSyncStatus.message}</span>
                        {localSettings.sync?.outlookLastSyncedAt && (
                          <div className="text-[11px] opacity-75 mt-0.5">
                            Last synced: {new Date(localSettings.sync.outlookLastSyncedAt).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Guide Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowOutlookGuide(!showOutlookGuide)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-[#0078D4]" />
                      <span>How do I find my Outlook Shared Calendar ICS link?</span>
                      {showOutlookGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showOutlookGuide && (
                      <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                        <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                          Steps to publish your Outlook calendar link:
                        </div>
                        <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px] leading-relaxed">
                          <li>
                            Open <strong>Outlook on the web</strong> (<a href="https://outlook.office.com" target="_blank" rel="noreferrer" className="text-[#0078D4] underline inline-flex items-center gap-0.5">outlook.office.com <ExternalLink className="w-2.5 h-2.5" /></a> or <a href="https://outlook.live.com" target="_blank" rel="noreferrer" className="text-[#0078D4] underline inline-flex items-center gap-0.5">outlook.live.com <ExternalLink className="w-2.5 h-2.5" /></a>).
                          </li>
                          <li>
                            Click the <strong>Settings gear icon (⚙️)</strong> in the top right header, then select <strong>Calendar</strong> → <strong>Shared calendars</strong>.
                          </li>
                          <li>
                            Under <strong>Publish a calendar</strong>, select the calendar you want to share and set permissions to <strong>"Can view all details"</strong>.
                          </li>
                          <li>
                            Click <strong>Publish</strong>. Outlook will display two links: an HTML link and an <strong>ICS link</strong>.
                          </li>
                          <li>
                            Copy the <strong>ICS link</strong> (ending in <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">.ics</code>) and paste it into the field above!
                          </li>
                        </ol>
                        <div className="pt-1 text-[11px] text-slate-400">
                          Note: Both <code className="font-mono">https://</code> and <code className="font-mono">webcal://</code> links are supported.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-section 2: Outbound - Subscribe Outlook to AuraCalendar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Subscribe Outlook to this Calendar (Live ICS Feed)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Add this schedule to Outlook Desktop or Web with real-time automatic synchronization.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={liveIcsFeedUrl}
                      className="flex-1 text-xs font-mono py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 select-all"
                    />

                    <button
                      type="button"
                      onClick={handleCopyFeedUrl}
                      className="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                    >
                      {copiedFeedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedFeedLink ? 'Copied URL!' : 'Copy Feed Link'}</span>
                    </button>

                    <a
                      href="https://outlook.live.com/calendar/0/addcalendar"
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[#0078D4] dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-1 shrink-0 transition-colors border border-blue-200 dark:border-blue-800"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Add in Outlook Web</span>
                    </a>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-0.5">
                    <Info className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>In Outlook: Click "Add calendar" → "Subscribe from web" → Paste the link above.</span>
                  </div>
                </div>
              </div>

              {/* Share Calendar & Access Codes Section */}
              {onOpenShare && (
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Share2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          Share Calendar & Access Codes
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200">
                            Permissions
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Create public share links, category-filtered access codes, and view/edit permissions.
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenShare();
                      }}
                      className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Manage Share Codes</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Category QR Codes & Public PDF Section */}
              {onOpenCategoryQr && (
                <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          Category QR Codes & Public PDF
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-200">
                            Print & Scan
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Download printable QR codes and instant live schedules without login requirements.
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCategoryQr();
                      }}
                      className="py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Open QR Codes & PDF</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 24/7 Cloud Service & Public QR Codes Domain */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Cloud className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        24/7 Public Cloud Service URL
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-200">
                          Cloud Run / Custom Domain
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Set your permanent public URL for 24/7 QR code scanning with no login or computer required.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Production Base URL (Google Cloud Run or Custom Domain)
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://my-calendar-app-488950738317.us-east1.run.app"
                      value={localSettings.publicBaseUrl || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setLocalSettings({ ...localSettings, publicBaseUrl: val });
                        setCustomPublicBaseUrl(val);
                      }}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onSaveSettings(localSettings);
                        if (localSettings.publicBaseUrl) {
                          window.open(localSettings.publicBaseUrl, '_blank');
                        }
                      }}
                      disabled={!localSettings.publicBaseUrl}
                      className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Test Cloud URL</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Deploy your app via the top-right <strong>Deploy</strong> button in Google AI Studio to obtain your permanent Cloud Run URL. Once pasted here, all generated QR codes, PDF flyers, and bulletin links will route visitors to your 24/7 public service.
                  </p>
                </div>
              </div>

              {/* Data Import & Export Section */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Data Backup & Export
                </div>

                {importStatus && (
                  <div className={`p-3 rounded-2xl text-xs font-semibold ${
                    importStatus.includes('Successfully')
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}>
                    {importStatus}
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json,application/json"
                  className="hidden"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleExportAllICal}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">
                      <Download className="w-4 h-4 text-indigo-500" />
                      <span>Export iCal (.ics)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Compatible with Apple Calendar, Google & iCal
                    </p>
                  </button>

                  <button
                    onClick={handleExportJSON}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">
                      <Download className="w-4 h-4 text-emerald-500" />
                      <span>Export Full Backup</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Download all {events.length} events as JSON
                    </p>
                  </button>

                  <button
                    onClick={handleTriggerImport}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">
                      <Upload className="w-4 h-4 text-amber-500" />
                      <span>Restore / Import JSON</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Restore events and sync permanently
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: THEME & APPEARANCE */}
          {activeTab === 'theme' && (
            <div className="space-y-5">
              {/* Theme Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Theme Appearance Mode
                </label>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      document.documentElement.classList.remove('dark');
                      setLocalSettings({ ...localSettings, theme: 'light' });
                    }}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      localSettings.theme === 'light'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Sun className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                    <span className="text-xs">Light Theme</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      document.documentElement.classList.add('dark');
                      setLocalSettings({ ...localSettings, theme: 'dark' });
                    }}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      localSettings.theme === 'dark'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Moon className="w-5 h-5 mx-auto mb-1 text-indigo-400" />
                    <span className="text-xs">Dark Theme</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        document.documentElement.classList.add('dark');
                      } else {
                        document.documentElement.classList.remove('dark');
                      }
                      setLocalSettings({ ...localSettings, theme: 'system' });
                    }}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      localSettings.theme === 'system'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Monitor className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                    <span className="text-xs">System Auto</span>
                  </button>
                </div>
              </div>

              {/* First Day of Week */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  First Day of Week
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setLocalSettings({ ...localSettings, firstDayOfWeek: 0 })}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                      localSettings.firstDayOfWeek === 0
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    Sunday (Standard)
                  </button>

                  <button
                    onClick={() => setLocalSettings({ ...localSettings, firstDayOfWeek: 1 })}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                      localSettings.firstDayOfWeek === 1
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    Monday (ISO Week)
                  </button>
                </div>
              </div>

              {/* Grid Density */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Calendar Grid Layout Density
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {(['compact', 'comfortable', 'spacious'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setLocalSettings({ ...localSettings, density: d })}
                      className={`p-2.5 rounded-xl border text-xs font-bold capitalize transition-all ${
                        localSettings.density === d
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CATEGORIES & TAGS MANAGEMENT */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              
              {/* Category Success & Error Alerts */}
              {categorySuccessToast && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{categorySuccessToast}</span>
                  </div>
                  <button
                    onClick={() => setCategorySuccessToast('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              )}

              {categoryErrorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{categoryErrorMsg}</span>
                  </div>
                  <button
                    onClick={() => setCategoryErrorMsg('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Header Info & Stats Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-indigo-50/80 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-indigo-950/40 border border-emerald-200/80 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="p-2.5 rounded-2xl bg-emerald-600 text-white shrink-0 shadow-xs mt-0.5">
                    <Tag className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        Color-Coded Category Tag System
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Calendar Classifications
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                      Create custom categories, assign color palettes, edit tags, and toggle visibility across all calendar views in real time.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {onOpenCategoryQr && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCategoryQr();
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Open Category QR Code Hub"
                    >
                      <QrCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>QR Hub</span>
                    </button>
                  )}
                  {onResetCategories && canEditCategories && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Restore default 7 system category tags?')) {
                          onResetCategories();
                          setCategorySuccessToast('Restored default category tags.');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Reset to default system categories"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Defaults</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Edit Category Drawer if active */}
              {editingCatId && (
                <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-xl bg-amber-500 text-white shadow-xs">
                        <Edit3 className="w-4 h-4" />
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Edit Category Tag
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingCatId(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      &times; Close
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                        Tag Name
                      </label>
                      <input
                        type="text"
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        placeholder="Tag name..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                        Custom Hex (Optional)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editCatCustomHex}
                          onChange={(e) => setEditCatCustomHex(e.target.value)}
                          placeholder="#3B82F6"
                          className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                        />
                        {editCatCustomHex && (
                          <span
                            className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-600 shrink-0"
                            style={{ backgroundColor: editCatCustomHex }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Color Preset Palette for Edit */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Select Color Theme Preset
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {CATEGORY_COLOR_PRESETS.map((preset) => {
                        const isSelected = editCatColorKey === preset.key;
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => {
                              setEditCatColorKey(preset.key);
                              setEditCatCustomHex(preset.hex);
                            }}
                            className={`p-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-amber-500 bg-white dark:bg-slate-800 ring-2 ring-amber-500 font-bold shadow-xs'
                                : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 hover:bg-white'
                            }`}
                          >
                            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: preset.hex }} />
                            <span className="text-[11px] truncate">{preset.name.split(' ')[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Edit Live Preview Pill */}
                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Live Preview:</span>
                      {(() => {
                        const preview = createCategory(editCatName || 'Category Name', editCatColorKey, undefined, editCatCustomHex);
                        return (
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${preview.badgeClass}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${preview.dotClass}`} />
                            <span>{preview.name}</span>
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCatId(null)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditCategory}
                        className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                      >
                        Save Tag Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Confirmation Alert if active */}
              {deletingCatId && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-400 dark:border-rose-800 space-y-3 animate-in fade-in duration-150">
                  {(() => {
                    const catToDelete = (categories || []).find((c) => c.id === deletingCatId);
                    const affectedEventsCount = events.filter((e) => e.categoryId === deletingCatId).length;

                    return (
                      <>
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs sm:text-sm">
                          <AlertCircle className="w-5 h-5 shrink-0" />
                          <span>Delete Category Tag "{catToDelete?.name}"?</span>
                        </div>
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                          {affectedEventsCount > 0
                            ? `Note: ${affectedEventsCount} calendar events are currently using this tag. Deleting will safely reassign those events to the default category.`
                            : 'This tag is not currently in use by any events and can be safely deleted.'}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setDeletingCatId(null)}
                            className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmDeleteCategory}
                            className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 cursor-pointer"
                          >
                            Confirm Delete Tag
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Section 1: Create New Category Tag or Restriction Notice */}
              {canEditCategories ? (
                <form onSubmit={handleCreateCategory} className="bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-4 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-indigo-600 text-white shadow-xs">
                      <PlusCircle className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Create New Color-Coded Tag
                      </h3>
                      <p className="text-xs text-slate-500">
                        Add a custom category tag with color scheme for calendar events
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Category Tag Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Executive Sync, Marketing, Client Strategy, Compliance"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Custom Hex Code (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. #6366F1 or choose from palette"
                        value={newCatCustomHex}
                        onChange={(e) => setNewCatCustomHex(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                    </div>
                  </div>

                  {/* Color Preset Palette Selection */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Choose Color Theme Palette
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {CATEGORY_COLOR_PRESETS.map((preset) => {
                        const isSelected = newCatColorKey === preset.key;
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => {
                              setNewCatColorKey(preset.key);
                              if (!newCatCustomHex) setNewCatCustomHex(preset.hex);
                            }}
                            className={`p-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-indigo-600 bg-white dark:bg-slate-800 ring-2 ring-indigo-500/40 font-bold shadow-xs'
                                : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: preset.hex }} />
                            <span className="text-xs truncate text-slate-800 dark:text-slate-200">{preset.name.split(' ')[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live Preview & Submit Row */}
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Live Preview:</span>
                      {(() => {
                        const preview = createCategory(newCatName || 'Category Name', newCatColorKey, undefined, newCatCustomHex || undefined);
                        return (
                          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 ${preview.badgeClass}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${preview.dotClass}`} />
                            <span>{preview.name}</span>
                          </span>
                        );
                      })()}
                    </div>

                    <button
                      type="submit"
                      className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Category Tag</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-4 rounded-3xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Administrator-Managed Category Tags
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      All active categories below are synced from administrators and available across your profile for scheduling events. You can toggle calendar visibility for each category below.
                    </p>
                  </div>
                </div>
              )}

              {/* Section 2: All Active Category Tags & Calendar Visibility */}
              {categories && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Category Tags & Calendar Visibility ({categories.length})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Use checkboxes to filter calendar view display. Edit or delete tags to keep classifications tidy.
                      </p>
                    </div>

                    {selectedCategoryIds && onToggleCategory && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                          {selectedCategoryIds.length}/{categories.length} Visible
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedCategoryIds.length === categories.length) {
                              // Deselect all except first
                              categories.slice(1).forEach((c) => {
                                if (selectedCategoryIds.includes(c.id)) onToggleCategory(c.id);
                              });
                            } else {
                              // Select all
                              categories.forEach((c) => {
                                if (!selectedCategoryIds.includes(c.id)) onToggleCategory(c.id);
                              });
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        >
                          {selectedCategoryIds.length === categories.length ? 'Filter Only First' : 'Select All'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categories.map((cat) => {
                      const isChecked = selectedCategoryIds ? selectedCategoryIds.includes(cat.id) : true;
                      const usageCount = events.filter((e) => e.categoryId === cat.id).length;

                      return (
                        <div
                          key={cat.id}
                          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                            isChecked
                              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/80 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {onToggleCategory && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => onToggleCategory(cat.id)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                title={isChecked ? 'Visible on calendar (click to hide)' : 'Hidden on calendar (click to show)'}
                              />
                            )}
                            <span
                              className="w-4 h-4 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: cat.hex || '#3B82F6' }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {cat.name}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cat.badgeClass}`}>
                                  {cat.id}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="font-mono">{cat.hex || '#3B82F6'}</span>
                                <span>&bull;</span>
                                <span>{usageCount} event{usageCount !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>

                          {canEditCategories && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditCategory(cat)}
                                className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                title={`Edit "${cat.name}"`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCategoryErrorMsg('');
                                  setDeletingCatId(cat.id);
                                }}
                                className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                                title={`Delete "${cat.name}"`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB: TEMAS MANAGEMENT */}
          {activeTab === 'temas' && (
            <div className="space-y-5">
              {/* Header Info Banner */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 shadow-xs mt-0.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                    Event "Tema" Classification Options
                  </h4>
                  <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/90 mt-0.5 leading-relaxed">
                    These options appear in the <strong>Tema</strong> dropdown when scheduling new events. Administrators can add new custom Temas, rename labels, or remove unused ones.
                  </p>
                </div>
              </div>

              {/* Feedback toast / alert */}
              {temaFeedback && (
                <div className="p-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center justify-between animate-in fade-in duration-200 shadow-md">
                  <span>{temaFeedback}</span>
                  <button
                    onClick={() => setTemaFeedback('')}
                    className="p-1 hover:opacity-75"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Admin Add New Tema Input Box */}
              {isAdmin ? (
                <form onSubmit={handleAddTema} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Add New Tema
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Tema 4, Workshop, Executive Briefing..."
                      value={newTemaInput}
                      onChange={(e) => setNewTemaInput(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                    <button
                      type="submit"
                      disabled={!newTemaInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Tema</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Only administrators can create or edit new Tema options.</span>
                </div>
              )}

              {/* Temas List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Active Temas ({currentTemas.length})
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleResetTemas}
                      className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
                      title="Reset to Tema 1, Tema 2, Tema 3"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore Defaults</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {currentTemas.map((temaItem, index) => {
                    const eventCount = events.filter((e) =>
                      Array.isArray(e.temas) && e.temas.length > 0 ? e.temas.includes(temaItem) : e.tema === temaItem
                    ).length;
                    const isEditing = editingTemaIndex === index;

                    return (
                      <div
                        key={temaItem}
                        className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 shadow-2xs group hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <input
                              type="text"
                              value={editingTemaText}
                              onChange={(e) => setEditingTemaText(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditTema(index);
                                if (e.key === 'Escape') setEditingTemaIndex(null);
                              }}
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-indigo-500 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditTema(index)}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                              title="Save"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTemaIndex(null)}
                              className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {temaItem}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {eventCount} {eventCount === 1 ? 'event' : 'events'}
                              </span>

                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditTema(index, temaItem)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                                    title="Rename Tema"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTema(temaItem)}
                                    disabled={currentTemas.length <= 1}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Delete Tema"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}


            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-end gap-2.5 sm:gap-3 shrink-0 z-10 shadow-xs">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none py-2.5 px-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300 text-center transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              className="flex-1 sm:flex-none py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 text-center transition-all active:scale-95 cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

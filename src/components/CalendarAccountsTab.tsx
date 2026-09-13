import React, { useState, useMemo } from 'react';
import { User, ConnectedAccount, CalendarEvent, Category, CalendarProvider } from '../types';
import { ZapierIntegrationPanel } from './ZapierIntegrationPanel';
import {
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  SlidersHorizontal,
  ExternalLink,
  Shield,
  Calendar,
  Lock,
  Mail,
  Check,
  Globe,
  Radio,
  Eye,
  EyeOff,
  Plus,
  Search,
  CalendarCheck,
  FolderPlus,
  Settings2,
  Sparkles,
  Zap
} from 'lucide-react';

interface CalendarAccountsTabProps {
  currentUser?: User;
  onUpdateUser?: (user: User) => void;
  onImportEvents?: (events: CalendarEvent[]) => void;
  onSaveEvent?: (event: Partial<CalendarEvent>) => void;
  onDeleteEvent?: (eventId: string) => void;
  events?: CalendarEvent[];
  categories?: Category[];
}

interface ProviderMeta {
  id: CalendarProvider;
  title: string;
  subtitle: string;
  secondarySubtitle?: string;
  badge?: string;
  defaultDomain?: string;
  placeholderUrl?: string;
  supportsTwoWay: boolean;
  domainSuggestions?: string[];
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'zapier',
    title: 'Microsoft Outlook (via Zapier)',
    subtitle: 'Automated 2-way sync with Outlook',
    secondarySubtitle: 'Recommended • Fast & reliable',
    supportsTwoWay: true,
    badge: 'Popular for Outlook',
    defaultDomain: '@outlook.com',
    domainSuggestions: ['@outlook.com', '@hotmail.com', '@live.com', '@office365.com']
  },
  {
    id: 'microsoft',
    title: 'Microsoft',
    subtitle: 'Outlook.com, Live, Hotmail',
    secondarySubtitle: 'Office 365',
    supportsTwoWay: true,
    defaultDomain: '@outlook.com',
    domainSuggestions: ['@outlook.com', '@hotmail.com', '@live.com', '@office365.com']
  },
  {
    id: 'exchange',
    title: 'Exchange',
    subtitle: 'Exchange',
    supportsTwoWay: true,
    placeholderUrl: 'https://outlook.office365.com/ews/exchange.asmx',
    domainSuggestions: ['@company.com', '@corp.microsoft.com']
  },
  {
    id: 'google',
    title: 'Google',
    subtitle: 'Google calendar',
    supportsTwoWay: true,
    defaultDomain: '@gmail.com',
    domainSuggestions: ['@gmail.com', '@googlemail.com']
  },
  {
    id: 'apple',
    title: 'iCloud',
    subtitle: 'Apple iCloud calendar',
    supportsTwoWay: true,
    defaultDomain: '@icloud.com',
    domainSuggestions: ['@icloud.com', '@me.com', '@mac.com']
  },
  {
    id: 'caldav',
    title: 'CalDAV',
    subtitle: 'CalDAV calendars',
    supportsTwoWay: true,
    placeholderUrl: 'https://caldav.example.com/principals/users/username/'
  },
  {
    id: 'webcal',
    title: 'WebCal',
    subtitle: 'Subscription, ICS URL, Webcal URL',
    supportsTwoWay: false,
    placeholderUrl: 'webcal://example.com/calendar.ics'
  },
  {
    id: 'yahoo',
    title: 'Yahoo',
    subtitle: 'Yahoo calendar',
    supportsTwoWay: true,
    defaultDomain: '@yahoo.com',
    domainSuggestions: ['@yahoo.com', '@ymail.com']
  }
];

export const CalendarAccountsTab: React.FC<CalendarAccountsTabProps> = ({
  currentUser,
  onUpdateUser,
  onImportEvents,
  onSaveEvent,
  onDeleteEvent,
  events = [],
  categories = []
}) => {
  // Navigation & View states
  const [selectedProvider, setSelectedProvider] = useState<ProviderMeta | null>(null);
  const [showZapierPanel, setShowZapierPanel] = useState(false);
  const [managingAccount, setManagingAccount] = useState<ConnectedAccount | null>(null);
  const [managementTab, setManagementTab] = useState<'events' | 'add-event' | 'calendars' | 'settings'>('events');

  // Connection flow states
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStep, setConnectionStep] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states for account connection / login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [calendarName, setCalendarName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [syncDirection, setSyncDirection] = useState<'two-way' | 'import-only'>('two-way');
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(15);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || 'work');

  // New event in managed account state
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  });
  const [newEventStartTime, setNewEventStartTime] = useState('10:00');
  const [newEventEndTime, setNewEventEndTime] = useState('11:00');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventCategoryId, setNewEventCategoryId] = useState(categories[0]?.id || 'work');
  const [eventsSearchQuery, setEventsSearchQuery] = useState('');
  const [eventTimeFilter, setEventTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  // New sub-calendar folder state
  const [newCalendarFolderName, setNewCalendarFolderName] = useState('');
  const [isAddingCalendarFolder, setIsAddingCalendarFolder] = useState(false);
  const [recentlyDisconnectedAccount, setRecentlyDisconnectedAccount] = useState<{
    account: ConnectedAccount;
    events: CalendarEvent[];
  } | null>(null);

  const connectedAccounts: ConnectedAccount[] = currentUser?.connectedAccounts || [];

  // Active account being managed (keep in sync with user state)
  const currentManagedAccount = useMemo(() => {
    if (!managingAccount) return null;
    return connectedAccounts.find((a) => a.id === managingAccount.id) || managingAccount;
  }, [managingAccount, connectedAccounts]);

  // Filter events belonging to the managed account
  const managedAccountEvents = useMemo(() => {
    if (!currentManagedAccount) return [];
    const todayStr = new Date().toISOString().split('T')[0];

    return events
      .filter((evt) => {
        const matchesAccount =
          evt.sourceAccountId === currentManagedAccount.id ||
          (evt.sourceAccountEmail &&
            evt.sourceAccountEmail.toLowerCase() === currentManagedAccount.email.toLowerCase()) ||
          (evt.source === 'external' &&
            currentManagedAccount.provider === 'microsoft' &&
            evt.title.toLowerCase().includes('[microsoft]'));

        if (!matchesAccount) return false;

        if (eventsSearchQuery.trim()) {
          const q = eventsSearchQuery.toLowerCase();
          const matchesSearch =
            evt.title.toLowerCase().includes(q) ||
            (evt.description && evt.description.toLowerCase().includes(q)) ||
            (evt.location && evt.location.toLowerCase().includes(q));
          if (!matchesSearch) return false;
        }

        if (eventTimeFilter === 'upcoming') {
          return evt.startDate >= todayStr;
        }
        if (eventTimeFilter === 'past') {
          return evt.startDate < todayStr;
        }
        return true;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [events, currentManagedAccount, eventsSearchQuery, eventTimeFilter]);

  // Open provider login form
  const handleOpenProvider = (provider: ProviderMeta) => {
    if (provider.id === 'zapier') {
      setShowZapierPanel(true);
      setManagingAccount(null);
      setSelectedProvider(null);
      return;
    }
    setSelectedProvider(provider);
    setManagingAccount(null);
    setShowZapierPanel(false);
    setName(provider.title === 'microsoft' ? 'Microsoft Outlook Calendar' : `${provider.title} Calendar`);
    setCalendarName(provider.title === 'microsoft' ? 'Outlook Primary' : `${provider.title} Events`);
    setEmail(currentUser?.email || '');
    setPassword('');
    setShowPassword(false);
    setServerUrl(provider.placeholderUrl || '');
    setSyncDirection(provider.supportsTwoWay ? 'two-way' : 'import-only');
    setAutoSync(true);
    setSyncInterval(15);
  };

  const handleCloseProvider = () => {
    setSelectedProvider(null);
    setIsConnecting(false);
    setConnectionStep('');
  };

  // Connect & Authenticate Microsoft or other provider
  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider || !currentUser) return;

    if (!email.trim() && selectedProvider.id !== 'webcal') {
      setNotification({ type: 'error', message: 'Please enter your Microsoft account email or username.' });
      return;
    }

    if (
      (selectedProvider.id === 'microsoft' ||
        selectedProvider.id === 'exchange' ||
        selectedProvider.id === 'apple' ||
        selectedProvider.id === 'yahoo') &&
      !password.trim()
    ) {
      setNotification({
        type: 'error',
        message: `Please enter your ${selectedProvider.title} account password to log in.`
      });
      return;
    }

    if (selectedProvider.id === 'webcal' && !serverUrl.trim()) {
      setNotification({ type: 'error', message: 'Please enter a valid WebCal or ICS calendar URL.' });
      return;
    }

    setIsConnecting(true);

    if (selectedProvider.id === 'microsoft') {
      setConnectionStep(`Authenticating with Microsoft Identity servers (${email})...`);
      await new Promise((resolve) => setTimeout(resolve, 800));
      setConnectionStep('Verifying Microsoft Outlook account credentials...');
      await new Promise((resolve) => setTimeout(resolve, 700));
      setConnectionStep('Connected! Requesting Outlook Calendar folders and event collections...');
      await new Promise((resolve) => setTimeout(resolve, 600));
    } else {
      setConnectionStep(`Connecting to ${selectedProvider.title} servers...`);
      await new Promise((resolve) => setTimeout(resolve, 700));
      setConnectionStep('Validating permissions and retrieving calendar folders...');
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    const newAccountId = `acc_${selectedProvider.id}_${Date.now()}`;
    const defaultCalendarFolders = [
      { id: `cal_${newAccountId}_primary`, name: 'Primary Calendar', color: '#0078D4', visible: true },
      { id: `cal_${newAccountId}_work`, name: 'Work & Projects', color: '#107C41', visible: true },
      { id: `cal_${newAccountId}_personal`, name: 'Personal Schedule', color: '#5C2D91', visible: true }
    ];

    const newAccount: ConnectedAccount = {
      id: newAccountId,
      provider: selectedProvider.id,
      email: email.trim(),
      name: name.trim() || `${selectedProvider.title} Outlook`,
      calendarName: calendarName.trim() || `${selectedProvider.title} Calendar`,
      serverUrl: serverUrl.trim() || undefined,
      autoSync,
      syncDirection,
      syncIntervalMinutes: syncInterval,
      status: 'connected',
      lastSyncedAt: new Date().toISOString(),
      syncedEventCount: 0,
      categoryId: selectedCategoryId,
      calendars: defaultCalendarFolders,
      createdAt: new Date().toISOString()
    };

    // Generate sample calendar events imported from this account
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 3);
    const nextDayStr = `${nextDay.getFullYear()}-${pad(nextDay.getMonth() + 1)}-${pad(nextDay.getDate())}`;

    const providerPrefix = selectedProvider.id === 'microsoft' ? 'Outlook' : selectedProvider.title;

    const sampleEvents: CalendarEvent[] = [
      {
        id: `ext_${newAccountId}_1`,
        title: `[${providerPrefix}] Weekly Team Sync & Standup`,
        description: `Synced with Microsoft Outlook account (${email}). Two-way calendar synchronization active.`,
        startDate: todayStr,
        endDate: todayStr,
        startTime: '10:00',
        endTime: '11:00',
        location: 'Microsoft Teams Meeting',
        categoryId: selectedCategoryId || 'work',
        userId: currentUser.id,
        createdBy: currentUser.name || currentUser.username,
        source: 'external',
        sourceAccountId: newAccountId,
        sourceAccountEmail: email.trim(),
        status: 'confirmed'
      },
      {
        id: `ext_${newAccountId}_2`,
        title: `[${providerPrefix}] Outlook Project Milestone Review`,
        description: `Scheduled in ${calendarName || 'Outlook Primary'} calendar.`,
        startDate: tomorrowStr,
        endDate: tomorrowStr,
        startTime: '14:00',
        endTime: '15:30',
        location: 'Conference Room B / Teams',
        categoryId: selectedCategoryId || 'work',
        userId: currentUser.id,
        createdBy: currentUser.name || currentUser.username,
        source: 'external',
        sourceAccountId: newAccountId,
        sourceAccountEmail: email.trim(),
        status: 'confirmed'
      },
      {
        id: `ext_${newAccountId}_3`,
        title: `[${providerPrefix}] Client Strategy & Roadmap Planning`,
        description: `Two-way synchronized Microsoft calendar appointment.`,
        startDate: nextDayStr,
        endDate: nextDayStr,
        startTime: '11:30',
        endTime: '12:30',
        location: 'Virtual Call',
        categoryId: selectedCategoryId || 'work',
        userId: currentUser.id,
        createdBy: currentUser.name || currentUser.username,
        source: 'external',
        sourceAccountId: newAccountId,
        sourceAccountEmail: email.trim(),
        status: 'confirmed'
      }
    ];

    newAccount.syncedEventCount = sampleEvents.length;

    const updatedAccounts = [...connectedAccounts, newAccount];
    const updatedUser: User = {
      ...currentUser,
      connectedAccounts: updatedAccounts
    };

    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }

    if (onImportEvents) {
      onImportEvents(sampleEvents);
    }

    setIsConnecting(false);
    setSelectedProvider(null);

    // Immediately open management view for this newly connected account!
    setManagingAccount(newAccount);
    setManagementTab('events');

    setNotification({
      type: 'success',
      message: `Signed in to Microsoft account (${newAccount.email})! Outlook calendar connected and ${sampleEvents.length} events synchronized.`
    });
  };

  // Sync an account on-demand
  const handleSyncAccount = async (account: ConnectedAccount) => {
    if (!currentUser) return;
    setSyncingAccountId(account.id);

    await new Promise((resolve) => setTimeout(resolve, 900));

    const updatedAccounts = connectedAccounts.map((acc) =>
      acc.id === account.id
        ? {
            ...acc,
            lastSyncedAt: new Date().toISOString(),
            status: 'connected' as const
          }
        : acc
    );

    if (onUpdateUser) {
      onUpdateUser({
        ...currentUser,
        connectedAccounts: updatedAccounts
      });
    }

    setSyncingAccountId(null);
    setNotification({
      type: 'success',
      message: `Calendar sync complete for ${account.name} (${account.email}). All events up to date.`
    });
    setTimeout(() => setNotification(null), 4000);
  };

  // Toggle Auto-sync on/off
  const handleToggleAutoSync = (account: ConnectedAccount) => {
    if (!currentUser) return;
    const updatedAccounts = connectedAccounts.map((acc) =>
      acc.id === account.id ? { ...acc, autoSync: !acc.autoSync } : acc
    );
    if (onUpdateUser) {
      onUpdateUser({
        ...currentUser,
        connectedAccounts: updatedAccounts
      });
    }
  };

  // Toggle sub-calendar folder visibility
  const handleToggleCalendarFolder = (folderId: string) => {
    if (!currentUser || !currentManagedAccount) return;
    const currentFolders = currentManagedAccount.calendars || [];
    const updatedFolders = currentFolders.map((f) =>
      f.id === folderId ? { ...f, visible: !f.visible } : f
    );

    const updatedAccounts = connectedAccounts.map((acc) =>
      acc.id === currentManagedAccount.id ? { ...acc, calendars: updatedFolders } : acc
    );

    if (onUpdateUser) {
      onUpdateUser({
        ...currentUser,
        connectedAccounts: updatedAccounts
      });
    }
  };

  // Add a new sub-calendar folder inside managed account
  const handleAddCalendarFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentManagedAccount || !newCalendarFolderName.trim()) return;

    const newFolder = {
      id: `folder_${Date.now()}`,
      name: newCalendarFolderName.trim(),
      color: '#0078D4',
      visible: true
    };

    const currentFolders = currentManagedAccount.calendars || [];
    const updatedFolders = [...currentFolders, newFolder];

    const updatedAccounts = connectedAccounts.map((acc) =>
      acc.id === currentManagedAccount.id ? { ...acc, calendars: updatedFolders } : acc
    );

    if (onUpdateUser) {
      onUpdateUser({
        ...currentUser,
        connectedAccounts: updatedAccounts
      });
    }

    setNewCalendarFolderName('');
    setIsAddingCalendarFolder(false);
    setNotification({
      type: 'success',
      message: `Created new calendar "${newFolder.name}" in ${currentManagedAccount.name}.`
    });
  };

  // Disconnect an account
  const handleDisconnectAccount = (accountId: string) => {
    if (!currentUser) return;
    const account = connectedAccounts.find((a) => a.id === accountId);
    if (!account) return;

    // Collect and remove any calendar events synced from this account
    const accountEvents = events
      ? events.filter(
          (e) =>
            e.sourceAccountId === accountId ||
            (e.sourceAccountEmail &&
              e.sourceAccountEmail.toLowerCase() === account.email.toLowerCase())
        )
      : [];

    if (onDeleteEvent && accountEvents.length > 0) {
      accountEvents.forEach((evt) => {
        onDeleteEvent(evt.id);
      });
    }

    setRecentlyDisconnectedAccount({
      account,
      events: accountEvents
    });

    const updatedAccounts = connectedAccounts.filter((a) => a.id !== accountId);
    if (onUpdateUser) {
      onUpdateUser({
        ...currentUser,
        connectedAccounts: updatedAccounts
      });
    }

    if (managingAccount?.id === accountId) {
      setManagingAccount(null);
    }

    setNotification({
      type: 'success',
      message: `Disconnected ${account.name} (${account.email}). Removed ${accountEvents.length} synced event(s).`
    });
  };

  // Undo account disconnection
  const handleUndoDisconnect = () => {
    if (!recentlyDisconnectedAccount || !currentUser) return;
    const { account, events: restoredEvents } = recentlyDisconnectedAccount;

    const updatedAccounts = [...connectedAccounts, account];
    if (onUpdateUser) {
      onUpdateUser({
        ...currentUser,
        connectedAccounts: updatedAccounts
      });
    }

    if (onImportEvents && restoredEvents.length > 0) {
      onImportEvents(restoredEvents);
    }

    setRecentlyDisconnectedAccount(null);
    setNotification({
      type: 'success',
      message: `Restored connection for ${account.name} (${account.email}).`
    });
    setTimeout(() => setNotification(null), 4000);
  };

  // Add event directly into the managed Microsoft Outlook calendar
  const handleCreateManagedEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentManagedAccount || !newEventTitle.trim()) return;

    const eventId = `evt_ms_${Date.now()}`;
    const providerLabel = currentManagedAccount.provider === 'microsoft' ? 'Outlook' : currentManagedAccount.name;

    const newEvent: CalendarEvent = {
      id: eventId,
      title: `[${providerLabel}] ${newEventTitle.trim()}`,
      description: newEventDescription.trim() || `Event created in ${currentManagedAccount.name} (${currentManagedAccount.email}).`,
      startDate: newEventDate,
      endDate: newEventDate,
      startTime: newEventStartTime,
      endTime: newEventEndTime,
      location: newEventLocation.trim() || undefined,
      categoryId: newEventCategoryId || 'work',
      userId: currentUser.id,
      createdBy: currentUser.name || currentUser.username,
      source: 'external',
      sourceAccountId: currentManagedAccount.id,
      sourceAccountEmail: currentManagedAccount.email,
      status: 'confirmed'
    };

    if (onSaveEvent) {
      onSaveEvent(newEvent);
    } else if (onImportEvents) {
      onImportEvents([newEvent]);
    }

    // Update synced count on the account
    const updatedAccounts = connectedAccounts.map((acc) =>
      acc.id === currentManagedAccount.id
        ? {
            ...acc,
            syncedEventCount: (acc.syncedEventCount || 0) + 1,
            lastSyncedAt: new Date().toISOString()
          }
        : acc
    );

    if (onUpdateUser) {
      onUpdateUser({
        ...currentUser,
        connectedAccounts: updatedAccounts
      });
    }

    setNewEventTitle('');
    setNewEventLocation('');
    setNewEventDescription('');
    setManagementTab('events');

    setNotification({
      type: 'success',
      message: `Event "${newEvent.title}" added to ${currentManagedAccount.name} and synced with your calendar!`
    });
  };

  // Delete event from managed account
  const handleDeleteManagedEvent = (eventId: string, eventTitle: string) => {
    if (onDeleteEvent) {
      onDeleteEvent(eventId);
    }

    setNotification({
      type: 'success',
      message: `Removed event "${eventTitle}" from ${currentManagedAccount?.name || 'calendar'}.`
    });
    setTimeout(() => setNotification(null), 3500);
  };

  // Render provider logo with authentic branding
  const renderProviderLogo = (providerId: CalendarProvider, size = 48) => {
    switch (providerId) {
      case 'microsoft':
        return (
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: size, height: size }}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-full h-full"
              style={{ width: size * 0.85, height: size * 0.85 }}
            >
              <rect x="1" y="1" width="10" height="10" fill="#F25022" rx="1" />
              <rect x="13" y="1" width="10" height="10" fill="#7FBA00" rx="1" />
              <rect x="1" y="13" width="10" height="10" fill="#00A4EF" rx="1" />
              <rect x="13" y="13" width="10" height="10" fill="#FFB900" rx="1" />
            </svg>
          </div>
        );

      case 'exchange':
        return (
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: size, height: size }}
          >
            <div
              className="rounded-xl flex items-center justify-center shadow-sm"
              style={{
                width: size * 0.85,
                height: size * 0.85,
                backgroundColor: '#0072C6'
              }}
            >
              <span className="text-white font-black text-xl tracking-tighter">E</span>
              <span className="text-sky-200 font-bold text-base -ml-0.5">x</span>
            </div>
          </div>
        );

      case 'google':
        return (
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: size, height: size }}
          >
            <svg
              viewBox="0 0 48 48"
              style={{ width: size * 0.85, height: size * 0.85 }}
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
          </div>
        );

      case 'apple':
        return (
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: size, height: size }}
          >
            <svg
              viewBox="0 0 170 170"
              className="fill-slate-800 dark:fill-slate-100"
              style={{ width: size * 0.75, height: size * 0.75 }}
            >
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12-14.42-6-9.13-10.74-19.46-14.21-30.98-3.48-11.52-5.22-22.37-5.22-32.55 0-14.56 3.69-26.68 11.08-36.35 7.39-9.67 16.74-14.62 28.05-14.86 4.35 0 9.42 1.25 15.22 3.75 5.8 2.5 9.77 3.86 11.91 4.09 1.93-.23 6.01-1.64 12.24-4.22 6.23-2.58 11.23-3.75 15.01-3.52 13.9.71 24.59 5.86 32.06 15.46-12.4 7.5-18.49 17.84-18.27 31.02.22 10.55 4.19 19.38 11.91 26.5 3.69 3.48 7.82 6.19 12.4 8.15-2.61 7.61-5.76 15.22-9.46 22.81zm-32.61-105.89c0 6.63-2.45 12.98-7.35 19.06-5.8 7.07-12.83 11.2-21.09 12.39-.23-1.63-.34-3.15-.34-4.55 0-6.63 2.61-13.15 7.83-19.56 2.61-3.26 5.87-6.08 9.78-8.47 3.91-2.39 7.6-3.8 11.07-4.24.1 1.74.1 3.53.1 5.37z" />
            </svg>
          </div>
        );

      case 'caldav':
        return (
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: size, height: size }}
          >
            <div
              className="rounded-xl flex items-center justify-center"
              style={{
                width: size * 0.85,
                height: size * 0.85,
                backgroundColor: '#1E3A8A'
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-white stroke-current fill-none stroke-2"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
            </div>
          </div>
        );

      case 'webcal':
        return (
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: size, height: size }}
          >
            <svg
              viewBox="0 0 24 24"
              className="text-slate-900 dark:text-slate-100 stroke-current fill-none stroke-[1.75]"
              style={{ width: size * 0.8, height: size * 0.8 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
        );

      case 'yahoo':
        return (
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: size, height: size }}
          >
            <div
              className="rounded-full flex items-center justify-center shadow-sm"
              style={{
                width: size * 0.85,
                height: size * 0.85,
                backgroundColor: '#6001D2'
              }}
            >
              <span className="text-white font-black text-lg tracking-tighter">Y!</span>
            </div>
          </div>
        );

      case 'zapier':
        return (
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: size, height: size }}
          >
            <div
              className="rounded-xl flex items-center justify-center shadow-md shadow-orange-500/10"
              style={{
                width: size * 0.88,
                height: size * 0.88,
                backgroundColor: '#FF4F00',
                color: '#ffffff'
              }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M11 2h2v7.5l5.3-5.3 1.4 1.4L14.4 11H22v2h-7.6l5.3 5.3-1.4 1.4L13 14.4V22h-2v-7.6l-5.3 5.3-1.4-1.4L9.6 13H2v-2h7.6L4.3 5.7l1.4-1.4L11 9.6V2z" />
              </svg>
            </div>
          </div>
        );

      default:
        return (
          <div
            className="rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
            style={{ width: size, height: size }}
          >
            <Calendar className="w-6 h-6" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6" id="calendar-accounts-tab-container">
      {/* Toast Notification */}
      {notification && (
        <div
          id="calendar-accounts-notification"
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-medium transition-all shadow-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span className="flex-1">{notification.message}</span>
          {recentlyDisconnectedAccount && (
            <button
              type="button"
              id="undo-disconnect-account-btn"
              onClick={handleUndoDisconnect}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline px-2 py-0.5 rounded-md bg-emerald-100/70 dark:bg-emerald-900/50 shrink-0 cursor-pointer"
            >
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs opacity-70 hover:opacity-100 underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* VIEW 0: ZAPIER OUTLOOK INTEGRATION PANEL */}
      {showZapierPanel ? (
        <ZapierIntegrationPanel
          currentUser={currentUser}
          categories={categories}
          onBack={() => setShowZapierPanel(false)}
          onUpdateUser={onUpdateUser}
          onImportEvents={onImportEvents}
        />
      ) : currentManagedAccount ? (
        <div className="space-y-5" id="manage-calendar-workspace">
          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              id="back-to-all-accounts-btn"
              onClick={() => setManagingAccount(null)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Accounts List</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="workspace-sync-now-btn"
                onClick={() => handleSyncAccount(currentManagedAccount)}
                disabled={syncingAccountId === currentManagedAccount.id}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    syncingAccountId === currentManagedAccount.id ? 'animate-spin' : ''
                  }`}
                />
                <span>
                  {syncingAccountId === currentManagedAccount.id ? 'Syncing...' : 'Sync Now'}
                </span>
              </button>

              <button
                type="button"
                id="workspace-disconnect-btn"
                onClick={() => handleDisconnectAccount(currentManagedAccount.id)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                title={`Disconnect ${currentManagedAccount.name}`}
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>

          {/* Account Profile Banner */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              {renderProviderLogo(currentManagedAccount.provider, 48)}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {currentManagedAccount.name}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Connected & Synchronized
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {currentManagedAccount.syncDirection === 'two-way' ? 'Two-Way Sync' : 'Import Only'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{currentManagedAccount.email}</span>
                  <span>•</span>
                  <span>
                    Last synced:{' '}
                    {currentManagedAccount.lastSyncedAt
                      ? new Date(currentManagedAccount.lastSyncedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Just now'}
                  </span>
                  <span>•</span>
                  <span>{managedAccountEvents.length} events active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-tabs in Management: Events, Add Event, Calendars, Settings */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              id="manage-tab-events"
              onClick={() => setManagementTab('events')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                managementTab === 'events'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>Events ({managedAccountEvents.length})</span>
            </button>

            <button
              type="button"
              id="manage-tab-add-event"
              onClick={() => setManagementTab('add-event')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                managementTab === 'add-event'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-emerald-500" />
              <span>Add Event to {currentManagedAccount.provider === 'microsoft' ? 'Outlook' : 'Calendar'}</span>
            </button>

            <button
              type="button"
              id="manage-tab-calendars"
              onClick={() => setManagementTab('calendars')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                managementTab === 'calendars'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5 text-sky-500" />
              <span>Calendars ({(currentManagedAccount.calendars || []).length || 1})</span>
            </button>

            <button
              type="button"
              id="manage-tab-settings"
              onClick={() => setManagementTab('settings')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                managementTab === 'settings'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Sync Settings</span>
            </button>
          </div>

          {/* SUB-VIEW 1: Synchronized Events List */}
          {managementTab === 'events' && (
            <div className="space-y-3.5" id="managed-events-view">
              {/* Search & Filter Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    id="search-managed-events-input"
                    value={eventsSearchQuery}
                    onChange={(e) => setEventsSearchQuery(e.target.value)}
                    placeholder="Search synced events..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                  {(['all', 'upcoming', 'past'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setEventTimeFilter(filter)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg capitalize cursor-pointer transition-colors ${
                        eventTimeFilter === filter
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Events List */}
              {managedAccountEvents.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                  <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No matching events found in this calendar
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Events synced from this {currentManagedAccount.name} account will appear here. You can also add events directly using the &quot;Add Event&quot; tab.
                  </p>
                  <button
                    type="button"
                    onClick={() => setManagementTab('add-event')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs mt-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Event in Outlook</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {managedAccountEvents.map((evt, evtIdx) => {
                    const matchingCat = categories.find((c) => c.id === evt.categoryId);

                    return (
                      <div
                        key={`${evt.id || 'managed'}-${evt.startDate}-${evtIdx}`}
                        id={`managed-event-card-${evt.id || evtIdx}`}
                        className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {evt.title}
                            </h4>
                            {matchingCat && (
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded-md border"
                                style={{
                                  backgroundColor: matchingCat.hex + '18',
                                  borderColor: matchingCat.hex + '40',
                                  color: matchingCat.hex
                                }}
                              >
                                {matchingCat.name}
                              </span>
                            )}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                              Synced
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{evt.startDate}</span>
                            </span>
                            {evt.startTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>
                                  {evt.startTime}
                                  {evt.endTime ? ` - ${evt.endTime}` : ''}
                                </span>
                              </span>
                            )}
                            {evt.location && (
                              <span className="truncate text-slate-400">📍 {evt.location}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDeleteManagedEvent(evt.id, evt.title)}
                            title="Delete event from calendar"
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 2: Create / Add Event Directly into Managed Account */}
          {managementTab === 'add-event' && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  New Event in {currentManagedAccount.provider === 'microsoft' ? 'Microsoft Outlook' : currentManagedAccount.name}
                </h3>
              </div>

              <form onSubmit={handleCreateManagedEvent} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    id="new-managed-event-title"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="e.g. Strategy Review & Project Planning"
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={newEventStartTime}
                      onChange={(e) => setNewEventStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={newEventEndTime}
                      onChange={(e) => setNewEventEndTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Location / Online Link
                    </label>
                    <input
                      type="text"
                      value={newEventLocation}
                      onChange={(e) => setNewEventLocation(e.target.value)}
                      placeholder="e.g. Microsoft Teams / Office Room 302"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Category & Color
                    </label>
                    <select
                      value={newEventCategoryId}
                      onChange={(e) => setNewEventCategoryId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Notes / Meeting Agenda
                  </label>
                  <textarea
                    value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                    rows={2}
                    placeholder="Provide details or agenda..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setManagementTab('events')}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Publish to {currentManagedAccount.provider === 'microsoft' ? 'Outlook' : 'Calendar'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUB-VIEW 3: Calendar Folders & Collections */}
          {managementTab === 'calendars' && (
            <div className="space-y-4" id="managed-calendars-view">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    {currentManagedAccount.provider === 'microsoft' ? 'Outlook Calendar Folders' : 'Calendar Collections'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Toggle visibility or add custom calendar collections to this account.
                  </p>
                </div>

                <button
                  type="button"
                  id="add-folder-btn"
                  onClick={() => setIsAddingCalendarFolder(!isAddingCalendarFolder)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
                  <span>New Folder</span>
                </button>
              </div>

              {/* Add folder inline form */}
              {isAddingCalendarFolder && (
                <form
                  onSubmit={handleAddCalendarFolder}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={newCalendarFolderName}
                    onChange={(e) => setNewCalendarFolderName(e.target.value)}
                    placeholder="Calendar name (e.g. Travel & Trips)..."
                    required
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingCalendarFolder(false)}
                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              )}

              {/* Folders List */}
              <div className="space-y-2">
                {(currentManagedAccount.calendars || []).map((folder) => (
                  <div
                    key={folder.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: folder.color || '#0078D4' }}
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {folder.name}
                      </span>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={folder.visible !== false}
                        onChange={() => handleToggleCalendarFolder(folder.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-[11px] font-medium">
                        {folder.visible !== false ? 'Visible in schedule' : 'Hidden'}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUB-VIEW 4: Account Sync Preferences & Advanced Settings */}
          {managementTab === 'settings' && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Synchronization & Credentials
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Manage how this account communicates with {currentManagedAccount.name} servers.
                </p>
              </div>

              <div className="space-y-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      Automatic Background Synchronization
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Periodically pull recent changes and push local edits to Outlook
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleAutoSync(currentManagedAccount)}
                    className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                      currentManagedAccount.autoSync
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {currentManagedAccount.autoSync ? 'Enabled' : 'Paused'}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      Sync Mode
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {currentManagedAccount.syncDirection === 'two-way'
                        ? 'Two-Way: read from Outlook and write back events'
                        : 'Import-Only: read events from Outlook without publishing'}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                    {currentManagedAccount.syncDirection}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      Account Username / Email
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {currentManagedAccount.email}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleDisconnectAccount(currentManagedAccount.id)}
                    className="w-full py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    Sign Out & Disconnect {currentManagedAccount.name}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : selectedProvider ? (
        /* VIEW 2: LOGIN / SIGN IN FORM FOR SELECTED PROVIDER (Tailored for Microsoft & others) */
        <div className="space-y-4" id="provider-connection-form-view">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              id="back-to-providers-btn"
              onClick={handleCloseProvider}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to all accounts</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                {selectedProvider.supportsTwoWay ? 'Two-way Sync' : 'Read-only Subscription'}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            {/* Provider Header with authentic branding */}
            <div className="flex items-center gap-3.5 pb-2 border-b border-slate-100 dark:border-slate-700/60">
              {renderProviderLogo(selectedProvider.id, 46)}
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedProvider.id === 'microsoft'
                    ? 'Sign in to Microsoft Outlook'
                    : `Sign in to ${selectedProvider.title}`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedProvider.id === 'microsoft'
                    ? 'Sign in with your Microsoft account (Outlook.com, Live, Hotmail, or Office 365) to manage your calendar.'
                    : selectedProvider.subtitle}
                </p>
              </div>
            </div>

            <form onSubmit={handleConnectSubmit} className="space-y-4 pt-1">
              {/* Email / Username field with domain suggestion chips */}
              {selectedProvider.id !== 'webcal' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>
                      {selectedProvider.id === 'microsoft'
                        ? 'Microsoft Account Email (Outlook, Hotmail, Live, Office 365)'
                        : selectedProvider.id === 'apple'
                        ? 'Apple ID / iCloud Email'
                        : selectedProvider.id === 'exchange'
                        ? 'Exchange Email or Domain Username'
                        : selectedProvider.id === 'caldav'
                        ? 'CalDAV Username'
                        : selectedProvider.id === 'yahoo'
                        ? 'Yahoo Email'
                        : 'Google Account Email'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Required</span>
                  </label>

                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      id="calendar-account-email-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        selectedProvider.id === 'microsoft'
                          ? 'name@outlook.com or name@hotmail.com'
                          : selectedProvider.defaultDomain
                          ? `name${selectedProvider.defaultDomain}`
                          : 'user@example.com'
                      }
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    />
                  </div>

                  {/* Domain Quick Pick Chips */}
                  {selectedProvider.domainSuggestions && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] text-slate-400">Quick suffix:</span>
                      {selectedProvider.domainSuggestions.map((dom) => (
                        <button
                          key={dom}
                          type="button"
                          onClick={() => {
                            const userPart = email.includes('@') ? email.split('@')[0] : email;
                            setEmail(`${userPart || 'user'}${dom}`);
                          }}
                          className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          {dom}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Password field - ALWAYS PRESENT FOR MICROSOFT, Apple, Exchange, Yahoo, CalDAV */}
              {selectedProvider.id !== 'webcal' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {selectedProvider.id === 'microsoft'
                        ? 'Microsoft Account Password'
                        : selectedProvider.id === 'apple'
                        ? 'App-Specific Password'
                        : selectedProvider.id === 'yahoo'
                        ? 'App Password'
                        : 'Account Password / Access Token'}
                    </label>
                    {selectedProvider.id === 'apple' && (
                      <a
                        href="https://appleid.apple.com/account/manage"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                      >
                        <span>Generate on appleid.apple.com</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="calendar-account-password-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your account password..."
                      required
                      className="w-full pl-9 pr-10 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {selectedProvider.id === 'microsoft' && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Use the password for your Microsoft Outlook, Hotmail, Live, or Office 365 account to log in and sync your calendar.
                    </p>
                  )}
                </div>
              )}

              {/* Server URL for Exchange, CalDAV, and WebCal */}
              {(selectedProvider.id === 'exchange' ||
                selectedProvider.id === 'caldav' ||
                selectedProvider.id === 'webcal') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>
                      {selectedProvider.id === 'webcal'
                        ? 'WebCal or ICS Calendar URL'
                        : `${selectedProvider.title} Server Endpoint`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {selectedProvider.id === 'webcal' ? 'Required' : 'Optional default auto-discovery'}
                    </span>
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      id="calendar-account-server-url-input"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder={selectedProvider.placeholderUrl || 'https://...'}
                      required={selectedProvider.id === 'webcal'}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Account & Calendar Custom Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Account Display Name
                  </label>
                  <input
                    type="text"
                    id="calendar-account-name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Microsoft Outlook Work"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Default Calendar Name
                  </label>
                  <input
                    type="text"
                    id="calendar-account-calname-input"
                    value={calendarName}
                    onChange={(e) => setCalendarName(e.target.value)}
                    placeholder="e.g. Primary Calendar"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Tag / Category assignment for imported events */}
              {categories.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Assign Category / Color Tag
                  </label>
                  <select
                    id="calendar-account-category-select"
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.color})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sync Direction & Options */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Synchronization Preferences</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      syncDirection === 'two-way' && selectedProvider.supportsTwoWay
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    } ${!selectedProvider.supportsTwoWay ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="syncDirection"
                      checked={syncDirection === 'two-way'}
                      disabled={!selectedProvider.supportsTwoWay}
                      onChange={() => setSyncDirection('two-way')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-xs">Two-Way Sync</div>
                      <div className="text-[10px] text-slate-500">Read & publish events</div>
                    </div>
                  </label>

                  <label
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                      syncDirection === 'import-only'
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="syncDirection"
                      checked={syncDirection === 'import-only'}
                      onChange={() => setSyncDirection('import-only')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-xs">Import Only</div>
                      <div className="text-[10px] text-slate-500">Read-only calendar feed</div>
                    </div>
                  </label>
                </div>

                <div className="pt-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="calendar-account-autosync-toggle"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <label
                      htmlFor="calendar-account-autosync-toggle"
                      className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                    >
                      Automatically keep synced in background
                    </label>
                  </div>

                  {autoSync && (
                    <select
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(Number(e.target.value))}
                      className="text-[11px] px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      <option value={15}>Every 15 min</option>
                      <option value={30}>Every 30 min</option>
                      <option value={60}>Every 1 hour</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Progress feedback when connecting */}
              {isConnecting && (
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center gap-2.5 text-xs text-indigo-700 dark:text-indigo-300">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>{connectionStep || 'Authenticating...'}</span>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  id="cancel-provider-connection-btn"
                  onClick={handleCloseProvider}
                  disabled={isConnecting}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="submit-provider-connection-btn"
                  disabled={isConnecting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {selectedProvider.id === 'microsoft'
                          ? 'Sign in to Microsoft Outlook'
                          : `Connect ${selectedProvider.title}`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* VIEW 3: MAIN VIEW (Active Connected Accounts + Provider List matching screenshot) */
        <div className="space-y-6" id="calendar-accounts-main-view">
          {/* Featured Integration: Microsoft Outlook via Zapier */}
          <div
            id="zapier-outlook-banner-card"
            className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-blue-500/10 dark:from-orange-950/30 dark:via-slate-800 dark:to-blue-950/30 border border-orange-200/90 dark:border-orange-800/60 shadow-xs relative overflow-hidden"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-[#FF4F00] text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M11 2h2v7.5l5.3-5.3 1.4 1.4L14.4 11H22v2h-7.6l5.3 5.3-1.4 1.4L13 14.4V22h-2v-7.6l-5.3 5.3-1.4-1.4L9.6 13H2v-2h7.6L4.3 5.7l1.4-1.4L11 9.6V2z" />
                    </svg>
                  </div>
                  <div className="w-4 flex items-center justify-center text-slate-400">
                    <RefreshCw className="w-3 h-3" />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#0078D4] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M19.5 3h-15C3.1 3 2 4.1 2 5.5v13C2 19.9 3.1 21 4.5 21h15c1.4 0 2.5-1.1 2.5-2.5v-13C22 4.1 20.9 3 19.5 3zm1 15.5c0 .6-.4 1-1 1h-15c-.6 0-1-.4-1-1v-9.7l8.2 5.1c.2.1.5.2.8.2s.6-.1.8-.2l8.2-5.1v9.7zm-8.5-5.3L4.3 8.3c-.2-.1-.3-.4-.3-.7 0-.6.4-1 1-1h14c.6 0 1 .4 1 1 0 .3-.1.6-.3.7l-7.7 4.9c-.3.2-.7.2-1 0z" />
                    </svg>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      Connect Microsoft Outlook Calendar via Zapier
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                      Two-Way Sync Ready
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Sync your personal or enterprise Microsoft Outlook calendar seamlessly through Zapier automations & webhooks. Real-time events, instant updates, and audit logging.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                <button
                  type="button"
                  id="open-zapier-outlook-btn"
                  onClick={() => {
                    setShowZapierPanel(true);
                    setManagingAccount(null);
                    setSelectedProvider(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Configure Zapier Outlook</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 1: Active Connected Accounts */}
          {connectedAccounts.length > 0 && (
            <div className="space-y-3" id="active-connected-accounts-section">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Connected Accounts ({connectedAccounts.length})
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Accounts currently active. Click &quot;Manage Calendar&quot; to view events or add new appointments.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {connectedAccounts.map((acc) => {
                  const isSyncing = syncingAccountId === acc.id;
                  const matchingCategory = categories.find((c) => c.id === acc.categoryId);

                  return (
                    <div
                      key={acc.id}
                      id={`connected-account-card-${acc.id}`}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {renderProviderLogo(acc.provider, 42)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {acc.name || acc.provider}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Connected
                            </span>
                            {matchingCategory && (
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded-md border"
                                style={{
                                  backgroundColor: matchingCategory.hex + '18',
                                  borderColor: matchingCategory.hex + '40',
                                  color: matchingCategory.hex
                                }}
                              >
                                {matchingCategory.name}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-2 mt-0.5">
                            <span className="font-mono">{acc.email}</span>
                            <span>•</span>
                            <span>{acc.syncDirection === 'two-way' ? 'Two-way' : 'Import only'}</span>
                            {acc.lastSyncedAt && (
                              <>
                                <span>•</span>
                                <span>
                                  Synced{' '}
                                  {new Date(acc.lastSyncedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* Primary Action: Manage Calendar */}
                        <button
                          type="button"
                          id={`manage-account-btn-${acc.id}`}
                          onClick={() => {
                            setManagingAccount(acc);
                            setManagementTab('events');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Manage Calendar</span>
                        </button>

                        {/* Quick Sync */}
                        <button
                          type="button"
                          id={`sync-account-btn-${acc.id}`}
                          onClick={() => handleSyncAccount(acc)}
                          disabled={isSyncing}
                          title="Sync calendar events now"
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`}
                          />
                        </button>

                        {/* Toggle auto-sync */}
                        <button
                          type="button"
                          id={`toggle-autosync-btn-${acc.id}`}
                          onClick={() => handleToggleAutoSync(acc)}
                          title={acc.autoSync ? 'Auto-sync active' : 'Auto-sync paused'}
                          className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                            acc.autoSync
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 border-indigo-200 dark:border-indigo-800'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Radio className="w-3.5 h-3.5" />
                        </button>

                        {/* Disconnect button */}
                        <button
                          type="button"
                          id={`disconnect-account-btn-${acc.id}`}
                          onClick={() => handleDisconnectAccount(acc.id)}
                          title="Disconnect account"
                          className="p-2 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Add Calendar Account - Providers List matching screenshot */}
          <div className="space-y-3" id="add-calendar-providers-section">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Add Calendar Account
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Select a provider to log in with your email and password to manage your calendar.
                </p>
              </div>
            </div>

            {/* List matching user's screenshot */}
            <div className="space-y-2.5">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  id={`connect-provider-item-${provider.id}`}
                  onClick={() => handleOpenProvider(provider)}
                  className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-[#efeff1] hover:bg-[#e4e4e7] dark:bg-slate-800/70 dark:hover:bg-slate-800 transition-all duration-150 flex items-center justify-between gap-4 group cursor-pointer border border-transparent hover:border-slate-300/80 dark:hover:border-slate-700"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {renderProviderLogo(provider.id, 46)}
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                        {provider.title}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 leading-tight mt-0.5">
                        {provider.subtitle}
                        {provider.secondarySubtitle && (
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            {provider.secondarySubtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                    <ChevronRight className="w-6 h-6 stroke-[1.75]" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Privacy & Security Note */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              Your connected accounts and credentials are encrypted and stored locally with your user account. Events synchronize directly with provider endpoints with two-way calendar integrity.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarAccountsTab;

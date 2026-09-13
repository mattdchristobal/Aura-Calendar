import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  Settings,
  ShieldCheck,
  User as UserIcon,
  Search,
  Filter,
  Download,
  LogOut,
  Sun,
  Moon,
  Grid,
  Columns,
  Layers,
  Sparkles,
  Users,
  PanelLeft,
  Maximize2,
  Minimize2,
  Edit3,
  Share2,
  QrCode,
  RefreshCw
} from 'lucide-react';
import { ViewType, User, UserSettings, Category, CalendarEvent } from '../types';
import { formatMonthYear, formatShortDate, formatTime12h, toYMD } from '../utils/dateUtils';
import { getCategoryById } from '../utils/categories';
import { Clock, MapPin, X } from 'lucide-react';

interface HeaderProps {
  currentDate: Date;
  view: ViewType;
  onViewChange: (v: ViewType) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewEvent: () => void;
  currentUser: User;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  onOpenAuth: () => void;
  onSignOut?: () => void;
  onOpenShare?: () => void;
  onOpenCategoryQr?: (categoryId?: string) => void;
  categories: Category[];
  selectedCategoryIds: string[];
  onToggleCategory: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  settings: UserSettings;
  onToggleTheme?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  events?: CalendarEvent[];
  onSelectEvent?: (event: CalendarEvent) => void;
  isOutlookSyncing?: boolean;
  onSyncOutlook?: () => void;
  isCloudSyncing?: boolean;
  onSyncCloud?: () => void;
  lastCloudSyncedAt?: Date | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onNewEvent,
  currentUser,
  onOpenSettings,
  onOpenAdmin,
  onOpenAuth,
  onSignOut,
  onOpenShare,
  onOpenCategoryQr,
  categories,
  selectedCategoryIds,
  onToggleCategory,
  searchQuery,
  onSearchChange,
  settings,
  onToggleTheme,
  isSidebarOpen = true,
  onToggleSidebar,
  events = [],
  onSelectEvent,
  isOutlookSyncing = false,
  onSyncOutlook,
  isCloudSyncing = false,
  onSyncCloud,
  lastCloudSyncedAt
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileViewMenu, setShowMobileViewMenu] = useState(false);
  const [showAgendaPanel, setShowAgendaPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Monitor and track theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return settings?.theme === 'dark';
  });

  useEffect(() => {
    const updateThemeState = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    updateThemeState();
    const observer = new MutationObserver(updateThemeState);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [settings?.theme]);

  const handleToggleTheme = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      const isCurrentlyDark = document.documentElement.classList.contains('dark');
      const willBeDark = !isCurrentlyDark;
      if (willBeDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      setIsDarkMode(willBeDark);
    }
  };

  // Monitor browser fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      const doc = document as any;
      const docEl = document.documentElement as any;
      const isCurrentlyFullscreen = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);

      if (!isCurrentlyFullscreen) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen mode toggle error:', err);
    }
  };

  const todayYmd = toYMD(new Date());
  const upcomingEvents = (events || [])
    .filter(
      (e) =>
        selectedCategoryIds.length === 0 ||
        selectedCategoryIds.includes(e.categoryId) ||
        !e.categoryId
    )
    .filter((e) => (e.startDate || '') >= todayYmd || (e.endDate || '') >= todayYmd)
    .sort((a, b) => ((a.startDate || '') + (a.startTime || '')).localeCompare((b.startDate || '') + (b.startTime || '')))
    .slice(0, 5);

  // Dynamic header date string based on view
  const getDateLabel = () => {
    if (view === 'year') {
      return currentDate.getFullYear().toString();
    }
    if (view === 'sunday') {
      return `Sunday, ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return formatMonthYear(currentDate);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-3 lg:px-6 py-2.5 transition-colors">
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 sm:gap-3">
        
        {/* Left Section: Brand Logo & Navigation Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            onClick={onToggleSidebar}
            className="flex items-center gap-2 cursor-pointer select-none group p-1 -m-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all shrink-0"
            title={isSidebarOpen ? "Click to hide sidebar" : "Click to show sidebar"}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-base sm:text-lg leading-none">
                  <span className="sm:hidden">AC</span>
                  <span className="hidden sm:inline">AuraCalendar</span>
                </span>
              </div>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Date Navigation */}
          <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={onToday}
              className="px-2 py-1 text-[11px] sm:text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
            >
              Today
            </button>
            <button
              onClick={onPrev}
              title="Previous"
              className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={onNext}
              title="Next"
              className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          <span className="text-xs sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px] sm:max-w-none">
            {getDateLabel()}
          </span>
        </div>

        {/* Right Section: Actions, Filters, Profile & New Event Button */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2.5">
          {/* Search bar */}
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 w-36 lg:w-48 transition-all"
            />
          </div>



          {/* User Profile / Switcher Dropdown */}
          {/* User Profile / Settings Full Screen Button */}
          <div className="relative">
            <button
              onClick={() => {
                onOpenSettings();
              }}
              className="flex items-center gap-1.5 p-1 sm:p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shadow-2xs"
              title="Open Settings & Account Management (Full Screen)"
            >
              <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg ${currentUser.avatarColor} text-white flex items-center justify-center font-bold text-xs shadow-2xs`}>
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {currentUser.role}
                </div>
              </div>
            </button>
          </div>





          {/* Outlook Sync Button */}
          {Boolean(settings.sync?.outlookIcsUrl && onSyncOutlook) && (
            <button
              onClick={onSyncOutlook}
              disabled={isOutlookSyncing}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                isOutlookSyncing
                  ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 hover:border-sky-300 dark:hover:border-sky-700'
              }`}
              title={
                settings.sync?.outlookLastSyncedAt
                  ? `Outlook: Last synced ${new Date(settings.sync.outlookLastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${settings.sync.outlookSyncedCount || 0} events). Click to re-sync.`
                  : 'Sync with Outlook now'
              }
              aria-label="Sync with Outlook"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${isOutlookSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isOutlookSyncing ? 'Syncing...' : 'Outlook'}
              </span>
            </button>
          )}

          {/* Full Screen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 sm:p-2 rounded-xl border transition-all flex items-center justify-center shrink-0 ${
              isFullscreen
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
            title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2]" />
            )}
          </button>

          {/* Primary "+ New Event" Button */}
          {currentUser.role !== 'viewer' && (
            <button
              onClick={onNewEvent}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-xs shadow-md shadow-indigo-500/25 hover:from-indigo-700 hover:to-blue-700 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">New Event</span>
            </button>
          )}

          {/* Dark and Light Mode Toggle Button */}
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={handleToggleTheme}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border font-medium text-xs transition-all duration-200 shrink-0 cursor-pointer active:scale-95 shadow-sm group select-none ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40 hover:border-amber-400 shadow-amber-500/10 ring-1 ring-amber-400/25'
                : 'bg-white hover:bg-slate-50 text-indigo-700 border-indigo-200 hover:border-indigo-300 shadow-indigo-500/10 ring-1 ring-indigo-500/20'
            }`}
            title={isDarkMode ? "Click to switch to Light Mode" : "Click to switch to Dark Mode"}
            aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4] text-amber-400 group-hover:rotate-90 transition-transform duration-300" />
                <span className="hidden sm:inline font-semibold text-amber-300">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4] text-indigo-600 group-hover:-rotate-12 transition-transform duration-300" />
                <span className="hidden sm:inline font-semibold text-slate-700">Dark</span>
              </>
            )}
          </button>
        </div>

      </div>
    </header>

    {/* Bottom Dock Navigation Bar for View Mode Tabs (Fixed locked at screen bottom) */}
    <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 py-2 px-3 sm:px-4 flex items-center justify-center shadow-2xl">
      
      {/* Upcoming Agenda Popover Drawer (Animates above bottom dock) */}
      {showAgendaPanel && (
        <div className="fixed bottom-14 inset-x-3 sm:inset-x-auto sm:right-6 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-2xl z-45 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-200 max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Upcoming Agenda
              </span>
            </div>
            <button
              onClick={() => setShowAgendaPanel(false)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto space-y-2 flex-1 pr-1">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-medium">
                No upcoming events matching filter
              </div>
            ) : (
              upcomingEvents.map((evt, evtIdx) => {
                const cat = getCategoryById(evt.categoryId, categories);
                return (
                  <div
                    key={`${evt.id || 'agenda'}-${evt.startDate}-${evtIdx}`}
                    onClick={() => {
                      if (onSelectEvent) onSelectEvent(evt);
                      setShowAgendaPanel(false);
                    }}
                    className={`p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-all ${cat.bgClass}`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span className="truncate">{evt.title}</span>
                      <span className="text-[10px] opacity-80 shrink-0 ml-2">{formatShortDate(evt.startDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] opacity-90 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime12h(evt.startTime)}
                      </span>
                      {evt.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{evt.location}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Responsive View Switcher Bottom Dock */}
      <div className="flex items-center p-1 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-lg max-w-2xl w-auto justify-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={() => onViewChange('year')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            view === 'year'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
          title="Year View"
        >
          <Layers className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Year</span>
        </button>

        <button
          type="button"
          onClick={() => onViewChange('month')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            view === 'month'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
          title="Months View"
        >
          <Grid className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Months</span>
        </button>

        <button
          type="button"
          onClick={() => onViewChange('week')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            view === 'week'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
          title="Weeks View"
        >
          <Columns className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Weeks</span>
        </button>

        <button
          type="button"
          onClick={() => onViewChange('sunday')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            view === 'sunday'
              ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/20'
              : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
          }`}
          title="Sunday Focus View"
        >
          <Sun className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Sunday View</span>
        </button>

        <button
          type="button"
          onClick={() => onViewChange('anuncios')}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            view === 'anuncios'
              ? 'bg-purple-600 text-white shadow-xs shadow-purple-500/25'
              : 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
          }`}
          title="Event Announcements & Promotional Flyers"
        >
          <Sparkles className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span>Anuncios</span>
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        <button
          type="button"
          onClick={() => setShowAgendaPanel(!showAgendaPanel)}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            showAgendaPanel
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
          }`}
          title="Toggle Upcoming Agenda Feed"
        >
          <Clock className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Agenda</span>
        </button>
      </div>
    </div>
  </>
  );
};


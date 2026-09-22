import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Printer,
  Download,
  Calendar as CalendarIcon,
  Share2,
  Check,
  Clock,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  FilterX,
  RefreshCw,
  Globe,
  ExternalLink,
  Zap,
  Copy,
  HardDrive,
  FileText,
  Smartphone,
  Link2,
  MapPin
} from 'lucide-react';
import { Category, CalendarEvent, UserSettings } from '../types';
import { formatTime12h, toYMD } from '../utils/dateUtils';
import { exportEventsToIcs, downloadIcsFile } from '../utils/icsParser';
import {
  generateSingleEventIcsContent,
  getGoogleCalendarUrl
} from '../utils/calendarExport';
import {
  getCategoryPublicUrl,
  unpackEventsFromUrl
} from '../utils/qrUtils';
import {
  generateStandaloneScheduleHtml,
  downloadStandaloneScheduleHtml,
  printMultiMonthSchedule
} from '../utils/standaloneScheduleGenerator';
import { deduplicateCalendarEvents } from '../utils/storage';
import { apiBulkSaveEvents } from '../utils/api';
import { fetchAnuncioPdfInfo, AnuncioPdfInfo } from '../utils/announcements';

interface CategoryPdfDocumentViewProps {
  category: Category;
  allCategories?: Category[];
  events: CalendarEvent[];
  settings?: UserSettings;
  onOpenCalendarView?: () => void;
  onSelectCategory?: (catId: string) => void;
  onBackToApp?: () => void;
  isGuest?: boolean;
}

export const CategoryPdfDocumentView: React.FC<CategoryPdfDocumentViewProps> = ({
  category,
  allCategories = [],
  events,
  settings,
  onOpenCalendarView,
  onSelectCategory,
  onBackToApp,
  isGuest = true
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Dynamic public state fetched directly from public API (no user session required)
  const [liveCategory, setLiveCategory] = useState<Category>(category);
  const [liveCategories, setLiveCategories] = useState<Category[]>(allCategories);
  const [liveSettings, setLiveSettings] = useState<UserSettings | undefined>(settings);
  const [isLoadingPublicData, setIsLoadingPublicData] = useState<boolean>(!events || events.length === 0);
  const [publicDataError, setPublicDataError] = useState<string | null>(null);

  useEffect(() => {
    setLiveCategory(category);
  }, [category]);

  useEffect(() => {
    if (allCategories && allCategories.length > 0) {
      setLiveCategories(allCategories);
    }
  }, [allCategories]);

  useEffect(() => {
    if (settings) {
      setLiveSettings(settings);
    }
  }, [settings]);

  const effectiveCategory = liveCategory || category;
  const effectiveCategories = liveCategories.length > 0 ? liveCategories : allCategories;
  const isAll = effectiveCategory.id === 'all' || effectiveCategory.id === 'overview';
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [anuncioPdf, setAnuncioPdf] = useState<AnuncioPdfInfo | null>(null);
  const [viewMode, setViewMode] = useState<'all-in-one' | 'events-only' | 'pdf-only'>('all-in-one');

  // Load Anuncio PDF info
  useEffect(() => {
    fetchAnuncioPdfInfo()
      .then((info) => {
        if (info) setAnuncioPdf(info);
      })
      .catch(() => {});
  }, []);

  // Live events state with automatic real-time sync and URL payload unpacking
  const [liveEvents, setLiveEvents] = useState<CalendarEvent[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const d = params.get('d') || params.get('data') || params.get('events');
        if (d) {
          const unpacked = unpackEventsFromUrl(d);
          if (unpacked.length > 0) {
            apiBulkSaveEvents(unpacked).catch(() => {});
            return deduplicateCalendarEvents([...unpacked, ...events]);
          }
        }
      }
    } catch (e) {
      console.warn('PDF view initial event unpack error:', e);
    }
    return deduplicateCalendarEvents(events);
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('Live Schedule');

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const d = params.get('d') || params.get('data') || params.get('events');
        if (d) {
          const unpacked = unpackEventsFromUrl(d);
          if (unpacked.length > 0) {
            apiBulkSaveEvents(unpacked).catch(() => {});
            setLiveEvents(deduplicateCalendarEvents([...unpacked, ...events]));
            return;
          }
        }
      }
    } catch (e) {}
    setLiveEvents(deduplicateCalendarEvents(events));
  }, [events]);

  const fetchFreshEvents = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const catId = (category.id || 'all').trim();
      const timestamp = Date.now();
      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const dParam = searchParams ? (searchParams.get('d') || searchParams.get('data') || searchParams.get('events')) : '';
      const dQuery = dParam ? `&d=${encodeURIComponent(dParam)}` : '';

      // Determine public API candidate URLs (supporting current host without auth/cookies)
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

      const candidateUrls = [
        `/api/public/category/${encodeURIComponent(catId)}?t=${timestamp}${dQuery}`,
        `${currentOrigin}/api/public/category/${encodeURIComponent(catId)}?t=${timestamp}${dQuery}`,
        `/api/public/events?t=${timestamp}`,
        `${currentOrigin}/api/public/events?t=${timestamp}`
      ].filter(Boolean);

      let successfulData: any = null;

      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });

          if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              const data = await res.json();
              if (data && data.success && Array.isArray(data.events)) {
                successfulData = data;
                break;
              } else if (Array.isArray(data)) {
                successfulData = {
                  events: catId === 'all' || catId === 'overview'
                    ? data
                    : data.filter((e: any) => e.categoryId === catId || (e.categoryId && e.categoryId.toLowerCase() === catId.toLowerCase()))
                };
                break;
              }
            }
          }
        } catch (e) {
          // Continue to next public URL candidate
        }
      }

      if (successfulData) {
        if (Array.isArray(successfulData.events)) {
          setLiveEvents(deduplicateCalendarEvents(successfulData.events));
        }
        if (successfulData.category) {
          setLiveCategory(successfulData.category);
        }
        if (Array.isArray(successfulData.categories) && successfulData.categories.length > 0) {
          setLiveCategories(successfulData.categories);
        }
        if (successfulData.settings) {
          setLiveSettings(successfulData.settings);
        }
        setPublicDataError(null);
        if (manual) {
          setSyncStatusText('Updated just now');
          setTimeout(() => setSyncStatusText('Live Schedule'), 2500);
        }
      } else if (liveEvents.length === 0) {
        setPublicDataError('Unable to refresh public schedule. Check network connection.');
      }
    } catch (e) {
      console.warn('Public schedule fetch error:', e);
    } finally {
      setIsLoadingPublicData(false);
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  }, [category.id]);

  useEffect(() => {
    // Initial fetch on mount to guarantee fresh events even if loaded from stale cache
    fetchFreshEvents();

    // Auto-poll every 3.5 seconds for instant updates when events are added, edited, or deleted
    const interval = setInterval(() => {
      fetchFreshEvents(false);
    }, 3500);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchFreshEvents(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', () => fetchFreshEvents(false));

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', () => fetchFreshEvents(false));
    };
  }, [fetchFreshEvents]);

  // Filter events belonging to this category (or all categories if isAll)
  const categoryEvents = useMemo(() => {
    if (isAll) {
      if (selectedCategoryFilter !== 'all') {
        return liveEvents.filter((e) =>
          e.categoryId === selectedCategoryFilter ||
          (e.categoryId && e.categoryId.toLowerCase() === selectedCategoryFilter.toLowerCase())
        );
      }
      return liveEvents;
    }
    const filtered = liveEvents.filter((e) =>
      e.categoryId === effectiveCategory.id ||
      (e.categoryId && effectiveCategory.id && e.categoryId.toLowerCase() === effectiveCategory.id.toLowerCase()) ||
      (e.categoryId && effectiveCategory.name && e.categoryId.toLowerCase() === effectiveCategory.name.toLowerCase())
    );
    // If no events matched category directly, but liveEvents has events:
    // If category is default/new or only 1 category exists, fall back to all live events
    if (filtered.length === 0 && liveEvents.length > 0) {
      if (effectiveCategories.length <= 1 || effectiveCategory.id.toLowerCase() === 'new' || effectiveCategory.id.toLowerCase() === 'default') {
        return liveEvents;
      }
    }
    return filtered;
  }, [liveEvents, effectiveCategory.id, effectiveCategory.name, isAll, selectedCategoryFilter, effectiveCategories.length]);

  const todayStr = toYMD(new Date());
  const currentMonthStr = todayStr.slice(0, 7); // e.g. "2026-09"

  // Initialize selectedMonth: automatically pick earliest upcoming event or latest past event
  const initialMonth = useMemo(() => {
    const sorted = [...categoryEvents].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    const upcomingOrCurrent = sorted.filter((e) => (e.startDate || '').slice(0, 7) >= currentMonthStr);
    if (upcomingOrCurrent.length > 0 && upcomingOrCurrent[0].startDate) {
      return upcomingOrCurrent[0].startDate.slice(0, 7);
    }
    if (sorted.length > 0 && sorted[sorted.length - 1].startDate) {
      return sorted[sorted.length - 1].startDate.slice(0, 7);
    }
    return currentMonthStr;
  }, [categoryEvents, currentMonthStr]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => initialMonth);
  const userInteractedRef = useRef<boolean>(false);
  const initializedCatRef = useRef<string>(effectiveCategory.id);

  // Sync selectedMonth ONLY when category truly changes (e.g. user selects a different category)
  useEffect(() => {
    if (initializedCatRef.current !== effectiveCategory.id) {
      initializedCatRef.current = effectiveCategory.id;
      userInteractedRef.current = false;
      setSelectedMonth(initialMonth);
      setSelectedDayFilter(null);
    }
  }, [effectiveCategory.id, initialMonth]);

  // Initial auto-sync when initialMonth becomes available and user hasn't touched the arrows
  useEffect(() => {
    if (!userInteractedRef.current && initialMonth && selectedMonth !== initialMonth) {
      setSelectedMonth(initialMonth);
    }
  }, [initialMonth]);

  // Helper functions for month navigation
  const computeNextMonth = (ymStr: string): string => {
    if (!ymStr || typeof ymStr !== 'string' || !ymStr.includes('-')) {
      const now = new Date();
      ymStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const parts = ymStr.split('-');
    let y = parseInt(parts[0], 10) || new Date().getFullYear();
    let m = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  };

  const computePrevMonth = (ymStr: string): string => {
    if (!ymStr || typeof ymStr !== 'string' || !ymStr.includes('-')) {
      const now = new Date();
      ymStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const parts = ymStr.split('-');
    let y = parseInt(parts[0], 10) || new Date().getFullYear();
    let m = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  };

  const formatMonthName = (ymStr: string): string => {
    const parts = ymStr.split('-');
    if (parts.length === 2) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return ymStr;
  };

  const nextMonthStr = useMemo(() => computeNextMonth(selectedMonth), [selectedMonth]);
  const prevMonthStr = useMemo(() => computePrevMonth(selectedMonth), [selectedMonth]);
  const currentMonthName = useMemo(() => formatMonthName(selectedMonth), [selectedMonth]);
  const nextMonthName = useMemo(() => formatMonthName(nextMonthStr), [nextMonthStr]);
  const prevMonthName = useMemo(() => formatMonthName(prevMonthStr), [prevMonthStr]);

  useEffect(() => {
    document.title = 'Sacramentos';
  }, []);

  // Dynamic unique public URL path based on category ID
  const publicPath = useMemo(() => {
    const rawId = (effectiveCategory?.id || 'all').trim();
    const isAllCat = rawId.toLowerCase() === 'all' || rawId.toLowerCase() === 'overview';
    return `/pdf/${isAllCat ? 'all' : encodeURIComponent(rawId)}`;
  }, [effectiveCategory?.id]);

  // Clean, canonical public URL that anyone can open in any browser without app login
  const effectivePublicUrl = useMemo(() => {
    return getCategoryPublicUrl(effectiveCategory.id, 'pdf');
  }, [effectiveCategory.id]);

  // Mini-Calendar Data Calculation
  const miniCalendarData = useMemo(() => {
    const parts = selectedMonth.split('-');
    const year = parseInt(parts[0], 10) || new Date().getFullYear();
    const month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sunday

    const eventDatesMap = new Map<string, number>();
    categoryEvents.forEach((e) => {
      if (e.startDate && e.startDate.startsWith(selectedMonth)) {
        eventDatesMap.set(e.startDate, (eventDatesMap.get(e.startDate) || 0) + 1);
      }
    });

    const cells: Array<{ day: number | null; dateStr: string; eventCount: number; isToday: boolean }> = [];

    // Empty offset cells
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, dateStr: '', eventCount: 0, isToday: false });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        dateStr: dStr,
        eventCount: eventDatesMap.get(dStr) || 0,
        isToday: dStr === todayStr
      });
    }

    return cells;
  }, [selectedMonth, categoryEvents, todayStr]);

  // Filter events by selected month, day filter, & search query (Title, Date, Time)
  const monthEvents = useMemo(() => {
    return categoryEvents
      .filter((e) => {
        const eventMonth = (e.startDate || '').slice(0, 7);
        if (eventMonth !== selectedMonth) return false;

        if (selectedDayFilter && e.startDate !== selectedDayFilter) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = (e.title || '').toLowerCase().includes(q);
          const matchDate = (e.startDate || '').toLowerCase().includes(q);
          const matchTime = (e.startTime || '').toLowerCase().includes(q);
          if (!matchTitle && !matchDate && !matchTime) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const aKey = (a.startDate || '') + (a.startTime || '');
        const bKey = (b.startDate || '') + (b.startTime || '');
        return aKey.localeCompare(bKey);
      });
  }, [categoryEvents, selectedMonth, selectedDayFilter, searchQuery]);

  // Group events by date for clean presentation
  const groupedEvents = useMemo(() => {
    const groups: { [dateStr: string]: CalendarEvent[] } = {};
    for (const evt of monthEvents) {
      const dateKey = evt.startDate || 'Unscheduled';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(evt);
    }
    return groups;
  }, [monthEvents]);

  const lastNavTimeRef = useRef<number>(0);

  const handleNextMonth = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const now = Date.now();
    if (now - lastNavTimeRef.current < 220) return;
    lastNavTimeRef.current = now;
    userInteractedRef.current = true;
    setSelectedMonth((prev) => {
      const base = prev || currentMonthStr;
      return computeNextMonth(base);
    });
    setSelectedDayFilter(null);
  };

  const handlePrevMonth = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const now = Date.now();
    if (now - lastNavTimeRef.current < 220) return;
    lastNavTimeRef.current = now;
    userInteractedRef.current = true;
    setSelectedMonth((prev) => {
      const base = prev || currentMonthStr;
      return computePrevMonth(base);
    });
    setSelectedDayFilter(null);
  };

  // Keyboard navigation for Left / Right arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevMonth();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextMonth();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMonthStr]);

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.warn('Fallback copy error:', e);
    }
  };

  const handleCopyLink = () => {
    copyToClipboard(effectivePublicUrl);
  };

  const handleCopyPath = () => {
    copyToClipboard(publicPath);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${effectiveCategory.name} Schedule`,
          text: `View the ${effectiveCategory.name} schedule online:`,
          url: effectivePublicUrl
        });
        return;
      } catch (e) {
        // User dismissed share dialog
      }
    }
    copyToClipboard(effectivePublicUrl);
  };

  const handleCategoryChange = (catId: string) => {
    if (onSelectCategory) {
      onSelectCategory(catId);
    }
    const found = effectiveCategories.find((c) => c.id === catId);
    if (found) {
      setLiveCategory(found);
    } else if (catId === 'all' || catId === 'overview' || catId === 'sacramentos') {
      setLiveCategory({
        id: 'all',
        name: 'Sacramentos',
        color: 'indigo',
        hex: '#4f46e5',
        bgClass: 'bg-indigo-50 dark:bg-indigo-950/40',
        borderClass: 'border-indigo-200 dark:border-indigo-800',
        textClass: 'text-indigo-700 dark:text-indigo-300',
        badgeClass: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200',
        dotClass: 'bg-indigo-500',
        description: 'Sacramentos church calendar schedule'
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePrintMultiMonth = () => {
    printMultiMonthSchedule({
      category: effectiveCategory,
      allCategories: effectiveCategories,
      events: categoryEvents,
      settings: liveSettings || settings,
      title: 'Sacramentos'
    });
  };

  const handleDownloadOfflineHtml = () => {
    downloadStandaloneScheduleHtml({
      category: effectiveCategory,
      allCategories: effectiveCategories,
      events: categoryEvents,
      settings: liveSettings || settings,
      title: 'Sacramentos'
    });
  };

  const handleExportIcs = () => {
    const icsContent = exportEventsToIcs(categoryEvents, `${effectiveCategory.name} Schedule`);
    const filename = `${effectiveCategory.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_schedule.ics`;
    downloadIcsFile(icsContent, filename);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased pb-16">

      {/* Main Document Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        
        {/* ==================================================================== */}
        {/* PDF DOCUMENT SHEET (Clean & Simple: Mini Month Calendar + Title, Date, Time) */}
        {/* ==================================================================== */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden transition-all duration-200 print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white print:text-black">
          
          {/* Top Category Accent Stripe */}
          <div
            className="absolute top-0 left-0 right-0 h-1.5 print:hidden"
            style={{ backgroundColor: effectiveCategory.hex || '#4f46e5' }}
          />

          {/* Document Top Bar with Category Dot, Real-time Sync Indicator & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 print:hidden">
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: effectiveCategory.hex || '#4f46e5' }}
              />
              {/* Word 'All Categories Overview' is completely removed as requested */}
              {effectiveCategory.id !== 'all' &&
                effectiveCategory.id !== 'overview' &&
                !effectiveCategory.name.toLowerCase().includes('overview') &&
                !effectiveCategory.name.toLowerCase().includes('all categories') &&
                !effectiveCategory.name.toLowerCase().includes('sacramentos') && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {effectiveCategory.name}
                  </span>
                )}
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-full select-none">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{syncStatusText}</span>
              </div>

              <button
                onClick={() => fetchFreshEvents(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                title="Refresh schedule data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handlePrintMultiMonth}
                className="w-8 h-8 min-w-[32px] min-h-[32px] inline-flex items-center justify-center text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Print or save as PDF"
                aria-label="Print or save as PDF"
              >
                <Printer className="w-4 h-4" />
              </button>

              <button
                onClick={handleDownloadOfflineHtml}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-all active:scale-95 cursor-pointer"
                title="Download self-contained offline calendar (.html)"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Offline (.html)</span>
              </button>
            </div>
          </div>

          {/* Main Title Banner: "SACRAMENTOS" */}
          <div className="pb-3 mb-4 border-b-2 border-slate-900 dark:border-slate-100">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
              SACRAMENTOS
            </h1>
          </div>

          {/* Collapsible Public Share & Link Details */}
          <details className="mb-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 print:hidden group">
            <summary className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-500" />
                <span>Public Share Link & QR Options ({publicPath})</span>
              </div>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">Share Options ▾</span>
            </summary>
            <div className="flex flex-col gap-3 pt-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 px-3 py-1.5 flex-1 min-w-0 font-mono text-xs text-slate-700 dark:text-slate-300 select-all overflow-hidden">
                  <Link2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate" title={effectivePublicUrl}>
                    {effectivePublicUrl}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 justify-end flex-wrap">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer ${
                      copiedLink
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    }`}
                    title="Copy full public URL for external sharing"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPath}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
                    title="Copy only URL path (/pdf/...)"
                  >
                    <Copy className="w-3 h-3 text-slate-400" />
                    <span className="font-mono text-[11px]">Path</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
                    title="Share link via phone or messaging apps"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Share</span>
                  </button>

                  <a
                    href={effectivePublicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer text-decoration-none"
                    title="Open public schedule in a new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="hidden sm:inline">Open</span>
                  </a>
                </div>
              </div>

              {/* Dynamic Category Switcher: quickly generate link for any other category */}
              {effectiveCategories.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Switch Category Link:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('all')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      effectiveCategory.id === 'all' || effectiveCategory.id === 'overview'
                        ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    <span>All (/pdf/all)</span>
                  </button>
                  {effectiveCategories.map((cat) => {
                    const isSelected = effectiveCategory.id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategoryChange(cat.id)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.hex || '#6366f1' }}
                        />
                        <span>{cat.name} (/pdf/{encodeURIComponent(cat.id)})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </details>

          {/* Unified View Tabs (Sacramentos Events + Anuncio PDF) */}
          {anuncioPdf && (
            <div className="flex items-center gap-1.5 p-1.5 mb-6 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 print:hidden overflow-x-auto">
              <button
                type="button"
                onClick={() => setViewMode('all-in-one')}
                className={`flex-1 min-w-[100px] py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  viewMode === 'all-in-one'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>Todo</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('events-only')}
                className={`flex-1 min-w-[120px] py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  viewMode === 'events-only'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>📅 Solo Calendario</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('pdf-only')}
                className={`flex-1 min-w-[130px] py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  viewMode === 'pdf-only'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📄 Solo Anuncio PDF</span>
              </button>
            </div>
          )}

          {/* Anuncio PDF Card (Displayed in 'all-in-one' and 'pdf-only' modes) */}
          {anuncioPdf && (viewMode === 'all-in-one' || viewMode === 'pdf-only') && (
            <div className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
              <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-800 text-white flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-amber-300 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-white">
                      Anuncio Parroquial / Boletín
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 print:hidden shrink-0">
                  <a
                    href="/api/anuncio/pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-lg transition-all"
                    title="Pantalla Completa"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Pantalla Completa</span>
                  </a>
                </div>
              </div>

              {/* Embedded PDF iframe */}
              <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800">
                <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800">
                  <iframe
                    src="/api/anuncio/pdf#toolbar=1"
                    className="w-full h-[550px] sm:h-[650px] border-none block"
                    title="Anuncio Parroquial PDF"
                  />
                </div>

                <div className="mt-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 px-1 print:hidden">
                  <span>¿Prefieres abrir el PDF directamente en tu celular o tablet?</span>
                  <a
                    href="/api/anuncio/pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Abrir o Descargar PDF de Anuncios</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Anuncios information banner when no custom PDF is yet uploaded */}
          {isAll && !anuncioPdf && (
            <div className="mb-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 shadow-sm overflow-hidden bg-gradient-to-r from-indigo-50/90 via-white to-amber-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Anuncios Parroquiales & Boletín Semanal
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        Sincronizado con Sacramentos
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
                      Los avisos parroquiales y el calendario de Sacramentos están vinculados en un solo destino QR. Al subir un archivo PDF en la pestaña <strong>Anuncios</strong>, los feligreses lo verán aquí automáticamente al escanear el código QR.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode !== 'pdf-only' && (
            <>
              <div className="hidden print:block pb-4 mb-4 border-b-2 border-slate-900">
                <h1 className="text-3xl font-black text-black tracking-tight uppercase">SACRAMENTOS</h1>
              </div>

              {/* Month Navigation Banner (Arrows with Current Month Name) */}
              <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 mb-3 print:border-slate-300 print:bg-slate-50">
            <button
              id="pdf-btn-prev-month"
              type="button"
              onClick={handlePrevMonth}
              onTouchEnd={handlePrevMonth}
              className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm border border-slate-200 dark:border-slate-600 transition-all print:hidden shadow-2xs active:scale-95 cursor-pointer select-none"
              title="Previous Month (Left Arrow Key)"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-6 h-6 pointer-events-none shrink-0" />
            </button>

            <div className="text-center font-extrabold text-sm sm:text-base text-slate-900 dark:text-white print:text-black tracking-tight select-none">
              {currentMonthName}
            </div>

            <button
              id="pdf-btn-next-month"
              type="button"
              onClick={handleNextMonth}
              onTouchEnd={handleNextMonth}
              className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm border border-slate-200 dark:border-slate-600 transition-all print:hidden shadow-2xs active:scale-95 cursor-pointer select-none"
              title="Next Month (Right Arrow Key)"
              aria-label="Next Month"
            >
              <ChevronRight className="w-6 h-6 pointer-events-none shrink-0" />
            </button>
          </div>

          {/* Quick 12-Month Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 print:hidden scrollbar-thin">
            {Array.from({ length: 12 }, (_, i) => {
              const mNum = i + 1;
              const curYear = parseInt(selectedMonth.split('-')[0], 10) || new Date().getFullYear();
              const mStr = `${curYear}-${String(mNum).padStart(2, '0')}`;
              const mName = new Date(curYear, i, 1).toLocaleDateString('en-US', { month: 'short' });
              const count = categoryEvents.filter(e => (e.startDate || '').startsWith(mStr)).length;
              const isSelected = selectedMonth === mStr;

              return (
                <button
                  key={mStr}
                  type="button"
                  onClick={() => {
                    userInteractedRef.current = true;
                    setSelectedMonth(mStr);
                    setSelectedDayFilter(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                  }`}
                >
                  <span>{mName}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ==================================================================== */}
          {/* SMALL MONTHS CALENDAR SECTION */}
          {/* ==================================================================== */}
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 print:border-slate-300 print:bg-slate-50/60 break-inside-avoid">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: effectiveCategory.hex || '#4f46e5' }} />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white print:text-black uppercase tracking-wider">
                  {currentMonthName} ({categoryEvents.filter(e => (e.startDate || '').startsWith(selectedMonth)).length} EVENTS)
                </h2>

                <div className="flex items-center gap-1 ml-2 print:hidden">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    onTouchEnd={handlePrevMonth}
                    className="w-7 h-7 min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer active:scale-95 select-none"
                    title="Previous Month"
                    aria-label="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4 pointer-events-none shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    onTouchEnd={handleNextMonth}
                    className="w-7 h-7 min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer active:scale-95 select-none"
                    title="Next Month"
                    aria-label="Next Month"
                  >
                    <ChevronRight className="w-4 h-4 pointer-events-none shrink-0" />
                  </button>
                </div>
              </div>

              {selectedDayFilter && (
                <button
                  onClick={() => setSelectedDayFilter(null)}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 print:hidden transition-colors"
                >
                  <FilterX className="w-3 h-3" />
                  <span>Clear day filter ({selectedDayFilter})</span>
                </button>
              )}
            </div>

            {/* Small Month Calendar Grid */}
            <div className="max-w-xs sm:max-w-sm mx-auto">
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayChar, i) => (
                  <div
                    key={i}
                    className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase py-1"
                  >
                    {dayChar}
                  </div>
                ))}
              </div>

              {/* Day Numbers Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {miniCalendarData.map((cell, idx) => {
                  if (cell.day === null) {
                    return <div key={`empty-${idx}`} className="h-7 sm:h-8" />;
                  }

                  const isSelected = selectedDayFilter === cell.dateStr;
                  const hasEvents = cell.eventCount > 0;

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      disabled={!hasEvents && isGuest}
                      onClick={() => {
                        if (hasEvents) {
                          setSelectedDayFilter(selectedDayFilter === cell.dateStr ? null : cell.dateStr);
                        }
                      }}
                      className={`h-7 sm:h-8 rounded-lg text-xs font-semibold flex flex-col items-center justify-center relative transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-bold shadow-xs scale-105 z-10'
                          : hasEvents
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-600 hover:border-indigo-400 shadow-2xs cursor-pointer'
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 cursor-default'
                      } ${cell.isToday && !isSelected ? 'ring-1.5 ring-indigo-500 font-bold' : ''}`}
                      title={hasEvents ? `${cell.eventCount} event(s) on ${cell.dateStr}` : cell.dateStr}
                    >
                      <span className="text-[11px] sm:text-xs leading-none">{cell.day}</span>
                      {hasEvents && (
                        <span
                          className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : ''}`}
                          style={!isSelected ? { backgroundColor: effectiveCategory.hex || '#4f46e5' } : undefined}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Events Schedule Breakdown: STRICTLY Title, Date, Time */}
          {monthEvents.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <CalendarIcon className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                No events scheduled for {currentMonthName}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4">
                {selectedDayFilter
                  ? `No events on selected date ${selectedDayFilter}.`
                  : searchQuery
                  ? `No events matching "${searchQuery}".`
                  : `There are currently no events registered in this category for ${currentMonthName}.`}
              </p>

              {(() => {
                const otherMonthEvent = categoryEvents.find((e) => (e.startDate || '').slice(0, 7) !== selectedMonth);
                const otherMonthStr = otherMonthEvent?.startDate?.slice(0, 7);
                const otherMonthFormatted = otherMonthStr ? formatMonthName(otherMonthStr) : '';

                if (selectedDayFilter) {
                  return (
                    <button
                      onClick={() => setSelectedDayFilter(null)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl shadow-xs transition-all"
                    >
                      <FilterX className="w-4 h-4" />
                      <span>Show All {currentMonthName} Events</span>
                    </button>
                  );
                }

                if (categoryEvents.length > 0 && otherMonthStr) {
                  return (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          userInteractedRef.current = true;
                          setSelectedMonth(otherMonthStr);
                          setSelectedDayFilter(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        <span>Jump to Events in {otherMonthFormatted} ({categoryEvents.length} total)</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }

                if (categoryEvents.length === 0 && liveEvents.length > 0 && !isAll) {
                  return (
                    <button
                      onClick={() => {
                        if (onSelectCategory) {
                          onSelectCategory('all');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                    >
                      <span>View All Calendar Events ({liveEvents.length} total)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  );
                }

                return (
                  <button
                    onClick={handleNextMonth}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                  >
                    <span>View {nextMonthName} Events</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                );
              })()}
            </div>
          ) : (
            <div className="space-y-5">
              {Object.keys(groupedEvents).map((dateKey) => {
                const dayEvents = groupedEvents[dateKey];
                const dateObj = new Date(dateKey + 'T12:00:00');
                const isDateValid = !isNaN(dateObj.getTime());
                const dateDisplay = isDateValid
                  ? dateObj.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : dateKey;

                return (
                  <div key={dateKey} className="break-inside-avoid">
                    {/* Date Section Label */}
                    <div className="flex items-center gap-2 mb-2.5 pb-1 border-b border-slate-200 dark:border-slate-800 print:border-slate-300">
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 print:text-black uppercase tracking-wider">
                        📅 {dateDisplay}
                      </span>
                      <span className="ml-auto text-[11px] text-slate-400 font-medium">
                        {dayEvents.length} event{dayEvents.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {/* Events List for Date: Showing ONLY Event Title, Date, Time */}
                    <div className="space-y-2">
                      {dayEvents.map((evt, evtIdx) => {
                        const timeDisplay = evt.isAllDay
                          ? 'All-Day'
                          : evt.startTime
                          ? `${formatTime12h(evt.startTime)}${evt.endTime ? ' – ' + formatTime12h(evt.endTime) : ''}`
                          : 'Time not specified';

                        const evtCategory = effectiveCategories.find((c) => c.id === evt.categoryId);
                        const leftBorderColor = isAll ? evtCategory?.hex || '#4f46e5' : effectiveCategory.hex || '#4f46e5';

                        return (
                          <div
                            key={`${evt.id || 'pdf'}-${evtIdx}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/90 print:bg-white print:border-slate-300 print:p-2 transition-all"
                            style={{ borderLeftWidth: '4px', borderLeftColor: leftBorderColor }}
                          >
                            {/* Event Title, Location & Notes */}
                            <div className="flex-1">
                              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white print:text-black leading-snug">
                                {evt.title || 'Untitled Event'}
                              </h3>
                              {evt.location && evt.location.trim() && (
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 print:text-slate-800 mt-1">
                                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 print:text-slate-700" />
                                  <span>{evt.location}</span>
                                </div>
                              )}
                              {(evt.notes || evt.description) && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                  📝 {evt.notes || evt.description}
                                </p>
                              )}
                            </div>

                            {/* Date & Time */}
                            <div className="flex flex-col sm:items-end gap-2 shrink-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600 font-medium">
                                  {dateDisplay}
                                </span>
                                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 print:border-slate-300">
                                  <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                                  <span>{timeDisplay}</span>
                                </div>
                              </div>

                              {/* Quick Calendar Actions for Event */}
                              <div className="flex items-center gap-1.5 print:hidden">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const ics = generateSingleEventIcsContent(evt, effectiveCategory.name);
                                    downloadIcsFile(ics, `${(evt.title || 'event').toLowerCase().replace(/[^a-z0-9]/g, '_')}.ics`);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95 transition-all cursor-pointer"
                                  title="Add event to phone calendar (iPhone / Android)"
                                >
                                  <Smartphone className="w-3 h-3 text-slate-500" />
                                  <span>Phone</span>
                                </button>
                                <a
                                  href={getGoogleCalendarUrl(evt)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:scale-95 transition-all cursor-pointer text-decoration-none"
                                  title="Add event to Google Calendar"
                                >
                                  <CalendarIcon className="w-3 h-3 text-blue-600" />
                                  <span>Google</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes Section at Bottom of Page */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
              <span>📝</span>
              <span>Notes</span>
            </div>

            {monthEvents.filter((e) => Boolean((e.notes || e.description || '').trim())).length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                No notes for {currentMonthName}.
              </div>
            ) : (
              <div className="space-y-2.5">
                {monthEvents
                  .filter((e) => Boolean((e.notes || e.description || '').trim()))
                  .map((evt, nIdx) => (
                    <div
                      key={`note-${evt.id || 'note'}-${nIdx}`}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {evt.title || 'Untitled Event'}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {evt.startDate}
                          {!evt.isAllDay && evt.startTime ? ` • ${evt.startTime}` : ''}
                        </span>
                      </div>
                      {evt.location && evt.location.trim() && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 print:text-slate-800 mb-1.5">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0 print:text-slate-700" />
                          <span>{evt.location}</span>
                        </div>
                      )}
                      <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {evt.notes || evt.description}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </main>

    </div>
  );
};

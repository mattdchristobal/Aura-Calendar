import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Printer,
  Download,
  QrCode,
  Calendar as CalendarIcon,
  Share2,
  Check,
  Clock,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  FilterX,
  RefreshCw
} from 'lucide-react';
import { Category, CalendarEvent, UserSettings } from '../types';
import { formatTime12h, toYMD } from '../utils/dateUtils';
import { exportEventsToIcs, downloadIcsFile } from '../utils/icsParser';
import { generateQrDataUrl, downloadQrCode, downloadHighResCategoryQrPng, printCategoryQrFlyer, getCategoryPublicUrl } from '../utils/qrUtils';
import { deduplicateCalendarEvents } from '../utils/storage';

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
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const isAll = category.id === 'all' || category.id === 'overview';
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Live events state with automatic real-time sync
  const [liveEvents, setLiveEvents] = useState<CalendarEvent[]>(() => deduplicateCalendarEvents(events));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('Live Schedule');

  useEffect(() => {
    setLiveEvents(deduplicateCalendarEvents(events));
  }, [events]);

  const fetchFreshEvents = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/events?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLiveEvents(deduplicateCalendarEvents(data));
          if (manual) {
            setSyncStatusText('Updated just now');
            setTimeout(() => setSyncStatusText('Live Schedule'), 2500);
          }
        }
      }
    } catch (e) {
      console.warn('Auto-sync fetch failed:', e);
    } finally {
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  }, []);

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
        return liveEvents.filter((e) => e.categoryId === selectedCategoryFilter);
      }
      return liveEvents;
    }
    return liveEvents.filter((e) => e.categoryId === category.id);
  }, [liveEvents, category.id, isAll, selectedCategoryFilter]);

  const todayStr = toYMD(new Date());
  const currentMonthStr = todayStr.slice(0, 7); // e.g. "2026-09"

  // Initialize selectedMonth: check if there are events in current or upcoming months
  const initialMonth = useMemo(() => {
    const sorted = [...categoryEvents].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    const hasCurrentOrFuture = sorted.some((e) => (e.startDate || '').slice(0, 7) >= currentMonthStr);
    if (hasCurrentOrFuture) {
      return currentMonthStr;
    }
    if (sorted.length > 0 && sorted[0].startDate) {
      return sorted[0].startDate.slice(0, 7);
    }
    return currentMonthStr;
  }, [categoryEvents, currentMonthStr]);

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);

  // Update selectedMonth if category changes
  useEffect(() => {
    setSelectedMonth(initialMonth);
    setSelectedDayFilter(null);
  }, [initialMonth]);

  // Helper functions for month navigation
  const computeNextMonth = (ymStr: string): string => {
    const parts = ymStr.split('-');
    let y = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  };

  const computePrevMonth = (ymStr: string): string => {
    const parts = ymStr.split('-');
    let y = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    m += 1;
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

  // Generate QR code for this category PDF view
  const publicUrl = useMemo(() => {
    return getCategoryPublicUrl(category.id, 'pdf');
  }, [category.id]);

  useEffect(() => {
    generateQrDataUrl(publicUrl, {
      width: 400,
      margin: 2,
      darkColor: category.hex || '#1e1b4b'
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Failed to generate QR code in view:', err));
  }, [publicUrl, category.hex]);

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

  const handleNextMonth = () => {
    setSelectedMonth(computeNextMonth(selectedMonth));
    setSelectedDayFilter(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevMonth = () => {
    setSelectedMonth(computePrevMonth(selectedMonth));
    setSelectedDayFilter(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadQrPng = async () => {
    if (qrDataUrl) {
      const safeName = (category.name || 'category').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadQrCode(qrDataUrl, `${safeName}_Schedule_QR.png`);
    } else {
      await downloadHighResCategoryQrPng(category, publicUrl);
    }
  };

  const handleExportIcs = () => {
    const icsContent = exportEventsToIcs(categoryEvents, `${category.name} Schedule`);
    const filename = `${category.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_schedule.ics`;
    downloadIcsFile(icsContent, filename);
  };

  const handlePrintFlyer = () => {
    if (!qrDataUrl) return;
    printCategoryQrFlyer({
      category,
      eventsCount: categoryEvents.length,
      qrDataUrl,
      publicUrl
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased pb-16">

      {/* Main Document Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        
        {/* ==================================================================== */}
        {/* PDF DOCUMENT SHEET (Clean & Simple: Mini Month Calendar + Title, Date, Time) */}
        {/* ==================================================================== */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white print:text-black">
          
          {/* Document Top Bar with Category Title, Real-time Sync Indicator & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 print:hidden">
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: category.hex || '#4f46e5' }}
              />
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {category.name}
              </h1>
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
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Print or save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          <div className="hidden print:block pb-4 mb-4 border-b-2 border-slate-900">
            <h1 className="text-2xl font-bold text-black">{category.name} Schedule</h1>
          </div>

          {/* Month Navigation Banner (Arrows Only) */}
          <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 mb-4 print:border-slate-300 print:bg-slate-50">
            <button
              onClick={handlePrevMonth}
              className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm border border-slate-200 dark:border-slate-600 transition-all print:hidden shadow-2xs active:scale-95 cursor-pointer"
              title="Previous Month"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="text-center font-extrabold text-sm sm:text-base text-slate-900 dark:text-white print:text-black tracking-tight">
              {currentMonthName}
            </div>

            <button
              onClick={handleNextMonth}
              className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm border border-slate-200 dark:border-slate-600 transition-all print:hidden shadow-2xs active:scale-95 cursor-pointer"
              title="Next Month"
              aria-label="Next Month"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* ==================================================================== */}
          {/* SMALL MONTHS CALENDAR OVERVIEW SECTION */}
          {/* ==================================================================== */}
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 print:border-slate-300 print:bg-slate-50/60 break-inside-avoid">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.hex }} />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white print:text-black uppercase tracking-wider">
                  {currentMonthName} Overview
                </h2>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  ({categoryEvents.filter(e => (e.startDate || '').startsWith(selectedMonth)).length} events)
                </span>
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
                          style={!isSelected ? { backgroundColor: category.hex || '#4f46e5' } : undefined}
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
              
              {selectedDayFilter ? (
                <button
                  onClick={() => setSelectedDayFilter(null)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl shadow-xs transition-all mr-2"
                >
                  <FilterX className="w-4 h-4" />
                  <span>Show All {currentMonthName} Events</span>
                </button>
              ) : (
                <button
                  onClick={handleNextMonth}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                >
                  <span>View {nextMonthName} Events</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
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

                        const evtCategory = allCategories.find((c) => c.id === evt.categoryId);
                        const leftBorderColor = isAll ? evtCategory?.hex || '#4f46e5' : category.hex || '#4f46e5';

                        return (
                          <div
                            key={`${evt.id || 'pdf'}-${evtIdx}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/90 print:bg-white print:border-slate-300 print:p-2 transition-all"
                            style={{ borderLeftWidth: '4px', borderLeftColor: leftBorderColor }}
                          >
                            {/* Event Title & Notes */}
                            <div className="flex-1">
                              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white print:text-black leading-snug">
                                {evt.title || 'Untitled Event'}
                              </h3>
                              {(evt.notes || evt.description) && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                  📝 {evt.notes || evt.description}
                                </p>
                              )}
                            </div>

                            {/* Date & Time */}
                            <div className="flex items-center gap-2 sm:text-right shrink-0">
                              <span className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600 font-medium">
                                {dateDisplay}
                              </span>
                              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 print:border-slate-300">
                                <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span>{timeDisplay}</span>
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
                      <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {evt.notes || evt.description}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* QR Code Inspection & Download Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl text-center">
            
            <div className="flex items-center justify-between mb-4">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold uppercase text-white"
                style={{ backgroundColor: category.hex }}
              >
                {category.name}
              </span>
              <button
                onClick={() => setQrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-1"
              >
                Close
              </button>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Scan or Save QR Code
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Scan with any mobile camera to open this clean PDF schedule view.
            </p>

            {qrDataUrl && (
              <div className="p-3 bg-white rounded-2xl border border-slate-200 dark:border-slate-700 inline-block mb-6 shadow-xs">
                <img
                  src={qrDataUrl}
                  alt={`${category.name} QR`}
                  className="w-48 h-48 rounded-lg"
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={() => downloadHighResCategoryQrPng(category, publicUrl, { width: 1024 })}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Save High-Res PNG (1024px)</span>
              </button>

              <button
                onClick={() => downloadQrCode(qrDataUrl, `${category.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_qr_code.png`)}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
              >
                <Download className="w-4 h-4 text-indigo-500" />
                <span>Save Standard PNG</span>
              </button>

              <button
                onClick={handlePrintFlyer}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Print Scannable Flyer</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full py-2 px-4 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800"
              >
                <Share2 className="w-4 h-4" />
                <span>Copy Shareable URL</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState } from 'react';
import { CalendarEvent, Category, UserSettings } from '../types';
import {
  getNearestSunday,
  formatFullDate,
  toYMD,
  formatTime12h,
  isToday,
  isEventOnDate
} from '../utils/dateUtils';
import { getCategoryById } from '../utils/categories';
import {
  Sun,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Sparkles,
  Coffee,
  BookOpen,
  Calendar as CalendarIcon,
  Trash,
  Trash2,
  ArrowLeft,
  X,
  Layers,
  Grid,
  Columns,
  MoreVertical,
  ExternalLink
} from 'lucide-react';

interface SundayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  selectedCategoryIds: string[];
  searchQuery: string;
  onSelectEvent: (event: CalendarEvent) => void;
  onCreateEventForDate?: (dateYmd: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  onSelectDate: (date: Date) => void;
  onClose?: () => void;
  onViewChange?: (view: 'year' | 'month' | 'week' | 'sunday') => void;
  categories?: Category[];
}

export const SundayView: React.FC<SundayViewProps> = ({
  currentDate,
  events,
  selectedCategoryIds,
  searchQuery,
  onSelectEvent,
  onCreateEventForDate,
  onDeleteEvent,
  onSelectDate,
  onClose,
  onViewChange,
  categories
}) => {
  // Ensure we are viewing a Sunday date
  const sundayDate = getNearestSunday(currentDate);
  const sundayYmd = toYMD(sundayDate);

  const [menuOpenEventId, setMenuOpenEventId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [sundayGoals, setSundayGoals] = useState([
    { id: '1', text: 'Review past week achievements and metrics', done: true },
    { id: '2', text: 'Organize high-priority goals for upcoming Monday', done: false },
    { id: '3', text: 'Conduct 30-minute mindfulness & mental reset', done: true },
    { id: '4', text: 'Prepare schedule agenda & sync team calendar', done: false }
  ]);

  const [newGoalText, setNewGoalText] = useState('');

  const toggleGoal = (id: string) => {
    setSundayGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, done: !g.done } : g))
    );
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalText.trim()) return;
    setSundayGoals((prev) => [
      ...prev,
      { id: Date.now().toString(), text: newGoalText.trim(), done: false }
    ]);
    setNewGoalText('');
  };

  // Filter Sunday events
  const sundayEvents = events
    .filter((e) => isEventOnDate(e, sundayYmd))
    .filter(
      (e) =>
        selectedCategoryIds.length === 0 ||
        selectedCategoryIds.includes(e.categoryId) ||
        !e.categoryId
    )
    .filter((evt) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        (evt.title && evt.title.toLowerCase().includes(query)) ||
        (evt.description && evt.description.toLowerCase().includes(query)) ||
        (evt.location && evt.location.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

  const handlePrevSunday = () => {
    const prev = new Date(sundayDate);
    prev.setDate(prev.getDate() - 7);
    onSelectDate(prev);
  };

  const handleNextSunday = () => {
    const next = new Date(sundayDate);
    next.setDate(next.getDate() + 7);
    onSelectDate(next);
  };

  const handleCloseWindow = () => {
    if (onClose) {
      onClose();
    } else if (onViewChange) {
      onViewChange('month');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
      
      {/* Dedicated Window Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-4 shadow-xl">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleCloseWindow}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors shadow-xs shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span className="hidden xs:inline sm:inline">Back</span>
            <span className="hidden sm:inline">to Calendar</span>
          </button>

          <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-3">
            <Sun className="w-5 h-5 text-amber-400 fill-amber-400/20" />
            <span className="font-extrabold text-white text-sm tracking-tight">
              Dedicated Sunday Focus Window
            </span>
          </div>
        </div>

        {/* View Mode Switcher inside Window */}
        {onViewChange && (
          <div className="flex items-center p-1 bg-slate-800/90 rounded-xl border border-slate-700/80 shadow-inner overflow-x-auto no-scrollbar order-3 sm:order-2 w-full sm:w-auto justify-center sm:justify-start">
            <button
              onClick={() => onViewChange('year')}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1 text-xs font-bold text-slate-400 hover:text-white rounded-lg transition-colors shrink-0"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Year</span>
            </button>
            <button
              onClick={() => onViewChange('month')}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1 text-xs font-bold text-slate-400 hover:text-white rounded-lg transition-colors shrink-0"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>
            <button
              onClick={() => onViewChange('week')}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1 text-xs font-bold text-slate-400 hover:text-white rounded-lg transition-colors shrink-0"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Week</span>
            </button>
            <button
              onClick={() => onViewChange('sunday')}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1 text-xs font-bold bg-amber-500 text-white rounded-lg shadow-sm shadow-amber-500/30 shrink-0"
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Sunday</span>
            </button>
          </div>
        )}

        {/* Right Window Controls */}
        <div className="flex items-center gap-2 order-2 sm:order-3 shrink-0">
          {onCreateEventForDate && (
            <button
              onClick={() => onCreateEventForDate(sundayYmd)}
              className="py-1.5 px-3 sm:px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/25 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Add Sunday Event</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}

          <button
            onClick={handleCloseWindow}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700/60"
            title="Close Full Window"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Sunday Workspace */}
      <div className="flex-1 p-3.5 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-7xl w-full mx-auto">
        
        {/* Sunday View Header Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white rounded-3xl p-4 sm:p-6 shadow-xl shadow-amber-500/15 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-100">
                  Dedicated Sunday Focus Mode
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {formatFullDate(sundayDate)}
              </h1>
            </div>

            {/* Sunday Navigator */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-white/15 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shrink-0">
              <button
                onClick={handlePrevSunday}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/20 transition-colors text-white"
                title="Previous Sunday"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <span className="text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 bg-white text-slate-900 rounded-xl shadow-xs">
                {isToday(sundayDate) ? 'Today (Sunday)' : 'Sunday View'}
              </span>

              <button
                onClick={handleNextSunday}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/20 transition-colors text-white"
                title="Next Sunday"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>

      {/* Main Sunday Workspace */}
      <div className="space-y-4">
        
        {/* Sunday Schedule & Timeline */}
        <div className="space-y-4">

          {sundayEvents.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-xs">
              <Sun className="w-12 h-12 text-amber-400 mx-auto mb-3 animate-pulse" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Clear Sunday Schedule
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                No events currently scheduled for this Sunday. Click below to add a reflection session, family plan, or weekly goal audit.
              </p>
              {onCreateEventForDate && (
                <button
                  onClick={() => onCreateEventForDate(sundayYmd)}
                  className="py-2 px-4 rounded-xl bg-amber-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-xs hover:bg-amber-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Sunday Event</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sundayEvents.map((evt, evtIdx) => {
                const cat = getCategoryById(evt.categoryId, categories);

                return (
                  <div
                    key={`${evt.id || 'sun'}-${evt.startDate}-${evtIdx}`}
                    onClick={() => onSelectEvent(evt)}
                    className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md cursor-pointer transition-all relative flex flex-col justify-between gap-3 ${cat.borderClass}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.badgeClass}`}>
                            {cat.name}
                          </span>
                          {evt.priority === 'high' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              High Priority
                            </span>
                          )}
                          {(() => {
                            const eventTemas = Array.isArray(evt.temas) && evt.temas.length > 0
                              ? evt.temas
                              : (evt.tema ? [evt.tema] : []);
                            return eventTemas.map((t, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                              >
                                <Layers className="w-2.5 h-2.5 text-indigo-500" />
                                <span>{t}</span>
                              </span>
                            ));
                          })()}
                        </div>

                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {evt.title}
                        </h3>

                        {evt.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                            {evt.description}
                          </p>
                        )}
                      </div>

                      {/* Three dots menu in top right corner of card */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenEventId(menuOpenEventId === evt.id ? null : evt.id);
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuOpenEventId === evt.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-8 z-30 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 text-xs text-slate-200 animate-in fade-in zoom-in-95"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenEventId(null);
                                onSelectEvent(evt);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 font-medium"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                              <span>View Details</span>
                            </button>

                            {onDeleteEvent && (
                              confirmDeleteId === evt.id ? (
                                <div className="p-2 border-t border-slate-700/60 bg-rose-950/40 flex items-center gap-1.5 justify-between">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMenuOpenEventId(null);
                                      setConfirmDeleteId(null);
                                      onDeleteEvent(evt.id);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                                  >
                                    <Trash className="w-3 h-3" />
                                    <span>Confirm Delete?</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteId(null);
                                    }}
                                    className="px-2 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(evt.id);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-rose-950/50 text-rose-400 hover:text-rose-300 flex items-center gap-2 font-medium border-t border-slate-700/60 cursor-pointer"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        {formatTime12h(evt.startTime)} - {formatTime12h(evt.endTime)}
                      </span>

                      {evt.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {evt.location}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>

  </div>
);
};

import React, { useState } from 'react';
import { CalendarEvent, Category, UserSettings } from '../types';
import {
  getDaysInMonthGrid,
  isSameDay,
  isToday,
  toYMD,
  formatTime12h,
  isEventOnDate
} from '../utils/dateUtils';
import { getCategoryById } from '../utils/categories';
import { Plus, Clock, MapPin, Trash, Trash2 } from 'lucide-react';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  selectedCategoryIds: string[];
  searchQuery: string;
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onCreateEventForDate?: (dateYmd: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  settings: UserSettings;
  categories?: Category[];
}

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  events,
  selectedCategoryIds,
  searchQuery,
  onSelectDate,
  onSelectEvent,
  onCreateEventForDate,
  onDeleteEvent,
  settings,
  categories
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfWeek = settings.firstDayOfWeek || 0;
  const daysGrid = getDaysInMonthGrid(year, month, firstDayOfWeek);

  const weekHeaders =
    firstDayOfWeek === 1
      ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Filter events by selected category tags and search query
  const filteredEvents = events.filter((evt) => {
    // If no categories are filtered out or list is empty, include all.
    const matchesCategory =
      selectedCategoryIds.length === 0 ||
      selectedCategoryIds.includes(evt.categoryId) ||
      !evt.categoryId;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (evt.title && evt.title.toLowerCase().includes(query)) ||
      (evt.description && evt.description.toLowerCase().includes(query)) ||
      (evt.location && evt.location.toLowerCase().includes(query)) ||
      (evt.createdBy && evt.createdBy.toLowerCase().includes(query))
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 overflow-hidden">
      
      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
        {weekHeaders.map((header, idx) => {
          const isSundayHeader = header === 'Sunday';
          return (
            <div
              key={idx}
              className={`py-2.5 px-3 text-center text-xs font-bold uppercase tracking-wider ${
                isSundayHeader
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="hidden sm:inline">{header}</span>
              <span className="sm:hidden">{header.substring(0, 3)}</span>
            </div>
          );
        })}
      </div>

      {/* 5 or 6 Row Month Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr gap-px bg-slate-200/80 dark:bg-slate-800/80 overflow-y-auto">
        {daysGrid.map(({ date, isCurrentMonth }, idx) => {
          const dateYmd = toYMD(date);
          const isCurrentToday = isToday(date);
          const isSunday = date.getDay() === 0;

          // Events on this day using canonical date range matcher
          const dayEvents = filteredEvents
            .filter((e) => isEventOnDate(e, dateYmd))
            .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

          const maxVisible = 3;
          const visibleEvents = dayEvents.slice(0, maxVisible);
          const hiddenCount = dayEvents.length - maxVisible;

          return (
            <div
              key={idx}
              onClick={() => onSelectDate(date)}
              className={`group relative min-h-[110px] p-1.5 flex flex-col justify-start transition-colors cursor-pointer ${
                isCurrentMonth
                  ? isSunday
                    ? 'bg-amber-50/20 dark:bg-amber-950/10 hover:bg-slate-50 dark:hover:bg-slate-900'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
                  : 'bg-slate-50/50 dark:bg-slate-950/60 text-slate-400'
              }`}
            >
              {/* Day Number Row */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg transition-all ${
                    isCurrentToday
                      ? 'bg-indigo-600 text-white shadow-xs scale-105'
                      : isSunday
                      ? 'text-amber-600 dark:text-amber-400 font-bold'
                      : isCurrentMonth
                      ? 'text-slate-800 dark:text-slate-200'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {date.getDate()}
                </span>

                {/* Quick Add Button on Date Grid (Visible with hover/focus highlight) */}
                {onCreateEventForDate && (
                  <button
                    id={`add-event-btn-${dateYmd}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateEventForDate(dateYmd);
                    }}
                    className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 transition-all opacity-70 group-hover:opacity-100 hover:!opacity-100 hover:scale-110"
                    title={`Add event on ${dateYmd}`}
                    aria-label={`Add event on ${dateYmd}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Event Pills List */}
              <div className="space-y-1 flex-1 overflow-hidden">
                {visibleEvents.map((evt, evtIdx) => {
                  const category = getCategoryById(evt.categoryId, categories);

                  return (
                    <div
                      key={`${evt.id || 'evt'}-${dateYmd}-${evtIdx}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt);
                      }}
                      className={`group/evt px-2 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xs flex items-center justify-between gap-1 border border-transparent ${category.bgClass}`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${category.dotClass}`} />
                        <span className="truncate font-semibold">{evt.title}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] opacity-80 font-medium group-hover/evt:hidden">
                          {evt.isAllDay ? 'All Day' : formatTime12h(evt.startTime)}
                        </span>
                        {onDeleteEvent && (
                          confirmDeleteId === evt.id ? (
                            <div className="flex items-center gap-1 z-30" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteEvent(evt.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[9px] flex items-center gap-0.5 shadow-xs transition-all cursor-pointer shrink-0"
                                title="Confirm Delete"
                              >
                                <Trash className="w-2.5 h-2.5" />
                                <span>Delete?</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-[9px] font-medium transition-colors cursor-pointer shrink-0"
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
                              className="hidden group-hover/evt:flex p-0.5 rounded hover:bg-rose-200 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 transition-colors cursor-pointer"
                              title="Delete event"
                            >
                              <Trash className="w-3 h-3" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Overflow Badge */}
                {hiddenCount > 0 && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(date);
                    }}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5"
                  >
                    +{hiddenCount} more event{hiddenCount > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

import React, { useState } from 'react';
import { CalendarEvent, Category, UserSettings } from '../types';
import {
  getWeekDays,
  isToday,
  toYMD,
  formatTime12h,
  isEventOnDate
} from '../utils/dateUtils';
import { getCategoryById } from '../utils/categories';
import { Clock, MapPin, Plus, Trash, Trash2, Calendar } from 'lucide-react';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  selectedCategoryIds: string[];
  searchQuery: string;
  onSelectEvent: (event: CalendarEvent) => void;
  onCreateEventForDateTime?: (dateYmd: string, time24: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  settings: UserSettings;
  categories?: Category[];
}

export const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  events,
  selectedCategoryIds,
  searchQuery,
  onSelectEvent,
  onCreateEventForDateTime,
  onDeleteEvent,
  settings,
  categories
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const weekDays = getWeekDays(currentDate, settings.firstDayOfWeek || 0);

  // Standard work/day hours 07:00 to 21:00 (plus 22:00 for late events)
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);

  // Filter events by selected category tags and search query
  const filteredEvents = events.filter((evt) => {
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
      
      {/* Week Header Row */}
      <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 z-10">
        <div className="p-3 text-center text-xs font-bold text-slate-400 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center">
          <span>Time</span>
        </div>

        {weekDays.map((day, idx) => {
          const isCurrentToday = isToday(day);
          const isSunday = day.getDay() === 0;

          return (
            <div
              key={idx}
              className={`p-2.5 text-center border-r border-slate-200 dark:border-slate-800 ${
                isSunday ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
              }`}
            >
              <div
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  isSunday ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="flex justify-center mt-1">
                <span
                  className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-full ${
                    isCurrentToday
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isSunday
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* All-Day / Multi-Day Events Row */}
      <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/20 min-h-[38px]">
        <div className="p-2 text-right text-[10px] font-bold text-slate-400 border-r border-slate-200 dark:border-slate-800 flex items-center justify-end">
          All-Day
        </div>

        {weekDays.map((day, dIdx) => {
          const dateYmd = toYMD(day);
          const allDayEventsOnDay = filteredEvents.filter(
            (e) => (e.isAllDay || e.startDate !== e.endDate) && isEventOnDate(e, dateYmd)
          );

          return (
            <div
              key={dIdx}
              className="p-1 border-r border-slate-200/60 dark:border-slate-800/60 space-y-1"
            >
              {allDayEventsOnDay.map((evt, eIdx) => {
                const cat = getCategoryById(evt.categoryId, categories);
                return (
                  <div
                    key={`${evt.id || 'allday'}-${dIdx}-${eIdx}`}
                    onClick={() => onSelectEvent(evt)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-semibold truncate cursor-pointer shadow-2xs hover:opacity-90 ${cat.bgClass} ${cat.borderClass} border`}
                    title={`${evt.title} (All Day)`}
                  >
                    {evt.title}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Hourly Grid Body */}
      <div className="flex-1 overflow-y-auto">
        {hours.map((hour) => {
          const hourStr = String(hour).padStart(2, '0') + ':00';
          const timeLabel = formatTime12h(hourStr);

          return (
            <div key={hour} className="grid grid-cols-8 border-b border-slate-100 dark:border-slate-800/60 min-h-[70px]">
              
              {/* Time Column */}
              <div className="p-2 text-right text-xs font-semibold text-slate-400 border-r border-slate-200 dark:border-slate-800 select-none bg-slate-50/30 dark:bg-slate-900/30">
                {timeLabel}
              </div>

              {/* Day Columns for this Hour */}
              {weekDays.map((day, dIdx) => {
                const dateYmd = toYMD(day);
                const isSunday = day.getDay() === 0;

                // Find events matching date and starting in this hour block (excluding pure all-day)
                const cellEvents = filteredEvents.filter((e) => {
                  if (e.isAllDay) return false;
                  if (!isEventOnDate(e, dateYmd)) return false;

                  const rawHour = parseInt((e.startTime || '09:00').split(':')[0], 10);
                  const clampedHour = isNaN(rawHour) ? 9 : Math.min(Math.max(rawHour, 7), 22);
                  return clampedHour === hour;
                });

                return (
                  <div
                    key={dIdx}
                    onClick={() => {
                      if (onCreateEventForDateTime) {
                        onCreateEventForDateTime(dateYmd, hourStr);
                      }
                    }}
                    className={`group relative p-1 border-r border-slate-100 dark:border-slate-800/60 transition-colors ${
                      onCreateEventForDateTime ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer' : ''
                    } ${isSunday ? 'bg-amber-50/10 dark:bg-amber-950/10' : ''}`}
                  >
                    {/* Hover Plus Icon for Editors */}
                    {onCreateEventForDateTime && (
                      <div className="opacity-0 group-hover:opacity-100 absolute right-1 top-1 text-[10px] text-indigo-500 font-bold flex items-center gap-0.5">
                        <Plus className="w-3 h-3" />
                        <span>{hourStr}</span>
                      </div>
                    )}

                    {/* Render matching events */}
                    <div className="space-y-1">
                      {cellEvents.map((evt, eIdx) => {
                        const cat = getCategoryById(evt.categoryId, categories);

                        return (
                          <div
                            key={`${evt.id || 'cell'}-${hour}-${dIdx}-${eIdx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectEvent(evt);
                            }}
                            className={`group/evt relative p-2 rounded-xl text-xs font-medium cursor-pointer shadow-xs hover:shadow-md transition-all ${cat.bgClass} ${cat.borderClass}`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <div className="font-bold text-xs truncate">{evt.title}</div>
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
                                    className="hidden group-hover/evt:flex p-1 rounded hover:bg-rose-200 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 transition-colors shrink-0 cursor-pointer"
                                    title="Delete event"
                                  >
                                    <Trash className="w-3 h-3" />
                                  </button>
                                )
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] opacity-90 font-semibold">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime12h(evt.startTime)} - {formatTime12h(evt.endTime)}
                              </span>
                            </div>
                            {evt.location && (
                              <div className="flex items-center gap-1 text-[10px] opacity-80 mt-1 truncate">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate">{evt.location}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

    </div>
  );
};

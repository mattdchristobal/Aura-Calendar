import React from 'react';
import { CalendarEvent, Category, UserSettings } from '../types';
import { getDaysInMonthGrid, isToday, toYMD, isEventOnDate } from '../utils/dateUtils';
import { getCategoryById } from '../utils/categories';
import { Layers, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles } from 'lucide-react';

interface YearViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  selectedCategoryIds: string[];
  onSelectDate: (date: Date) => void;
  onYearChange: (year: number) => void;
  settings: UserSettings;
  categories?: Category[];
}

export const YearView: React.FC<YearViewProps> = ({
  currentDate,
  events,
  selectedCategoryIds,
  onSelectDate,
  onYearChange,
  settings,
  categories
}) => {
  const currentYear = currentDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => i);

  // Filtered events
  const filteredEvents = events.filter(
    (e) =>
      selectedCategoryIds.length === 0 ||
      selectedCategoryIds.includes(e.categoryId) ||
      !e.categoryId
  );

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-slate-950 overflow-y-auto p-4 lg:p-6 space-y-4">
      
      {/* 12 Months Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {months.map((mIdx) => {
          const daysGrid = getDaysInMonthGrid(currentYear, mIdx, settings.firstDayOfWeek || 0);

          return (
            <div
              key={mIdx}
              className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col"
            >
              {/* Month Title */}
              <div
                onClick={() => onSelectDate(new Date(currentYear, mIdx, 1))}
                className="text-xs font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer mb-2.5 flex items-center justify-between"
              >
                <span>{monthNames[mIdx]}</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {currentYear}
                </span>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 text-center text-[9px] font-bold text-slate-400 mb-1">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
              </div>

              {/* Days Matrix */}
              <div className="grid grid-cols-7 gap-1 text-center flex-1">
                {daysGrid.map(({ date, isCurrentMonth }, dIdx) => {
                  const dateYmd = toYMD(date);
                  const isCurrentToday = isToday(date);
                  const isSunday = date.getDay() === 0;

                  // Count events on this day
                  const dayEvents = filteredEvents.filter((e) => isEventOnDate(e, dateYmd));
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <button
                      key={dIdx}
                      onClick={() => onSelectDate(date)}
                      className={`relative w-full aspect-square text-[10px] font-semibold rounded-md flex items-center justify-center transition-all ${
                        isCurrentToday
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : isCurrentMonth
                          ? isSunday
                            ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'text-slate-300 dark:text-slate-700'
                      }`}
                    >
                      {date.getDate()}
                      {hasEvents && !isCurrentToday && (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-indigo-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

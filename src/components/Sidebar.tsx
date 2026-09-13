import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Tag,
  Check,
  QrCode
} from 'lucide-react';
import { Category, CalendarEvent, ViewType, User } from '../types';
import {
  getDaysInMonthGrid,
  isSameDay,
  isToday,
  toYMD,
  isEventOnDate
} from '../utils/dateUtils';

interface SidebarProps {
  currentDate: Date;
  onSelectDate: (d: Date) => void;
  categories: Category[];
  selectedCategoryIds: string[];
  onToggleCategory: (id: string) => void;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onViewChange: (v: ViewType) => void;
  onNewEvent: () => void;
  currentUser: User;
  onOpenAdmin: () => void;
  onOpenCategoryQr?: (categoryId?: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentDate,
  onSelectDate,
  categories,
  selectedCategoryIds,
  onToggleCategory,
  events,
  onSelectEvent,
  onViewChange,
  onNewEvent,
  currentUser,
  onOpenAdmin,
  onOpenCategoryQr
}) => {
  const [miniMonthDate, setMiniMonthDate] = useState(new Date(currentDate));

  const handleMiniPrev = () => {
    setMiniMonthDate(new Date(miniMonthDate.getFullYear(), miniMonthDate.getMonth() - 1, 1));
  };

  const handleMiniNext = () => {
    setMiniMonthDate(new Date(miniMonthDate.getFullYear(), miniMonthDate.getMonth() + 1, 1));
  };

  const daysGrid = getDaysInMonthGrid(miniMonthDate.getFullYear(), miniMonthDate.getMonth(), 0);

  return (
    <aside className="hidden lg:flex w-72 bg-slate-50/80 dark:bg-slate-900/50 border-r border-slate-200/80 dark:border-slate-800/80 p-4 flex-col gap-4 overflow-y-auto shrink-0">
      
      {/* Mini-Calendar Date Picker */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {miniMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleMiniPrev}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleMiniNext}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-1.5">
          <span>Su</span>
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {daysGrid.map(({ date, isCurrentMonth }, idx) => {
            const isSelected = isSameDay(date, currentDate);
            const isCurrentToday = isToday(date);
            const dateYmd = toYMD(date);
            const hasEvents = events
              .filter(
                (e) =>
                  selectedCategoryIds.length === 0 ||
                  selectedCategoryIds.includes(e.categoryId) ||
                  !e.categoryId
              )
              .some((e) => isEventOnDate(e, dateYmd));

            return (
              <button
                key={idx}
                onClick={() => onSelectDate(date)}
                className={`relative w-full aspect-square text-xs font-semibold rounded-lg flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : isCurrentToday
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200'
                    : isCurrentMonth
                    ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    : 'text-slate-300 dark:text-slate-600'
                }`}
              >
                {date.getDate()}
                {hasEvents && !isSelected && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-indigo-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Tag Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            <Tag className="w-3.5 h-3.5 text-indigo-500" />
            <span>Category Filters</span>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenCategoryQr && (
              <button
                onClick={() => onOpenCategoryQr('all')}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold transition-colors"
                title="Generate Master QR Code for All Categories Overview"
              >
                <QrCode className="w-3 h-3" />
                <span>All QR</span>
              </button>
            )}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              {selectedCategoryIds.length}/{categories.length}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const isChecked = selectedCategoryIds.includes(cat.id);
            const count = events.filter((e) => e.categoryId === cat.id).length;

            return (
              <div
                key={cat.id}
                className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isChecked
                    ? 'bg-slate-100 dark:bg-slate-700/60 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-70'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleCategory(cat.id)}
                  className="flex items-center gap-2 truncate flex-1 text-left"
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cat.dotClass}`} />
                  <span className="truncate">{cat.name}</span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onOpenCategoryQr && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCategoryQr(cat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 hover:text-indigo-600 transition-opacity"
                      title={`QR Code for ${cat.name}`}
                    >
                      <QrCode className="w-3 h-3" />
                    </button>
                  )}
                  <span className="text-[10px] text-slate-400 font-normal">
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleCategory(cat.id)}
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                      isChecked
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Special Sunday Focus Launcher */}
      <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-orange-500/10 dark:from-amber-950/40 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3.5 relative overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-bold mb-1">
              <Sun className="w-4 h-4 text-amber-500 fill-amber-500/30" />
              <span>Sunday Planner</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
              Dedicated view to plan weekend reflections, rest, and upcoming weekly objectives.
            </p>
          </div>
        </div>
        <button
          onClick={() => onViewChange('sunday')}
          className="mt-3 w-full py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
        >
          <span>Open Sunday View</span>
        </button>
      </div>

    </aside>
  );
};

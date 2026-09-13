import React, { useState } from 'react';
import { CalendarEvent, Category, User } from '../types';
import { getCategoryById } from '../utils/categories';
import { formatFullDate, formatTime12h, exportToICal } from '../utils/dateUtils';
import {
  X,
  Clock,
  MapPin,
  Users,
  Edit2,
  Trash,
  Trash2,
  Download,
  Copy,
  Calendar as CalendarIcon,
  CheckCircle,
  AlertCircle,
  Share2,
  Sparkles,
  Check,
  Layers,
  Tag,
  ChevronDown,
  ShieldCheck
} from 'lucide-react';

interface EventInspectorWindowProps {
  event: CalendarEvent | null;
  selectedDateEvents?: CalendarEvent[];
  selectedDate?: Date | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
  onDuplicate: (event: CalendarEvent) => void;
  onUpdateEvent?: (event: CalendarEvent) => void;
  currentUser: User;
  users?: User[];
  categories?: Category[];
  onSaveCategory?: (category: Category) => void;
}

export const EventInspectorWindow: React.FC<EventInspectorWindowProps> = ({
  event,
  selectedDateEvents = [],
  selectedDate,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  onUpdateEvent,
  currentUser,
  users,
  categories,
  onSaveCategory
}) => {
  if (!isOpen) return null;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteAgendaId, setConfirmDeleteAgendaId] = useState<string | null>(null);
  const [isRenamingCategory, setIsRenamingCategory] = useState(false);
  const [renamedCategoryName, setRenamedCategoryName] = useState('');
  const [categorySavedToast, setCategorySavedToast] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [categoryChangedToast, setCategoryChangedToast] = useState<string | null>(null);

  // Single event view vs Daily Agenda view
  const isSingleEvent = !!event;

  const isOutlookEvent = Boolean(
    event &&
      (event.sourceAccountId === 'outlook-ics' ||
        event.sourceAccountId?.toLowerCase().includes('outlook') ||
        event.sourceAccountEmail?.toLowerCase().includes('outlook') ||
        event.sourceAccountEmail?.toLowerCase().includes('microsoft') ||
        event.notes?.toLowerCase().includes('outlook') ||
        event.source === 'external' ||
        Boolean(event.externalEventId))
  );

  const handleSelectEventCategory = (targetCatId: string, targetCatName: string) => {
    if (!event) return;
    setIsCategoryPickerOpen(false);
    if (onUpdateEvent) {
      onUpdateEvent({
        ...event,
        categoryId: targetCatId,
        customizedByAdmin: true,
        adminEditedAt: new Date().toISOString(),
        adminEditedBy: currentUser.name || 'Admin'
      });
    }
    setCategoryChangedToast(`Category updated to "${targetCatName}"`);
    setTimeout(() => setCategoryChangedToast(null), 3000);
  };

  const handleStartRenameCategory = (currentCat: Category) => {
    if (currentUser.role !== 'admin') return;
    setRenamedCategoryName(currentCat.name);
    setIsRenamingCategory(true);
  };

  const handleSaveRenamedCategory = (currentCat: Category) => {
    const trimmed = renamedCategoryName.trim();
    if (!trimmed) return;
    if (onSaveCategory) {
      onSaveCategory({
        ...currentCat,
        name: trimmed
      });
    }
    setIsRenamingCategory(false);
    setCategorySavedToast(true);
    setTimeout(() => setCategorySavedToast(false), 2500);
  };

  const handleExportSingle = () => {
    if (!event) return;
    const ics = exportToICal([event]);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyDetails = () => {
    if (!event) return;
    const eventTemas = Array.isArray(event.temas) && event.temas.length > 0
      ? event.temas
      : (event.tema ? [event.tema] : []);
    const temasText = eventTemas.length > 0 ? `\nTemas: ${eventTemas.join(', ')}` : '';
    const catequistasText = event.attendees && event.attendees.length > 0 ? `\nCatequistas: ${event.attendees.join(', ')}` : '';
    const text = `Event: ${event.title}\nDate: ${event.startDate}\nTime: ${formatTime12h(event.startTime)} - ${formatTime12h(event.endTime)}\nLocation: ${event.location || 'N/A'}${temasText}${catequistasText}`;
    navigator.clipboard.writeText(text);
    alert('Event details copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Drawer Panel */}
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Header Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider truncate">
                {isSingleEvent ? 'Large Event Inspector' : 'Day Events Preview'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {isSingleEvent && event ? formatFullDate(new Date(event.startDate)) : selectedDate ? formatFullDate(selectedDate) : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          
          {isSingleEvent && event ? (
            /* Single Event Large Inspector Details */
            (() => {
              const category = getCategoryById(event.categoryId, categories);

              return (
                <div className="space-y-6">
                  
                  {/* Category Color Banner */}
                  <div className={`p-5 rounded-3xl border shadow-xs ${category.bgClass}`}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {isRenamingCategory && currentUser.role === 'admin' ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveRenamedCategory(category);
                          }}
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={renamedCategoryName}
                            onChange={(e) => setRenamedCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setIsRenamingCategory(false);
                            }}
                            autoFocus
                            className="px-2.5 py-0.5 text-xs font-bold rounded-lg border border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs outline-none focus:ring-2 focus:ring-indigo-500 max-w-[150px]"
                            placeholder="Category name"
                          />
                          <button
                            type="submit"
                            disabled={!renamedCategoryName.trim()}
                            className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                            title="Save category name"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsRenamingCategory(false)}
                            className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 group/cat">
                            <span
                              onClick={() => handleStartRenameCategory(category)}
                              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${category.badgeClass} ${
                                currentUser.role === 'admin'
                                  ? 'cursor-pointer hover:shadow-sm hover:scale-[1.02] active:scale-95'
                                  : ''
                              }`}
                              title={currentUser.role === 'admin' ? 'Admin: Click to rename category label' : undefined}
                            >
                              {category.name}
                            </span>

                            {currentUser.role === 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleStartRenameCategory(category)}
                                className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all opacity-75 hover:opacity-100"
                                title="Rename category definition"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}

                            {categorySavedToast && (
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md animate-in fade-in">
                                Renamed!
                              </span>
                            )}
                          </div>

                          {/* Admin Quick Category Selector */}
                          {currentUser.role === 'admin' && onUpdateEvent && (
                            <div className="relative inline-block">
                              <button
                                type="button"
                                onClick={() => setIsCategoryPickerOpen(!isCategoryPickerOpen)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-2xs cursor-pointer"
                                title="Admin: Change category of this event"
                              >
                                <Tag className="w-3 h-3 text-indigo-500" />
                                <span>Change Category</span>
                                <ChevronDown className="w-3 h-3 text-slate-400" />
                              </button>

                              {isCategoryPickerOpen && (
                                <div
                                  className="absolute left-0 top-full mt-1.5 w-52 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 animate-in fade-in zoom-in-95"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                    Set Event Category
                                  </div>
                                  {(categories || []).map((cat) => {
                                    const isSelected = cat.id === category.id;
                                    return (
                                      <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => handleSelectEventCategory(cat.id, cat.name)}
                                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                                          isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-950/60 font-bold text-indigo-600 dark:text-indigo-400'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <span className={`w-2.5 h-2.5 rounded-full ${cat.dotColor || 'bg-indigo-500'} shrink-0`} />
                                          <span className="truncate">{cat.name}</span>
                                        </div>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {categoryChangedToast && (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full animate-in fade-in flex items-center gap-1 shadow-2xs">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>{categoryChangedToast}</span>
                            </span>
                          )}

                          {/* Outlook Source Indicator Badge */}
                          {isOutlookEvent && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0078D4]/10 text-[#0078D4] dark:bg-[#0078D4]/20 dark:text-sky-300 text-[11px] font-bold border border-[#0078D4]/20 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0078D4] animate-pulse"></span>
                              <span>Outlook Synced</span>
                              {event.customizedByAdmin && (
                                <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded-full bg-[#0078D4] text-white">
                                  Admin Custom
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {(() => {
                        const eventTemas = Array.isArray(event.temas) && event.temas.length > 0
                          ? event.temas
                          : (event.tema ? [event.tema] : []);
                        if (eventTemas.length === 0) return null;
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {eventTemas.map((t, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 shadow-2xs"
                              >
                                <Layers className="w-3 h-3 text-indigo-500" />
                                <span>{t}</span>
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                      {event.title}
                    </h1>

                    {Array.isArray(event.tags) && event.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                        {event.tags.map((tag, tagIdx) => (
                          <span
                            key={tagIdx}
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70 flex items-center gap-1 shadow-2xs"
                          >
                            <Tag className="w-2.5 h-2.5 text-indigo-500" />
                            <span>#{tag}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Timing & Location Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3">
                      <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Date & Time
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {event.startDate}
                        </div>
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {formatTime12h(event.startTime)} &ndash; {formatTime12h(event.endTime)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Location
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {event.location || 'No location set'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Catequistas Section */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-500" />
                        <span>Catequistas</span>
                      </div>
                      {event.attendees && event.attendees.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                          {event.attendees.length}
                        </span>
                      )}
                    </div>

                    {event.attendees && event.attendees.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {event.attendees.map((att, idx) => {
                          const matchedUser = users?.find((u) => u.name === att || (u.email && u.email === att));
                          return (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-2xs"
                            >
                              <span
                                className={`w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0 ${
                                  matchedUser?.avatarColor || 'bg-indigo-600'
                                }`}
                              >
                                {att.charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate max-w-[180px]">{att}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                        No catequistas assigned
                      </p>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            /* Day Agenda List Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Events on {selectedDate ? formatFullDate(selectedDate) : 'Selected Date'}
                </h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  {selectedDateEvents.length} Events
                </span>
              </div>

              {selectedDateEvents.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No events scheduled for this day.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateEvents.map((evt, evtIdx) => {
                    const cat = getCategoryById(evt.categoryId);

                    return (
                      <div
                        key={`${evt.id || 'inspect'}-${evt.startDate}-${evtIdx}`}
                        onClick={() => {
                          if (currentUser.role !== 'viewer') onEdit(evt);
                        }}
                        className={`p-4 rounded-2xl border shadow-xs transition-all ${cat.bgClass} ${cat.borderClass} ${currentUser.role !== 'viewer' ? 'hover:shadow-md cursor-pointer' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.badgeClass}`}>
                              {cat.name}
                            </span>
                            {(() => {
                              const eventTemas = Array.isArray(evt.temas) && evt.temas.length > 0
                                ? evt.temas
                                : (evt.tema ? [evt.tema] : []);
                              return eventTemas.map((t, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50/90 dark:bg-indigo-950/90 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center gap-1"
                                >
                                  <Layers className="w-2.5 h-2.5 text-indigo-500" />
                                  <span>{t}</span>
                                </span>
                              ));
                            })()}
                          </div>
                          <span className="text-xs font-bold opacity-80 shrink-0">
                            {formatTime12h(evt.startTime)} - {formatTime12h(evt.endTime)}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {evt.title}
                        </h4>
                        {evt.location && (
                          <div className="text-xs opacity-80 mt-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{evt.location}</span>
                          </div>
                        )}
                        {evt.attendees && evt.attendees.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap pt-1.5 border-t border-black/5 dark:border-white/5">
                            <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-0.5">Catequistas:</span>
                            {evt.attendees.map((att, idx) => {
                              const matchedUser = users?.find((u) => u.name === att || (u.email && u.email === att));
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200/60 dark:border-slate-700/60"
                                >
                                  <span
                                    className={`w-3 h-3 rounded-full text-[7px] font-bold text-white flex items-center justify-center shrink-0 ${
                                      matchedUser?.avatarColor || 'bg-indigo-600'
                                    }`}
                                  >
                                    {att.charAt(0).toUpperCase()}
                                  </span>
                                  <span>{att}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Admin Quick Category Selector in Agenda Card */}
                        {currentUser.role === 'admin' && (
                          <div
                            className="mt-2.5 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                                Category:
                              </span>
                              <select
                                value={evt.categoryId}
                                onChange={(e) => {
                                  const newCatId = e.target.value;
                                  if (onUpdateEvent) {
                                    onUpdateEvent({
                                      ...evt,
                                      categoryId: newCatId,
                                      customizedByAdmin: true,
                                      adminEditedAt: new Date().toISOString(),
                                      adminEditedBy: currentUser.name || 'Admin'
                                    });
                                  }
                                }}
                                className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-white/95 dark:bg-slate-800/95 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
                              >
                                {(categories || []).map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onEdit(evt)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                                <span>Edit Details</span>
                              </button>

                              {onDelete && currentUser.role === 'admin' && (
                                confirmDeleteAgendaId === evt.id ? (
                                  <div className="flex items-center gap-1 animate-in fade-in duration-150">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onDelete(evt.id);
                                        setConfirmDeleteAgendaId(null);
                                      }}
                                      className="py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                                    >
                                      <Trash className="w-2.5 h-2.5" />
                                      <span>Confirm?</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteAgendaId(null)}
                                      className="py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-medium transition-colors cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteAgendaId(evt.id)}
                                    className="py-1 px-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Trash className="w-2.5 h-2.5" />
                                    <span>Delete</span>
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Action Bar */}
        {isSingleEvent && event && (
          <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {currentUser.role !== 'viewer' ? (
              <>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <button
                    onClick={() => onEdit(event)}
                    className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => onDuplicate(event)}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplicate</span>
                  </button>

                  <button
                    onClick={handleExportSingle}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors shrink-0"
                    title="Export iCal .ics"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>iCal</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  {onDelete && currentUser.role === 'admin' && (
                    confirmDelete ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(event.id);
                            onClose();
                          }}
                          className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <Trash className="w-3.5 h-3.5" />
                          <span>Confirm Delete?</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="py-2.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="py-2.5 px-3 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )
                  )}
                </div>
              </>
            ) : (
              <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Viewer (Read-Only Mode)
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    Editing restricted to Admins
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportSingle}
                    className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .ics</span>
                  </button>

                  <button
                    onClick={handleCopyDetails}
                    className="py-1.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Copy Summary</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};

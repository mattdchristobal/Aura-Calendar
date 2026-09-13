import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent, Category, User } from '../types';
import {
  X,
  Clock,
  Calendar as CalendarIcon,
  MapPin,
  Users,
  AlertCircle,
  Trash,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Lock,
  Edit3,
  Tag,
  Layers,
  Plus,
  Search,
  Settings2
} from 'lucide-react';

// Generate 15-minute interval time options from 00:00 to 23:45
const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const label = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  return { val, label };
});

const DURATION_PRESETS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '3 hours', minutes: 180 },
];

const formatTime12h = (time24: string): string => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
};

const formatDateDisplay = (ymd: string): string => {
  if (!ymd) return '';
  try {
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) return ymd;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return ymd;
  }
};

const getTodayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getTomorrowYmd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getNextWeekYmd = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Partial<CalendarEvent>) => void;
  onDelete?: (eventId: string) => void;
  initialEvent?: CalendarEvent | null;
  initialDateYmd?: string;
  initialTime24?: string;
  categories: Category[];
  currentUser: User;
  users?: User[];
  onOpenAdminCategories?: () => void;
  temas?: string[];
  onOpenSettings?: () => void;
  onOpenTemasSettings?: () => void;
  onAddTema?: (newTema: string) => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialEvent,
  initialDateYmd,
  initialTime24,
  categories,
  currentUser,
  users = [],
  temas = ['Tema 1', 'Tema 2', 'Tema 3'],
  onOpenAdminCategories,
  onOpenSettings,
  onOpenTemasSettings,
  onAddTema
}) => {
  // Check if member editing is restricted (members editing an existing event cannot modify core timing/title/location/notes)
  const isEditing = !!initialEvent;
  const isMemberRestricted = currentUser.role !== 'admin' && isEditing;

  const isOutlookEvent = Boolean(
    initialEvent &&
      (initialEvent.sourceAccountId === 'outlook-ics' ||
        initialEvent.sourceAccountId?.toLowerCase().includes('outlook') ||
        initialEvent.sourceAccountEmail?.toLowerCase().includes('outlook') ||
        initialEvent.sourceAccountEmail?.toLowerCase().includes('microsoft') ||
        initialEvent.notes?.toLowerCase().includes('outlook') ||
        initialEvent.source === 'external' ||
        Boolean(initialEvent.externalEventId))
  );

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [categoryId, setCategoryId] = useState('work');
  const [selectedTemas, setSelectedTemas] = useState<string[]>(['Tema 1']);
  const [eventTags, setEventTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Category & Tags dropdown menu state
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Temas dropdown menu state
  const [isTemasDropdownOpen, setIsTemasDropdownOpen] = useState(false);
  const [newTemaInput, setNewTemaInput] = useState('');
  const temasDropdownRef = useRef<HTMLDivElement>(null);

  // Attendees dropdown state
  const [isAttendeesDropdownOpen, setIsAttendeesDropdownOpen] = useState(false);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Date and Time pickers dropdown state: auto-closes immediately upon selection
  type PickerDropdownType = 'startDate' | 'endDate' | 'startTime' | 'endTime' | null;
  const [openPickerDropdown, setOpenPickerDropdown] = useState<PickerDropdownType>(null);
  const [pickerCalendarMonth, setPickerCalendarMonth] = useState<Date>(() => new Date());
  const dateTimePickerRef = useRef<HTMLDivElement>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Track the modal session using a ref so background polling/syncs NEVER wipe out user typing!
  const lastSessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      lastSessionKeyRef.current = null;
      setIsAttendeesDropdownOpen(false);
      setIsCategoryDropdownOpen(false);
      setIsTemasDropdownOpen(false);
      setOpenPickerDropdown(null);
      setConfirmDelete(false);
      setErrorMessage('');
      setCategorySearchQuery('');
      setNewTemaInput('');
      setTagInput('');
      return;
    }

    const currentSessionKey = initialEvent ? `edit_${initialEvent.id}` : `new_${initialDateYmd}_${initialTime24}`;

    // Only populate fields if opening a fresh session or switching event ID
    if (lastSessionKeyRef.current !== currentSessionKey) {
      lastSessionKeyRef.current = currentSessionKey;
      setConfirmDelete(false);
      setErrorMessage('');
      setIsAttendeesDropdownOpen(false);
      setIsCategoryDropdownOpen(false);
      setIsTemasDropdownOpen(false);
      setOpenPickerDropdown(null);
      setAttendeeSearchQuery('');
      setCategorySearchQuery('');
      setNewTemaInput('');
      setTagInput('');

      if (initialEvent) {
        setTitle(initialEvent.title || '');
        setStartDate(initialEvent.startDate || '');
        setEndDate(initialEvent.endDate || initialEvent.startDate || '');
        setStartTime(initialEvent.startTime || '09:00');
        setEndTime(initialEvent.endTime || '10:00');
        setIsAllDay(!!initialEvent.isAllDay);
        setCategoryId(initialEvent.categoryId || (categories[0]?.id || 'work'));
        const initTemas = Array.isArray(initialEvent.temas) && initialEvent.temas.length > 0
          ? [...initialEvent.temas]
          : (initialEvent.tema ? [initialEvent.tema] : [temas[0] || 'Tema 1']);
        setSelectedTemas(initTemas);
        setEventTags(Array.isArray(initialEvent.tags) ? [...initialEvent.tags] : []);
        setLocation(initialEvent.location || '');
        setDescription(initialEvent.description || '');
        setNotes(initialEvent.notes || '');
        setRecurrence(initialEvent.recurrence || 'none');
        setAttendees(Array.isArray(initialEvent.attendees) ? [...initialEvent.attendees] : []);
      } else {
        const todayYmd = initialDateYmd || new Date().toISOString().split('T')[0];
        const startT = initialTime24 || '09:00';
        const [h, m] = startT.split(':').map(Number);
        const endH = String((h + 1) % 24).padStart(2, '0');
        const endT = `${endH}:${String(m).padStart(2, '0')}`;

        setTitle('');
        setStartDate(todayYmd);
        setEndDate(todayYmd);
        setStartTime(startT);
        setEndTime(endT);
        setIsAllDay(false);
        setCategoryId(categories[0]?.id || 'work');
        setSelectedTemas([temas[0] || 'Tema 1']);
        setEventTags([]);
        setLocation('');
        setDescription('');
        setNotes('');
        setRecurrence('none');
        setAttendees([currentUser.name]);
      }

      // Auto-focus title input on fresh open if not restricted
      if (!isMemberRestricted) {
        setTimeout(() => {
          titleInputRef.current?.focus();
        }, 50);
      }
    }
  }, [isOpen, initialEvent?.id, initialDateYmd, initialTime24, isMemberRestricted, temas]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dateTimePickerRef.current && !dateTimePickerRef.current.contains(target)) {
        setOpenPickerDropdown(null);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsAttendeesDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(target)) {
        setIsCategoryDropdownOpen(false);
      }
      if (temasDropdownRef.current && !temasDropdownRef.current.contains(target)) {
        setIsTemasDropdownOpen(false);
      }
    };
    if (openPickerDropdown || isAttendeesDropdownOpen || isCategoryDropdownOpen || isTemasDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openPickerDropdown, isAttendeesDropdownOpen, isCategoryDropdownOpen, isTemasDropdownOpen]);

  // Calculate current duration difference in minutes between start and end
  const activeDurationMinutes = (() => {
    if (isAllDay || !startTime || !endTime || !startDate || !endDate) return null;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;

    const [sy, smon, sd] = startDate.split('-').map(Number);
    const [ey, emon, ed] = endDate.split('-').map(Number);
    if (!sy || !smon || !sd || !ey || !emon || !ed) return null;

    const startMs = new Date(sy, smon - 1, sd, sh, sm).getTime();
    const endMs = new Date(ey, emon - 1, ed, eh, em).getTime();
    const diff = Math.round((endMs - startMs) / (1000 * 60));
    return diff > 0 ? diff : null;
  })();

  // Apply quick default time preset (15 min, 30 min, 1, 2, 3 hours)
  const handleApplyDuration = (minutes: number) => {
    if (isMemberRestricted) return;
    setIsAllDay(false);

    const [sh, sm] = (startTime || '09:00').split(':').map(Number);
    const startMins = (isNaN(sh) ? 9 : sh) * 60 + (isNaN(sm) ? 0 : sm);
    const endTotalMins = startMins + minutes;

    const daysToAdd = Math.floor(endTotalMins / (24 * 60));
    const endMinutesInDay = endTotalMins % (24 * 60);

    const endH = Math.floor(endMinutesInDay / 60);
    const endM = endMinutesInDay % 60;

    const newEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    setEndTime(newEndTime);

    if (startDate) {
      if (daysToAdd > 0) {
        const [y, m, d] = startDate.split('-').map(Number);
        const nextDate = new Date(y, m - 1, d + daysToAdd);
        const nextYmd = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
        setEndDate(nextYmd);
      } else {
        setEndDate(startDate);
      }
    }

    setOpenPickerDropdown(null);
  };

  // Dropdown open triggers with calendar synchronization
  const openStartDatePicker = () => {
    if (isMemberRestricted) return;
    if (startDate) {
      const [y, m] = startDate.split('-').map(Number);
      if (y && m) setPickerCalendarMonth(new Date(y, m - 1, 1));
    }
    setOpenPickerDropdown((prev) => (prev === 'startDate' ? null : 'startDate'));
  };

  const openEndDatePicker = () => {
    if (isMemberRestricted) return;
    const targetYmd = endDate || startDate;
    if (targetYmd) {
      const [y, m] = targetYmd.split('-').map(Number);
      if (y && m) setPickerCalendarMonth(new Date(y, m - 1, 1));
    }
    setOpenPickerDropdown((prev) => (prev === 'endDate' ? null : 'endDate'));
  };

  // Date selection handlers that automatically close the dropdown immediately
  const handleSelectStartDate = (ymd: string) => {
    setStartDate(ymd);
    if (!endDate || endDate < ymd) {
      setEndDate(ymd);
    }
    setOpenPickerDropdown(null);
  };

  const handleSelectEndDate = (ymd: string) => {
    setEndDate(ymd);
    setOpenPickerDropdown(null);
  };

  // Time selection handlers that automatically close the dropdown immediately
  const handleSelectStartTime = (timeVal: string) => {
    setStartTime(timeVal);
    // If end time is before or equal to start time on same date, advance end time
    if (startDate === endDate && endTime <= timeVal) {
      const [sh, sm] = timeVal.split(':').map(Number);
      const duration = activeDurationMinutes || 60;
      const endTotal = sh * 60 + sm + duration;
      const endH = Math.floor(endTotal / 60) % 24;
      const endM = endTotal % 60;
      setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
      if (Math.floor(endTotal / (24 * 60)) > 0) {
        const [y, m, d] = startDate.split('-').map(Number);
        const nextDate = new Date(y, m - 1, d + 1);
        setEndDate(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`);
      }
    }
    setOpenPickerDropdown(null);
  };

  const handleSelectEndTime = (timeVal: string) => {
    setEndTime(timeVal);
    setOpenPickerDropdown(null);
  };

  const renderCalendarDays = (currentDateYmd: string, onSelectDate: (ymd: string) => void) => {
    const year = pickerCalendarMonth.getFullYear();
    const month = pickerCalendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const monthTitle = pickerCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const todayYmd = getTodayYmd();

    const blanks = [];
    for (let i = 0; i < firstDay; i++) {
      blanks.push(<div key={`blank-${i}`} className="w-7 h-7 sm:w-8 sm:h-8" />);
    }

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSelected = ymd === currentDateYmd;
      const isToday = ymd === todayYmd;

      days.push(
        <button
          key={ymd}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectDate(ymd);
          }}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
            isSelected
              ? 'bg-indigo-600 text-white font-bold shadow-2xs'
              : isToday
              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="space-y-2 select-none">
        {/* Quick Shortcuts */}
        <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectDate(getTodayYmd());
            }}
            className="flex-1 py-1 px-1.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors text-center cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectDate(getTomorrowYmd());
            }}
            className="flex-1 py-1 px-1.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors text-center cursor-pointer"
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectDate(getNextWeekYmd());
            }}
            className="flex-1 py-1 px-1.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors text-center whitespace-nowrap cursor-pointer"
          >
            +1 Week
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPickerCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
            }}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {monthTitle}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPickerCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
            }}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
          <span>Su</span>
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {blanks}
          {days}
        </div>
      </div>
    );
  };

  const renderTimeList = (currentTimeVal: string, onSelectTime: (val: string) => void) => {
    return (
      <div className="p-1 max-h-56 overflow-y-auto space-y-0.5">
        {TIME_SLOTS.map((slot) => {
          const isSelected = slot.val === currentTimeVal;
          return (
            <button
              key={slot.val}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTime(slot.val);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
              }`}
            >
              <span>{slot.label}</span>
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
            </button>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  const handleToggleAttendee = (attendeeName: string) => {
    const cleanName = attendeeName.trim();
    if (!cleanName) return;

    if (attendees.includes(cleanName)) {
      setAttendees(attendees.filter((a) => a !== cleanName));
    } else {
      setAttendees([...attendees, cleanName]);
    }
  };

  const handleRemoveAttendee = (name: string) => {
    setAttendees(attendees.filter((a) => a !== name));
  };

  const handleAddCustomAttendee = () => {
    const custom = attendeeSearchQuery.trim();
    if (custom && !attendees.includes(custom)) {
      setAttendees([...attendees, custom]);
      setAttendeeSearchQuery('');
    }
  };

  const handleSelectAllTeam = () => {
    const allNames = Array.from(new Set([...attendees, ...users.map((u) => u.name)]));
    setAttendees(allNames);
  };

  const handleClearAllAttendees = () => {
    setAttendees([]);
  };

  const handleAddTag = (tagToAdd?: string) => {
    const raw = tagToAdd !== undefined ? tagToAdd : tagInput;
    const clean = raw.trim().replace(/^#/, '');
    if (!clean) return;
    if (!eventTags.includes(clean)) {
      setEventTags((prev) => [...prev, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEventTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleToggleTema = (temaItem: string) => {
    if (isMemberRestricted) return;
    setSelectedTemas((prev) => {
      if (prev.includes(temaItem)) {
        const filtered = prev.filter((t) => t !== temaItem);
        return filtered.length > 0 ? filtered : [temaItem];
      } else {
        return [...prev, temaItem];
      }
    });
  };

  const handleSelectSingleTema = (temaItem: string) => {
    if (isMemberRestricted) return;
    setSelectedTemas([temaItem]);
    setIsTemasDropdownOpen(false);
  };

  const handleAddNewTema = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newTemaInput.trim();
    if (!clean) return;
    if (onAddTema) {
      onAddTema(clean);
    }
    if (!selectedTemas.includes(clean)) {
      setSelectedTemas([clean]);
    }
    setNewTemaInput('');
    setIsTemasDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // If restricted member, preserve all core scheduling values exactly as in initialEvent
    if (isMemberRestricted && initialEvent) {
      onSave({
        id: initialEvent.id,
        title: initialEvent.title,
        startDate: initialEvent.startDate,
        endDate: initialEvent.endDate,
        startTime: initialEvent.startTime,
        endTime: initialEvent.endTime,
        isAllDay: initialEvent.isAllDay,
        categoryId: initialEvent.categoryId,
        tags: initialEvent.tags,
        tema: initialEvent.tema,
        temas: initialEvent.temas || (initialEvent.tema ? [initialEvent.tema] : []),
        priority: initialEvent.priority || 'medium',
        location: initialEvent.location,
        description: description.trim(),
        notes: initialEvent.notes,
        recurrence: initialEvent.recurrence,
        attendees,
        userId: initialEvent.userId || currentUser.id,
        createdBy: initialEvent.createdBy || currentUser.name
      });
      onClose();
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please enter an event title.');
      titleInputRef.current?.focus();
      return;
    }

    if (!startDate) {
      setErrorMessage('Please select a start date.');
      return;
    }

    if (!isAllDay && startTime >= endTime && startDate === endDate) {
      setErrorMessage('End time must be after start time.');
      return;
    }

    onSave({
      id: initialEvent?.id,
      title: title.trim(),
      startDate,
      endDate: endDate || startDate,
      startTime: isAllDay ? '00:00' : startTime,
      endTime: isAllDay ? '23:59' : endTime,
      isAllDay,
      categoryId,
      tags: eventTags,
      tema: selectedTemas.length > 0 ? selectedTemas[0] : undefined,
      temas: selectedTemas,
      priority: initialEvent?.priority || 'medium',
      location: location.trim(),
      description: description.trim(),
      notes: notes.trim(),
      recurrence,
      attendees,
      userId: initialEvent?.userId || currentUser.id,
      createdBy: initialEvent?.createdBy || currentUser.name,
      source: initialEvent?.source || 'local',
      sourceAccountId: initialEvent?.sourceAccountId,
      sourceAccountEmail: initialEvent?.sourceAccountEmail,
      externalEventId: initialEvent?.externalEventId,
      customizedByAdmin: currentUser.role === 'admin' ? true : initialEvent?.customizedByAdmin,
      adminEditedAt: currentUser.role === 'admin' ? new Date().toISOString() : initialEvent?.adminEditedAt,
      adminEditedBy: currentUser.role === 'admin' ? (currentUser.name || 'Admin') : initialEvent?.adminEditedBy
    });

    onClose();
  };

  // Filter users in dropdown
  const filteredUsers = users.filter((u) => {
    const query = attendeeSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      u.name.toLowerCase().includes(query) ||
      u.username.toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query)
    );
  });

  const isExactUserMatch = users.some(
    (u) =>
      u.name.toLowerCase() === attendeeSearchQuery.trim().toLowerCase() ||
      u.email.toLowerCase() === attendeeSearchQuery.trim().toLowerCase()
  );

  const selectedCategory = categories.find((c) => c.id === categoryId) || categories[0] || {
    id: 'work',
    name: 'General',
    color: 'indigo',
    hex: '#4f46e5',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/60',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    borderClass: 'border-indigo-200 dark:border-indigo-800',
    dotClass: 'bg-indigo-500',
    badgeClass: 'bg-indigo-100 text-indigo-800'
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain p-2 sm:p-4 flex flex-col items-center justify-start sm:justify-center bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[88dvh] my-auto relative">
        
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80 shrink-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {initialEvent
                  ? isMemberRestricted
                    ? 'Edit Event (Attendees & Notes)'
                    : isOutlookEvent
                    ? 'Edit Outlook Event'
                    : 'Edit Event'
                  : 'Schedule New Event'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isMemberRestricted
                  ? 'Update catechists and description'
                  : isOutlookEvent
                  ? 'Admin: Update category, temas, tags and schedule'
                  : 'Enter timing, category tag, and event details'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            {/* Quick Save button in header for immediate access without scrolling */}
            <button
              type="submit"
              form="event-editor-form"
              id="event-modal-header-save-btn"
              className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Save Changes"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden xs:inline">Save</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <form id="event-editor-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar overscroll-contain pb-6">

          {/* Outlook Synced Event Banner */}
          {isOutlookEvent && (
            <div className="p-3 rounded-2xl bg-sky-50/90 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/70 flex items-start gap-2.5 animate-in fade-in duration-150">
              <div className="w-6 h-6 rounded-lg bg-[#0078D4] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs mt-0.5">
                O
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-sky-950 dark:text-sky-100">
                    Microsoft Outlook Synced Event
                  </span>
                  {currentUser.role === 'admin' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      Admin Editable
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      External Synced
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-sky-800 dark:text-sky-200/90 mt-0.5 leading-relaxed">
                  {currentUser.role === 'admin'
                    ? 'As an Admin, you can change the category tag, temas, event tags, times, or notes. Your customizations are preserved across Outlook synchronization.'
                    : 'This event was synchronized from an Outlook calendar feed. Contact an administrator to update its category.'}
                </p>
              </div>
            </div>
          )}

          {/* Member Permission Notice */}
          {isMemberRestricted && (
            <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/70 flex items-start gap-2.5 animate-in fade-in duration-150">
              <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <span className="font-bold">Member Notice:</span> You can edit{' '}
                <strong className="underline decoration-indigo-400">Catequistas</strong> and{' '}
                <strong className="underline decoration-indigo-400">Description</strong>. Date, time, category tag, and location are admin-controlled.
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Event Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Event Title *
              </label>
              {isMemberRestricted && (
                <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Admin Only
                </span>
              )}
            </div>
            <input
              ref={titleInputRef}
              type="text"
              disabled={isMemberRestricted}
              placeholder="e.g. Sunday Catechesis, Team Sync, Workshop"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                isMemberRestricted
                  ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 cursor-not-allowed'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500'
              }`}
              required={!isMemberRestricted}
            />
          </div>

          {/* Classification Row: Category & Tags Dropdown + Temas Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* 1. Category & Tags Dropdown */}
            <div ref={categoryDropdownRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Category &amp; Tags</span>
                </label>
                {isMemberRestricted && (
                  <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Admin Only
                  </span>
                )}
              </div>

              {/* Category Dropdown Trigger Button */}
              <button
                type="button"
                id="event-modal-category-dropdown-trigger"
                disabled={isMemberRestricted}
                onClick={() => {
                  if (isMemberRestricted) return;
                  setIsCategoryDropdownOpen((prev) => !prev);
                  setIsTemasDropdownOpen(false);
                  setOpenPickerDropdown(null);
                  setIsAttendeesDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isMemberRestricted
                    ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 cursor-not-allowed'
                    : isCategoryDropdownOpen
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 ${selectedCategory.dotClass || 'bg-indigo-500'}`}
                    style={selectedCategory.hex ? { backgroundColor: selectedCategory.hex } : undefined}
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {selectedCategory.name}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate hidden xs:inline-block ${selectedCategory.bgClass} ${selectedCategory.textClass} border ${selectedCategory.borderClass}`}>
                    Tag
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-1.5 ${
                    isCategoryDropdownOpen ? 'rotate-180 text-indigo-600' : ''
                  }`}
                />
              </button>

              {/* Category Dropdown Popover */}
              {isCategoryDropdownOpen && (
                <div className="absolute top-full left-0 right-0 sm:right-auto sm:w-80 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                  {/* Search Filter if many categories */}
                  {categories.length > 4 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search categories..."
                        value={categorySearchQuery}
                        onChange={(e) => setCategorySearchQuery(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  {/* Categories List */}
                  <div className="max-h-52 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {categories
                      .filter((c) =>
                        categorySearchQuery.trim()
                          ? c.name.toLowerCase().includes(categorySearchQuery.trim().toLowerCase())
                          : true
                      )
                      .map((cat) => {
                        const isSelected = cat.id === categoryId;
                        return (
                          <div
                            key={cat.id}
                            id={`category-opt-${cat.id}`}
                            onClick={() => {
                              setCategoryId(cat.id);
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 font-bold text-indigo-900 dark:text-indigo-200'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-3.5 h-3.5 rounded-full shrink-0 ${cat.dotClass || 'bg-indigo-500'}`}
                                style={cat.hex ? { backgroundColor: cat.hex } : undefined}
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold block truncate">
                                  {cat.name}
                                </span>
                                {cat.description && (
                                  <span className="text-[10px] text-slate-400 block truncate">
                                    {cat.description}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cat.bgClass} ${cat.textClass} border ${cat.borderClass}`}>
                                {cat.name}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Settings Link for Admins */}
                  {onOpenAdminCategories && currentUser.role === 'admin' && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCategoryDropdownOpen(false);
                          onOpenAdminCategories();
                        }}
                        className="w-full py-1.5 px-2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>Manage Category Tags in Settings</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Temas Dropdown */}
            <div ref={temasDropdownRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Temas</span>
                  {selectedTemas.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                      {selectedTemas.length}
                    </span>
                  )}
                </label>
                {isMemberRestricted && (
                  <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Admin Only
                  </span>
                )}
              </div>

              {/* Temas Dropdown Trigger Button */}
              <button
                type="button"
                id="event-modal-temas-dropdown-trigger"
                disabled={isMemberRestricted}
                onClick={() => {
                  if (isMemberRestricted) return;
                  setIsTemasDropdownOpen((prev) => !prev);
                  setIsCategoryDropdownOpen(false);
                  setOpenPickerDropdown(null);
                  setIsAttendeesDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isMemberRestricted
                    ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 cursor-not-allowed'
                    : isTemasDropdownOpen
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                  <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  {selectedTemas.length > 0 ? (
                    <div className="flex items-center gap-1 truncate">
                      {selectedTemas.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">Select Tema...</span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-1.5 ${
                    isTemasDropdownOpen ? 'rotate-180 text-indigo-600' : ''
                  }`}
                />
              </button>

              {/* Temas Dropdown Popover */}
              {isTemasDropdownOpen && (
                <div className="absolute top-full right-0 left-0 sm:left-auto sm:w-80 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
                    <span>Available Temas ({temas.length})</span>
                    <span className="text-[10px] text-slate-400">Click to assign</span>
                  </div>

                  {/* Temas List */}
                  <div className="max-h-52 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {temas.map((temaItem) => {
                      const isSelected = selectedTemas.includes(temaItem);
                      return (
                        <div
                          key={temaItem}
                          id={`tema-opt-${temaItem.replace(/\s+/g, '-').toLowerCase()}`}
                          onClick={() => handleToggleTema(temaItem)}
                          className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 font-bold text-indigo-900 dark:text-indigo-200'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 shrink-0">
                              <Layers className="w-2.5 h-2.5 text-indigo-500" />
                              <span>{temaItem}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSingleTema(temaItem);
                              }}
                              className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5 cursor-pointer"
                              title="Set as sole Tema"
                            >
                              Set Sole
                            </button>
                            <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Inline Add New Tema */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Add custom Tema..."
                      value={newTemaInput}
                      onChange={(e) => setNewTemaInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewTema();
                        }
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddNewTema()}
                      disabled={!newTemaInput.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Settings Link for Temas */}
                  {(onOpenTemasSettings || onOpenSettings) && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsTemasDropdownOpen(false);
                          if (onOpenTemasSettings) onOpenTemasSettings();
                          else if (onOpenSettings) onOpenSettings();
                        }}
                        className="w-full py-1 px-2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>Manage Temas in Settings</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Event Tags Badges & Custom Tag Input */}
          <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-indigo-500" />
                <span>Event Tags</span>
                {eventTags.length > 0 && (
                  <span className="text-[10px] text-slate-400">({eventTags.length})</span>
                )}
              </span>
              <span className="text-[10px] text-slate-400">Attach keywords or badges</span>
            </div>

            {/* Display Active Tags */}
            <div className="flex flex-wrap items-center gap-1.5 min-h-[26px]">
              {/* Category tag chip */}
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${selectedCategory.bgClass} ${selectedCategory.textClass} border ${selectedCategory.borderClass} flex items-center gap-1`}>
                <span className={`w-1.5 h-1.5 rounded-full ${selectedCategory.dotClass}`} />
                <span>{selectedCategory.name}</span>
              </span>

              {/* Tema chips */}
              {selectedTemas.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                >
                  <Layers className="w-2.5 h-2.5 text-indigo-500" />
                  <span>{t}</span>
                </span>
              ))}

              {/* Custom tags */}
              {eventTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1 animate-in fade-in duration-100"
                >
                  <span>#{tag}</span>
                  {!isMemberRestricted && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="p-0.5 hover:text-rose-500 rounded transition-colors cursor-pointer"
                      title="Remove tag"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </span>
              ))}

              {/* Quick Tag Adder Input */}
              {!isMemberRestricted && (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="+ Add tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="w-24 px-2 py-0.5 text-[11px] rounded-md border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:w-36 focus:border-indigo-500 transition-all"
                  />
                  {tagInput.trim() && (
                    <button
                      type="button"
                      onClick={() => handleAddTag()}
                      className="p-1 rounded bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-700 cursor-pointer"
                      title="Add tag"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Date & Time Picker Group */}
          <div
            ref={dateTimePickerRef}
            className={`p-3.5 rounded-2xl border space-y-3 transition-colors ${
              isMemberRestricted
                ? 'bg-slate-100/60 dark:bg-slate-800/30 border-slate-200/60 dark:border-slate-800/60'
                : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Date &amp; Time</span>
              </span>

              <label
                className={`flex items-center gap-2 text-xs font-medium select-none ${
                  isMemberRestricted ? 'text-slate-400 cursor-not-allowed' : 'text-slate-600 dark:text-slate-300 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={isMemberRestricted}
                  checked={isAllDay}
                  onChange={(e) => {
                    setIsAllDay(e.target.checked);
                    setOpenPickerDropdown(null);
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span>All day</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Start Date & Time */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Starts
                </label>
                <div className="flex gap-2">
                  {/* Start Date Trigger */}
                  <div className="relative flex-1 min-w-0">
                    <button
                      type="button"
                      disabled={isMemberRestricted}
                      onClick={openStartDatePicker}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isMemberRestricted
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                          : openPickerDropdown === 'startDate'
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{formatDateDisplay(startDate) || 'Pick date'}</span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${openPickerDropdown === 'startDate' ? 'rotate-180 text-indigo-600' : ''}`} />
                    </button>

                    {/* Start Date Dropdown Popover */}
                    {openPickerDropdown === 'startDate' && (
                      <div className="absolute top-full left-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 w-72 animate-in fade-in zoom-in-95 duration-100">
                        {renderCalendarDays(startDate, handleSelectStartDate)}
                      </div>
                    )}
                  </div>

                  {/* Start Time Trigger */}
                  {!isAllDay && (
                    <div className="relative w-28 sm:w-32 shrink-0">
                      <button
                        type="button"
                        disabled={isMemberRestricted}
                        onClick={() => {
                          if (isMemberRestricted) return;
                          setOpenPickerDropdown((prev) => (prev === 'startTime' ? null : 'startTime'));
                        }}
                        className={`w-full px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                          isMemberRestricted
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                            : openPickerDropdown === 'startTime'
                            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{formatTime12h(startTime)}</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${openPickerDropdown === 'startTime' ? 'rotate-180 text-indigo-600' : ''}`} />
                      </button>

                      {/* Start Time Dropdown Popover */}
                      {openPickerDropdown === 'startTime' && (
                        <div className="absolute top-full right-0 sm:left-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-44 animate-in fade-in zoom-in-95 duration-100">
                          {renderTimeList(startTime, handleSelectStartTime)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* End Date & Time */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Ends
                </label>
                <div className="flex gap-2">
                  {/* End Date Trigger */}
                  <div className="relative flex-1 min-w-0">
                    <button
                      type="button"
                      disabled={isMemberRestricted}
                      onClick={openEndDatePicker}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isMemberRestricted
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                          : openPickerDropdown === 'endDate'
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{formatDateDisplay(endDate) || 'Pick date'}</span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${openPickerDropdown === 'endDate' ? 'rotate-180 text-indigo-600' : ''}`} />
                    </button>

                    {/* End Date Dropdown Popover */}
                    {openPickerDropdown === 'endDate' && (
                      <div className="absolute top-full left-0 sm:right-0 sm:left-auto mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 w-72 animate-in fade-in zoom-in-95 duration-100">
                        {renderCalendarDays(endDate, handleSelectEndDate)}
                      </div>
                    )}
                  </div>

                  {/* End Time Trigger */}
                  {!isAllDay && (
                    <div className="relative w-28 sm:w-32 shrink-0">
                      <button
                        type="button"
                        disabled={isMemberRestricted}
                        onClick={() => {
                          if (isMemberRestricted) return;
                          setOpenPickerDropdown((prev) => (prev === 'endTime' ? null : 'endTime'));
                        }}
                        className={`w-full px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                          isMemberRestricted
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                            : openPickerDropdown === 'endTime'
                            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{formatTime12h(endTime)}</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${openPickerDropdown === 'endTime' ? 'rotate-180 text-indigo-600' : ''}`} />
                      </button>

                      {/* End Time Dropdown Popover */}
                      {openPickerDropdown === 'endTime' && (
                        <div className="absolute top-full right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-44 animate-in fade-in zoom-in-95 duration-100">
                          {renderTimeList(endTime, handleSelectEndTime)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Default Duration Presets (15 min, 30 min, 1, 2, 3 hours) */}
            {!isAllDay && !isMemberRestricted && (
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Duration
                  </span>
                  {activeDurationMinutes && (
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      {activeDurationMinutes < 60
                        ? `${activeDurationMinutes} mins total`
                        : `${activeDurationMinutes / 60} hour${activeDurationMinutes > 60 ? 's' : ''} total`}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {DURATION_PRESETS.map((preset) => {
                    const isActive = activeDurationMinutes === preset.minutes;
                    return (
                      <button
                        key={preset.minutes}
                        type="button"
                        onClick={() => handleApplyDuration(preset.minutes)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Recurrence & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Recurrence Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recurrence
              </label>
              <select
                disabled={isMemberRestricted}
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${
                  isMemberRestricted
                    ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 cursor-not-allowed'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
                }`}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Every Day</option>
                <option value="weekly">Every Week</option>
                <option value="monthly">Every Month</option>
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>Location / Link</span>
              </label>
              <input
                type="text"
                disabled={isMemberRestricted}
                placeholder="Room, Parish Hall, or Zoom"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-medium ${
                  isMemberRestricted
                    ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 cursor-not-allowed'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
                }`}
              />
            </div>
          </div>

          {/* Catequistas (Attendees) Dropdown Multi-Select */}
          <div ref={dropdownRef} className="relative space-y-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Catequistas</span>
                  {attendees.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                      {attendees.length}
                    </span>
                  )}
                </label>
                {isMemberRestricted && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                    <Edit3 className="w-2.5 h-2.5" /> Editable
                  </span>
                )}
              </div>

              {attendees.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllAttendees}
                  className="text-[11px] font-medium text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Selected Attendees Badges */}
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 max-h-24 overflow-y-auto">
                {attendees.map((att, idx) => {
                  const matchedUser = users.find((u) => u.name === att || (u.email && u.email === att));
                  return (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-medium border border-indigo-200/80 dark:border-indigo-800/80 flex items-center gap-1.5"
                    >
                      <span className={`w-3.5 h-3.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center ${matchedUser?.avatarColor || 'bg-indigo-600'}`}>
                        {att.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate max-w-[140px]">{att}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttendee(att)}
                        className="p-0.5 hover:text-rose-500 rounded transition-colors"
                        title="Remove"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Dropdown Toggle Trigger Button */}
            <button
              type="button"
              onClick={() => setIsAttendeesDropdownOpen((prev) => !prev)}
              className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between text-xs font-medium transition-all ${
                isAttendeesDropdownOpen
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate text-xs">
                  {attendees.length === 0
                    ? 'Select catequistas from team list...'
                    : `${attendees.length} catequista${attendees.length > 1 ? 's' : ''} assigned`}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-1.5 ${
                  isAttendeesDropdownOpen ? 'rotate-180 text-indigo-600' : ''
                }`}
              />
            </button>

            {/* Interactive Dropdown Popover */}
            {isAttendeesDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
                  <span>Team Members ({users.length})</span>
                  <button
                    type="button"
                    onClick={handleSelectAllTeam}
                    className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Select All
                  </button>
                </div>

                <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
                  {users.map((user) => {
                    const isSelected = attendees.includes(user.name);
                    return (
                      <div
                        key={user.id}
                        onClick={() => handleToggleAttendee(user.name)}
                        className={`p-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center shrink-0 ${user.avatarColor || 'bg-indigo-600'}`}>
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate block">
                              {user.name}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block">
                              @{user.username}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                            user.role === 'admin'
                              ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                              : user.role === 'member'
                              ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {user.role}
                          </span>
                          <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>Click to toggle assignment</span>
                  <button
                    type="button"
                    onClick={() => setIsAttendeesDropdownOpen(false)}
                    className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description
              </label>
              {isMemberRestricted && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Edit3 className="w-2.5 h-2.5" /> Editable by You
                </span>
              )}
            </div>
            <textarea
              rows={2}
              placeholder="Key meeting objectives, context, or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          </div>

          {/* Sticky/Fixed Submit Action Bar - Always Visible & Clickable */}
          <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-30 shadow-md shadow-black/5">
            <div>
              {initialEvent && onDelete && currentUser.role === 'admin' && (
                confirmDelete ? (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        if (initialEvent.id) {
                          onDelete(initialEvent.id);
                          onClose();
                        }
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

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-300 transition-colors text-center cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                id="event-modal-save-changes-btn"
                className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-500/20 transition-all text-center cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  {initialEvent
                    ? isMemberRestricted
                      ? 'Save Changes'
                      : 'Save Changes'
                    : 'Create Event'}
                </span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};


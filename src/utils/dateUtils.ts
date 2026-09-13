import { CalendarEvent } from '../types';

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalizes any date string format (unpadded 2026-8-5, 2026/08/05, 20260805, 2026-08-05T00:00:00)
 * into a standard canonical 'YYYY-MM-DD'
 */
export function normalizeYMD(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // Case 1: ISO string or T separator (2026-08-10T14:30:00Z)
  if (trimmed.includes('T')) {
    return normalizeYMD(trimmed.split('T')[0]);
  }

  // Case 2: Standard dashed (e.g. 2026-8-9 or 2026-08-09)
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const y = parts[0].padStart(4, '0');
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Case 3: Slashed format (e.g. 2026/8/9 or 2026/08/09)
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const y = parts[0].padStart(4, '0');
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Case 4: Compact 8-digit format (20260809)
  if (trimmed.length === 8 && /^\d{8}$/.test(trimmed)) {
    const y = trimmed.slice(0, 4);
    const m = trimmed.slice(4, 6);
    const d = trimmed.slice(6, 8);
    return `${y}-${m}-${d}`;
  }

  // Case 5: Parse via Date
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return toYMD(parsed);
  }

  return trimmed;
}

/**
 * Checks if a calendar event falls on a specific date (YYYY-MM-DD),
 * properly handling single-day events, multi-day ranges, and format discrepancies.
 */
export function isEventOnDate(evt: CalendarEvent, targetDateYmd: string): boolean {
  if (!evt || !targetDateYmd) return false;
  const target = normalizeYMD(targetDateYmd);
  const start = normalizeYMD(evt.startDate);
  const end = normalizeYMD(evt.endDate || evt.startDate);

  if (!start) return false;
  const validEnd = end && end >= start ? end : start;

  return start <= target && validEnd >= target;
}

export function parseYMD(ymdStr: string): Date {
  const [y, m, d] = ymdStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function isSunday(d: Date): boolean {
  return d.getDay() === 0;
}

export function getDaysInMonthGrid(year: number, monthIndex: number, firstDayOfWeek: 0 | 1 = 0): { date: Date; isCurrentMonth: boolean }[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);

  let startDay = firstOfMonth.getDay(); // 0 = Sun, 1 = Mon
  if (firstDayOfWeek === 1) {
    startDay = (startDay + 6) % 7; // Adjust for Monday start
  }

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
  for (let i = startDay - 1; i >= 0; i--) {
    const prevDate = new Date(year, monthIndex, -i);
    days.push({ date: prevDate, isCurrentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= lastOfMonth.getDate(); i++) {
    days.push({ date: new Date(year, monthIndex, i), isCurrentMonth: true });
  }

  // Next month leading days (fill up to grid of 35 or 42)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, monthIndex + 1, i), isCurrentMonth: false });
  }

  // If total days < 35, pad to 35
  while (days.length < 35) {
    const lastDate = days[days.length - 1].date;
    const nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 1);
    days.push({ date: nextDate, isCurrentMonth: false });
  }

  return days;
}

export function getWeekDays(referenceDate: Date, firstDayOfWeek: 0 | 1 = 0): Date[] {
  const dayOfWeek = referenceDate.getDay();
  let diff = dayOfWeek - firstDayOfWeek;
  if (diff < 0) diff += 7;

  const startOfWeek = new Date(referenceDate);
  startOfWeek.setDate(referenceDate.getDate() - diff);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push(d);
  }
  return days;
}

export function getNearestSunday(referenceDate: Date): Date {
  const d = new Date(referenceDate);
  const day = d.getDay();
  if (day === 0) return d;
  // Pick Sunday of current week
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

export function formatTime12h(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

export function exportToICal(events: CalendarEvent[]): string {
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Professional Executive Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ].join('\r\n') + '\r\n';

  events.forEach((ev) => {
    const startStr = ev.startDate.replace(/-/g, '') + 'T' + ev.startTime.replace(':', '') + '00';
    const endStr = ev.endDate.replace(/-/g, '') + 'T' + ev.endTime.replace(':', '') + '00';

    icsContent += [
      'BEGIN:VEVENT',
      `UID:${ev.id}@pro-calendar.local`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${(ev.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${ev.location || ''}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `STATUS:${(ev.status || 'CONFIRMED').toUpperCase()}`,
      'END:VEVENT'
    ].join('\r\n') + '\r\n';
  });

  icsContent += 'END:VCALENDAR';
  return icsContent;
}

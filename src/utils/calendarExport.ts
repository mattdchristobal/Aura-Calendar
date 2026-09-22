import { CalendarEvent } from '../types';

/**
 * Formats a date string 'YYYY-MM-DD' into iCalendar format 'YYYYMMDD'
 */
function toIcsDate(dateStr: string): string {
  return (dateStr || '').replace(/[-/]/g, '').trim();
}

/**
 * Returns the next day in 'YYYYMMDD' format for RFC 5545 all-day DTEND
 */
function getNextDayIcs(dateStr: string): string {
  try {
    const parts = dateStr.split(/[-/]/).map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    }
  } catch (e) {
    // fallback
  }
  return toIcsDate(dateStr);
}

/**
 * Cleans and escapes text for iCalendar RFC 5545 format
 */
function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
    .trim();
}

/**
 * Generates an RFC 5545 standard .ics file string compatible with Apple Calendar (iOS),
 * Google Calendar, Outlook, and Android native calendar apps.
 */
export function generateIcsForEvents(events: CalendarEvent[], calTitle: string = 'Church Community Calendar'): string {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Church Ministry Schedule//ExecutiveSync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calTitle)}`,
    'X-WR-TIMEZONE:UTC'
  ];

  for (const evt of events) {
    if (!evt.startDate) continue;

    const sDate = toIcsDate(evt.startDate);
    if (!sDate || sDate.length < 8) continue;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${evt.id || Math.random().toString(36).substring(2)}@churchcalendar`);
    lines.push(`DTSTAMP:${dtstamp}`);

    if (evt.isAllDay) {
      const eDate = evt.endDate ? getNextDayIcs(evt.endDate) : getNextDayIcs(evt.startDate);
      lines.push(`DTSTART;VALUE=DATE:${sDate}`);
      lines.push(`DTEND;VALUE=DATE:${eDate}`);
    } else {
      const sTime = (evt.startTime || '09:00').replace(/:/g, '').slice(0, 4) + '00';
      const eTime = evt.endTime
        ? evt.endTime.replace(/:/g, '').slice(0, 4) + '00'
        : (parseInt(sTime.slice(0, 2), 10) + 1).toString().padStart(2, '0') + sTime.slice(2);
      
      const eDate = evt.endDate ? toIcsDate(evt.endDate) : sDate;

      lines.push(`DTSTART:${sDate}T${sTime}`);
      lines.push(`DTEND:${eDate}T${eTime}`);
    }

    lines.push(`SUMMARY:${escapeIcsText(evt.title || 'Church Event')}`);

    const descParts: string[] = [];
    if (evt.description) descParts.push(evt.description);
    if (evt.notes) descParts.push(`Notes: ${evt.notes}`);
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\n\n'))}`);
    }

    if (evt.location) {
      lines.push(`LOCATION:${escapeIcsText(evt.location)}`);
    }

    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers a download of an .ics calendar file, compatible with mobile devices and desktop.
 */
export function downloadIcsFile(events: CalendarEvent[], filename: string = 'schedule.ics', calTitle?: string): void {
  if (!events || events.length === 0) return;

  const icsContent = generateIcsForEvents(events, calTitle || filename.replace(/\.ics$/i, ''));
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Generates a direct Google Calendar event creation URL for an individual event
 */
export function getGoogleCalendarUrl(evt: CalendarEvent): string {
  const title = encodeURIComponent(evt.title || 'Church Event');
  const details = encodeURIComponent([evt.description, evt.notes ? `Notes: ${evt.notes}` : ''].filter(Boolean).join('\n\n'));
  const location = encodeURIComponent(evt.location || '');

  let dates = '';
  if (!evt.startDate) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    dates = `${today}/${today}`;
  } else if (evt.isAllDay) {
    const s = toIcsDate(evt.startDate);
    const e = evt.endDate ? getNextDayIcs(evt.endDate) : getNextDayIcs(evt.startDate);
    dates = `${s}/${e}`;
  } else {
    const sDate = toIcsDate(evt.startDate);
    const sTime = (evt.startTime || '09:00').replace(/:/g, '').slice(0, 4) + '00';
    const eDate = evt.endDate ? toIcsDate(evt.endDate) : sDate;
    const eTime = evt.endTime
      ? evt.endTime.replace(/:/g, '').slice(0, 4) + '00'
      : (parseInt(sTime.slice(0, 2), 10) + 1).toString().padStart(2, '0') + sTime.slice(2);
    dates = `${sDate}T${sTime}/${eDate}T${eTime}`;
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

/**
 * Directly opens Google Calendar in a new tab to add the event
 */
export function openGoogleCalendar(evt: CalendarEvent): void {
  const url = getGoogleCalendarUrl(evt);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Adds an individual event to phone calendar (.ics)
 */
export function addEventToPhoneCalendar(evt: CalendarEvent): void {
  const safeName = (evt.title || 'event').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  downloadIcsFile([evt], `${safeName}.ics`, evt.title);
}

/**
 * Generates an RFC 5545 .ics content string for an individual event
 */
export function generateSingleEventIcsContent(evt: CalendarEvent, calTitle?: string): string {
  return generateIcsForEvents([evt], calTitle || evt.title || 'Church Event');
}

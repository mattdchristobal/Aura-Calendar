import { CalendarEvent, User } from '../types';
import { normalizeYMD, toYMD } from './dateUtils';

/**
 * Normalizes unfolded ICS lines according to RFC 5545
 */
function unfoldIcsLines(icsText: string): string[] {
  const rawLines = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const unfolded: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  return unfolded;
}

/**
 * Unescape special characters in ICS strings
 */
function unescapeIcsValue(val: string): string {
  return val
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Splits an RFC 5545 line into property parameter section and value section.
 * Colons inside quotes (e.g. TZID="(UTC-06:00) Central Time (US & Canada)") are preserved!
 */
export function splitIcsParamAndValue(line: string): { keyPart: string; valPart: string } | null {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ':' && !inQuote) {
      return {
        keyPart: line.substring(0, i).trim(),
        valPart: line.substring(i + 1).trim()
      };
    }
  }
  return null;
}

/**
 * Parses iCal DTSTART/DTEND strings across standard iCalendar formats:
 * - 20260810T140000Z
 * - 20260810T140000
 * - 2026-08-10T14:00:00
 * - 20260810 (All-day date)
 * - 2026-08-10
 */
export function parseIcsDateTime(valueStr: string): { date: string; time: string; isAllDay: boolean } {
  if (!valueStr) {
    const today = toYMD(new Date());
    return { date: today, time: '09:00', isAllDay: false };
  }

  let clean = valueStr.trim();
  // Strip quotes if any
  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.slice(1, -1).trim();
  }

  // If a parameter prefix was accidentally included (e.g. "VALUE=DATE:20260726" or "TZID=...:20260726T090000")
  const splitAttempt = splitIcsParamAndValue(clean);
  if (splitAttempt && splitAttempt.valPart) {
    clean = splitAttempt.valPart.trim();
  }

  // Remove trailing Z if present
  const valWithoutZ = clean.replace(/Z$/, '').trim();

  // Pattern 1: Compact datetime YYYYMMDDTHHMMSS or YYYYMMDDTHHMM (e.g. 20260810T143000)
  const compactDateTimeMatch = valWithoutZ.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (compactDateTimeMatch) {
    const [, y, m, d, hh, mm] = compactDateTimeMatch;
    return {
      date: `${y}-${m}-${d}`,
      time: `${hh}:${mm}`,
      isAllDay: false
    };
  }

  // Pattern 2: ISO datetime (e.g. 2026-08-10T14:30:00 or 2026-08-10T14:30)
  const isoDateTimeMatch = valWithoutZ.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (isoDateTimeMatch) {
    const [, y, m, d, hh, mm] = isoDateTimeMatch;
    return {
      date: `${y}-${m}-${d}`,
      time: `${hh}:${mm}`,
      isAllDay: false
    };
  }

  // Pattern 3: Compact date only YYYYMMDD (e.g. 20260810)
  const compactDateMatch = valWithoutZ.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactDateMatch) {
    const [, y, m, d] = compactDateMatch;
    return {
      date: `${y}-${m}-${d}`,
      time: '09:00',
      isAllDay: true
    };
  }

  // Pattern 4: Standard date only YYYY-MM-DD
  const standardDateMatch = valWithoutZ.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (standardDateMatch) {
    const [, y, m, d] = standardDateMatch;
    return {
      date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
      time: '09:00',
      isAllDay: true
    };
  }

  // Fallback: try JS Date
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return {
      date: toYMD(parsed),
      time: `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`,
      isAllDay: false
    };
  }

  const today = toYMD(new Date());
  return { date: today, time: '09:00', isAllDay: false };
}

/**
 * Expand basic RRULE recurrence for recurring events
 * Generates future occurrences for weekly, daily, monthly, and yearly frequencies
 */
function expandRecurrence(
  baseEvent: CalendarEvent,
  rruleStr: string,
  usedIds?: Set<string>
): CalendarEvent[] {
  const events: CalendarEvent[] = [baseEvent];
  if (!rruleStr) return events;

  try {
    const ruleParts: Record<string, string> = {};
    rruleStr.split(';').forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) ruleParts[k.toUpperCase()] = v.toUpperCase();
    });

    const freq = ruleParts['FREQ'];
    if (!freq) return events;

    const interval = parseInt(ruleParts['INTERVAL'] || '1', 10) || 1;
    const maxCount = parseInt(ruleParts['COUNT'] || '52', 10);
    const untilStr = ruleParts['UNTIL'];
    const untilDate = untilStr ? parseIcsDateTime(untilStr).date : undefined;

    const startDateObj = new Date(baseEvent.startDate + 'T' + (baseEvent.startTime || '00:00'));
    const durationMs =
      new Date(baseEvent.endDate + 'T' + (baseEvent.endTime || '00:00')).getTime() -
      startDateObj.getTime();

    // Map BYDAY if present
    const byDays = ruleParts['BYDAY'] ? ruleParts['BYDAY'].split(',') : [];
    const dayMap: Record<string, number> = {
      SU: 0,
      MO: 1,
      TU: 2,
      WE: 3,
      TH: 4,
      FR: 5,
      SA: 6
    };

    let currentCursor = new Date(startDateObj);
    let occurrencesGenerated = 1;
    const maxOccurrences = Math.min(maxCount, 52); // Max 52 occurrences

    // Generate up to 1 year of occurrences
    const maxFutureMs = startDateObj.getTime() + 365 * 24 * 60 * 60 * 1000;

    while (occurrencesGenerated < maxOccurrences) {
      if (freq === 'DAILY') {
        currentCursor.setDate(currentCursor.getDate() + interval);
      } else if (freq === 'WEEKLY') {
        if (byDays.length > 0) {
          // Advance by 1 day and check if day matches BYDAY
          currentCursor.setDate(currentCursor.getDate() + 1);
          const currentDayStr = Object.keys(dayMap).find((k) => dayMap[k] === currentCursor.getDay());
          if (!currentDayStr || !byDays.includes(currentDayStr)) {
            if (currentCursor.getTime() > maxFutureMs) break;
            continue;
          }
        } else {
          currentCursor.setDate(currentCursor.getDate() + 7 * interval);
        }
      } else if (freq === 'MONTHLY') {
        currentCursor.setMonth(currentCursor.getMonth() + interval);
      } else if (freq === 'YEARLY') {
        currentCursor.setFullYear(currentCursor.getFullYear() + interval);
      } else {
        break;
      }

      if (currentCursor.getTime() > maxFutureMs) break;

      const occDateYmd = toYMD(currentCursor);
      if (untilDate && occDateYmd > untilDate) break;

      const endCursor = new Date(currentCursor.getTime() + (durationMs > 0 ? durationMs : 3600000));
      const occEndDateYmd = toYMD(endCursor);

      let occId = `${baseEvent.id}-occ-${occurrencesGenerated}-${occDateYmd.replace(/-/g, '')}`;
      if (usedIds) {
        if (usedIds.has(occId)) {
          let c = 2;
          while (usedIds.has(`${occId}_${c}`)) {
            c++;
          }
          occId = `${occId}_${c}`;
        }
        usedIds.add(occId);
      }

      events.push({
        ...baseEvent,
        id: occId,
        startDate: occDateYmd,
        endDate: occEndDateYmd,
        notes: `${baseEvent.notes || ''} (Recurring: ${freq})`
      });

      occurrencesGenerated++;
    }
  } catch (err) {
    console.warn('Error expanding RRULE:', err);
  }

  return events;
}

/**
 * Parses raw ICS text into CalendarEvent array for a target User
 */
export function parseIcsContent(icsText: string, targetUser: User): CalendarEvent[] {
  const lines = unfoldIcsLines(icsText);
  const events: CalendarEvent[] = [];
  const usedIds = new Set<string>();

  let inEvent = false;
  let currentEventProps: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEventProps = {};
      continue;
    }

    if (trimmed.toUpperCase() === 'END:VEVENT') {
      if (inEvent) {
        inEvent = false;

        const summary = unescapeIcsValue(currentEventProps['SUMMARY'] || 'Calendar Event');
        const description = currentEventProps['DESCRIPTION']
          ? unescapeIcsValue(currentEventProps['DESCRIPTION'])
          : undefined;
        const location = currentEventProps['LOCATION']
          ? unescapeIcsValue(currentEventProps['LOCATION'])
          : undefined;

        const startParsed = parseIcsDateTime(currentEventProps['DTSTART'] || '');
        let endParsed = parseIcsDateTime(
          currentEventProps['DTEND'] || currentEventProps['DTSTART'] || ''
        );

        // Adjust RFC 5545 exclusive DTEND for 1-day all-day events
        if (startParsed.isAllDay && endParsed.isAllDay) {
          const startDateObj = new Date(startParsed.date);
          const endDateObj = new Date(endParsed.date);
          const diffDays = Math.round(
            (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays === 1) {
            // Next day DTEND means 1-day event
            endParsed = { ...endParsed, date: startParsed.date };
          } else if (diffDays > 1) {
            // Multi-day exclusive DTEND -> subtract 1 day
            const adjusted = new Date(endDateObj);
            adjusted.setDate(adjusted.getDate() - 1);
            endParsed = { ...endParsed, date: toYMD(adjusted) };
          }
        }

        const statusRaw = (currentEventProps['STATUS'] || 'CONFIRMED').toLowerCase();
        let status: 'confirmed' | 'tentative' | 'cancelled' = 'confirmed';
        if (statusRaw.includes('tentative')) status = 'tentative';
        if (statusRaw.includes('cancel')) status = 'cancelled';

        // Extract category if available
        let categoryId = 'work';
        const rawCategories = currentEventProps['CATEGORIES'];
        if (rawCategories) {
          const firstCat = rawCategories.split(',')[0].trim().toLowerCase();
          if (firstCat.includes('urgent') || firstCat.includes('deadline')) categoryId = 'urgent';
          else if (firstCat.includes('personal')) categoryId = 'personal';
          else if (firstCat.includes('team') || firstCat.includes('meeting')) categoryId = 'team';
          else if (firstCat.includes('health') || firstCat.includes('wellness')) categoryId = 'health';
          else if (firstCat.includes('client')) categoryId = 'client';
          else if (firstCat.includes('social') || firstCat.includes('family')) categoryId = 'social';
          else categoryId = firstCat.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'work';
        }

        const uid = currentEventProps['UID'];
        const recurrenceId = currentEventProps['RECURRENCE-ID'];
        const startYmd = normalizeYMD(startParsed.date);
        const startTimeClean = (startParsed.time || '0000').replace(/[^0-9]/g, '');

        // Preserve full UID to prevent collision on Exchange GOID binary formats
        const cleanUid = uid ? uid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180) : '';
        const recSuffix = recurrenceId ? `_rec_${recurrenceId.replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
        const dateSuffix = startYmd ? `_${startYmd.replace(/-/g, '')}_${startTimeClean}` : '';

        // Deterministic stable ID:
        // When UID is available, use ext-ics-{cleanUid} (with recSuffix if recurring modification)
        // so that it matches existing database records across sync cycles.
        let candidateId = cleanUid
          ? `ext-ics-${cleanUid}${recSuffix}`
          : `ext-ics-${startYmd.replace(/-/g, '')}_${startTimeClean}_${(summary || 'event').slice(0, 30).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        // Guarantee strictly unique ID across all parsed events deterministically
        if (usedIds.has(candidateId)) {
          candidateId = `${candidateId}${dateSuffix}`;
          let c = 2;
          while (usedIds.has(candidateId)) {
            candidateId = `${candidateId}_${c}`;
            c++;
          }
        }
        usedIds.add(candidateId);

        const baseEvt: CalendarEvent = {
          id: candidateId,
          externalEventId: uid || candidateId,
          title: summary,
          description,
          location,
          startDate: normalizeYMD(startParsed.date),
          endDate: normalizeYMD(endParsed.date || startParsed.date),
          startTime: startParsed.time,
          endTime: endParsed.time,
          isAllDay: startParsed.isAllDay,
          categoryId,
          userId: targetUser.id,
          createdBy: targetUser.name || targetUser.username,
          status,
          notes: 'Imported via External Calendar Feed (.ics)'
        };

        // If RRULE present, expand recurring occurrences
        const rrule = currentEventProps['RRULE'];
        if (rrule) {
          const expanded = expandRecurrence(baseEvt, rrule, usedIds);
          events.push(...expanded);
        } else {
          events.push(baseEvt);
        }
      }
      continue;
    }

    if (inEvent) {
      const split = splitIcsParamAndValue(trimmed);
      if (split) {
        const { keyPart, valPart } = split;
        // Key might have parameters e.g. DTSTART;TZID="..."
        const keyName = keyPart.split(';')[0].toUpperCase().trim();
        currentEventProps[keyName] = valPart;
        // Also save param key for timezones or other attributes
        currentEventProps[`${keyName}_PARAMS`] = keyPart;
      }
    }
  }

  // Final guarantee: every event returned has a strictly unique, valid id deterministically
  const finalSeen = new Set<string>();
  return events.map((e) => {
    if (!e.id || finalSeen.has(e.id)) {
      let counter = 2;
      let safeId = `${e.id || 'ext-evt'}_${counter}`;
      while (finalSeen.has(safeId)) {
        counter++;
        safeId = `${e.id || 'ext-evt'}_${counter}`;
      }
      finalSeen.add(safeId);
      return { ...e, id: safeId };
    }
    finalSeen.add(e.id);
    return e;
  });
}

/**
 * Normalizes an external ICS URL (webcal:// -> https://, auto-converts Outlook HTML links to .ics, strips quotes, brackets, and whitespace)
 */
export function normalizeIcsUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim();

  // Strip wrapping quotes and angle brackets
  cleaned = cleaned.replace(/^[\"'<(\[]+|[\"'>)\]]+$/g, '').trim();

  // Markdown links like [Calendar](https://...)
  const mdMatch = cleaned.match(/\]\((https?:[^\)]+)\)/i);
  if (mdMatch) cleaned = mdMatch[1].trim();

  // Convert webcal protocols
  if (cleaned.startsWith('webcal://')) {
    cleaned = 'https://' + cleaned.slice(9);
  } else if (cleaned.startsWith('webcals://')) {
    cleaned = 'https://' + cleaned.slice(10);
  } else if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }

  // Auto-convert Outlook Web HTML sharing links to live RFC 5545 .ics calendar feeds
  // E.g.: https://outlook.office365.com/owa/calendar/.../reachcalendar.html -> reachcalendar.ics
  // E.g.: https://outlook.live.com/owa/calendar/.../calendar.html -> calendar.ics
  cleaned = cleaned.replace(/reachcalendar\.html/gi, 'reachcalendar.ics');
  cleaned = cleaned.replace(/calendar\.html/gi, 'calendar.ics');
  if (cleaned.includes('outlook.') && cleaned.includes('.html')) {
    cleaned = cleaned.replace(/\.html(\?|$)/gi, (match, p1) => `.ics${p1}`);
  }

  return cleaned.trim();
}

/**
 * Fetches ICS feed content using server proxy with fallbacks for browser CORS restrictions
 */
export async function fetchIcsFeed(rawUrl: string): Promise<string> {
  const cleanUrl = normalizeIcsUrl(rawUrl);

  const fetchWithTimeout = async (url: string, timeoutMs: number = 10000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  };

  // Attempt 1: Express Server API proxy endpoint
  try {
    const proxyUrl = `/api/ics-proxy?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetchWithTimeout(proxyUrl, 12000);
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('BEGIN:VCALENDAR')) {
        return text;
      }
    }
  } catch (e) {
    console.warn('Server proxy fetch failed, trying direct and public fallbacks:', e);
  }

  // Attempt 2: Direct fetch
  try {
    const res = await fetchWithTimeout(cleanUrl, 8000);
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('BEGIN:VCALENDAR')) {
        return text;
      }
    }
  } catch (e) {
    console.warn('Direct fetch failed (likely browser CORS), trying CORS proxy fallbacks:', e);
  }

  // Attempt 3: Public CORS proxy fallback 1 (allorigins)
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetchWithTimeout(proxyUrl, 10000);
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('BEGIN:VCALENDAR')) {
        return text;
      }
    }
  } catch (e) {
    console.warn('AllOrigins proxy failed:', e);
  }

  // Attempt 4: Public CORS proxy fallback 2 (corsproxy.io)
  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`;
    const res = await fetchWithTimeout(proxyUrl, 10000);
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('BEGIN:VCALENDAR')) {
        return text;
      }
    }
  } catch (e) {
    console.warn('CorsProxy.io failed:', e);
  }

  throw new Error('Unable to fetch calendar feed from the URL. Please verify the link is published with "Can view all details" in Outlook Shared Calendars.');
}

/**
 * Sample standard ICS feed text for testing & demonstration
 */
export const SAMPLE_ICS_FEED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Executive Calendar//EN
METHOD:PUBLISH
BEGIN:VEVENT
SUMMARY:Executive Strategy & Q3 Planning
DESCRIPTION:Review quarterly targets and strategic sync with leadership team.
LOCATION:Conference Room 402
DTSTART:20260810T130000Z
DTEND:20260810T143000Z
CATEGORIES:Work & Projects
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
SUMMARY:Client Technical Onboarding
DESCRIPTION:Discuss technical architecture and deployment goals.
LOCATION:Video Conference Bridge
DTSTART:20260812T150000Z
DTEND:20260812T160000Z
CATEGORIES:Client Strategy
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
SUMMARY:Weekly Engineering Leadership Standup
DESCRIPTION:Cross-functional review of sprint deliverables.
LOCATION:Executive Boardroom 3
DTSTART:20260810T090000Z
DTEND:20260810T100000Z
RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;COUNT=12
CATEGORIES:Team & Meetings
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
SUMMARY:Board of Directors Briefing
DESCRIPTION:Annual governance review and portfolio update.
LOCATION:Executive Suite A
DTSTART:20260815T100000Z
DTEND:20260815T113000Z
CATEGORIES:Work & Projects
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

/**
 * Exports an array of CalendarEvent objects to RFC 5545 standard .ics file
 */
export function exportEventsToIcs(events: CalendarEvent[], calTitle: string = 'Shared Pro Calendar'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ProCalendar//SharedCalendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calTitle.replace(/[\r\n]/g, ' ')}`
  ];

  for (const evt of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${evt.id}@procalendar`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    
    // Format Start & End Dates
    const startClean = (evt.startDate || '').replace(/-/g, '');
    const endClean = (evt.endDate || evt.startDate || '').replace(/-/g, '');
    const startTimeClean = (evt.startTime || '09:00').replace(/:/g, '') + '00';
    const endTimeClean = (evt.endTime || '10:00').replace(/:/g, '') + '00';

    if (evt.isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${startClean}`);
      lines.push(`DTEND;VALUE=DATE:${endClean}`);
    } else {
      lines.push(`DTSTART:${startClean}T${startTimeClean}`);
      lines.push(`DTEND:${endClean}T${endTimeClean}`);
    }

    lines.push(`SUMMARY:${(evt.title || 'Untitled Event').replace(/[\r\n]/g, ' ')}`);
    if (evt.description) {
      lines.push(`DESCRIPTION:${evt.description.replace(/\n/g, '\\n')}`);
    }
    if (evt.location) {
      lines.push(`LOCATION:${evt.location.replace(/[\r\n]/g, ' ')}`);
    }
    const eventTemas = Array.isArray(evt.temas) && evt.temas.length > 0 ? evt.temas : (evt.tema ? [evt.tema] : []);
    if (eventTemas.length > 0) {
      lines.push(`CATEGORIES:${eventTemas.join(',')}`);
    }
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers browser download of generated .ics file
 */
export function downloadIcsFile(icsContent: string, filename: string = 'calendar-export.ics') {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

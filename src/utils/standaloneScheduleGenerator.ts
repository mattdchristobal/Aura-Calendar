import { CalendarEvent, Category, UserSettings } from '../types';

export interface GenerateOptions {
  category: Category;
  allCategories: Category[];
  events: CalendarEvent[];
  settings?: UserSettings;
  title?: string;
}

const escapeHtml = (str: string) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatTime12h = (timeStr?: string) => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
};

const getMonthName = (ymStr: string) => {
  const parts = ymStr.split('-');
  if (parts.length === 2) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return ymStr;
};

const computeNextMonth = (ymStr: string): string => {
  const parts = ymStr.split('-');
  let y = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
};

const computePrevMonth = (ymStr: string): string => {
  const parts = ymStr.split('-');
  let y = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
};

const getGoogleCalendarUrlForEvent = (evt: CalendarEvent): string => {
  const title = encodeURIComponent(evt.title || 'Church Event');
  const details = encodeURIComponent([evt.description, evt.notes ? `Notes: ${evt.notes}` : ''].filter(Boolean).join('\n\n'));
  const location = encodeURIComponent(evt.location || '');
  let dates = '';
  if (!evt.startDate) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    dates = `${today}/${today}`;
  } else if (evt.isAllDay) {
    const s = (evt.startDate || '').replace(/-/g, '');
    const parts = (evt.startDate || '').split(/[-/]/).map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    const e = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    dates = `${s}/${e}`;
  } else {
    const sDate = (evt.startDate || '').replace(/-/g, '');
    const sTime = (evt.startTime || '09:00').replace(/:/g, '').slice(0, 4) + '00';
    const eDate = (evt.endDate || evt.startDate || '').replace(/-/g, '');
    const eTime = evt.endTime
      ? evt.endTime.replace(/:/g, '').slice(0, 4) + '00'
      : (parseInt(sTime.slice(0, 2), 10) + 1).toString().padStart(2, '0') + sTime.slice(2);
    dates = `${sDate}T${sTime}/${eDate}T${eTime}`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
};

/**
 * Builds a 100% self-contained, interactive multi-month calendar HTML document.
 * Works 24/7 on any mobile phone, tablet, or desktop, whether the host computer is running or not.
 * Contains:
 * - Next / Previous Month navigation buttons
 * - Quick Month Selector pills
 * - Category filter chips
 * - Full interactive 7-day monthly calendar grid
 * - Complete event listings with dates, times, locations, and descriptions
 * - Print / Save as PDF button formatted for 8.5x11 / A4
 * - Zero-JS anchor fallbacks so all months are accessible even if scripts are disabled
 */
export function generateStandaloneScheduleHtml(options: GenerateOptions): string {
  const { category, allCategories, events, title } = options;
  const mainTitle = title || 'Sacramentos';
  const primaryHex = category.hex || '#4f46e5';

  // Filter events for this category (or all if master overview)
  const isAll = category.id === 'all' || category.id === 'overview' || category.id === 'sacramentos';
  const excludedCatIds = new Set(
    (allCategories || [])
      .filter((c) => c && (c.includeInPublicPdf === false || (c as any).includeInPublicPdf === 'false'))
      .map((c) => (c.id || '').toLowerCase())
  );
  const excludedCatNames = new Set(
    (allCategories || [])
      .filter((c) => c && (c.includeInPublicPdf === false || (c as any).includeInPublicPdf === 'false'))
      .map((c) => (c.name || '').toLowerCase())
  );

  const isCurrentCatExcluded = !isAll && (
    category.includeInPublicPdf === false ||
    (category as any).includeInPublicPdf === 'false' ||
    excludedCatIds.has((category.id || '').toLowerCase()) ||
    excludedCatNames.has((category.name || '').toLowerCase())
  );

  const categoryEvents = isCurrentCatExcluded
    ? []
    : (isAll
        ? events.filter((e) => {
            const catKey = (e.categoryId || '').toLowerCase();
            const catNameKey = (e.categoryName || '').toLowerCase();
            return !excludedCatIds.has(catKey) && !excludedCatNames.has(catKey) && !excludedCatNames.has(catNameKey);
          })
        : events.filter((e) => {
            const catKey = (e.categoryId || '').toLowerCase();
            const catNameKey = (e.categoryName || '').toLowerCase();
            if (excludedCatIds.has(catKey) || excludedCatNames.has(catKey) || excludedCatNames.has(catNameKey)) {
              return false;
            }
            return (
              e.categoryId === category.id ||
              (category.id && catKey === category.id.toLowerCase()) ||
              (category.name && (catKey === category.name.toLowerCase() || catNameKey === category.name.toLowerCase()))
            );
          }));

  // Determine all months represented in the events + 12 months back and 24 months forward
  const now = new Date();
  const currentYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const monthsSet = new Set<string>();
  monthsSet.add(currentYMD);

  // Add 12 months back and 24 months ahead so user can navigate seamlessly across all months
  for (let i = -12; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Also include any months that have existing events
  categoryEvents.forEach((e) => {
    if (e.startDate && e.startDate.length >= 7) {
      monthsSet.add(e.startDate.slice(0, 7));
    }
  });

  const sortedMonths = Array.from(monthsSet).sort();

  // Determine the default active month (earliest upcoming month with events, or last with events, or current month)
  let defaultActiveYm = currentYMD;
  const sortedUpcoming = categoryEvents
    .filter((e) => (e.startDate || '').slice(0, 7) >= currentYMD)
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  if (sortedUpcoming.length > 0 && sortedUpcoming[0].startDate) {
    defaultActiveYm = sortedUpcoming[0].startDate.slice(0, 7);
  } else {
    const allSorted = [...categoryEvents].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    if (allSorted.length > 0 && allSorted[allSorted.length - 1].startDate) {
      defaultActiveYm = allSorted[allSorted.length - 1].startDate.slice(0, 7);
    }
  }

  // Pre-calculate month data for the zero-JS view & initial render
  const monthsData = sortedMonths.map((ym) => {
    const parts = ym.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const monthName = getMonthName(ym);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

    const mEvents = categoryEvents.filter((e) => (e.startDate || '').startsWith(ym));

    return {
      ym,
      year,
      month,
      monthName,
      daysInMonth,
      firstDayOfWeek,
      eventsCount: mEvents.length,
      events: mEvents
    };
  });

  // Pre-render HTML sections for each month
  const preRenderedMonthsHtml = monthsData
    .map((m, idx) => {
      const prevYm = computePrevMonth(m.ym);
      const nextYm = computeNextMonth(m.ym);
      const prevMonthTitle = getMonthName(prevYm);
      const nextMonthTitle = getMonthName(nextYm);

      // Group events by date
      const dateGroups: { [d: string]: CalendarEvent[] } = {};
      m.events.forEach((e) => {
        const d = e.startDate || 'Unscheduled';
        if (!dateGroups[d]) dateGroups[d] = [];
        dateGroups[d].push(e);
      });

      const datesSorted = Object.keys(dateGroups).sort();

      const eventsListHtml =
        datesSorted.length === 0
          ? `<div class="empty-state">
              <div class="empty-icon">📅</div>
              <p class="empty-text">No events scheduled for ${escapeHtml(m.monthName)}.</p>
              <button type="button" class="jump-btn" onclick="switchMonth('${nextYm}')">View Next Month (${escapeHtml(nextMonthTitle)}) →</button>
            </div>`
          : datesSorted
              .map((dStr) => {
                const dayEvts = dateGroups[dStr];
                const dObj = new Date(dStr + 'T00:00:00');
                const dateHeader = isNaN(dObj.getTime())
                  ? dStr
                  : dObj.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric'
                    });

                const dayCards = dayEvts
                  .map((evt) => {
                    const timeStr = evt.isAllDay
                      ? 'All Day'
                      : evt.startTime
                      ? `${formatTime12h(evt.startTime)}${evt.endTime ? ' – ' + formatTime12h(evt.endTime) : ''}`
                      : 'All Day';

                    const cat = allCategories.find((c) => c.id === evt.categoryId);
                    const catColor = cat?.hex || primaryHex;

                    return `
                    <div class="event-card" style="border-left-color: ${catColor};">
                      <div class="event-header">
                        <h4 class="event-title">${escapeHtml(evt.title)}</h4>
                        <span class="time-badge">${escapeHtml(timeStr)}</span>
                      </div>
                      ${
                        evt.location
                          ? `<div class="event-meta">📍 ${escapeHtml(evt.location)}</div>`
                          : ''
                      }
                      ${
                        evt.description
                          ? `<p class="event-desc">${escapeHtml(evt.description)}</p>`
                          : ''
                      }
                      <div class="event-cal-actions no-print">
                        <button type="button" class="event-cal-btn" onclick="addSingleEventToIcs('${escapeHtml(evt.id || '')}'); return false;" title="Add to iPhone or Android Phone Calendar">
                          📱 Add to Phone
                        </button>
                        <a href="${getGoogleCalendarUrlForEvent(evt)}" target="_blank" rel="noopener noreferrer" class="event-cal-btn google" title="Add to Google Calendar">
                          📅 Google Calendar
                        </a>
                      </div>
                    </div>
                  `;
                  })
                  .join('');

                return `
                <div class="date-group">
                  <div class="date-header">${escapeHtml(dateHeader)}</div>
                  <div class="date-events">${dayCards}</div>
                </div>
              `;
              })
              .join('');

      return `
      <section id="month-${m.ym}" class="month-section ${m.ym === defaultActiveYm ? 'active-month' : ''}">
        <!-- Month Navigation Controls -->
        <div class="month-nav-bar no-print">
          <button type="button" class="nav-btn prev-btn" onclick="switchMonth('${prevYm}'); return false;" title="Previous Month: ${escapeHtml(prevMonthTitle)}" aria-label="Previous Month">
            ←
          </button>
          <div class="month-header-title">
            <h2>${escapeHtml(m.monthName)}</h2>
            <span class="event-count-badge">${m.eventsCount} event${m.eventsCount === 1 ? '' : 's'}</span>
          </div>
          <button type="button" class="nav-btn next-btn" onclick="switchMonth('${nextYm}'); return false;" title="Next Month: ${escapeHtml(nextMonthTitle)}" aria-label="Next Month">
            →
          </button>
        </div>

        <div class="print-month-title print-only">
          <h2>${escapeHtml(m.monthName)}</h2>
        </div>

        <!-- Mini Calendar Grid -->
        <div class="cal-grid-card">
          <div class="cal-days-header">
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
          </div>
          <div class="cal-days-grid">
            ${Array(m.firstDayOfWeek)
              .fill(0)
              .map(() => `<div class="cal-cell empty"></div>`)
              .join('')}
            ${Array(m.daysInMonth)
              .fill(0)
              .map((_, dayIdx) => {
                const dayNum = dayIdx + 1;
                const dStr = `${m.ym}-${String(dayNum).padStart(2, '0')}`;
                const hasEvt = Boolean(dateGroups[dStr]);
                const count = hasEvt ? dateGroups[dStr].length : 0;
                return `
                <div class="cal-cell ${hasEvt ? 'has-events' : ''}">
                  <span class="day-number">${dayNum}</span>
                  ${hasEvt ? `<span class="event-dot" title="${count} event(s)"></span>` : ''}
                </div>
              `;
              })
              .join('')}
          </div>
        </div>

        <!-- Events List for this month -->
        <div class="events-container">
          ${eventsListHtml}
        </div>
      </section>
    `;
    })
    .join('\n');

  // Month Quick Switcher Pills
  const monthPillsHtml = monthsData
    .map((m, idx) => {
      return `
      <a href="#month-${m.ym}" class="month-pill ${m.ym === defaultActiveYm ? 'active' : ''}" data-ym="${m.ym}" onclick="switchMonth('${m.ym}'); return false;">
        ${escapeHtml(m.monthName.split(' ')[0])} <span class="pill-year">${m.year}</span>
      </a>
    `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
  <title>${escapeHtml(mainTitle)}</title>
  <style>
    :root {
      --primary: ${primaryHex};
      --primary-light: ${primaryHex}15;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
    }

    * { box-sizing: border-box; }
    html {
      scroll-behavior: smooth;
    }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 16px;
    }

    /* Top Banner / Header */
    .top-header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      text-align: center;
    }

    .category-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: var(--primary-light);
      color: var(--primary);
      margin-bottom: 8px;
    }

    h1 {
      margin: 4px 0 8px 0;
      font-size: 22px;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.3px;
    }

    .subtitle {
      margin: 0;
      font-size: 13px;
      color: var(--text-muted);
    }

    .actions-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-top: 16px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      border: none;
    }

    .btn-primary {
      background: var(--primary);
      color: #ffffff;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }

    .btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    /* Quick Month Selector Bar */
    .months-bar-wrapper {
      margin-bottom: 16px;
      overflow-x: auto;
      padding-bottom: 4px;
      -webkit-overflow-scrolling: touch;
    }

    .months-bar {
      display: flex;
      gap: 6px;
      min-width: max-content;
    }

    .month-pill {
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      background: #ffffff;
      color: var(--text-muted);
      border: 1px solid var(--border);
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .month-pill.active {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
    }

    .pill-year {
      font-size: 10px;
      opacity: 0.8;
    }

    /* Month Navigation Card */
    .month-section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      scroll-margin-top: 20px;
    }

    /* In interactive JS mode, only active month is displayed unless showing all */
    body.js-enabled .month-section {
      display: none !important;
    }

    body.js-enabled .month-section.active-month {
      display: block !important;
    }

    body.show-all-months .month-section {
      display: block !important;
    }

    .month-nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 16px;
    }

    .month-header-title {
      text-align: center;
    }

    .month-header-title h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      color: var(--text);
    }

    .event-count-badge {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .nav-btn {
      padding: 10px 16px;
      min-width: 60px;
      min-height: 44px;
      background: #ffffff;
      color: #0f172a;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      border: 1px solid #cbd5e1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      cursor: pointer;
      touch-action: manipulation;
      transition: all 0.15s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .nav-btn:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
      color: #0f172a;
    }

    .nav-btn:active {
      transform: scale(0.96);
      background: #e2e8f0;
    }

    .btn-calendar {
      background: #0284c7;
      color: #ffffff;
      border: 1px solid #0369a1;
    }

    .btn-calendar:hover {
      background: #0369a1;
      color: #ffffff;
    }

    .event-cal-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #e2e8f0;
    }

    .event-cal-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
      transition: all 0.15s ease;
      touch-action: manipulation;
      user-select: none;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }

    .event-cal-btn:hover {
      background: #f8fafc;
      border-color: #94a3b8;
      color: #0f172a;
    }

    .event-cal-btn:active {
      transform: scale(0.96);
    }

    .event-cal-btn.google {
      background: #eff6ff;
      color: #1d4ed8;
      border-color: #bfdbfe;
    }

    .event-cal-btn.google:hover {
      background: #dbeafe;
      border-color: #93c5fd;
    }

    /* Modal Backdrop & Dialog */
    .cal-modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 99999;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .cal-modal-backdrop.open {
      display: flex;
    }

    .cal-modal-box {
      background: #ffffff;
      border-radius: 20px;
      max-width: 480px;
      width: 100%;
      padding: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      border: 1px solid #e2e8f0;
      animation: modalSlideUp 0.2s ease-out;
    }

    @keyframes modalSlideUp {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .cal-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .cal-modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }

    .cal-modal-close {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 14px;
      font-weight: 700;
      color: #475569;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cal-modal-close:hover {
      background: #e2e8f0;
      color: #0f172a;
    }

    .cal-modal-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 18px 0;
    }

    .cal-modal-options {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
    }

    .cal-modal-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 12px;
      text-align: left;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #0f172a;
      cursor: pointer;
      transition: all 0.15s ease;
      touch-action: manipulation;
      text-decoration: none;
    }

    .cal-modal-btn:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
      transform: translateY(-1px);
    }

    .cal-modal-btn .icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .cal-modal-btn strong {
      display: block;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }

    .cal-modal-btn small {
      display: block;
      font-size: 12px;
      color: #64748b;
    }

    .cal-modal-btn.phone {
      border-color: #93c5fd;
      background: #eff6ff;
    }

    .cal-modal-btn.phone:hover {
      background: #dbeafe;
    }

    .cal-modal-tip {
      font-size: 11.5px;
      color: #64748b;
      background: #f8fafc;
      border-radius: 10px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      line-height: 1.4;
    }

    /* Mini Calendar Grid */
    .cal-grid-card {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 20px;
      max-width: 320px;
      margin-left: auto;
      margin-right: auto;
    }

    .cal-days-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      text-align: center;
      font-size: 10px;
      font-weight: 800;
      color: #94a3b8;
      margin-bottom: 4px;
    }

    .cal-days-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
      text-align: center;
    }

    .cal-cell {
      height: 30px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      background: #ffffff;
      position: relative;
    }

    .cal-cell.empty {
      background: transparent;
    }

    .cal-cell.has-events {
      background: var(--primary-light);
      color: var(--primary);
      font-weight: 800;
    }

    .event-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--primary);
      margin-top: 1px;
    }

    /* Events List */
    .date-group {
      margin-bottom: 20px;
    }

    .date-header {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .date-header::after {
      content: "";
      flex: 1;
      height: 1px;
      background: var(--border);
    }

    .event-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-left: 4px solid var(--primary);
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }

    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 4px;
    }

    .event-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
    }

    .time-badge {
      font-size: 11px;
      font-weight: 700;
      color: #065f46;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      padding: 2px 8px;
      border-radius: 9999px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .event-meta {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .event-desc {
      margin: 4px 0 0 0;
      font-size: 12px;
      color: #334155;
      line-height: 1.4;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 36px 16px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 14px;
    }

    .empty-icon {
      font-size: 28px;
      margin-bottom: 6px;
    }

    .empty-text {
      margin: 0 0 12px 0;
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 600;
    }

    .jump-btn {
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      background: var(--primary);
      color: #ffffff;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
    }

    .footer {
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      padding: 24px 0;
    }

    .print-only {
      display: none;
    }

    /* Print Stylesheet for True Multi-Month PDF Export */
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
      }

      .container {
        max-width: 100% !important;
        padding: 0 !important;
      }

      .no-print, .actions-bar, .months-bar-wrapper, .month-nav-bar, .footer {
        display: none !important;
      }

      .month-section {
        display: block !important;
        page-break-after: always;
        break-after: page;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin-bottom: 40px !important;
      }

      .print-only {
        display: block !important;
      }

      .print-month-title h2 {
        font-size: 20px !important;
        font-weight: 800 !important;
        margin: 0 0 12px 0 !important;
        border-bottom: 2px solid #000000 !important;
        padding-bottom: 6px !important;
      }

      .event-card {
        border: 1px solid #cbd5e1 !important;
        border-left: 4px solid #000000 !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .cal-grid-card {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="top-header">
      ${!isAll && category.name && !category.name.toLowerCase().includes('all categories') && !category.name.toLowerCase().includes('overview') ? `
      <div class="category-badge">
        <span>●</span>
        <span>${escapeHtml(category.name)}</span>
      </div>` : ''}
      <h1>${escapeHtml(mainTitle || 'SACRAMENTOS')}</h1>

      <div class="actions-bar no-print">
        <button type="button" class="btn btn-primary" onclick="window.print()" title="Print / Save PDF" aria-label="Print / Save PDF" style="padding: 8px 14px; font-size: 16px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;">
          🖨️
        </button>
        <button type="button" class="btn btn-secondary" onclick="toggleAllMonths()">
          📋 View All Months
        </button>
      </div>
    </header>

    <!-- Add to Calendar Modal Dialog -->
    <div id="calendarModal" class="cal-modal-backdrop" onclick="closeCalendarExportModal(event)">
      <div class="cal-modal-box" onclick="event.stopPropagation()">
        <div class="cal-modal-header">
          <h3>📅 Add to Calendar</h3>
          <button type="button" class="cal-modal-close" onclick="closeCalendarExportModal()">✕</button>
        </div>
        <p class="cal-modal-subtitle">Sync or add events to your iPhone, Android, or Google Calendar:</p>
        
        <div class="cal-modal-options">
          <button type="button" class="cal-modal-btn phone" onclick="downloadAllEventsIcs(false)">
            <span class="icon">📱</span>
            <div>
              <strong>Add All Events to Phone (.ics)</strong>
              <small>Apple Calendar (iPhone/iPad), Android, Samsung, Outlook</small>
            </div>
          </button>

          <button type="button" class="cal-modal-btn" onclick="downloadAllEventsIcs(true)">
            <span class="icon">📆</span>
            <div>
              <strong>Add Current Month Only (.ics)</strong>
              <small>Import only the events for the month currently selected</small>
            </div>
          </button>

          <button type="button" class="cal-modal-btn" onclick="openUpcomingInGoogle()">
            <span class="icon">🌐</span>
            <div>
              <strong>Add Next Event to Google Calendar</strong>
              <small>Opens Google Calendar to save the next scheduled event</small>
            </div>
          </button>
        </div>
        
        <div class="cal-modal-tip">
          💡 <strong>Tip for Phone users:</strong> Tapping "Add All Events to Phone (.ics)" downloads the standard calendar file which your phone prompts to "Add All Events" directly into your built-in Apple or Android Calendar.
        </div>
      </div>
    </div>

    <!-- Months Horizontal Scrollbar -->
    <div class="months-bar-wrapper no-print">
      <div class="months-bar">
        ${monthPillsHtml}
      </div>
    </div>

    <!-- Pre-rendered Months (Each has complete navigation and events) -->
    <main id="scheduleContent">
      ${preRenderedMonthsHtml}
    </main>

    <footer class="footer">
      Public Community Calendar • Accessible 24/7/365 • Always Up to Date
    </footer>
  </div>

  <script>
    document.body.classList.add('js-enabled');

    var embeddedEvents = ${JSON.stringify(categoryEvents)};
    var activeYm = '${defaultActiveYm}';

    function openCalendarExportModal() {
      var modal = document.getElementById('calendarModal');
      if (modal) modal.classList.add('open');
    }

    function closeCalendarExportModal(e) {
      if (e && e.target !== e.currentTarget && !e.target.classList.contains('cal-modal-close')) return;
      var modal = document.getElementById('calendarModal');
      if (modal) modal.classList.remove('open');
    }

    function generateIcsString(evts, title) {
      var dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      var lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Church Ministry Schedule//ExecutiveSync//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:' + (title || 'Church Calendar').replace(/[\\r\\n]/g, ' '),
        'X-WR-TIMEZONE:UTC'
      ];

      evts.forEach(function(e) {
        if (!e.startDate) return;
        var sDate = (e.startDate || '').replace(/[-/]/g, '').trim();
        if (sDate.length < 8) return;

        lines.push('BEGIN:VEVENT');
        lines.push('UID:' + (e.id || Math.random().toString(36).substring(2)) + '@churchcalendar');
        lines.push('DTSTAMP:' + dtstamp);

        if (e.isAllDay) {
          var parts = (e.startDate || '').split(/[-/]/).map(Number);
          var d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
          var nextD = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
          lines.push('DTSTART;VALUE=DATE:' + sDate);
          lines.push('DTEND;VALUE=DATE:' + nextD);
        } else {
          var sTime = (e.startTime || '09:00').replace(/:/g, '').slice(0, 4) + '00';
          var eTime = e.endTime
            ? e.endTime.replace(/:/g, '').slice(0, 4) + '00'
            : (parseInt(sTime.slice(0, 2), 10) + 1).toString().padStart(2, '0') + sTime.slice(2);
          var eDate = (e.endDate || e.startDate || '').replace(/[-/]/g, '').trim();
          lines.push('DTSTART:' + sDate + 'T' + sTime);
          lines.push('DTEND:' + eDate + 'T' + eTime);
        }

        lines.push('SUMMARY:' + (e.title || 'Church Event').replace(/[\\r\\n]/g, ' '));
        var descParts = [];
        if (e.description) descParts.push(e.description);
        if (e.notes) descParts.push('Notes: ' + e.notes);
        if (descParts.length > 0) {
          lines.push('DESCRIPTION:' + descParts.join('\\n').replace(/[\\r\\n]/g, ' '));
        }
        if (e.location) {
          lines.push('LOCATION:' + e.location.replace(/[\\r\\n]/g, ' '));
        }
        lines.push('STATUS:CONFIRMED');
        lines.push('TRANSP:OPAQUE');
        lines.push('END:VEVENT');
      });

      lines.push('END:VCALENDAR');
      return lines.join('\\r\\n');
    }

    function triggerIcsFileDownload(icsStr, filename) {
      var blob = new Blob([icsStr], { type: 'text/calendar;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }

    function addSingleEventToIcs(eventId) {
      var match = embeddedEvents.find(function(e) { return e.id === eventId; });
      if (!match) return;
      var ics = generateIcsString([match], match.title);
      var safeTitle = (match.title || 'event').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      triggerIcsFileDownload(ics, safeTitle + '.ics');
    }

    function downloadAllEventsIcs(monthOnly) {
      closeCalendarExportModal();
      var evts = monthOnly
        ? embeddedEvents.filter(function(e) { return (e.startDate || '').startsWith(activeYm); })
        : embeddedEvents;
      if (evts.length === 0) {
        alert('No events found for ' + (monthOnly ? activeYm : 'this calendar') + '.');
        return;
      }
      var safeName = '${escapeHtml(category.name.toLowerCase().replace(/[^a-z0-9]/g, '-'))}';
      var fileName = monthOnly ? safeName + '-' + activeYm + '.ics' : safeName + '-full-schedule.ics';
      var ics = generateIcsString(evts, '${escapeHtml(category.name)} Schedule');
      triggerIcsFileDownload(ics, fileName);
    }

    function openUpcomingInGoogle() {
      closeCalendarExportModal();
      var upcoming = embeddedEvents.find(function(e) { return (e.startDate || '') >= activeYm; }) || embeddedEvents[0];
      if (!upcoming) {
        alert('No upcoming events found.');
        return;
      }
      var title = encodeURIComponent(upcoming.title || 'Church Event');
      var details = encodeURIComponent([upcoming.description, upcoming.notes ? 'Notes: ' + upcoming.notes : ''].filter(Boolean).join('\\n\\n'));
      var location = encodeURIComponent(upcoming.location || '');
      var s = (upcoming.startDate || '').replace(/-/g, '');
      var sTime = (upcoming.startTime || '09:00').replace(/:/g, '').slice(0, 4) + '00';
      var eTime = upcoming.endTime
        ? upcoming.endTime.replace(/:/g, '').slice(0, 4) + '00'
        : (parseInt(sTime.slice(0, 2), 10) + 1).toString().padStart(2, '0') + sTime.slice(2);
      var dates = s + 'T' + sTime + '/' + s + 'T' + eTime;
      var gUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + title + '&dates=' + dates + '&details=' + details + '&location=' + location;
      window.open(gUrl, '_blank', 'noopener,noreferrer');
    }

    function switchMonth(ym) {
      if (!ym) return;
      activeYm = ym;
      document.body.classList.remove('show-all-months');
      var sections = document.querySelectorAll('.month-section');
      sections.forEach(function(sec) {
        if (sec.id === 'month-' + ym) {
          sec.classList.add('active-month');
          sec.style.display = 'block';
        } else {
          sec.classList.remove('active-month');
          sec.style.display = 'none';
        }
      });

      var target = document.getElementById('month-' + ym);
      if (target) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      var pills = document.querySelectorAll('.month-pill');
      pills.forEach(function(p) {
        if (p.getAttribute('data-ym') === ym) {
          p.classList.add('active');
          p.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } else {
          p.classList.remove('active');
        }
      });
    }

    function toggleAllMonths() {
      if (document.body.classList.contains('show-all-months')) {
        document.body.classList.remove('show-all-months');
      } else {
        document.body.classList.add('show-all-months');
      }
    }

    // On initial load, respect URL hash if present
    window.addEventListener('DOMContentLoaded', function() {
      var hash = window.location.hash;
      if (hash && hash.startsWith('#month-')) {
        var ym = hash.replace('#month-', '');
        switchMonth(ym);
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Downloads a self-contained .html schedule that can be opened on any phone or computer offline.
 */
export function downloadStandaloneScheduleHtml(options: GenerateOptions) {
  const html = generateStandaloneScheduleHtml(options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = `${options.category.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-schedule-24-7.html`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens a printable multi-month document and triggers the browser's print dialog.
 * From here, the user can either print physical paper or choose "Save as PDF" to get a full multi-month PDF file!
 */
export function printMultiMonthSchedule(options: GenerateOptions) {
  const html = generateStandaloneScheduleHtml(options);
  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      win.print();
    }, 400);
  }
}

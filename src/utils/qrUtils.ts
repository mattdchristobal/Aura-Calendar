import QRCode from 'qrcode';
import { Category, CalendarEvent } from '../types';

export interface QrCodeOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Calculates perceived brightness and darkens colors if they are too light.
 * Smartphone cameras (iOS Camera, Google Lens, Samsung Camera) need high contrast
 * (at least 4.5:1, ideally > 7:1) against white backgrounds to lock onto QR code
 * finder patterns instantly in any lighting condition.
 */
export function ensureCameraScannableColor(hexColor?: string): string {
  if (!hexColor || hexColor === '#000000' || hexColor === '#0f172a' || hexColor === '#1e293b') {
    return '#000000';
  }
  let clean = hexColor.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) return '#000000';

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  // Relative luminance according to ITU-R BT.709
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Smartphone cameras need high contrast (ideally pure black on white)
  // If luminance is too high, aggressively darken to deep black/navy for instant lock
  if (luminance > 0.15) {
    const factor = 0.18;
    const dr = Math.round(r * 255 * factor).toString(16).padStart(2, '0');
    const dg = Math.round(g * 255 * factor).toString(16).padStart(2, '0');
    const db = Math.round(b * 255 * factor).toString(16).padStart(2, '0');
    return `#${dr}${dg}${db}`;
  }

  return hexColor;
}

/**
 * Generate a high-resolution base64 PNG data URL for any text/URL.
 * Configured specifically for universal smartphone camera scanning.
 */
export async function generateQrDataUrl(
  text: string,
  options: QrCodeOptions = {}
): Promise<string> {
  const {
    width = 512,
    margin = 4, // ISO 18004 4-module quiet zone for fast camera edge detection
    darkColor = '#000000',
    lightColor = '#ffffff',
    errorCorrectionLevel = 'M' // 15% error recovery provides optimal module size for smartphone lenses
  } = options;

  const scannableDarkColor = ensureCameraScannableColor(darkColor);

  try {
    return await QRCode.toDataURL(text, {
      width,
      margin,
      color: {
        dark: scannableDarkColor,
        light: lightColor
      },
      errorCorrectionLevel
    });
  } catch (err) {
    console.error('Failed to generate QR code data URL:', err);
    throw err;
  }
}

/**
 * Generate SVG string for vector export
 */
export async function generateQrSvgString(
  text: string,
  options: QrCodeOptions = {}
): Promise<string> {
  const {
    margin = 4,
    darkColor = '#000000',
    lightColor = '#ffffff',
    errorCorrectionLevel = 'M'
  } = options;

  const scannableDarkColor = ensureCameraScannableColor(darkColor);

  try {
    return await QRCode.toString(text, {
      type: 'svg',
      margin,
      color: {
        dark: scannableDarkColor,
        light: lightColor
      },
      errorCorrectionLevel
    });
  } catch (err) {
    console.error('Failed to generate QR SVG:', err);
    throw err;
  }
}

export type PublicUrlMode = 'direct' | 'cloud' | 'custom' | 'shared';

/**
 * Normalizes and formats an independent public PDF or web URL (Google Drive, Dropbox, OneDrive, or public website).
 * Specifically converts Google Drive and Dropbox share links to direct mobile-scannable viewer links that bypass login walls.
 */
export function formatIndependentPdfUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();
  if (!clean) return '';

  // Ensure protocol if missing
  if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('data:')) {
    clean = 'https://' + clean;
  }

  // Google Drive: Convert share link /view to /preview for instant mobile browser viewing without sign-in prompt
  if (clean.includes('drive.google.com')) {
    const fileIdMatch = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
    }
  }

  // Dropbox: Convert dl=0 to direct preview or raw
  if (clean.includes('dropbox.com')) {
    clean = clean.replace(/[?&]dl=0/, '').replace(/[?&]dl=1/, '');
    clean += clean.includes('?') ? '&raw=1' : '?raw=1';
    return clean;
  }

  return clean;
}

/**
 * Gets the configured independent public PDF URL for a specific category (or 'all').
 * Independent URLs bypass app login and do not require the user's computer to be on.
 */
export function getIndependentPdfUrl(categoryId: string = 'all'): string {
  try {
    const key = `calendar_pdf_url_${(categoryId || 'all').toLowerCase()}`;
    const saved = localStorage.getItem(key);
    if (saved && saved.includes('dpaste')) {
      localStorage.removeItem(key);
    } else if (saved && saved.trim()) {
      return saved.trim();
    }
    if (categoryId && categoryId.toLowerCase() !== 'all') {
      const global = localStorage.getItem('calendar_pdf_url_all');
      if (global && global.includes('dpaste')) {
        localStorage.removeItem('calendar_pdf_url_all');
      } else if (global && global.trim()) {
        return global.trim();
      }
    }
  } catch (e) {}
  return '';
}

/**
 * Stores the independent public PDF URL for a specific category (or 'all').
 */
export function setIndependentPdfUrl(categoryId: string = 'all', url: string): void {
  try {
    const key = `calendar_pdf_url_${(categoryId || 'all').toLowerCase()}`;
    if (url && url.trim() && !url.includes('dpaste')) {
      const formatted = formatIndependentPdfUrl(url.trim());
      localStorage.setItem(key, formatted);
      // Also persist to server settings in background
      fetch('/api/pdf-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: (categoryId || 'all').toLowerCase(), url: formatted })
      }).catch(() => {});
    } else {
      localStorage.removeItem(key);
      fetch('/api/pdf-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: (categoryId || 'all').toLowerCase(), url: '' })
      }).catch(() => {});
    }
  } catch (e) {}
}

/**
 * Gets all saved independent PDF URLs as a dictionary of categoryId -> url
 */
export function getAllIndependentPdfUrls(): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('calendar_pdf_url_')) {
        const catId = key.replace('calendar_pdf_url_', '');
        const val = localStorage.getItem(key);
        if (val && !val.includes('dpaste')) result[catId] = val;
      }
    }
  } catch (e) {}
  return result;
}

/**
 * Publishes an independent, 24/7 standalone HTML schedule page for a category to the cloud.
 * Requires NO app login, NO computer running, and works on any phone camera scan.
 */
export async function publishScheduleToCloud(
  categoryId: string,
  categoryName: string,
  categoryHex: string,
  events: CalendarEvent[],
  customHtml?: string
): Promise<string> {
  try {
    const res = await fetch('/api/publish-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: (categoryId || 'all').toLowerCase(),
        categoryName: categoryName || 'Community Schedule',
        categoryHex: categoryHex || '#0f172a',
        events,
        customHtml
      })
    });

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    const data = await res.json();
    if (data.url) {
      setIndependentPdfUrl(categoryId, data.url);
      return data.url;
    }
    throw new Error('No URL returned from public cloud publisher');
  } catch (err: any) {
    console.error('publishScheduleToCloud error:', err);
    throw err;
  }
}

export const PUBLIC_CLOUD_ORIGIN = 'https://ais-pre-7l4infuif524ncheylrol3-488950738317.us-east1.run.app';

export const CANONICAL_PUBLIC_APP_URL = typeof window !== 'undefined' && window.location && !window.location.origin.includes('localhost') && !window.location.origin.includes('ais-dev-')
  ? window.location.origin
  : PUBLIC_CLOUD_ORIGIN;

export function getCustomPublicBaseUrl(): string {
  try {
    const saved = localStorage.getItem('calendar_public_base_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch (e) {}
  return '';
}

export function setCustomPublicBaseUrl(url: string): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem('calendar_public_base_url', url.trim().replace(/\/+$/, ''));
    } else {
      localStorage.removeItem('calendar_public_base_url');
    }
  } catch (e) {}
}

export function getPublicUrlMode(): PublicUrlMode {
  try {
    const mode = localStorage.getItem('calendar_public_url_mode') as PublicUrlMode;
    if (mode === 'direct' || mode === 'custom' || mode === 'shared') return mode;
  } catch (e) {}

  return 'direct';
}

export function setPublicUrlMode(mode: PublicUrlMode): void {
  try {
    localStorage.setItem('calendar_public_url_mode', mode);
  } catch (e) {}
}

/**
 * Helper to determine if the app is currently running inside Google AI Studio's developer/preview sandbox
 */
export function isCurrentHostAiStudioPreview(): boolean {
  try {
    const host = window.location.hostname || '';
    return host.includes('ais-dev-') || host.includes('ais-pre-') || host.includes('ai.studio');
  } catch {
    return false;
  }
}

/**
 * Checks if a public URL is live and reachable externally
 */
export async function verifyPublicUrlLive(url: string): Promise<{
  reachable: boolean;
  status?: number;
  error?: string;
  isAiStudioPreview?: boolean;
  message?: string;
  finalUrl?: string;
}> {
  try {
    const res = await fetch(`/api/check-public-url?url=${encodeURIComponent(url)}`);
    if (!res.ok) return { reachable: false, status: res.status };
    const data = await res.json();
    return data;
  } catch (e: any) {
    return { reachable: false, error: e.message };
  }
}

/**
 * Compact schema representation for encoding category event schedules into QR Code URLs.
 * Enables 100% offline, serverless, login-free immediate schedule display upon scanning!
 */
export interface CompactQrEvent {
  i: string; // id
  t: string; // title
  sd: string; // startDate YYYY-MM-DD
  ed?: string; // endDate YYYY-MM-DD
  st?: string; // startTime HH:MM
  et?: string; // endTime HH:MM
  c?: string; // categoryId
  l?: string; // location
  d?: string; // description
  ad?: number; // 1 for isAllDay
  p?: 'low' | 'medium' | 'high';
  tm?: string; // tema
}

/**
 * Compacts and base64-url encodes category events for embedding into the public QR URL.
 */
export function packEventsForUrl(
  eventsToPack: CalendarEvent[],
  categoryId?: string
): string {
  try {
    if (!eventsToPack || !Array.isArray(eventsToPack) || eventsToPack.length === 0) {
      return '';
    }
    const isAll = !categoryId || categoryId.toLowerCase() === 'all' || categoryId.toLowerCase() === 'overview';
    const relevant = isAll
      ? eventsToPack
      : eventsToPack.filter(
          (e) =>
            e.categoryId === categoryId ||
            (e.categoryId && categoryId && e.categoryId.toLowerCase() === categoryId.toLowerCase())
        );

    const list = relevant.length === 0 && (categoryId === 'new' || !categoryId) ? eventsToPack : relevant;
    if (list.length === 0) return '';

    // Sort by start date ascending
    const sorted = [...list].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    // Take up to 25 events so the QR code density remains easy to scan by smartphone lenses
    const slice = sorted.slice(0, 25);

    const compact: CompactQrEvent[] = slice.map((e) => ({
      i: e.id,
      t: e.title || 'Event',
      sd: e.startDate || new Date().toISOString().slice(0, 10),
      ...(e.endDate && e.endDate !== e.startDate ? { ed: e.endDate } : {}),
      ...(e.startTime ? { st: e.startTime } : {}),
      ...(e.endTime ? { et: e.endTime } : {}),
      ...(e.categoryId ? { c: e.categoryId } : {}),
      ...(e.location ? { l: e.location } : {}),
      ...(e.description ? { d: e.description.slice(0, 100) } : {}),
      ...(e.isAllDay ? { ad: 1 } : {}),
      ...(e.priority && e.priority !== 'medium' ? { p: e.priority } : {}),
      ...(e.tema ? { tm: e.tema } : {})
    }));

    const jsonStr = JSON.stringify(compact);
    const base64 = btoa(
      encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Safety length cap: if QR payload would exceed 1500 chars, compress further to 8 events
    if (base64.length > 1500 && slice.length > 6) {
      const smaller = slice.slice(0, 8);
      const smallerCompact: CompactQrEvent[] = smaller.map((e) => ({
        i: e.id,
        t: e.title || 'Event',
        sd: e.startDate,
        st: e.startTime,
        et: e.endTime,
        c: e.categoryId,
        l: e.location || undefined
      }));
      return btoa(
        encodeURIComponent(JSON.stringify(smallerCompact)).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16))
        )
      )
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    return base64;
  } catch (e) {
    console.warn('packEventsForUrl error:', e);
    return '';
  }
}

/**
 * Unpacks and parses compact QR URL payload into full CalendarEvent objects.
 */
export function unpackEventsFromUrl(encoded: string): CalendarEvent[] {
  try {
    if (!encoded || typeof encoded !== 'string' || !encoded.trim()) {
      return [];
    }
    let base64 = encoded.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const jsonStr = decodeURIComponent(
      Array.prototype.map
        .call(binary, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any) => ({
      id: item.i || `evt-qr-${Math.random().toString(36).slice(2, 9)}`,
      title: item.t || 'Event',
      startDate: item.sd || new Date().toISOString().slice(0, 10),
      endDate: item.ed || item.sd || new Date().toISOString().slice(0, 10),
      startTime: item.st || '09:00',
      endTime: item.et || '10:00',
      categoryId: item.c || 'new',
      location: item.l || '',
      description: item.d || '',
      notes: '',
      isAllDay: Boolean(item.ad),
      priority: item.p || 'medium',
      tema: item.tm || '',
      userId: 'qr_scanner',
      createdBy: 'Organizers',
      recurrence: 'none' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  } catch (e) {
    console.warn('unpackEventsFromUrl error:', e);
    return [];
  }
}

/**
 * Constructs the canonical public web browser URL for viewing a category PDF schedule or master overview.
 * Produces clean, concise URLs (< 70 chars) so that smartphone cameras lock onto the QR code in < 100ms.
 */
export function getCategoryPublicUrl(
  categoryId: string,
  view: 'pdf' | 'calendar' = 'pdf',
  explicitBaseUrl?: string,
  urlFormat?: 'path' | 'query',
  eventsToPack?: CalendarEvent[]
): string {
  const isAll = (categoryId || '').toLowerCase() === 'all' || (categoryId || '').toLowerCase() === 'overview';
  const cleanCategory = isAll ? 'all' : encodeURIComponent(categoryId.trim());

  try {
    let origin = '';
    const customUrl = getCustomPublicBaseUrl();

    if (explicitBaseUrl && explicitBaseUrl.trim()) {
      origin = explicitBaseUrl.trim().replace(/\/+$/, '');
    } else if (customUrl && customUrl.trim()) {
      origin = customUrl.trim().replace(/\/+$/, '');
    } else if (typeof window !== 'undefined' && window.location && window.location.origin) {
      origin = window.location.origin.replace(/\/+$/, '');
    }

    if (!origin && typeof window !== 'undefined' && window.location) {
      origin = window.location.origin.replace(/\/+$/, '');
    }

    // 1. If in AI Studio developer sandbox (ais-dev-), convert to public shared origin (ais-pre-)
    // so any phone camera scanner lands directly on the live schedule without developer login!
    if (origin && origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }

    // 2. If origin is localhost or loopback, phone cameras cannot reach it and it stops when the computer is off.
    // Automatically route to the permanent Google Cloud Run 24/7 server!
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      origin = PUBLIC_CLOUD_ORIGIN;
    }

    origin = (origin || PUBLIC_CLOUD_ORIGIN).replace(/\/+$/, '');

    // Optional fail-safe: if events are passed and compact, encode into query string so schedule self-heals even on cold start
    let queryPayload = '';
    if (Array.isArray(eventsToPack) && eventsToPack.length > 0) {
      const packed = packEventsForUrl(eventsToPack);
      if (packed && packed.length <= 800) {
        queryPayload = `?d=${encodeURIComponent(packed)}`;
      }
    }

    // Ultra-clean, 24/7 cloud URL accessible to anyone who scans the QR code
    return `${origin}/pdf/${cleanCategory}${queryPayload}`;
  } catch (e) {
    return `${PUBLIC_CLOUD_ORIGIN}/pdf/${cleanCategory}`;
  }
}

/**
 * Downloads a generated QR Code image to the user's computer or device
 */
export function downloadQrCode(dataUrl: string, filename: string = 'category-qr-code.png') {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and downloads a high-resolution PNG file directly to the user's computer
 */
export async function downloadHighResCategoryQrPng(
  category: Category,
  publicUrl: string,
  options: { width?: number; darkColor?: string } = {}
) {
  try {
    const { width = 1024, darkColor = '#000000' } = options;
    const dataUrl = await generateQrDataUrl(publicUrl, {
      width,
      margin: 4,
      darkColor: ensureCameraScannableColor(darkColor),
      lightColor: '#ffffff',
      errorCorrectionLevel: 'M'
    });
    const safeName = (category.name || 'category').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadQrCode(dataUrl, `${safeName}_Schedule_QR.png`);
    return true;
  } catch (err) {
    console.error('Failed to download high-res QR PNG:', err);
    return false;
  }
}

/**
 * Downloads an SVG string as a file
 */
export function downloadQrSvg(svgContent: string, filename: string = 'category-qr-code.svg') {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Launches an executive printable flyer/poster with Category QR code for physical display
 */
export function printCategoryQrFlyer(params: {
  category: Category;
  eventsCount: number;
  qrDataUrl: string;
  publicUrl: string;
}) {
  const { category, eventsCount, qrDataUrl, publicUrl } = params;

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    alert('Please allow popups to open the printable QR code flyer.');
    return;
  }

  const isAll = category.id === 'all' || category.id === 'overview';
  const badgeTitle = isAll ? 'SACRAMENTOS' : `${category.name} Schedule`;
  const mainTitle = isAll ? 'Scan to View SACRAMENTOS Schedule & PDF' : 'Scan to View Event Details & PDF';
  const subtitleDesc = isAll
    ? 'Scan this QR code with any mobile camera to view the complete SACRAMENTOS schedule, event locations, timings, and download PDF. <strong>No account or login required.</strong>'
    : 'Scan this QR code with any mobile camera to view full schedule, event locations, timings, and download PDF. <strong>No account or login required.</strong>';
  const eventsCountLabel = isAll
    ? `${eventsCount} active event${eventsCount === 1 ? '' : 's'} across all categories`
    : `${eventsCount} active event${eventsCount === 1 ? '' : 's'}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QR Code Schedule - ${category.name}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 90vh;
      text-align: center;
    }
    .poster-card {
      border: 3px solid #e2e8f0;
      border-radius: 24px;
      padding: 48px 36px;
      max-width: 620px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      position: relative;
    }
    .badge-pill {
      display: inline-block;
      padding: 6px 18px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      background-color: ${category.hex}15;
      color: ${category.hex};
      border: 2px solid ${category.hex}40;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 32px;
      font-weight: 800;
      line-height: 1.2;
      color: #0f172a;
      margin-bottom: 12px;
    }
    p.subtitle {
      font-size: 16px;
      color: #64748b;
      margin-bottom: 32px;
      max-width: 440px;
      margin-left: auto;
      margin-right: auto;
    }
    .qr-frame {
      background: #ffffff;
      padding: 20px;
      border-radius: 20px;
      border: 2px dashed #cbd5e1;
      display: inline-block;
      margin-bottom: 28px;
    }
    .qr-frame img {
      width: 260px;
      height: 260px;
      display: block;
    }
    .instructions {
      background: #f8fafc;
      border-radius: 16px;
      padding: 16px 20px;
      margin-bottom: 24px;
      border: 1px solid #e2e8f0;
    }
    .instructions-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .instructions-desc {
      font-size: 13px;
      color: #64748b;
    }
    .footer-url {
      font-size: 11px;
      color: #94a3b8;
      word-break: break-all;
    }
    .event-count {
      font-weight: 700;
      color: ${category.hex};
    }
    @media print {
      body {
        padding: 0;
      }
      .poster-card {
        border: 2px solid #0f172a;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="poster-card">
    <div class="badge-pill">${badgeTitle}</div>
    <h1>${mainTitle}</h1>
    <p class="subtitle">
      ${subtitleDesc}
    </p>

    <div class="qr-frame">
      <img src="${qrDataUrl}" alt="QR Code for ${category.name}" />
    </div>

    <div class="instructions">
      <div class="instructions-title">📷 How to Access</div>
      <div class="instructions-desc">
        Open your smartphone camera or QR scanner, point it at the code, and tap the link to open the live browser PDF schedule.
      </div>
    </div>

    <p style="font-size: 13px; color: #475569; margin-bottom: 12px;">
      Total Events Scheduled: <span class="event-count">${eventsCountLabel}</span>
    </p>

    <div class="footer-url">
      Direct Web Link: ${publicUrl}
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

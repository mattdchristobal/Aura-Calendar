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
    return '#0f172a';
  }
  let clean = hexColor.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) return '#0f172a';

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  // Relative luminance according to ITU-R BT.709
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // If luminance is too high for reliable phone camera detection (e.g. yellow, lime, light cyan, pink),
  // aggressively darken it by 60-70% so the camera sensor sees crisp, sharp edge transitions.
  if (luminance > 0.25) {
    const factor = 0.35; // Deepen color while keeping hue recognizable
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
    width = 480,
    margin = 3, // ISO quiet zone for fast camera edge detection
    darkColor = '#0f172a',
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
    margin = 3,
    darkColor = '#0f172a',
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

export type PublicUrlMode = 'shared' | 'direct' | 'custom';

export function getCustomPublicBaseUrl(): string {
  try {
    const saved = localStorage.getItem('calendar_public_base_url');
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
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
  return 'shared';
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
 * Constructs the canonical public web browser URL for viewing a category PDF schedule or master overview.
 * Prioritizes verified 24/7 Cloud Run or custom production domain if configured,
 * ensuring smartphone cameras scanning the QR code work 24/7 without login!
 */
export function getCategoryPublicUrl(
  categoryId: string,
  view: 'pdf' | 'calendar' = 'pdf',
  explicitBaseUrl?: string
): string {
  const isAll = (categoryId || '').toLowerCase() === 'all' || (categoryId || '').toLowerCase() === 'overview';
  try {
    let origin = '';
    if (explicitBaseUrl && explicitBaseUrl.trim()) {
      origin = explicitBaseUrl.trim().replace(/\/+$/, '');
    } else {
      const mode = getPublicUrlMode();
      const customUrl = getCustomPublicBaseUrl();

      // If a custom 24/7 production or Cloud Run URL is configured, ALWAYS prioritize it
      if (customUrl && (mode === 'custom' || !explicitBaseUrl)) {
        origin = customUrl;
      } else if (mode === 'direct') {
        origin = window.location.origin;
      } else {
        origin = window.location.origin;
        if (origin.includes('ais-dev-')) {
          origin = origin.replace('ais-dev-', 'ais-pre-');
        }
      }
    }

    if (view === 'pdf') {
      if (isAll) {
        return `${origin}/pdf/all`;
      }
      return `${origin}/pdf/${encodeURIComponent(categoryId)}`;
    }

    const url = new URL(origin + '/');
    if (isAll) {
      url.searchParams.set('category', 'all');
      url.searchParams.set('view', 'pdf');
    } else {
      url.searchParams.set('category', categoryId);
      url.searchParams.set('view', 'pdf');
    }
    return url.toString();
  } catch (e) {
    let origin = explicitBaseUrl || getCustomPublicBaseUrl() || window.location?.origin || '';
    if (!explicitBaseUrl && !getCustomPublicBaseUrl() && origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    if (isAll) {
      return `${origin}/pdf/all`;
    }
    return `${origin}/pdf/${encodeURIComponent(categoryId)}`;
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
    const { width = 1024, darkColor = category.hex || '#0f172a' } = options;
    const dataUrl = await generateQrDataUrl(publicUrl, {
      width,
      margin: 2,
      darkColor,
      lightColor: '#ffffff',
      errorCorrectionLevel: 'H'
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
  const badgeTitle = isAll ? 'All Categories Master Overview' : `${category.name} Schedule`;
  const mainTitle = isAll ? 'Scan to View All Categories Schedule & PDF' : 'Scan to View Event Details & PDF';
  const subtitleDesc = isAll
    ? 'Scan this QR code with any mobile camera to view the complete schedule across all ministries and categories, event locations, timings, and download PDF. <strong>No account or login required.</strong>'
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

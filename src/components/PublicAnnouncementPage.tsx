import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Phone,
  Mail,
  Globe,
  Share2,
  Download,
  Printer,
  Check,
  ArrowRight,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { AnnouncementFlyer } from '../types';
import {
  DEFAULT_ANNOUNCEMENT,
  ANNOUNCEMENT_THEMES,
  loadAnnouncementsFromStorage,
  getAnnouncementPublicUrl
} from '../utils/announcements';

interface PublicAnnouncementPageProps {
  announcementId?: string;
  onOpenCalendar?: () => void;
  onOpenLogin?: () => void;
}

export const PublicAnnouncementPage: React.FC<PublicAnnouncementPageProps> = ({
  announcementId,
  onOpenCalendar,
  onOpenLogin
}) => {
  const [announcement, setAnnouncement] = useState<AnnouncementFlyer>(DEFAULT_ANNOUNCEMENT);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1. Try to load from server
    async function fetchDetails() {
      try {
        const id = announcementId || 'active';
        const res = await fetch(`/api/announcements/${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.title) {
            setAnnouncement(data);
            return;
          }
        }
      } catch (e) {}

      // 2. Fallback to local storage
      const list = loadAnnouncementsFromStorage();
      if (announcementId) {
        const found = list.find((a) => a.id === announcementId);
        if (found) {
          setAnnouncement(found);
          return;
        }
      }
      setAnnouncement(list[0] || DEFAULT_ANNOUNCEMENT);
    }

    fetchDetails();
  }, [announcementId]);

  const currentTheme =
    ANNOUNCEMENT_THEMES.find((t) => t.id === announcement.theme) || ANNOUNCEMENT_THEMES[0];

  const handleShare = async () => {
    const shareUrl = getAnnouncementPublicUrl(announcement.id);
    if (navigator.share) {
      try {
        await navigator.share({
          title: announcement.title,
          text: `${announcement.title} - ${announcement.dateDayOfWeek} ${announcement.dateMonthDay} ${announcement.timeText}`,
          url: shareUrl
        });
        return;
      } catch (e) {}
    }
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadIcs = () => {
    // Generate simple .ics calendar file for the announcement
    const title = announcement.title;
    const location = announcement.locationText || announcement.address || '';
    const desc = `${announcement.subtitle || ''}\n${announcement.highlights.join('\n')}`;
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AuraCalendar//Announcement Flyer//EN',
      'BEGIN:VEVENT',
      `SUMMARY:${title}`,
      `DESCRIPTION:${desc.replace(/\n/g, '\\n')}`,
      `LOCATION:${location}`,
      `STATUS:CONFIRMED`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onOpenCalendar && (
            <button
              onClick={onOpenCalendar}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Calendar</span>
            </button>
          )}
          <div className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span>Event Announcement</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-900/30 transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied!' : 'Share'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 transition-colors"
            title="Print Flyer"
          >
            <Printer className="w-4 h-4" />
          </button>

          {onOpenLogin && (
            <button
              onClick={onOpenLogin}
              className="text-xs text-purple-400 hover:text-purple-300 font-bold px-2 py-1"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Content: Centered Flyer Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8">
        <div
          id="public-announcement-flyer-render"
          className={`relative w-full max-w-md sm:max-w-lg rounded-3xl overflow-hidden shadow-2xl border ${currentTheme.cardBorder}`}
          style={{
            background: `radial-gradient(circle at 50% 35%, #4a127a 0%, #2e0854 50%, #120324 100%)`
          }}
        >
          {/* Background Geometric Diamond Decorative Layers */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute left-1/2 -translate-x-1/2 top-28 w-[380px] h-[380px] sm:w-[460px] sm:h-[460px] rotate-45 rounded-3xl border border-purple-400/20 shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(88, 28, 135, 0.25) 100%)'
              }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 top-36 w-[300px] h-[300px] sm:w-[370px] sm:h-[370px] rotate-45 rounded-2xl border border-fuchsia-400/25 shadow-inner"
              style={{
                background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(59, 7, 100, 0.4) 100%)'
              }}
            />
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                backgroundSize: '16px 16px'
              }}
            />
          </div>

          {/* Flyer Body Content */}
          <div className="relative z-10 flex flex-col items-center text-center px-6 pt-0 pb-6 min-h-[640px] sm:min-h-[720px] justify-between">
            {/* Top Logo Badge */}
            <div className="relative -mt-2 mb-6 flex flex-col items-center">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white shadow-2xl border-4 border-white flex flex-col items-center justify-center p-2 relative overflow-hidden">
                {announcement.logoUrl ? (
                  <img
                    src={announcement.logoUrl}
                    alt="Event Logo"
                    className="max-w-[85%] max-h-[58%] object-contain"
                  />
                ) : (
                  <svg
                    viewBox="0 0 100 100"
                    className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500 drop-shadow-sm mb-1"
                    fill="currentColor"
                  >
                    <path
                      d="M30,20 C45,20 50,30 50,45 L50,60 C50,75 55,80 70,80 C75,80 80,75 80,70 L80,55 C80,40 75,35 60,35 C55,35 50,40 50,45"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="50" cy="50" r="8" fill="#fbbf24" />
                  </svg>
                )}

                {announcement.showLogo !== false && (
                  <span className="text-[10px] sm:text-[11px] font-black tracking-wider text-slate-900 uppercase mt-0.5 max-w-[90%] truncate">
                    {announcement.logoText || 'EVENT LOGO'}
                  </span>
                )}
              </div>
            </div>

            {/* Headlines Section */}
            <div className="w-full space-y-1 sm:space-y-1.5 mb-5">
              <div className="text-xs sm:text-sm font-black tracking-widest text-amber-400 uppercase drop-shadow-sm">
                {announcement.eyebrow || "DON'T MISS OUT!"}
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase leading-none drop-shadow-md">
                {announcement.title || 'EVENT TITLE'}
              </h1>

              <div className="text-sm sm:text-base font-medium text-slate-100 tracking-wide opacity-95">
                {announcement.subtitle || 'Family-Friendly Event'}
              </div>
            </div>

            {/* Picture (if enabled) */}
            {announcement.showPicture && announcement.pictureUrl && (
              <div className="w-full max-w-sm mb-5 rounded-2xl overflow-hidden border-2 border-purple-400/40 shadow-xl max-h-48">
                <img
                  src={announcement.pictureUrl}
                  alt="Featured Event"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            )}

            {/* Date & Time Badge */}
            <div className="w-full max-w-sm bg-white rounded-2xl p-3 sm:p-4 shadow-2xl flex items-center gap-3.5 mb-6 text-left border border-purple-100">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-amber-50 border-2 border-amber-400 flex items-center justify-center text-amber-500 shrink-0 shadow-xs relative">
                <CalendarIcon className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2]" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-amber-400 flex items-center justify-center text-amber-600 shadow-2xs">
                  <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              </div>

              <div className="flex-1">
                <div className="text-xs sm:text-sm font-extrabold uppercase tracking-tight leading-tight">
                  <span className="text-slate-900">{announcement.dateDayOfWeek} </span>
                  <span className="text-amber-500">{announcement.dateMonthDay}</span>
                </div>
                <div className="text-slate-900 font-black text-sm sm:text-base tracking-tight mt-0.5">
                  {announcement.timeText}
                </div>
                {announcement.locationText && (
                  <div className="text-[10px] text-slate-500 font-semibold truncate max-w-[200px] mt-0.5">
                    {announcement.locationText}
                  </div>
                )}
              </div>
            </div>

            {/* Highlights Section */}
            <div className="w-full max-w-sm text-left mb-6 space-y-2">
              <div className="text-xs sm:text-sm font-black tracking-wider text-amber-400 uppercase drop-shadow-sm flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{announcement.highlightsTitle || 'HIGHLIGHTS OF THE EVENT:'}</span>
              </div>

              <div className="space-y-1.5 pl-1">
                {announcement.highlights.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-white text-xs sm:text-sm font-medium">
                    <div className="w-4 h-4 rounded-full border border-amber-400 bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                    <span className="leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Contact Chips */}
            <div className="w-full max-w-md pt-3 border-t border-purple-500/30 grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
              <div className="flex items-center gap-1.5 text-left truncate">
                <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
                  <Phone className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[8px] font-bold text-amber-400 uppercase tracking-wider leading-none">
                    CALL US
                  </div>
                  <div className="text-[10px] sm:text-xs font-black text-white truncate">
                    {announcement.phone || '123-456-789'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-left truncate">
                <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
                  <Globe className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-white truncate leading-tight">
                    {announcement.email || 'info@email.com'}
                  </div>
                  <div className="text-[8px] font-bold text-amber-300 truncate leading-tight">
                    {announcement.website || 'www.websitename.com'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-left truncate">
                <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
                  <MapPin className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-medium text-slate-200 truncate leading-tight">
                    {announcement.address || 'Event Address'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons for Mobile Visitors */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 max-w-md w-full">
          <button
            onClick={handleDownloadIcs}
            className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 transition-all"
          >
            <CalendarIcon className="w-4 h-4 text-amber-300" />
            <span>Add to My Calendar (.ics)</span>
          </button>

          {onOpenCalendar && (
            <button
              onClick={onOpenCalendar}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
            >
              <span>View Full Calendar</span>
              <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
            </button>
          )}
        </div>
      </main>

      <footer className="py-3 px-4 text-center text-[11px] text-slate-500 border-t border-slate-900">
        Powered by AuraCalendar &bull; Scanned via Live Announcement QR
      </footer>
    </div>
  );
};

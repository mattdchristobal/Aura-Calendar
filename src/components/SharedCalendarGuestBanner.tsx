import React, { useState } from 'react';
import {
  Share2,
  Lock,
  Globe,
  Copy,
  Check,
  X,
  LogIn,
  Filter,
  Download,
  Printer,
  Sparkles,
  Users
} from 'lucide-react';
import { SharedCalendar } from '../types';

interface SharedCalendarGuestBannerProps {
  share: SharedCalendar;
  onExitSharedView: () => void;
  onOpenLogin?: () => void;
  isAuthenticated: boolean;
  onExportIcs?: () => void;
  onPrint?: () => void;
}

export const SharedCalendarGuestBanner: React.FC<SharedCalendarGuestBannerProps> = ({
  share,
  onExitSharedView,
  onOpenLogin,
  isAuthenticated,
  onExportIcs,
  onPrint
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(share.code)}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      id="shared-calendar-guest-banner"
      className="w-full bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white px-4 py-2.5 shadow-md border-b border-indigo-700/60 z-30 transition-all"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 text-xs">
        {/* Left Section: Share Info */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-700/60 border border-indigo-500/40 text-indigo-100 font-medium">
            <Globe className="w-3.5 h-3.5 text-indigo-300 animate-pulse" />
            <span>Shared View</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white">
              {share.title}
            </span>
            {share.targetGroup && (
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-950/70 border border-indigo-600/50 text-indigo-200 flex items-center gap-1">
                <Users className="w-3 h-3 text-indigo-300" />
                {share.targetGroup}
              </span>
            )}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-600/40 font-mono text-[11px] text-indigo-300">
              <span>Code:</span>
              <strong className="text-white">{share.code}</strong>
            </div>
          </div>

          {share.description && (
            <span className="hidden lg:inline text-[11px] text-indigo-200/80 truncate max-w-xs">
              &bull; {share.description}
            </span>
          )}
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Copy Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-700/70 hover:bg-indigo-600 border border-indigo-500/50 text-white font-medium transition-all shadow-xs"
            title="Copy Direct Share Link"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span className="text-emerald-200 font-bold">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Share Link</span>
              </>
            )}
          </button>

          {/* Export / Print if allowed */}
          {share.allowGuestsToExport && onExportIcs && (
            <button
              type="button"
              onClick={onExportIcs}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 hover:text-white transition-colors"
              title="Download iCalendar (.ics) file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export .ics</span>
            </button>
          )}

          {share.allowGuestsToExport && onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 hover:text-white transition-colors"
              title="Print Schedule"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
          )}

          {/* If Guest (Not Authenticated), show Sign In / Full Access */}
          {!isAuthenticated && onOpenLogin && (
            <button
              type="button"
              onClick={onOpenLogin}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Admin</span>
            </button>
          )}

          {/* Exit Shared View */}
          <button
            type="button"
            onClick={onExitSharedView}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 hover:text-white border border-rose-700/50 transition-colors"
            title="Exit Shared Calendar Mode"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit Share</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Phone,
  Mail,
  Globe,
  Upload,
  Image as ImageIcon,
  Trash2,
  Plus,
  RefreshCw,
  ExternalLink,
  Edit3,
  Eye,
  Share2,
  Palette,
  CheckCircle2,
  ChevronDown,
  Layers,
  FileText
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { AnnouncementFlyer, CalendarEvent, User } from '../types';
import {
  DEFAULT_ANNOUNCEMENT,
  ANNOUNCEMENT_THEMES,
  loadAnnouncementsFromStorage,
  saveAnnouncementsToStorage,
  getActiveAnnouncement,
  setActiveAnnouncementId,
  getAnnouncementPublicUrl,
  createAnnouncementFromEvent
} from '../utils/announcements';
import { generateQrDataUrl, downloadQrCode } from '../utils/qrUtils';

interface AnunciosViewProps {
  events: CalendarEvent[];
  currentUser?: User | null;
  onSelectEvent?: (event: CalendarEvent) => void;
  isGuest?: boolean;
  onBackToCalendar?: () => void;
}

export const AnunciosView: React.FC<AnunciosViewProps> = ({
  events = [],
  currentUser,
  onSelectEvent,
  isGuest = false,
  onBackToCalendar
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const isReadOnly = isGuest || currentUser?.role === 'viewer';

  // Announcements state
  const [announcements, setAnnouncements] = useState<AnnouncementFlyer[]>(() =>
    loadAnnouncementsFromStorage()
  );
  const [activeId, setActiveId] = useState<string>(() => getActiveAnnouncement().id);
  const [isEditMode, setIsEditMode] = useState<boolean>(!isReadOnly);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState<boolean>(false);

  // File input refs
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const pictureFileInputRef = useRef<HTMLInputElement>(null);
  const flyerContainerRef = useRef<HTMLDivElement>(null);

  // Current active announcement
  const currentAnnouncement =
    announcements.find((a) => a.id === activeId) || announcements[0] || DEFAULT_ANNOUNCEMENT;

  // Sync to activeId
  useEffect(() => {
    setActiveAnnouncementId(activeId);
  }, [activeId]);

  // Load from server on mount
  useEffect(() => {
    async function fetchServerAnnouncements() {
      try {
        const res = await fetch('/api/announcements');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setAnnouncements(data);
            saveAnnouncementsToStorage(data);
          }
        }
      } catch (e) {
        // Fallback to local storage is already active
      }
    }
    fetchServerAnnouncements();
  }, []);

  // Generate live QR code for the announcement
  useEffect(() => {
    const publicUrl = getAnnouncementPublicUrl(currentAnnouncement.id);
    generateQrDataUrl(publicUrl, {
      width: 512,
      margin: 2,
      darkColor: '#2e0854',
      lightColor: '#ffffff',
      errorCorrectionLevel: 'M'
    })
      .then(setQrDataUrl)
      .catch((err) => console.warn('QR generation error:', err));
  }, [currentAnnouncement.id]);

  // Active theme configuration
  const currentTheme =
    ANNOUNCEMENT_THEMES.find((t) => t.id === currentAnnouncement.theme) || ANNOUNCEMENT_THEMES[0];

  // Helper to update current announcement
  const updateCurrent = (fields: Partial<AnnouncementFlyer>) => {
    setAnnouncements((prev) => {
      const updated = prev.map((a) =>
        a.id === currentAnnouncement.id
          ? { ...a, ...fields, updatedAt: new Date().toISOString() }
          : a
      );
      saveAnnouncementsToStorage(updated);
      return updated;
    });
  };

  // Save changes to server
  const handleSaveAnnouncement = async () => {
    setIsSaving(true);
    try {
      saveAnnouncementsToStorage(announcements);
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcements)
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.warn('Failed to save to server, saved locally:', e);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default template (matches attached image)
  const handleResetToDefault = () => {
    if (window.confirm('Reset this announcement to the default flyer template?')) {
      updateCurrent({
        ...DEFAULT_ANNOUNCEMENT,
        id: currentAnnouncement.id,
        createdAt: currentAnnouncement.createdAt
      });
    }
  };

  // Handle Logo file upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Logo image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        updateCurrent({ logoUrl: dataUrl, showLogo: true });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle Picture file upload
  const handlePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Picture image must be under 8MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        updateCurrent({ pictureUrl: dataUrl, showPicture: true });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle Highlights editing
  const handleHighlightChange = (index: number, val: string) => {
    const list = [...currentAnnouncement.highlights];
    list[index] = val;
    updateCurrent({ highlights: list });
  };

  const handleAddHighlight = () => {
    const list = [...currentAnnouncement.highlights, 'New Event Highlight'];
    updateCurrent({ highlights: list });
  };

  const handleRemoveHighlight = (index: number) => {
    const list = currentAnnouncement.highlights.filter((_, i) => i !== index);
    updateCurrent({ highlights: list.length > 0 ? list : ['Highlight 1'] });
  };

  // Import from Calendar Event
  const handleImportEvent = (eventId: string) => {
    const evt = events.find((e) => e.id === eventId);
    if (!evt) return;
    const converted = createAnnouncementFromEvent(evt, currentAnnouncement);
    updateCurrent({
      title: converted.title,
      subtitle: converted.subtitle,
      dateDayOfWeek: converted.dateDayOfWeek,
      dateMonthDay: converted.dateMonthDay,
      timeText: converted.timeText,
      locationText: converted.locationText,
      highlights: converted.highlights,
      linkedEventId: evt.id
    });
  };

  // Copy share link
  const handleCopyLink = () => {
    const publicUrl = getAnnouncementPublicUrl(currentAnnouncement.id);
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Download flyer as high-res PNG image
  const handleDownloadFlyerImage = async () => {
    if (!flyerContainerRef.current) return;
    setIsDownloadingImage(true);
    try {
      const canvas = await html2canvas(flyerContainerRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
      });
      const dataUrl = canvas.toDataURL('image/png');
      const filename = `${currentAnnouncement.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_flyer.png`;
      downloadQrCode(dataUrl, filename);
    } catch (err) {
      console.warn('Failed to capture flyer as image:', err);
    } finally {
      setIsDownloadingImage(false);
    }
  };

  // Print flyer
  const handlePrintFlyer = () => {
    window.print();
  };

  // Create a brand new announcement
  const handleCreateNewAnnouncement = () => {
    const newId = `announcement-${Date.now()}`;
    const newAnn: AnnouncementFlyer = {
      ...DEFAULT_ANNOUNCEMENT,
      id: newId,
      title: 'NUEVO ANUNCIO',
      eyebrow: '¡GRAN EVENTO!',
      subtitle: 'Comunidad y Familia',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const next = [...announcements, newAnn];
    setAnnouncements(next);
    saveAnnouncementsToStorage(next);
    setActiveId(newId);
    setIsEditMode(true);
  };

  // Delete announcement (keep at least 1)
  const handleDeleteAnnouncement = (id: string) => {
    if (announcements.length <= 1) {
      alert('You must keep at least one announcement flyer.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      const next = announcements.filter((a) => a.id !== id);
      setAnnouncements(next);
      saveAnnouncementsToStorage(next);
      setActiveId(next[0].id);
    }
  };

  const publicUrl = getAnnouncementPublicUrl(currentAnnouncement.id);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-900 text-slate-100 font-sans">
      {/* Top Action & Navigation Banner */}
      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-amber-400 flex items-center justify-center text-white shadow-md shadow-purple-500/25">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>Anuncios & Flyers</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wide">
                  Live Designer
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Create, customize, and share promotional event announcements with instant QR codes
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Announcement Switcher Dropdown */}
          {announcements.length > 1 && (
            <div className="relative">
              <select
                value={activeId}
                onChange={(e) => setActiveId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {announcements.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title || 'Untitled Announcement'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* New Announcement Button */}
          {!isReadOnly && (
            <button
              onClick={handleCreateNewAnnouncement}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
              title="Create another announcement flyer"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden md:inline">New Flyer</span>
            </button>
          )}

          {/* Edit / Preview Mode Toggle */}
          {!isReadOnly && (
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isEditMode
                  ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {isEditMode ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview View</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit Flyer</span>
                </>
              )}
            </button>
          )}

          {/* QR Code Quick Modal Trigger */}
          <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-900/40 transition-all cursor-pointer"
            title="Scan QR Code or copy announcement link"
          >
            <QrCode className="w-4 h-4 text-amber-300" />
            <span>QR Code</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrintFlyer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            title="Print printable announcement flyer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {/* Download Image Button */}
          <button
            onClick={handleDownloadFlyerImage}
            disabled={isDownloadingImage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            title="Download high-resolution flyer graphic (PNG)"
          >
            <Download className={`w-3.5 h-3.5 text-slate-400 ${isDownloadingImage ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">Export PNG</span>
          </button>

          {/* Back to Calendar if in guest view */}
          {onBackToCalendar && (
            <button
              onClick={onBackToCalendar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Full Calendar</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Layout: Side-by-Side Editor & Live Flyer */}
      <div className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <div className={`grid grid-cols-1 ${isEditMode ? 'lg:grid-cols-12 gap-6' : 'justify-center max-w-xl mx-auto'}`}>
          
          {/* ================= LEFT / DESKTOP EDITOR PANEL ================= */}
          {isEditMode && !isReadOnly && (
            <div className="lg:col-span-5 flex flex-col gap-4 bg-slate-950/80 border border-slate-800 rounded-3xl p-5 shadow-2xl h-fit">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span className="font-extrabold text-sm text-white tracking-wide">
                    Flyer Customizer
                  </span>
                </div>

                {/* Save Feedback */}
                <div className="flex items-center gap-2">
                  {saveSuccess && (
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 animate-pulse">
                      <CheckCircle2 className="w-3 h-3" /> Saved!
                    </span>
                  )}
                  <button
                    onClick={handleSaveAnnouncement}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/30 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSaving ? 'animate-spin' : ''}`} />
                    <span>Save</span>
                  </button>
                </div>
              </div>

              {/* 1. Quick Import From Calendar Event */}
              {events.length > 0 && (
                <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800/80">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-purple-400 mb-1.5 flex items-center gap-1.5">
                    <CalendarIcon className="w-3 h-3" />
                    <span>Auto-Fill from Calendar Event</span>
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleImportEvent(e.target.value);
                    }}
                    defaultValue=""
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="" disabled>
                      Select an event to copy details...
                    </option>
                    {events.map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.startDate} — {evt.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 2. Logo & Picture Customization */}
              <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800/80 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Logo & Picture Settings</span>
                </div>

                {/* Logo Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Header Logo</span>
                    <label className="flex items-center gap-1.5 text-[11px] font-normal cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentAnnouncement.showLogo !== false}
                        onChange={(e) => updateCurrent({ showLogo: e.target.checked })}
                        className="rounded accent-purple-500"
                      />
                      <span>Show in Circle</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center p-1 border border-slate-700 overflow-hidden shrink-0 shadow-sm">
                      {currentAnnouncement.logoUrl ? (
                        <img
                          src={currentAnnouncement.logoUrl}
                          alt="Logo preview"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-amber-500 font-bold text-xs text-center leading-tight">
                          <Sparkles className="w-5 h-5 mx-auto" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-wrap gap-1.5">
                      <input
                        type="file"
                        ref={logoFileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-purple-300 border border-purple-500/30 flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Upload Logo</span>
                      </button>

                      {currentAnnouncement.logoUrl && (
                        <button
                          type="button"
                          onClick={() => updateCurrent({ logoUrl: '' })}
                          className="px-2 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-[11px] font-bold text-rose-300 border border-rose-800/40 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Logo Caption Text
                    </label>
                    <input
                      type="text"
                      value={currentAnnouncement.logoText || ''}
                      onChange={(e) => updateCurrent({ logoText: e.target.value })}
                      placeholder="e.g. EVENT LOGO or PARISH NAME"
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Picture Section */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Featured Event Picture</span>
                    <label className="flex items-center gap-1.5 text-[11px] font-normal cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(currentAnnouncement.showPicture)}
                        onChange={(e) => updateCurrent({ showPicture: e.target.checked })}
                        className="rounded accent-purple-500"
                      />
                      <span>Show Picture on Flyer</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    {currentAnnouncement.pictureUrl ? (
                      <div className="w-16 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                        <img
                          src={currentAnnouncement.pictureUrl}
                          alt="Picture preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-12 rounded-lg bg-slate-800/60 border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-[10px] shrink-0">
                        No image
                      </div>
                    )}

                    <div className="flex-1 flex flex-wrap gap-1.5">
                      <input
                        type="file"
                        ref={pictureFileInputRef}
                        onChange={handlePictureUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => pictureFileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-sky-300 border border-sky-500/30 flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Upload Picture</span>
                      </button>

                      {currentAnnouncement.pictureUrl && (
                        <button
                          type="button"
                          onClick={() => updateCurrent({ pictureUrl: '', showPicture: false })}
                          className="px-2 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-[11px] font-bold text-rose-300 border border-rose-800/40 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Text Fields Editor */}
              <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800/80 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Headlines & Details</span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Eyebrow Tagline (Yellow)
                    </label>
                    <input
                      type="text"
                      value={currentAnnouncement.eyebrow || ''}
                      onChange={(e) => updateCurrent({ eyebrow: e.target.value })}
                      placeholder="DON'T MISS OUT!"
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-amber-300 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Event Title (Bold White)
                    </label>
                    <input
                      type="text"
                      value={currentAnnouncement.title}
                      onChange={(e) => updateCurrent({ title: e.target.value })}
                      placeholder="EVENT TITLE"
                      className="w-full px-3 py-1.5 text-sm font-black uppercase rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Event Subtitle / Category
                    </label>
                    <input
                      type="text"
                      value={currentAnnouncement.subtitle || ''}
                      onChange={(e) => updateCurrent({ subtitle: e.target.value })}
                      placeholder="Family-Friendly Event"
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Date & Time Inputs */}
                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Day of Week
                    </label>
                    <input
                      type="text"
                      value={currentAnnouncement.dateDayOfWeek}
                      onChange={(e) => updateCurrent({ dateDayOfWeek: e.target.value })}
                      placeholder="SATURDAY,"
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-400 uppercase mb-1">
                      Month & Day
                    </label>
                    <input
                      type="text"
                      value={currentAnnouncement.dateMonthDay}
                      onChange={(e) => updateCurrent({ dateMonthDay: e.target.value })}
                      placeholder="AUGUST 24th"
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-amber-300 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Time
                    </label>
                    <input
                      type="text"
                      value={currentAnnouncement.timeText}
                      onChange={(e) => updateCurrent({ timeText: e.target.value })}
                      placeholder="9:00 PM"
                      className="w-full px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Event Highlights Editor */}
              <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                    Highlights Section
                  </div>
                  <button
                    type="button"
                    onClick={handleAddHighlight}
                    className="text-[10px] font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-900/40 border border-purple-700/50"
                  >
                    <Plus className="w-3 h-3" /> Add item
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {currentAnnouncement.highlights.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-amber-400 text-amber-400 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleHighlightChange(idx, e.target.value)}
                        className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      {currentAnnouncement.highlights.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveHighlight(idx)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Contact Info Editor */}
              <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800/80 space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-400">
                  Contact & Location Footer
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <input
                      type="text"
                      value={currentAnnouncement.phone || ''}
                      onChange={(e) => updateCurrent({ phone: e.target.value })}
                      placeholder="123-456-789"
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <input
                      type="text"
                      value={currentAnnouncement.email || ''}
                      onChange={(e) => updateCurrent({ email: e.target.value })}
                      placeholder="info@email.com"
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <input
                      type="text"
                      value={currentAnnouncement.website || ''}
                      onChange={(e) => updateCurrent({ website: e.target.value })}
                      placeholder="www.websitename.com"
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <input
                      type="text"
                      value={currentAnnouncement.address || ''}
                      onChange={(e) => updateCurrent({ address: e.target.value })}
                      placeholder="Lorem ipsum St, City State, Zip Code, 12345"
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Theme & Template Options */}
              <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  <span>Color Theme</span>
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                  >
                    Reset to Picture Template
                  </button>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {ANNOUNCEMENT_THEMES.map((th) => (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => updateCurrent({ theme: th.id as any })}
                      className={`h-8 rounded-xl flex items-center justify-center transition-all ${
                        currentAnnouncement.theme === th.id
                          ? 'ring-2 ring-white scale-105 shadow-md'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: th.previewColor }}
                      title={th.name}
                    >
                      {currentAnnouncement.theme === th.id && (
                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Option to embed QR code directly on flyer */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-300">Show Scannable QR on Flyer</span>
                  <input
                    type="checkbox"
                    checked={Boolean(currentAnnouncement.showQrOnFlyer)}
                    onChange={(e) => updateCurrent({ showQrOnFlyer: e.target.checked })}
                    className="rounded accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Danger Zone: Delete this flyer */}
              {announcements.length > 1 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteAnnouncement(currentAnnouncement.id)}
                    className="w-full py-1.5 px-3 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/40 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete This Announcement</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================= RIGHT / MAIN LIVE FLYER DISPLAY ================= */}
          <div className={`${isEditMode ? 'lg:col-span-7' : 'w-full'} flex flex-col items-center justify-center`}>
            
            {/* The Announcement Flyer Container (Formatted identically to attached image) */}
            <div
              ref={flyerContainerRef}
              id="announcement-flyer-render-canvas"
              className={`relative w-full max-w-md sm:max-w-lg rounded-3xl overflow-hidden shadow-2xl transition-all border ${currentTheme.cardBorder}`}
              style={{
                background: `radial-gradient(circle at 50% 35%, #4a127a 0%, #2e0854 50%, #120324 100%)`
              }}
            >
              {/* Background Geometric Diamond Decorative Layers */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Outer Diamond Layer */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-28 w-[380px] h-[380px] sm:w-[460px] sm:h-[460px] rotate-45 rounded-3xl border border-purple-400/20 shadow-2xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(88, 28, 135, 0.25) 100%)'
                  }}
                />
                {/* Second Concentric Diamond Layer */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-36 w-[300px] h-[300px] sm:w-[370px] sm:h-[370px] rotate-45 rounded-2xl border border-fuchsia-400/25 shadow-inner"
                  style={{
                    background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(59, 7, 100, 0.4) 100%)'
                  }}
                />
                {/* Dot Matrix Pattern Quadrants */}
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
                
                {/* TOP CIRCULAR BADGE (Matches Image with Logo & "EVENT LOGO") */}
                <div className="relative -mt-2 mb-6 flex flex-col items-center">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white shadow-2xl border-4 border-white flex flex-col items-center justify-center p-2 transition-transform hover:scale-105 group relative overflow-hidden">
                    {currentAnnouncement.logoUrl ? (
                      <img
                        src={currentAnnouncement.logoUrl}
                        alt="Event Logo"
                        className="max-w-[85%] max-h-[58%] object-contain"
                      />
                    ) : (
                      /* Stylized Modern Golden Geometric Swirl Logo matching uploaded image */
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

                    {/* Logo Text Caption */}
                    {currentAnnouncement.showLogo !== false && (
                      <span className="text-[10px] sm:text-[11px] font-black tracking-wider text-slate-900 uppercase mt-0.5 max-w-[90%] truncate">
                        {currentAnnouncement.logoText || 'EVENT LOGO'}
                      </span>
                    )}

                    {/* Quick Edit hover hint */}
                    {!isReadOnly && isEditMode && (
                      <div
                        onClick={() => logoFileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer text-[10px] font-bold"
                      >
                        <Upload className="w-4 h-4 mb-0.5 text-amber-400" />
                        <span>Change</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* HERO HEADERS SECTION */}
                <div className="w-full space-y-1 sm:space-y-1.5 mb-5">
                  {/* Eyebrow in Vibrant Gold */}
                  <div className="text-xs sm:text-sm font-black tracking-widest text-amber-400 uppercase drop-shadow-sm">
                    {currentAnnouncement.eyebrow || "DON'T MISS OUT!"}
                  </div>

                  {/* Main Event Title in Condensed Extra Bold White */}
                  <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase leading-none drop-shadow-md">
                    {currentAnnouncement.title || 'EVENT TITLE'}
                  </h2>

                  {/* Event Subtitle */}
                  <div className="text-sm sm:text-base font-medium text-slate-100 tracking-wide opacity-95">
                    {currentAnnouncement.subtitle || 'Family-Friendly Event'}
                  </div>
                </div>

                {/* OPTIONAL FEATURED EVENT PICTURE */}
                {currentAnnouncement.showPicture && currentAnnouncement.pictureUrl && (
                  <div className="w-full max-w-sm mb-5 rounded-2xl overflow-hidden border-2 border-purple-400/40 shadow-xl max-h-48 group relative">
                    <img
                      src={currentAnnouncement.pictureUrl}
                      alt="Featured Event Picture"
                      className="w-full h-full object-cover object-center"
                    />
                    {!isReadOnly && isEditMode && (
                      <button
                        onClick={() => pictureFileInputRef.current?.click()}
                        className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/70 text-white text-[10px] font-bold backdrop-blur-xs flex items-center gap-1 opacity-80 hover:opacity-100"
                      >
                        <Upload className="w-3 h-3" /> Change
                      </button>
                    )}
                  </div>
                )}

                {/* DATE & TIME CARD (Matches the white rounded box with yellow calendar/clock) */}
                <div className="w-full max-w-sm bg-white rounded-2xl p-3 sm:p-4 shadow-2xl flex items-center gap-3.5 mb-6 text-left border border-purple-100">
                  {/* Yellow Calendar + Clock Icon */}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-amber-50 border-2 border-amber-400 flex items-center justify-center text-amber-500 shrink-0 shadow-xs relative">
                    <CalendarIcon className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2]" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-amber-400 flex items-center justify-center text-amber-600 shadow-2xs">
                      <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </div>

                  {/* Date & Time Text Lines */}
                  <div className="flex-1">
                    <div className="text-xs sm:text-sm font-extrabold uppercase tracking-tight leading-tight">
                      <span className="text-slate-900">{currentAnnouncement.dateDayOfWeek} </span>
                      <span className="text-amber-500">{currentAnnouncement.dateMonthDay}</span>
                    </div>
                    <div className="text-slate-900 font-black text-sm sm:text-base tracking-tight mt-0.5">
                      {currentAnnouncement.timeText}
                    </div>
                    {currentAnnouncement.locationText && (
                      <div className="text-[10px] text-slate-500 font-semibold truncate max-w-[200px] mt-0.5">
                        {currentAnnouncement.locationText}
                      </div>
                    )}
                  </div>
                </div>

                {/* HIGHLIGHTS OF THE EVENT (Gold Title + Checkmarked Items) */}
                <div className="w-full max-w-sm text-left mb-6 space-y-2">
                  <div className="text-xs sm:text-sm font-black tracking-wider text-amber-400 uppercase drop-shadow-sm flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{currentAnnouncement.highlightsTitle || 'HIGHLIGHTS OF THE EVENT:'}</span>
                  </div>

                  <div className="space-y-1.5 pl-1">
                    {currentAnnouncement.highlights.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 text-white text-xs sm:text-sm font-medium">
                        <div className="w-4 h-4 rounded-full border border-amber-400 bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span className="leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* OPTIONAL EMBEDDED QR CODE ON THE FLYER */}
                {currentAnnouncement.showQrOnFlyer && qrDataUrl && (
                  <div className="w-full max-w-sm bg-slate-950/70 border border-purple-400/40 rounded-2xl p-2.5 mb-4 flex items-center justify-between gap-3 shadow-xl backdrop-blur-xs">
                    <div className="text-left pl-2">
                      <div className="text-[11px] font-black text-amber-400 uppercase tracking-wide">
                        Scan to View
                      </div>
                      <div className="text-[10px] text-slate-200">
                        Open on mobile or share flyer
                      </div>
                    </div>
                    <div className="w-14 h-14 bg-white p-1 rounded-xl shrink-0 shadow-md">
                      <img src={qrDataUrl} alt="Announcement QR" className="w-full h-full" />
                    </div>
                  </div>
                )}

                {/* BOTTOM CONTACT BOX (Phone, Email/Web, Location in 3 amber chips) */}
                <div className="w-full max-w-md pt-3 border-t border-purple-500/30 grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                  {/* Phone */}
                  <div className="flex items-center gap-1.5 text-left truncate">
                    <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
                      <Phone className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[8px] font-bold text-amber-400 uppercase tracking-wider leading-none">
                        CALL US
                      </div>
                      <div className="text-[10px] sm:text-xs font-black text-white truncate">
                        {currentAnnouncement.phone || '123-456-789'}
                      </div>
                    </div>
                  </div>

                  {/* Email & Web */}
                  <div className="flex items-center gap-1.5 text-left truncate">
                    <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
                      <Globe className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-bold text-white truncate leading-tight">
                        {currentAnnouncement.email || 'info@email.com'}
                      </div>
                      <div className="text-[8px] font-bold text-amber-300 truncate leading-tight">
                        {currentAnnouncement.website || 'www.websitename.com'}
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-center gap-1.5 text-left truncate">
                    <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
                      <MapPin className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-medium text-slate-200 truncate leading-tight">
                        {currentAnnouncement.address || 'Event Address'}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Quick Flyer Action Bar Beneath Preview */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 max-w-lg w-full">
              <button
                onClick={() => setShowQrModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-amber-300" />
                <span>Show QR Code</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300 font-bold">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Flyer Link</span>
                  </>
                )}
              </button>

              <button
                onClick={handlePrintFlyer}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>Print Poster</span>
              </button>

              <button
                onClick={handleDownloadFlyerImage}
                disabled={isDownloadingImage}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Save PNG</span>
              </button>

              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
                title="Open public standalone link"
              >
                <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                <span>Open Link</span>
              </a>
            </div>

          </div>

        </div>
      </div>

      {/* ================= QR CODE & MOBILE SCANNER MODAL ================= */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white tracking-tight">
                    Scan Announcement QR Code
                  </h3>
                  <p className="text-xs text-slate-400">
                    Direct access to this promotional flyer on any mobile phone
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* QR Code Presentation Box */}
            <div className="flex flex-col items-center justify-center py-4 space-y-3">
              <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-purple-500/30 relative">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Announcement QR Code"
                    className="w-56 h-56 object-contain"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-500 text-xs">
                    Generating QR Code...
                  </div>
                )}
              </div>

              {/* Title & Date Label */}
              <div className="text-center">
                <div className="text-sm font-black text-white uppercase">
                  {currentAnnouncement.title}
                </div>
                <div className="text-xs text-amber-400 font-bold">
                  {currentAnnouncement.dateDayOfWeek} {currentAnnouncement.dateMonthDay} — {currentAnnouncement.timeText}
                </div>
              </div>

              {/* Canonical Public URL display */}
              <div className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-[11px] text-slate-400 truncate">
                  {publicUrl}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  if (qrDataUrl) {
                    downloadQrCode(
                      qrDataUrl,
                      `${currentAnnouncement.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_qr.png`
                    );
                  }
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span>Save QR Image</span>
              </button>

              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/40"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                <span>Test Live Link</span>
              </a>
            </div>

          </div>
        </div>
      )}

      {/* Embedded Print Styling for High-Resolution Flyer Printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #announcement-flyer-render-canvas, #announcement-flyer-render-canvas * {
            visibility: visible;
          }
          #announcement-flyer-render-canvas {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            width: 100% !important;
            max-width: 600px !important;
            box-shadow: none !important;
            margin: 0 !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

    </div>
  );
};

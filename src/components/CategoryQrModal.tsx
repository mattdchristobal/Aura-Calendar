import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  X,
  Sparkles,
  Layers,
  FileText,
  Smartphone,
  Eye,
  Tag,
  Share2,
  Calendar,
  Lock,
  Globe,
  RefreshCw,
  Sliders,
  Info,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Cloud,
  AlertTriangle
} from 'lucide-react';
import { Category, CalendarEvent, User } from '../types';
import {
  generateQrDataUrl,
  generateQrSvgString,
  downloadQrCode,
  downloadHighResCategoryQrPng,
  downloadQrSvg,
  printCategoryQrFlyer,
  getCategoryPublicUrl,
  getPublicUrlMode,
  setPublicUrlMode,
  getCustomPublicBaseUrl,
  setCustomPublicBaseUrl,
  verifyPublicUrlLive,
  isCurrentHostAiStudioPreview,
  PublicUrlMode
} from '../utils/qrUtils';
import { getAnnouncementPublicUrl } from '../utils/announcements';

interface CategoryQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  events: CalendarEvent[];
  currentUser?: User;
  initialCategoryId?: string;
  onOpenCategoryPdfView?: (categoryId: string) => void;
}

const ALL_CATEGORY: Category = {
  id: 'all',
  name: 'All Categories Overview',
  hex: '#4f46e5',
  color: 'indigo',
  bgClass: 'bg-indigo-50 dark:bg-indigo-950/40',
  borderClass: 'border-indigo-200 dark:border-indigo-800',
  textClass: 'text-indigo-700 dark:text-indigo-300',
  badgeClass: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200',
  dotClass: 'bg-indigo-500',
  description: 'Master consolidated calendar combining all categories and ministries'
};

export const CategoryQrModal: React.FC<CategoryQrModalProps> = ({
  isOpen,
  onClose,
  categories,
  events,
  currentUser,
  initialCategoryId,
  onOpenCategoryPdfView
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialCategoryId || 'all'
  );
  const [qrColorMode, setQrColorMode] = useState<'category' | 'dark'>('category');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // URL Mode & Domain Settings (Shared Public, Direct Dev, or Custom Domain)
  const [urlMode, setUrlMode] = useState<PublicUrlMode>(() => getPublicUrlMode());
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() => getCustomPublicBaseUrl());
  const [showDomainSettings, setShowDomainSettings] = useState(false);
  const [qrDestination, setQrDestination] = useState<'pdf' | 'anuncio'>('pdf');
  const [urlCheckStatus, setUrlCheckStatus] = useState<{
    checked: boolean;
    checking: boolean;
    reachable: boolean;
    isAiStudioPreview?: boolean;
    status?: number;
    error?: string;
    message?: string;
  }>({ checked: false, checking: false, reachable: false });

  // On mount, query server public-info to discover any server-configured origin
  useEffect(() => {
    fetch('/api/public-info')
      .then((res) => res.json())
      .then((data) => {
        if (data.customOrigin && !customBaseUrl) {
          setCustomBaseUrl(data.customOrigin);
          setCustomPublicBaseUrl(data.customOrigin);
        }
      })
      .catch(() => {});
  }, []);

  const handleUrlModeChange = (newMode: PublicUrlMode) => {
    setUrlMode(newMode);
    setPublicUrlMode(newMode);
  };

  const handleCustomBaseUrlChange = (val: string) => {
    const clean = val.trim();
    setCustomBaseUrl(clean);
    setCustomPublicBaseUrl(clean);
    try {
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicBaseUrl: clean })
      }).catch(() => {});
    } catch (e) {}
  };

  // Track previous initialCategoryId and isOpen to only synchronize when the modal opens or parent explicitly sets initialCategoryId
  const prevInitialIdRef = useRef(initialCategoryId);
  const prevIsOpenRef = useRef(isOpen);

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const initialChanged = initialCategoryId !== prevInitialIdRef.current;

    prevIsOpenRef.current = isOpen;
    prevInitialIdRef.current = initialCategoryId;

    if (justOpened || initialChanged) {
      if (initialCategoryId) {
        if (initialCategoryId.toLowerCase() === 'all' || initialCategoryId.toLowerCase() === 'overview') {
          setSelectedCategoryId('all');
        } else if (categories.some((c) => c.id === initialCategoryId)) {
          setSelectedCategoryId(initialCategoryId);
        } else {
          setSelectedCategoryId('all');
        }
      } else {
        setSelectedCategoryId('all');
      }
    } else {
      // On background updates, preserve user's manual category selection if it still exists in the categories list
      setSelectedCategoryId((current) => {
        if (current === 'all' || current === 'overview') return 'all';
        if (categories.some((c) => c.id === current)) return current;
        return 'all';
      });
    }
  }, [isOpen, initialCategoryId, categories]);

  const activeCategory = useMemo(() => {
    if (selectedCategoryId === 'all' || selectedCategoryId === 'overview') {
      return ALL_CATEGORY;
    }
    return categories.find((c) => c.id === selectedCategoryId) || ALL_CATEGORY;
  }, [categories, selectedCategoryId]);

  const categoryEventsCount = useMemo(() => {
    if (!activeCategory) return 0;
    if (activeCategory.id === 'all') return events.length;
    let count = events.filter((e) => e.categoryId === activeCategory.id).length;
    if (count === 0 && events.length > 0 && (categories.length <= 1 || activeCategory.id === 'new')) {
      count = events.length;
    }
    return count;
  }, [events, activeCategory, categories]);

  const publicUrl = useMemo(() => {
    if (qrDestination === 'anuncio') {
      return getAnnouncementPublicUrl(undefined, urlMode === 'custom' ? customBaseUrl : undefined);
    }
    if (!activeCategory) return '';
    return getCategoryPublicUrl(activeCategory.id, 'pdf', urlMode === 'custom' ? customBaseUrl : undefined);
  }, [qrDestination, activeCategory, urlMode, customBaseUrl]);

  // Verify public URL reachability
  const verifyCurrentUrl = async (urlToCheck: string) => {
    if (!urlToCheck) return;
    setUrlCheckStatus((prev) => ({ ...prev, checking: true }));
    try {
      const res = await verifyPublicUrlLive(urlToCheck);
      setUrlCheckStatus({
        checked: true,
        checking: false,
        reachable: res.reachable,
        isAiStudioPreview: res.isAiStudioPreview,
        message: res.message,
        status: res.status,
        error: res.error
      });
    } catch (err: any) {
      setUrlCheckStatus({
        checked: true,
        checking: false,
        reachable: false,
        error: err.message
      });
    }
  };

  useEffect(() => {
    if (isOpen && publicUrl) {
      verifyCurrentUrl(publicUrl);
    }
  }, [isOpen, publicUrl]);

  // Generate QR Code data URL whenever category or color changes
  useEffect(() => {
    if (!activeCategory || !publicUrl) return;

    const darkColor = qrColorMode === 'category' ? activeCategory.hex || '#0f172a' : '#0f172a';

    generateQrDataUrl(publicUrl, {
      width: 512,
      margin: 3,
      darkColor,
      lightColor: '#ffffff',
      errorCorrectionLevel: 'M'
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Error generating QR code in modal:', err));
  }, [activeCategory, publicUrl, qrColorMode]);

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDownloadPng = async (highRes: boolean = false) => {
    if (!activeCategory || !publicUrl) return;
    if (highRes) {
      const darkColor = qrColorMode === 'category' ? activeCategory.hex || '#0f172a' : '#0f172a';
      await downloadHighResCategoryQrPng(activeCategory, publicUrl, { width: 1024, darkColor });
    } else {
      if (!qrDataUrl) return;
      downloadQrCode(qrDataUrl, `${activeCategory.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_qr_code.png`);
    }
  };

  const handleDownloadSvg = async () => {
    if (!activeCategory || !publicUrl) return;
    try {
      const darkColor = qrColorMode === 'category' ? activeCategory.hex || '#0f172a' : '#0f172a';
      const svg = await generateQrSvgString(publicUrl, { darkColor, margin: 3 });
      downloadQrSvg(svg, `${activeCategory.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_qr_code.svg`);
    } catch (e) {
      console.error('Failed to export SVG:', e);
    }
  };

  const handlePrintFlyer = () => {
    if (!activeCategory || !qrDataUrl || !publicUrl) return;
    printCategoryQrFlyer({
      category: activeCategory,
      eventsCount: categoryEventsCount,
      qrDataUrl,
      publicUrl
    });
  };

  const handlePreviewPdf = () => {
    if (activeCategory && onOpenCategoryPdfView) {
      onClose();
      onOpenCategoryPdfView(activeCategory.id);
    } else if (publicUrl) {
      window.open(publicUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Category QR Codes & Public PDF Hub
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Anyone can scan to open live schedule and event details in any browser without an account.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-6 pt-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('single')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'single'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Category QR Generator</span>
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'batch'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Categories Overview ({categories.length})</span>
          </button>
        </div>

        {/* Member Read-Only Notice */}
        {!isAdmin && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
            <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <span>
              <strong>Member Read-Only Access:</strong> You can view, share, download, and print Category QR codes &amp; public PDF schedules. Editing category tags, QR color styles, and system presets is reserved for administrators.
            </span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Target Destination Selector: Schedule PDF vs Announcement Flyer */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setQrDestination('pdf')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                qrDestination === 'pdf'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm border border-slate-200/60 dark:border-slate-600'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>Calendario PDF (Schedule)</span>
            </button>
            <button
              type="button"
              onClick={() => setQrDestination('anuncio')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                qrDestination === 'anuncio'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm border border-slate-200/60 dark:border-slate-600'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>Flyer de Anuncios (Flyer)</span>
            </button>
          </div>

          {activeTab === 'single' && activeCategory && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left Column: QR Code Visual Card */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                
                {/* Category Pill */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: qrDestination === 'anuncio' ? '#9333ea' : activeCategory.hex }}
                  />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {qrDestination === 'anuncio' ? 'Flyer de Anuncios' : activeCategory.name}
                  </span>
                </div>

                {/* QR Code Container */}
                <div
                  onClick={handleDownloadPng}
                  className="p-3.5 bg-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm relative group cursor-pointer"
                  title="Click to save this QR Code as PNG to your computer"
                >
                  {qrDataUrl ? (
                    <>
                      <img
                        src={qrDataUrl}
                        alt={`QR Code for ${activeCategory.name}`}
                        className="w-44 h-44 sm:w-48 sm:h-48 rounded-lg object-contain"
                      />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl text-white text-xs font-bold gap-1.5">
                        <Download className="w-4 h-4" />
                        <span>Save PNG to Computer</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                      Generating QR...
                    </div>
                  )}
                </div>

                {/* Scan Instructions Pill */}
                <div className="mt-3 flex flex-col items-center gap-1 text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Works with any camera (iPhone & Android)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Opens directly in web browser — no app installation or login required
                  </span>
                </div>

                {/* Event Count Indicator */}
                <span className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {categoryEventsCount} Active Event{categoryEventsCount === 1 ? '' : 's'}
                </span>
              </div>

              {/* Right Column: Customization & Actions */}
              <div className="md:col-span-7 space-y-4">
                
                {/* Category Selector Dropdown */}
                <div>
                  <label htmlFor="category-qr-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Calendar Category:
                  </label>
                  <select
                    id="category-qr-select"
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden transition-all duration-150 cursor-pointer"
                  >
                    <option value="all">
                      🌟 All Categories Overview (Master Schedule - {events.length} events)
                    </option>
                    <optgroup label="Individual Categories">
                      {categories.map((cat) => {
                        const count = events.filter((e) => e.categoryId === cat.id).length;
                        return (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({count} event{count === 1 ? '' : 's'})
                          </option>
                        );
                      })}
                    </optgroup>
                  </select>
                </div>

                {/* QR Styling Color Picker */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      QR Code Color Theme:
                    </label>
                    {!isAdmin && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Admin Only</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={!isAdmin}
                      onClick={() => isAdmin && setQrColorMode('category')}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        !isAdmin ? 'cursor-not-allowed opacity-85' : 'cursor-pointer'
                      } ${
                        qrColorMode === 'category'
                          ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: activeCategory.hex }} />
                      <span>Category Color ({activeCategory.name})</span>
                    </button>

                    <button
                      disabled={!isAdmin}
                      onClick={() => isAdmin && setQrColorMode('dark')}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        !isAdmin ? 'cursor-not-allowed opacity-85' : 'cursor-pointer'
                      } ${
                        qrColorMode === 'dark'
                          ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-slate-900 dark:bg-white" />
                      <span>Classic High Contrast</span>
                    </button>
                  </div>
                </div>

                {/* 24/7 Public Cloud Scanning Status & Domain Configuration */}
                <div className="rounded-2xl border p-4 space-y-3 bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/70">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        24/7 Public Cloud Scanning
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {urlCheckStatus.checking ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          Testing link...
                        </span>
                      ) : urlCheckStatus.reachable && !urlCheckStatus.isAiStudioPreview ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          24/7 Cloud Active (No Login)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Preview Mode (Requires Google Login)
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => verifyCurrentUrl(publicUrl)}
                        title="Re-verify reachability from external mobile devices"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${urlCheckStatus.checking ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* If in AI Studio preview sandbox, show helpful instructions and prompt for 24/7 Cloud Run URL */}
                  {(!customBaseUrl || urlCheckStatus.isAiStudioPreview) && (
                    <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-100 bg-amber-50/90 dark:bg-amber-950/60 p-3.5 rounded-2xl border-2 border-amber-300 dark:border-amber-700/80 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-extrabold text-xs text-amber-950 dark:text-amber-200">
                            Why this QR code currently requires a login:
                          </p>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                            You are currently previewing inside Google AI Studio. AI Studio's preview URLs (<span className="font-mono text-[10px] font-bold bg-amber-200/60 dark:bg-amber-900/60 px-1 py-0.5 rounded">ais-dev- / ais-pre-</span>) require Google developer login and stop working when your computer or tab is closed.
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800/80 space-y-2">
                        <div className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>🚀</span>
                          <span>To make this QR code scan 24/7 for ANY phone with NO login:</span>
                        </div>
                        <ol className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 list-decimal list-inside pl-0.5">
                          <li>In Google AI Studio, click the <strong>Deploy</strong> button (or Settings &rarr; Deploy to Cloud Run).</li>
                          <li>Copy your deployed <strong>Cloud Run URL</strong> and paste it below:</li>
                        </ol>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                          <input
                            type="url"
                            placeholder="https://my-calendar-app-488950738317.us-east1.run.app"
                            value={customBaseUrl}
                            onChange={(e) => handleCustomBaseUrlChange(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (customBaseUrl.trim()) {
                                handleUrlModeChange('custom');
                                handleCustomBaseUrlChange(customBaseUrl.trim());
                                verifyCurrentUrl(getCategoryPublicUrl(activeCategory.id, 'pdf', customBaseUrl.trim()));
                              }
                            }}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save & Activate 24/7 Link</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Once set, ALL QR codes, printable posters, and flyers will automatically route phone cameras to your 24/7 cloud service.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* If custom 24/7 URL is configured and active */}
                  {customBaseUrl && !urlCheckStatus.isAiStudioPreview && (
                    <div className="text-xs text-emerald-900 dark:text-emerald-100 bg-emerald-50 dark:bg-emerald-950/60 p-3 rounded-xl border border-emerald-300 dark:border-emerald-700/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                            <strong>24/7 Public Cloud Active!</strong> Anyone scanning this QR code with any smartphone camera will instantly view the schedule. No login, no app, and no computer needed.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowDomainSettings(!showDomainSettings)}
                          className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:underline shrink-0 ml-2"
                        >
                          {showDomainSettings ? 'Hide' : 'Edit URL'}
                        </button>
                      </div>

                      {showDomainSettings && (
                        <div className="pt-2 flex items-center gap-2 border-t border-emerald-200 dark:border-emerald-800">
                          <input
                            type="url"
                            value={customBaseUrl}
                            onChange={(e) => handleCustomBaseUrlChange(e.target.value)}
                            placeholder="https://my-app.run.app"
                            className="flex-1 px-3 py-1 bg-white dark:bg-slate-900 border border-emerald-300 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => verifyCurrentUrl(publicUrl)}
                            className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                          >
                            Update
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Direct Test in New Tab Link */}
                  <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[11px] text-slate-500">
                      Destination: <strong className="text-slate-700 dark:text-slate-300">{activeCategory.name} Schedule PDF View</strong>
                    </span>

                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Test in New Tab</span>
                    </a>
                  </div>
                </div>

                {/* Direct Share URL Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Public Web Browser URL:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={publicUrl}
                      className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 select-all"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                        copiedLink
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="pt-2 space-y-2">
                  
                  {/* Print Flyer / Poster Button */}
                  <button
                    onClick={handlePrintFlyer}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99]"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Printable QR Flyer / Poster (8.5×11 / A4)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Preview PDF Document View */}
                    <button
                      onClick={handlePreviewPdf}
                      className="py-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/70 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-purple-200 dark:border-purple-800 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Preview PDF Schedule</span>
                    </button>

                    {/* Download PNG */}
                    <button
                      onClick={() => handleDownloadPng(true)}
                      className="py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-indigo-200 dark:border-indigo-800 transition-colors"
                      title="Save high-resolution QR code PNG image to your computer"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Save QR (PNG)</span>
                    </button>
                  </div>

                  {/* Download Vector SVG */}
                  <button
                    onClick={handleDownloadSvg}
                    className="w-full py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <span>Download Vector Format (.svg) for Graphic Designers</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Batch Overview of all Categories */}
          {activeTab === 'batch' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    All Available Category QR Codes
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quickly view, open PDF schedules, or copy links for every category in the system.
                  </p>
                </div>
              </div>

              {/* Master All Categories Overview Card */}
              <div className="p-4 bg-gradient-to-r from-indigo-50 via-indigo-50/50 to-white dark:from-indigo-950/60 dark:via-indigo-950/30 dark:to-slate-900 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        All Categories Master Overview
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                        Master QR
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Consolidated public schedule linking to all {events.length} events across {categories.length} ministries.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setSelectedCategoryId('all');
                      setActiveTab('single');
                    }}
                    className="flex-1 sm:flex-none py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Generate Master QR</span>
                  </button>
                  <button
                    onClick={() => {
                      if (onOpenCategoryPdfView) {
                        onClose();
                        onOpenCategoryPdfView('all');
                      } else {
                        window.open(getCategoryPublicUrl('all', 'pdf'), '_blank');
                      }
                    }}
                    className="py-2 px-3 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="Open All Categories PDF Document"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>View PDF</span>
                  </button>
                  <button
                    onClick={async () => {
                      await downloadHighResCategoryQrPng(ALL_CATEGORY, getCategoryPublicUrl('all', 'pdf'), {
                        width: 1024,
                        darkColor: '#4f46e5'
                      });
                    }}
                    className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-colors"
                    title="Save Master QR Code (PNG) to computer"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {categories.map((cat) => {
                  const count = events.filter((e) => e.categoryId === cat.id).length;
                  const catUrl = getCategoryPublicUrl(cat.id, 'pdf');

                  return (
                    <div
                      key={cat.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.hex }} />
                          <div>
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                              {cat.name}
                            </h4>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {count} active event{count === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                          style={{ backgroundColor: `${cat.hex}15`, color: cat.hex }}
                        >
                          {cat.hex}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <button
                          onClick={() => {
                            setSelectedCategoryId(cat.id);
                            setActiveTab('single');
                          }}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>View QR</span>
                        </button>

                        <button
                          onClick={() => {
                            if (onOpenCategoryPdfView) {
                              onClose();
                              onOpenCategoryPdfView(cat.id);
                            } else {
                              window.open(catUrl, '_blank');
                            }
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-300 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                          title="Open PDF Document"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>

                        <button
                          onClick={async () => {
                            await downloadHighResCategoryQrPng(cat, catUrl, { width: 1024, darkColor: cat.hex || '#0f172a' });
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400"
                          title="Save QR Code (PNG) to computer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(catUrl);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                          title="Copy Link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Notice */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <p>
              <strong>Public Access:</strong> QR codes and web links generated here are accessible from any iPhone, Android, or desktop browser. Scanners see the live updated schedule with full event details and can print/download PDF copies anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

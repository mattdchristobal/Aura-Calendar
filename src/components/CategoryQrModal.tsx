import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  X,
  FileText,
  Smartphone,
  Tag,
  Layers,
  Globe,
  Sparkles,
  ChevronDown,
  Cloud,
  HardDrive,
  RefreshCw,
  Link2,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { Category, CalendarEvent, User, UserSettings } from '../types';
import {
  generateQrDataUrl,
  downloadHighResCategoryQrPng,
  printCategoryQrFlyer,
  getCategoryPublicUrl,
  getCustomPublicBaseUrl,
  setCustomPublicBaseUrl,
  getIndependentPdfUrl,
  setIndependentPdfUrl,
  CANONICAL_PUBLIC_APP_URL
} from '../utils/qrUtils';
import {
  generateStandaloneScheduleHtml,
  downloadStandaloneScheduleHtml,
  printMultiMonthSchedule
} from '../utils/standaloneScheduleGenerator';
import { getAnnouncementPublicUrl } from '../utils/announcements';
import { apiBulkSaveEvents } from '../utils/api';

interface CategoryQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  events: CalendarEvent[];
  settings?: UserSettings;
  currentUser?: User;
  initialCategoryId?: string;
  onOpenCategoryPdfView?: (categoryId: string) => void;
}

const ALL_CATEGORY: Category = {
  id: 'all',
  name: 'SACRAMENTOS',
  hex: '#4f46e5',
  color: 'indigo',
  bgClass: 'bg-indigo-50 dark:bg-indigo-950/40',
  borderClass: 'border-indigo-200 dark:border-indigo-800',
  textClass: 'text-indigo-700 dark:text-indigo-300',
  badgeClass: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200',
  dotClass: 'bg-indigo-500',
  description: 'Master consolidated calendar combining all sacrament categories and parish announcements'
};

const ANUNCIOS_CATEGORY: Category = {
  id: 'anuncios',
  name: 'ANUNCIOS PARROQUIALES (PDF)',
  hex: '#f59e0b',
  color: 'amber',
  bgClass: 'bg-amber-50 dark:bg-amber-950/40',
  borderClass: 'border-amber-200 dark:border-amber-800',
  textClass: 'text-amber-700 dark:text-amber-300',
  badgeClass: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200',
  dotClass: 'bg-amber-500',
  description: 'Boletín y Anuncios Parroquiales en PDF sincronizados con el calendario de Sacramentos'
};

export const CategoryQrModal: React.FC<CategoryQrModalProps> = ({
  isOpen,
  onClose,
  categories,
  events,
  settings,
  initialCategoryId,
  onOpenCategoryPdfView
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialCategoryId || 'all'
  );
  const [qrDestination, setQrDestination] = useState<'pdf' | 'anuncio'>('pdf');
  const [qrColorMode, setQrColorMode] = useState<'dark' | 'category'>('dark');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() => getCustomPublicBaseUrl());
  const [showCustomDomain, setShowCustomDomain] = useState(false);

  // Destination mode: 'public' (canonical 24/7 web schedule, no app/login needed) or 'custom' (Google Drive/Dropbox/external link)
  const [urlMode, setUrlMode] = useState<'public' | 'custom'>('public');
  const [drivePdfUrl, setDrivePdfUrl] = useState<string>('');

  // Sync initialCategoryId on modal open or prop change
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
        } else if (initialCategoryId.toLowerCase() === 'anuncios' || initialCategoryId.toLowerCase() === 'anuncio') {
          setSelectedCategoryId('anuncios');
        } else if (categories.some((c) => c.id === initialCategoryId)) {
          setSelectedCategoryId(initialCategoryId);
        } else {
          setSelectedCategoryId('all');
        }
      } else {
        setSelectedCategoryId('all');
      }
    }
  }, [isOpen, initialCategoryId, categories]);

  // Load any existing saved custom link for category (if user entered one)
  useEffect(() => {
    const saved = getIndependentPdfUrl(selectedCategoryId);
    if (saved && !saved.includes('dpaste') && !saved.includes('/pdf/')) {
      setDrivePdfUrl(saved);
      setUrlMode('custom');
    }
  }, [selectedCategoryId]);

  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');

  const syncToCloud = async () => {
    if (events.length === 0) return;
    setCloudSyncStatus('syncing');
    try {
      await apiBulkSaveEvents(events);
      setCloudSyncStatus('synced');
      setTimeout(() => setCloudSyncStatus('idle'), 3500);
    } catch (e) {
      setCloudSyncStatus('idle');
    }
  };

  // Ensure server DB has latest events when QR modal opens
  useEffect(() => {
    if (isOpen && events.length > 0) {
      syncToCloud();
    }
  }, [isOpen]);

  const activeCategory = useMemo(() => {
    if (selectedCategoryId === 'all' || selectedCategoryId === 'overview') {
      return ALL_CATEGORY;
    }
    if (selectedCategoryId === 'anuncios' || selectedCategoryId === 'anuncio') {
      return ANUNCIOS_CATEGORY;
    }
    return categories.find((c) => c.id === selectedCategoryId) || ALL_CATEGORY;
  }, [categories, selectedCategoryId]);

  const relevantEvents = useMemo(() => {
    if (!activeCategory) return events;
    if (activeCategory.id === 'all' || activeCategory.id === 'overview' || activeCategory.id === 'anuncios') {
      return events;
    }
    const filtered = events.filter((e) => {
      if (!e) return false;
      if (e.categoryId === activeCategory.id) return true;
      if (activeCategory.name && e.categoryId && e.categoryId.toLowerCase() === activeCategory.name.toLowerCase()) return true;
      return false;
    });
    return filtered.length > 0 ? filtered : events;
  }, [events, activeCategory]);

  // Determine canonical 24/7 public web schedule URL
  const canonicalPublicUrl = useMemo(() => {
    if (selectedCategoryId === 'anuncios' || selectedCategoryId === 'anuncio' || qrDestination === 'anuncio') {
      const origin = (customBaseUrl || '').trim() || CANONICAL_PUBLIC_APP_URL;
      return `${origin}/pdf/all?view=anuncios`;
    }
    if (!activeCategory) return '';
    return getCategoryPublicUrl(activeCategory.id, 'pdf', customBaseUrl || undefined, undefined, relevantEvents);
  }, [qrDestination, selectedCategoryId, activeCategory, customBaseUrl, relevantEvents]);

  // The effective URL encoded in the QR code (defaults to 24/7 public web URL, or custom link if entered)
  const effectiveQrUrl = useMemo(() => {
    if (urlMode === 'custom' && drivePdfUrl.trim()) {
      return drivePdfUrl.trim();
    }
    return canonicalPublicUrl;
  }, [urlMode, drivePdfUrl, canonicalPublicUrl]);

  // Generate crisp, large-module QR Code for instant phone camera detection
  useEffect(() => {
    if (!activeCategory || !effectiveQrUrl) return;

    const darkColor = qrColorMode === 'category' ? (activeCategory.hex || '#000000') : '#000000';

    generateQrDataUrl(effectiveQrUrl, {
      width: 600,
      margin: 4, // 4-module quiet zone for fast camera edge detection
      darkColor,
      lightColor: '#ffffff',
      errorCorrectionLevel: 'M' // Optimal module size for instant scanning
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Error generating QR code:', err));
  }, [activeCategory, effectiveQrUrl, qrColorMode]);

  const handleCopyLink = () => {
    if (!effectiveQrUrl) return;
    navigator.clipboard.writeText(effectiveQrUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadPng = async () => {
    if (!activeCategory || !effectiveQrUrl) return;
    const darkColor = qrColorMode === 'category' ? (activeCategory.hex || '#000000') : '#000000';
    await downloadHighResCategoryQrPng(activeCategory, effectiveQrUrl, { width: 1024, darkColor });
  };

  const handlePrintFlyer = () => {
    if (!activeCategory || !qrDataUrl) return;
    printCategoryQrFlyer({
      category: activeCategory,
      eventsCount: relevantEvents.length,
      qrDataUrl,
      publicUrl: effectiveQrUrl
    });
  };

  const handlePreviewPdf = () => {
    if (effectiveQrUrl.startsWith('http')) {
      window.open(effectiveQrUrl, '_blank');
    } else if (onOpenCategoryPdfView && activeCategory) {
      onClose();
      onOpenCategoryPdfView(activeCategory.id);
    } else {
      window.open(effectiveQrUrl, '_blank');
    }
  };

  // Direct multi-month printable PDF generator
  const handlePrintMultiMonthPdf = () => {
    printMultiMonthSchedule({
      category: activeCategory,
      allCategories: categories,
      events: relevantEvents,
      settings,
      title: 'Sacramentos'
    });
  };

  // Download standalone .html schedule file for 100% offline usage
  const handleDownloadOfflineHtml = () => {
    downloadStandaloneScheduleHtml({
      category: activeCategory,
      allCategories: categories,
      events: relevantEvents,
      settings,
      title: 'Sacramentos'
    });
  };

  const handleCustomBaseUrlSave = (val: string) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Public Schedule QR Code &amp; PDF
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scan with any smartphone camera to open the complete schedule 24/7 — no app login required.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher: Single vs All */}
        <div className="px-6 pt-2 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'single'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Single QR Code</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'batch'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Categories ({categories.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === 'single' ? (
            <>
              {/* Category Selector */}
              <div>
                <label htmlFor="qr-category-picker" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Calendar Category:
                </label>
                <select
                  id="qr-category-picker"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-800/80 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 shadow-sm hover:shadow focus:ring-3 focus:ring-indigo-500/25 focus:border-indigo-600 focus:outline-hidden transition-all cursor-pointer"
                >
                  <optgroup label="🌟 Calendario Maestro & Anuncios">
                    <option value="all">
                      🌟 SACRAMENTOS (Todo: Eventos + Anuncios)
                    </option>
                    <option value="anuncios">
                      📄 ANUNCIOS (Boletín Parroquial / PDF)
                    </option>
                  </optgroup>
                  <optgroup label="Categorías Individuales">
                    {categories.map((cat) => {
                      const count = events.filter((e) => e.categoryId === cat.id).length;
                      const isPublic = cat.includeInPublicPdf !== false;
                      return (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({count} event{count === 1 ? '' : 's'}){!isPublic ? ' 🔒 [Oculto en PDF]' : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                </select>

                {activeCategory && activeCategory.includeInPublicPdf === false && (
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Categoría Privada:</strong> Esta categoría está configurada como excluida del PDF público general y del código QR maestro. Puedes cambiar esta opción en <em>Configuración &gt; Categorías</em>.
                    </span>
                  </div>
                )}

                {selectedCategoryId === 'all' && (
                  <div className="mt-2.5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Todo en Uno:</strong> Al escanear este código QR con la cámara del celular, se abre automáticamente el Calendario de Sacramentos y el archivo PDF de Anuncios en una sola pantalla unificada con selector interactivo.
                    </span>
                  </div>
                )}

                {selectedCategoryId === 'anuncios' && (
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Anuncios Parroquiales & Sacramentos:</strong> Este código QR dirige directamente a los Anuncios y boletín PDF, permitiendo además a los fieles consultar las fechas y horarios de Sacramentos en la misma vista.
                    </span>
                  </div>
                )}
              </div>

              {/* QR Code & Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
                {/* Left Column: QR Code Hero Box */}
                <div className="sm:col-span-5 flex flex-col items-center justify-center p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                  <div
                    onClick={handleDownloadPng}
                    className="p-3 bg-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm relative group cursor-pointer flex items-center justify-center transition-transform hover:scale-[1.02]"
                    title="Click to download QR Code (PNG)"
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
                          <span>Save PNG</span>
                        </div>
                      </>
                    ) : (
                      <div className="w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center text-slate-400 text-xs">
                        Generating QR Code...
                      </div>
                    )}
                  </div>

                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Point phone camera to scan</span>
                  </div>

                  {/* Color mode toggle */}
                  <div className="mt-2.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQrColorMode('dark')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        qrColorMode === 'dark'
                          ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Black QR
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setQrColorMode('category')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        qrColorMode === 'category'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Category Color
                    </button>
                  </div>
                </div>

                {/* Right Column: 24/7 Hosting Mode & Quick Actions */}
                <div className="sm:col-span-7 space-y-3.5">
                  {/* Category Summary Pill */}
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: activeCategory.hex }}
                    />
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {activeCategory.name}
                    </span>
                    <span className="ml-auto text-[11px] text-slate-500 font-semibold shrink-0">
                      {activeCategory.id === 'anuncios' ? 'Boletín / PDF' : `${relevantEvents.length} event${relevantEvents.length === 1 ? '' : 's'}`}
                    </span>
                  </div>

                  {/* Cloud Persistence 24/7 Status Banner */}
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-emerald-800 dark:text-emerald-200 block text-[11px] truncate">
                          Events Saved in Google Cloud
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block truncate">
                          {relevantEvents.length} event{relevantEvents.length === 1 ? '' : 's'} live • Visible even if computer is off
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={syncToCloud}
                      disabled={cloudSyncStatus === 'syncing'}
                      className="px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${cloudSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                      <span>{cloudSyncStatus === 'syncing' ? 'Saving...' : cloudSyncStatus === 'synced' ? 'Synced ✓' : 'Sync Now'}</span>
                    </button>
                  </div>

                  {/* 24/7 Host / URL Mode Selector */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-indigo-500" />
                        <span>QR Code Web Destination</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Public 24/7 • No Login Required</span>
                      </span>
                    </div>

                    {/* Mode Radio Options */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setUrlMode('public')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          urlMode === 'public'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Public Web Schedule</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUrlMode('custom')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          urlMode === 'custom'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>External / Drive Link</span>
                      </button>
                    </div>

                    {/* Sub-UI based on urlMode */}
                    {urlMode === 'public' && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Anyone scanning this QR code opens the live multi-month schedule in any phone or desktop browser. No app or login needed.
                      </p>
                    )}

                    {urlMode === 'custom' && (
                      <div className="space-y-1.5 pt-1">
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          Paste your Google Drive, Dropbox, or custom PDF Link:
                        </label>
                        <input
                          type="url"
                          placeholder="https://drive.google.com/file/d/.../view"
                          value={drivePdfUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDrivePdfUrl(val);
                            setIndependentPdfUrl(activeCategory.id, val);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                        <p className="text-[10px] text-slate-500">
                          If you have an uploaded PDF in Google Drive or Dropbox, paste its share link here. The QR code will update immediately.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Effective Target URL Box */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Active QR Code Link:
                    </label>
                    <div className="flex items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300">
                      <span className="truncate flex-1 select-all">{effectiveQrUrl}</span>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 shrink-0 cursor-pointer transition-colors"
                        title="Copy exact link"
                      >
                        {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <a
                        href={effectiveQrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0 cursor-pointer transition-colors"
                        title="Open in new tab to test"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Primary PDF & Print Actions */}
                  <div className="space-y-2 pt-1">
                    {/* Multi-Month PDF Export */}
                    <button
                      type="button"
                      onClick={handlePrintMultiMonthPdf}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print / Save Complete Multi-Month PDF</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadOfflineHtml}
                        className="py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                        title="Save offline HTML schedule"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Offline Schedule (.html)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handlePrintFlyer}
                        className="py-2.5 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Print Flyer Poster</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handlePreviewPdf}
                        className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Preview Schedule</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadPng}
                        className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Save PNG QR</span>
                      </button>
                    </div>
                  </div>

                  {/* Optional Custom Domain Collapsible */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowCustomDomain((prev) => !prev)}
                      className="text-[11px] font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Globe className="w-3 h-3" />
                      <span>Configure custom church domain (optional)</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${showCustomDomain ? 'rotate-180' : ''}`} />
                    </button>

                    {showCustomDomain && (
                      <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          Custom Public Base URL:
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="url"
                            placeholder="https://calendar.mychurch.org"
                            value={customBaseUrl}
                            onChange={(e) => handleCustomBaseUrlSave(e.target.value)}
                            className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                          />
                          {customBaseUrl && (
                            <button
                              type="button"
                              onClick={() => handleCustomBaseUrlSave('')}
                              className="px-2 py-1 text-xs text-slate-500 hover:text-red-500 rounded-lg"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Batch Overview Tab */
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Print flyers or download QR codes for all categories at once:
              </p>

              {/* Master All Categories Card */}
              <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                      All Categories Master Schedule
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Consolidated calendar with all {events.length} events
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId('all');
                      setActiveTab('single');
                    }}
                    className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Open QR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenCategoryPdfView) {
                        onClose();
                        onOpenCategoryPdfView('all');
                      } else {
                        window.open(getCategoryPublicUrl('all'), '_blank');
                      }
                    }}
                    className="py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    View PDF
                  </button>
                </div>
              </div>

              {/* Category Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {categories.map((cat) => {
                  const count = events.filter((e) => e.categoryId === cat.id).length;
                  const catUrl = getCategoryPublicUrl(cat.id, 'pdf', customBaseUrl || undefined);

                  return (
                    <div
                      key={cat.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.hex }} />
                        <div className="truncate">
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {cat.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {count} event{count === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategoryId(cat.id);
                            setActiveTab('single');
                          }}
                          className="py-1 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold transition-colors cursor-pointer"
                        >
                          QR
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenCategoryPdfView) {
                              onClose();
                              onOpenCategoryPdfView(cat.id);
                            } else {
                              window.open(catUrl, '_blank');
                            }
                          }}
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                          title="Open Schedule"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Notice */}
          <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 flex items-center gap-2 text-xs text-indigo-900 dark:text-indigo-200">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              <strong>Always Accessible:</strong> Anyone scanning your QR code gets the live, interactive multi-month schedule directly in any web browser — 24/7 without needing an app or login.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

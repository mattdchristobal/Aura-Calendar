import React, { useState } from 'react';
import {
  Share2,
  X,
  Copy,
  Check,
  Link,
  Users,
  Shield,
  Calendar,
  Sparkles,
  RefreshCw,
  Trash2,
  ExternalLink,
  Eye,
  Lock,
  Globe,
  Tag,
  Clock,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SharedCalendar, Category, CalendarEvent, UserSettings, User } from '../types';

interface ShareCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  shares: SharedCalendar[];
  categories: Category[];
  settings: UserSettings;
  currentUser: User | null;
  events: CalendarEvent[];
  onCreateShare: (shareData: Partial<SharedCalendar>) => Promise<SharedCalendar | null> | (SharedCalendar | null);
  onUpdateShare: (id: string, updates: Partial<SharedCalendar>) => Promise<void> | void;
  onDeleteShare: (id: string) => Promise<void> | void;
  onAccessShareCode: (code: string) => Promise<{ success: boolean; error?: string }>;
}

export const ShareCalendarModal: React.FC<ShareCalendarModalProps> = ({
  isOpen,
  onClose,
  shares,
  categories,
  settings,
  currentUser,
  events,
  onCreateShare,
  onUpdateShare,
  onDeleteShare,
  onAccessShareCode
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'enter'>(shares.length > 0 ? 'manage' : 'create');

  // New Share Form State
  const [title, setTitle] = useState('');
  const [code, setCode] = useState(() => generateRandomCode());
  const [targetGroup, setTargetGroup] = useState('');
  const [description, setDescription] = useState('');
  const [categoryScope, setCategoryScope] = useState<'all' | 'custom'>('all');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTema, setSelectedTema] = useState<string>('all');
  const [allowExport, setAllowExport] = useState(true);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enter Code State
  const [enterCodeInput, setEnterCodeInput] = useState('');
  const [enterCodeLoading, setEnterCodeLoading] = useState(false);
  const [enterCodeError, setEnterCodeError] = useState('');

  // UI helpers
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  function generateRandomCode() {
    const prefixes = ['TEAM', 'SHARE', 'CAL', 'EVENT', 'SYNC', 'GROUP', 'PROJECT'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
  }

  const handleGenerateCode = () => {
    setCode(generateRandomCode());
  };

  const getBaseShareUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${window.location.pathname}`;
    }
    return '';
  };

  const getFullShareLink = (shareCode: string) => {
    const base = getBaseShareUrl();
    return `${base}?share=${encodeURIComponent(shareCode.trim().toUpperCase())}`;
  };

  const handleCopyText = (text: string, id: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } else {
      setCopiedLink(id);
      setTimeout(() => setCopiedLink(null), 2500);
    }
  };

  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      alert('Please provide or generate a share code.');
      return;
    }

    setIsSubmitting(true);
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    const shareData: Partial<SharedCalendar> = {
      code: cleanCode,
      title: title.trim() || `Calendar Share (${cleanCode})`,
      description: description.trim(),
      targetGroup: targetGroup.trim() || 'General Audience',
      createdByUserId: currentUser?.id || 'admin',
      createdByName: currentUser?.name || 'Organizer',
      createdAt: new Date().toISOString(),
      isActive: true,
      filterCategories: categoryScope === 'custom' ? selectedCategoryIds : [],
      filterTema: selectedTema !== 'all' ? selectedTema : 'all',
      allowGuestsToExport: allowExport,
      expiresAt: hasExpiry && expiryDate ? expiryDate : undefined,
      viewCount: 0
    };

    try {
      const created = await onCreateShare(shareData);
      if (created) {
        // Auto copy link to clipboard
        const link = getFullShareLink(created.code);
        navigator.clipboard.writeText(link);

        setSuccessToast(`Share Code "${created.code}" created! Share link copied to clipboard.`);
        setTimeout(() => setSuccessToast(null), 4000);

        // Reset fields
        setTitle('');
        setCode(generateRandomCode());
        setTargetGroup('');
        setDescription('');
        setCategoryScope('all');
        setSelectedCategoryIds([]);
        setSelectedTema('all');
        setActiveTab('manage');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to create share link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnterCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnterCodeError('');
    const clean = enterCodeInput.trim().toUpperCase();
    if (!clean) {
      setEnterCodeError('Please enter a valid share code.');
      return;
    }

    setEnterCodeLoading(true);
    try {
      const res = await onAccessShareCode(clean);
      if (res.success) {
        onClose();
      } else {
        setEnterCodeError(res.error || `No active calendar share found with code "${clean}".`);
      }
    } catch (err: any) {
      setEnterCodeError(err?.message || 'Error accessing shared calendar.');
    } finally {
      setEnterCodeLoading(false);
    }
  };

  return (
    <div
      id="share-calendar-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="share-calendar-modal-content"
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-800 dark:text-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Calendar Sharing & Access Codes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Share calendars with specific groups or individuals without requiring accounts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Create New Share
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'manage'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Active Shares & Codes
            {shares.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold">
                {shares.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enter')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'enter'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Enter Share Code
          </button>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-emerald-600 hover:text-emerald-800 text-[11px] font-bold underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 max-h-[68vh] overflow-y-auto">
          {/* TAB 1: CREATE NEW SHARE */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4.5">
              <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-2.5">
                <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                  Anyone who receives this <strong>Access Code</strong> or opens the <strong>Direct Link</strong> can view your calendar events instantly in guest mode — <strong>no sign-in or account registration required!</strong>
                </p>
              </div>

              {/* Share Title & Target Group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Share Title / Calendar Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Marketing Team Calendar, Client Schedule"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Group / Audience
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Marketing Dept, External Clients, Family"
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    className="w-full px-3.5 py-2.2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Share Code (Access Code) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Access Code (People can type this code to view)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                      placeholder="e.g. TEAM-2026, VIP-PASS, PROJ-ALPHA"
                      className="w-full pl-3.5 pr-10 py-2.2 text-xs font-mono font-bold tracking-wider rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase transition-all"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-sans">
                      CODE
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="flex items-center gap-1.5 px-3 py-2.2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all shrink-0"
                    title="Generate a new random access code"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Random Code</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Preview Direct Link: <span className="font-mono text-indigo-500 dark:text-indigo-400">{getFullShareLink(code || 'CODE')}</span>
                </p>
              </div>

              {/* Description (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Description / Welcome Note for Viewers (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Here is our official team calendar for Q3 deliverables and client presentations."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Scope Filters: Categories and Temas */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-500" />
                    Select Specific Events to Share
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-600 dark:text-slate-400">
                      <input
                        type="radio"
                        name="catScope"
                        checked={categoryScope === 'all'}
                        onChange={() => setCategoryScope('all')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      All Categories ({categories.length})
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-600 dark:text-slate-400 ml-2">
                      <input
                        type="radio"
                        name="catScope"
                        checked={categoryScope === 'custom'}
                        onChange={() => setCategoryScope('custom')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      Specific Categories Only
                    </label>
                  </div>
                </div>

                {categoryScope === 'custom' && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 animate-in fade-in duration-150">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                      Check the categories you want viewers of this share to see:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {categories.map((cat) => {
                        const isChecked = selectedCategoryIds.includes(cat.id);
                        return (
                          <label
                            key={cat.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                              isChecked
                                ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/40 text-slate-900 dark:text-white font-medium'
                                : 'border-slate-200 dark:border-slate-700/70 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleCategory(cat.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.hex }} />
                            <span className="truncate">{cat.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tema Filter */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Filter by Tema / Track:
                  </span>
                  <select
                    value={selectedTema}
                    onChange={(e) => setSelectedTema(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Temas / Tracks</option>
                    {(settings.temas || ['Tema 1', 'Tema 2', 'Tema 3']).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Permissions & Expiry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-800/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowExport}
                    onChange={(e) => setAllowExport(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Allow iCal & Print Export
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      Guests can export filtered events to standard iCal format
                    </span>
                  </div>
                </label>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-800/50 space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasExpiry}
                      onChange={(e) => setHasExpiry(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Set Expiration Date
                    </span>
                  </label>
                  {hasExpiry && (
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 mt-1"
                    />
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Creating...' : 'Create Share Link & Access Code'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: ACTIVE SHARES & CODES */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Active Calendar Shares ({shares.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Manage active share codes, view counts, and copy instant links.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  New Share Code
                </button>
              </div>

              {shares.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                    <Share2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                    No Shared Calendars Created Yet
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                    Create your first share code to let groups, coworkers, or clients view your schedule without an account.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md shadow-indigo-500/20"
                  >
                    Create Your First Share Code
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {shares.map((share) => {
                    const isCodeCopied = copiedId === share.id;
                    const isLinkCopied = copiedLink === share.id;
                    const fullLink = getFullShareLink(share.code);

                    return (
                      <div
                        key={share.id}
                        className={`p-4 rounded-xl border transition-all ${
                          share.isActive
                            ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800/50 bg-slate-50/60 dark:bg-slate-900/40 opacity-70'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                {share.title}
                              </h4>
                              {share.targetGroup && (
                                <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  {share.targetGroup}
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                                  share.isActive
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}
                              >
                                {share.isActive ? 'Active' : 'Paused'}
                              </span>
                            </div>
                            {share.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {share.description}
                              </p>
                            )}
                          </div>

                          {/* Access Code Pill */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80">
                              <span className="text-[10px] font-bold uppercase text-indigo-500 dark:text-indigo-400">
                                CODE:
                              </span>
                              <span className="text-xs font-mono font-bold tracking-wider text-indigo-700 dark:text-indigo-300">
                                {share.code}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(share.code, share.id, 'code')}
                                className="p-1 rounded text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 transition-colors ml-1"
                                title="Copy Access Code"
                              >
                                {isCodeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Details & Actions Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                              {share.viewCount || 0} guest views
                            </span>
                            <span className="flex items-center gap-1">
                              <Tag className="w-3.5 h-3.5 text-slate-400" />
                              {share.filterCategories && share.filterCategories.length > 0
                                ? `${share.filterCategories.length} categories`
                                : 'All categories'}
                            </span>
                            {share.filterTema && share.filterTema !== 'all' && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                                {share.filterTema}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Copy Direct Share Link */}
                            <button
                              type="button"
                              onClick={() => handleCopyText(fullLink, share.id, 'link')}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                              title="Copy Direct Share Link to Clipboard"
                            >
                              {isLinkCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-600 font-bold">Copied Link!</span>
                                </>
                              ) : (
                                <>
                                  <Link className="w-3.5 h-3.5" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>

                            {/* Preview as Guest */}
                            <button
                              type="button"
                              onClick={async () => {
                                await onAccessShareCode(share.code);
                                onClose();
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 transition-colors"
                              title="View calendar using this share code"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Preview</span>
                            </button>

                            {/* Toggle Active / Pause */}
                            <button
                              type="button"
                              onClick={() => onUpdateShare(share.id, { isActive: !share.isActive })}
                              className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              title={share.isActive ? 'Pause Share' : 'Resume Share'}
                            >
                              {share.isActive ? 'Pause' : 'Resume'}
                            </button>

                            {/* Delete Share */}
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete the share code "${share.code}"?`)) {
                                  onDeleteShare(share.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Delete Share Code"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ENTER ACCESS CODE */}
          {activeTab === 'enter' && (
            <form onSubmit={handleEnterCodeSubmit} className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-center">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-2.5">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Enter Calendar Access Code
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  If someone shared an access code with you, enter it below to instantly load and view their shared calendar.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Calendar Access Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. TEAM-2026 or PROJECT-ALPHA"
                    value={enterCodeInput}
                    onChange={(e) => {
                      setEnterCodeInput(e.target.value.toUpperCase());
                      setEnterCodeError('');
                    }}
                    className="w-full px-4 py-3 text-sm font-mono font-bold tracking-wider rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase transition-all"
                  />
                </div>
              </div>

              {enterCodeError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{enterCodeError}</span>
                </div>
              )}

              {/* Quick Select from existing active shares if any */}
              {shares.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Or select an active share code:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {shares.filter((s) => s.isActive).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setEnterCodeInput(s.code)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 transition-all"
                      >
                        {s.code} ({s.title})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enterCodeLoading}
                  className="flex items-center gap-2 px-5 py-2.2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  <ArrowRight className="w-4 h-4" />
                  {enterCodeLoading ? 'Validating...' : 'Access Shared Calendar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

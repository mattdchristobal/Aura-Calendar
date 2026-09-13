import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  Zap,
  ExternalLink,
  Shield,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Key,
  Play,
  Sliders,
  Sparkles,
  Info,
  CalendarCheck
} from 'lucide-react';
import { ZapierConfig, Category, CalendarEvent, User, ConnectedAccount } from '../types';
import {
  fetchZapierConfig,
  apiSaveZapierConfig,
  apiTestZapierOutbound,
  apiSimulateZapierInbound,
  apiClearZapierLogs
} from '../utils/api';

interface ZapierIntegrationPanelProps {
  currentUser?: User;
  categories?: Category[];
  onBack: () => void;
  onUpdateUser?: (user: User) => void;
  onImportEvents?: (events: CalendarEvent[]) => void;
  onRefreshEvents?: () => void;
}

export const ZapierIntegrationPanel: React.FC<ZapierIntegrationPanelProps> = ({
  currentUser,
  categories = [],
  onBack,
  onUpdateUser,
  onImportEvents,
  onRefreshEvents
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingOutbound, setTestingOutbound] = useState(false);
  const [simulatingInbound, setSimulatingInbound] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'setup' | 'testing' | 'logs'>('setup');

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Configuration state
  const [config, setConfig] = useState<ZapierConfig>({
    apiKey: '',
    catchHookUrl: '',
    enabled: true,
    syncDirection: 'two-way',
    defaultCategoryId: categories[0]?.id || 'work',
    outlookAccountEmail: currentUser?.email || 'outlook-calendar@zapier.sync',
    logs: []
  });

  const [webhookUrl, setWebhookUrl] = useState('');
  const [urlFormat, setUrlFormat] = useState<'query' | 'header'>('query');
  const [domainMode, setDomainMode] = useState<'default' | 'shared' | 'browser'>('default');
  const [endpointStatus, setEndpointStatus] = useState<{ checked: boolean; ok: boolean; message?: string } | null>(null);
  const [checkingEndpoint, setCheckingEndpoint] = useState(false);
  const [customTestTitle, setCustomTestTitle] = useState('Outlook: Executive Strategy & Planning');
  const [customTestLocation, setCustomTestLocation] = useState('Microsoft Teams');

  // Compute the active webhook URL based on domainMode and urlFormat
  const getComputedWebhookUrl = useCallback(
    (apiKey: string) => {
      let base = 'https://ais-dev-7l4infuif524ncheylrol3-488950738317.us-east1.run.app';
      if (domainMode === 'shared') {
        base = 'https://ais-pre-7l4infuif524ncheylrol3-488950738317.us-east1.run.app';
      } else if (domainMode === 'browser') {
        const origin = window.location.origin;
        if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
          base = origin;
        }
      }
      return urlFormat === 'query'
        ? `${base}/api/webhooks/zapier?apiKey=${apiKey}`
        : `${base}/api/webhooks/zapier`;
    },
    [domainMode, urlFormat]
  );

  // Load configuration from server
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchZapierConfig();
      if (res.success && res.config) {
        setConfig(res.config);
        if (res.webhookUrl && !res.webhookUrl.includes('localhost')) {
          setWebhookUrl(res.webhookUrl);
        } else {
          // Construct using public Cloud Run URL
          const origin = window.location.origin;
          const baseUrl = (!origin.includes('localhost') && !origin.includes('127.0.0.1'))
            ? origin
            : (res.baseUrl && !res.baseUrl.includes('localhost') ? res.baseUrl : 'https://ais-dev-7l4infuif524ncheylrol3-488950738317.us-east1.run.app');
          setWebhookUrl(`${baseUrl}/api/webhooks/zapier?apiKey=${res.config.apiKey}`);
        }
      }
    } catch {
      setNotification({
        type: 'error',
        message: 'Could not connect to Zapier sync server.'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Update webhookUrl when config, domainMode, or urlFormat change
  useEffect(() => {
    if (config.apiKey) {
      setWebhookUrl(getComputedWebhookUrl(config.apiKey));
    }
  }, [domainMode, urlFormat, config.apiKey, getComputedWebhookUrl]);

  // Health check the webhook endpoint live
  const handleCheckEndpoint = async () => {
    setCheckingEndpoint(true);
    try {
      const res = await fetch(`/api/webhooks/zapier?apiKey=${config.apiKey}`);
      if (res.ok) {
        const data = await res.json();
        setEndpointStatus({
          checked: true,
          ok: true,
          message: data.instructions || 'Endpoint is online and ready to accept POST webhooks from Zapier.'
        });
      } else {
        setEndpointStatus({
          checked: true,
          ok: false,
          message: `Server returned HTTP status ${res.status}`
        });
      }
    } catch (err: any) {
      setEndpointStatus({
        checked: true,
        ok: false,
        message: err?.message || 'Failed to ping endpoint.'
      });
    } finally {
      setCheckingEndpoint(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, type: 'webhook' | 'key') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'webhook') {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2200);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2200);
    }
  };

  // Save config changes
  const handleSave = async (extraPayload: Partial<ZapierConfig> & { regenerateKey?: boolean } = {}) => {
    setSaving(true);
    setNotification(null);
    try {
      const payload = {
        ...config,
        ...extraPayload
      };
      const res = await apiSaveZapierConfig(payload);
      if (res.success && res.config) {
        setConfig(res.config);
        if (res.webhookUrl) setWebhookUrl(res.webhookUrl);

        // Also ensure a ConnectedAccount exists in the current user's profile
        if (currentUser && onUpdateUser) {
          const accounts: ConnectedAccount[] = [...(currentUser.connectedAccounts || [])];
          const existingIdx = accounts.findIndex(
            (a) => a.provider === 'zapier' || a.id === 'acc_zapier_outlook'
          );

          const zapierAccount: ConnectedAccount = {
            id: 'acc_zapier_outlook',
            provider: 'zapier',
            name: 'Microsoft Outlook (Zapier)',
            email: res.config.outlookAccountEmail || 'outlook-calendar@zapier.sync',
            createdAt: new Date().toISOString(),
            lastSyncedAt: res.config.lastSyncedAt || new Date().toISOString(),
            syncDirection:
              res.config.syncDirection === 'inbound-only'
                ? 'import-only'
                : res.config.syncDirection === 'outbound-only'
                ? 'export-only'
                : 'two-way',
            autoSync: res.config.enabled,
            categoryId: res.config.defaultCategoryId || 'work',
            status: 'connected'
          };

          if (existingIdx >= 0) {
            accounts[existingIdx] = { ...accounts[existingIdx], ...zapierAccount };
          } else {
            accounts.push(zapierAccount);
          }

          onUpdateUser({
            ...currentUser,
            connectedAccounts: accounts
          });
        }

        setNotification({
          type: 'success',
          message: extraPayload.regenerateKey
            ? 'Generated a new Zapier Webhook API Key!'
            : 'Zapier Microsoft Outlook configuration saved successfully.'
        });
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to save settings.'
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Error saving settings'
      });
    } finally {
      setSaving(false);
    }
  };

  // Test Outbound to Zapier Catch Hook
  const handleTestOutbound = async () => {
    if (!config.catchHookUrl || !config.catchHookUrl.startsWith('http')) {
      setNotification({
        type: 'error',
        message: 'Please enter a valid Zapier Catch Hook URL in the settings before testing.'
      });
      return;
    }

    setTestingOutbound(true);
    setNotification(null);
    try {
      const res = await apiTestZapierOutbound(config.catchHookUrl);
      if (res.success) {
        setNotification({
          type: 'success',
          message: res.message || 'Sample event successfully received by Zapier Catch Hook!'
        });
        loadConfig();
      } else {
        setNotification({
          type: 'error',
          message: res.error || res.message || 'Zapier Catch Hook rejected test event.'
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Network error: ${err?.message || 'Failed to connect to Zapier'}`
      });
    } finally {
      setTestingOutbound(false);
    }
  };

  // Simulate Inbound event from Microsoft Outlook via Zapier
  const handleSimulateInbound = async () => {
    setSimulatingInbound(true);
    setNotification(null);
    try {
      const res = await apiSimulateZapierInbound({
        title: customTestTitle.trim() || 'Outlook: Q4 Product Strategy & Client Review',
        location: customTestLocation.trim() || 'Microsoft Teams Meeting'
      });
      if (res.success && res.event) {
        setNotification({
          type: 'success',
          message: 'Microsoft Outlook event simulated! It is now scheduled on your calendar.'
        });
        if (onImportEvents) {
          onImportEvents([res.event]);
        }
        if (onRefreshEvents) {
          onRefreshEvents();
        }
        loadConfig();
      } else {
        setNotification({
          type: 'error',
          message: res.error || 'Failed to simulate inbound event.'
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Simulation error: ${err?.message}`
      });
    } finally {
      setSimulatingInbound(false);
    }
  };

  // Clear log history
  const handleClearLogs = async () => {
    try {
      await apiClearZapierLogs();
      setConfig((prev) => ({ ...prev, logs: [] }));
      setNotification({ type: 'info', message: 'Zapier delivery logs cleared.' });
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5" id="zapier-outlook-integration-panel">
      {/* Top Header / Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          id="back-from-zapier-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Calendar Accounts</span>
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              config.enabled
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                config.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            {config.enabled ? 'Zapier Outlook Bridge Active' : 'Integration Paused'}
          </span>
          <button
            type="button"
            onClick={loadConfig}
            disabled={loading}
            title="Refresh status and logs"
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Brand Hero Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white via-orange-50/20 to-blue-50/30 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-800/60 border border-slate-200/90 dark:border-slate-700 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Authentic Zapier Logo Badge */}
              <div className="w-11 h-11 rounded-xl bg-[#FF4F00] text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                  <path d="M11 2h2v7.5l5.3-5.3 1.4 1.4L14.4 11H22v2h-7.6l5.3 5.3-1.4 1.4L13 14.4V22h-2v-7.6l-5.3 5.3-1.4-1.4L9.6 13H2v-2h7.6L4.3 5.7l1.4-1.4L11 9.6V2z" />
                </svg>
              </div>

              {/* Sync Connector */}
              <div className="w-6 flex items-center justify-center text-slate-400">
                <RefreshCw className="w-3.5 h-3.5" />
              </div>

              {/* Authentic Microsoft Outlook Logo Badge */}
              <div className="w-11 h-11 rounded-xl bg-[#0078D4] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                  <path d="M19.5 3h-15C3.1 3 2 4.1 2 5.5v13C2 19.9 3.1 21 4.5 21h15c1.4 0 2.5-1.1 2.5-2.5v-13C22 4.1 20.9 3 19.5 3zm1 15.5c0 .6-.4 1-1 1h-15c-.6 0-1-.4-1-1v-9.7l8.2 5.1c.2.1.5.2.8.2s.6-.1.8-.2l8.2-5.1v9.7zm-8.5-5.3L4.3 8.3c-.2-.1-.3-.4-.3-.7 0-.6.4-1 1-1h14c.6 0 1 .4 1 1 0 .3-.1.6-.3.7l-7.7 4.9c-.3.2-.7.2-1 0z" />
                </svg>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Microsoft Outlook via Zapier
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                  Automated Two-Way Sync
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Connect your Outlook calendar using Zapier webhooks. Changes synchronize seamlessly without complex OAuth tenant registration.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <a
              href="https://zapier.com/apps/microsoft-outlook/integrations"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-1.5"
            >
              <span>Zapier Outlook Directory</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Sync Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/50">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Sync Mode</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize mt-0.5">
              {config.syncDirection.replace('-', ' ')}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/50">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Outlook Account</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
              {config.outlookAccountEmail || 'Connected'}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/50">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Events Synced</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {config.syncedEventsCount || 0} events
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/50">
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Last Activity</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {config.lastSyncedAt
                ? new Date(config.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Ready to sync'}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-3 rounded-xl flex items-center justify-between gap-3 text-xs font-medium border ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('setup')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'setup'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Webhook Setup</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('testing')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'testing'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Live Test Lab</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'logs'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          <span>Logs ({config.logs?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: WEBHOOK SETUP & CONFIGURATION */}
      {activeTab === 'setup' && (
        <div className="space-y-5" id="zapier-setup-view">
          {/* STEP 1: Inbound Webhook (Outlook -> App) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-[10px] font-black">
                    1
                  </span>
                  <span>Inbound Webhook: Outlook to App</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Send Microsoft Outlook Calendar Events to this App
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Copy this URL into Zapier to automatically push new or updated Outlook meetings straight into your schedule.
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                Ready & Active
              </span>
            </div>

            {/* Inbound Webhook URL Display with 1-Click Copy */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>Your App Webhook Endpoint URL</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    HTTPS Live
                  </span>
                </label>

                {/* URL Format Toggle */}
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-400 mr-1">URL Style:</span>
                  <button
                    type="button"
                    onClick={() => setUrlFormat('query')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                      urlFormat === 'query'
                        ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    With ?apiKey (Easiest)
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={() => setUrlFormat('header')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                      urlFormat === 'header'
                        ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Clean URL (with Header)
                  </button>
                </div>
              </div>

              {/* URL Input and Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    id="zapier-inbound-webhook-url-input"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 select-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    id="copy-inbound-webhook-btn"
                    onClick={() => handleCopy(webhookUrl, 'webhook')}
                    className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedWebhook ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Webhook URL</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    id="test-inbound-endpoint-btn"
                    onClick={handleCheckEndpoint}
                    disabled={checkingEndpoint}
                    title="Ping endpoint to verify it is reachable from Zapier"
                    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingEndpoint ? 'animate-spin text-indigo-500' : ''}`} />
                    <span className="hidden sm:inline">Verify Endpoint</span>
                  </button>
                </div>
              </div>

              {/* Endpoint Live Test Health Result */}
              {endpointStatus && (
                <div
                  className={`p-2.5 rounded-xl flex items-center gap-2 text-xs font-medium border ${
                    endpointStatus.ok
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {endpointStatus.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span className="flex-1">
                    {endpointStatus.ok
                      ? 'Endpoint is live and accessible from the public internet! Ready to receive events from Zapier.'
                      : endpointStatus.message}
                  </span>
                </div>
              )}

              {/* Domain Switcher */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-medium">URL Domain:</span>
                <button
                  type="button"
                  onClick={() => setDomainMode('default')}
                  className={`px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer ${
                    domainMode === 'default'
                      ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white font-bold'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Development App (ais-dev)
                </button>
                <button
                  type="button"
                  onClick={() => setDomainMode('shared')}
                  className={`px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer ${
                    domainMode === 'shared'
                      ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white font-bold'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Shared App (ais-pre)
                </button>
                <button
                  type="button"
                  onClick={() => setDomainMode('browser')}
                  className={`px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer ${
                    domainMode === 'browser'
                      ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white font-bold'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Current Browser Origin
                </button>
              </div>
            </div>

            {/* How to configure in Zapier Guide with Exact Field Mapping */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 space-y-3 text-xs">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Zapier Webhook Step Configuration Guide</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300">
                  Step 2 in your Zap
                </span>
              </div>

              <div className="space-y-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  In your Zapier editor, configure <strong>Webhooks by Zapier</strong> with the exact values below:
                </p>

                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-1.5">Zapier Field</th>
                        <th className="px-3 py-1.5">Value to Enter / Select</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[10.5px]">
                      <tr>
                        <td className="px-3 py-1.5 font-sans font-bold text-slate-800 dark:text-slate-200">Event</td>
                        <td className="px-3 py-1.5 text-indigo-600 dark:text-indigo-400 font-bold">POST</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 font-sans font-bold text-slate-800 dark:text-slate-200">URL</td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 break-all">{webhookUrl}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 font-sans font-bold text-slate-800 dark:text-slate-200">Payload Type</td>
                        <td className="px-3 py-1.5 text-emerald-600 dark:text-emerald-400 font-bold">json</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-1.5 font-sans font-bold text-slate-800 dark:text-slate-200">Data (Key → Value)</td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">
                          <div><code>subject</code> → <em>(Map from Microsoft Outlook: Subject)</em></div>
                          <div><code>startDateTime</code> → <em>(Map from Outlook: Start Date Time)</em></div>
                          <div><code>endDateTime</code> → <em>(Map from Outlook: End Date Time)</em></div>
                          <div><code>location</code> → <em>(Map from Outlook: Location Display Name)</em></div>
                        </td>
                      </tr>
                      {urlFormat === 'header' && (
                        <tr>
                          <td className="px-3 py-1.5 font-sans font-bold text-slate-800 dark:text-slate-200">Headers</td>
                          <td className="px-3 py-1.5 text-indigo-600 dark:text-indigo-400">
                            <code>x-api-key</code> → <code>{config.apiKey}</code>
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td className="px-3 py-1.5 font-sans font-bold text-slate-800 dark:text-slate-200">Wrap Request in Array</td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">no</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-blue-800 dark:text-blue-200 text-[11px] flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Testing in Zapier:</strong> When you click <strong>Test step</strong> in Zapier, this calendar will respond with a verified status and log the incoming test. You will see a green checkmark indicating successful delivery!
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: Outbound Catch Hook (App -> Outlook) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-[10px] font-black">
                  2
                </span>
                <span>Outbound Hook: App to Microsoft Outlook</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Push Events Created Here into Microsoft Outlook
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                To achieve true two-way sync, paste your Zapier Catch Hook URL below. Any new event or edit made in this app will be automatically published into your Outlook calendar.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Zapier Catch Hook URL (Optional for 2-way sync)</span>
                <span className="text-[11px] text-slate-400 font-mono">https://hooks.zapier.com/hooks/catch/...</span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://hooks.zapier.com/hooks/catch/123456/abcdef/"
                  value={config.catchHookUrl || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, catchHookUrl: e.target.value }))}
                  id="zapier-catchhook-url-input"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleTestOutbound}
                  disabled={testingOutbound || !config.catchHookUrl}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Play className={`w-3.5 h-3.5 ${testingOutbound ? 'animate-spin' : ''}`} />
                  <span>{testingOutbound ? 'Testing...' : 'Test Hook'}</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  Create a Zap with Trigger: <strong>Webhooks by Zapier (Catch Hook)</strong> &rarr; Action: <strong>Microsoft Outlook (Create Event)</strong>.
                </span>
              </div>
            </div>
          </div>

          {/* STEP 3: Preferences & Mapping */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-[10px] font-black">
                  3
                </span>
                <span>Calendar Mapping & Direction</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Synchronization Preferences
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Outlook Email Identifier */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Microsoft Outlook Account Email
                </label>
                <input
                  type="email"
                  placeholder="your-email@outlook.com or @company.com"
                  value={config.outlookAccountEmail || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, outlookAccountEmail: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400">
                  Used as the label and event source tag on your calendar.
                </p>
              </div>

              {/* Default Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Import into Calendar Category
                </label>
                <select
                  value={config.defaultCategoryId}
                  onChange={(e) => setConfig((prev) => ({ ...prev, defaultCategoryId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Events from Outlook will inherit this category styling and color.
                </p>
              </div>

              {/* Sync Direction */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Sync Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition-all ${
                      config.syncDirection === 'two-way'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="syncDirection"
                      value="two-way"
                      checked={config.syncDirection === 'two-way'}
                      onChange={() => setConfig((prev) => ({ ...prev, syncDirection: 'two-way' }))}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="font-bold">Two-Way (Recommended)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Import Outlook & export local changes</div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition-all ${
                      config.syncDirection === 'inbound-only'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="syncDirection"
                      value="inbound-only"
                      checked={config.syncDirection === 'inbound-only'}
                      onChange={() => setConfig((prev) => ({ ...prev, syncDirection: 'inbound-only' }))}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="font-bold">Inbound Only</div>
                      <div className="text-[10px] text-slate-500 font-normal">Only receive events from Outlook</div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 cursor-pointer transition-all ${
                      config.syncDirection === 'outbound-only'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="syncDirection"
                      value="outbound-only"
                      checked={config.syncDirection === 'outbound-only'}
                      onChange={() => setConfig((prev) => ({ ...prev, syncDirection: 'outbound-only' }))}
                      className="text-indigo-600"
                    />
                    <div>
                      <div className="font-bold">Outbound Only</div>
                      <div className="text-[10px] text-slate-500 font-normal">Only push events to Outlook</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* API Key Security Section */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Webhook Secret Key: </span>
                  <span className="font-mono text-slate-500">
                    {config.apiKey ? `${config.apiKey.slice(0, 10)}••••••••` : 'None'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(config.apiKey, 'key')}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedKey ? 'Key Copied!' : 'Copy API Key'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSave({ regenerateKey: true })}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                >
                  Regenerate Key
                </button>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="save-zapier-config-btn"
                onClick={() => handleSave()}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Integration Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE TEST LAB */}
      {activeTab === 'testing' && (
        <div className="space-y-4" id="zapier-testing-view">
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Live Outlook & Zapier Testing Lab
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You do not have to wait for an upcoming meeting to verify your integration! Use these live simulators to test two-way communication instantly.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Simulator 1: Inbound Event from Outlook */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Simulate Inbound Outlook Event
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Sends a test event through the webhook processor
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Event Title
                      </label>
                      <input
                        type="text"
                        value={customTestTitle}
                        onChange={(e) => setCustomTestTitle(e.target.value)}
                        className="w-full mt-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Location
                      </label>
                      <input
                        type="text"
                        value={customTestLocation}
                        onChange={(e) => setCustomTestLocation(e.target.value)}
                        className="w-full mt-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  id="simulate-inbound-btn"
                  onClick={handleSimulateInbound}
                  disabled={simulatingInbound}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${simulatingInbound ? 'animate-spin' : ''}`} />
                  <span>{simulatingInbound ? 'Simulating...' : 'Simulate Outlook Event'}</span>
                </button>
              </div>

              {/* Simulator 2: Outbound to Zapier Catch Hook */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
                      <Zap className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Dispatch Sample Event to Zapier
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Verifies your Zapier Catch Hook is alive and responding
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                    Pushes a standard payload containing event subject, startDateTime, endDateTime, location, and attendees to your Catch Hook:
                  </p>
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/90 font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate">
                    {config.catchHookUrl || 'No catch hook URL configured yet'}
                  </div>
                </div>

                <button
                  type="button"
                  id="test-outbound-btn"
                  onClick={handleTestOutbound}
                  disabled={testingOutbound || !config.catchHookUrl}
                  className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${testingOutbound ? 'animate-spin' : ''}`} />
                  <span>{testingOutbound ? 'Sending payload...' : 'Dispatch Sample to Zapier'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LOGS & AUDIT TRAIL */}
      {activeTab === 'logs' && (
        <div className="space-y-4" id="zapier-logs-view">
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Recent Webhook Transmissions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live audit log of all events dispatched to or received from Zapier and Microsoft Outlook.
                </p>
              </div>

              {config.logs && config.logs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Logs</span>
                </button>
              )}
            </div>

            {(!config.logs || config.logs.length === 0) ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No webhook activity recorded yet. Run a test from the &quot;Live Test Lab&quot; or dispatch a test from Zapier!
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {config.logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${
                          log.status === 'success'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {log.status}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${
                          log.type === 'inbound'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : log.type === 'outbound'
                            ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300'
                            : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                        }`}
                      >
                        {log.type}
                      </span>

                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {log.eventTitle}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {log.details}
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-slate-400 shrink-0 self-end sm:self-center">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ZapierIntegrationPanel;

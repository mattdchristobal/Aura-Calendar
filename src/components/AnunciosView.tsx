import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Download,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar as CalendarIcon,
  ArrowLeft,
  Sparkles,
  QrCode,
  Copy,
  Check
} from 'lucide-react';
import { User } from '../types';
import {
  fetchAnuncioPdfInfo,
  uploadAnuncioPdfFile,
  deleteAnuncioPdf,
  loadAnuncioPdfFromStorage,
  AnuncioPdfInfo
} from '../utils/announcements';
import { generateQrDataUrl, downloadHighResCategoryQrPng, getCategoryPublicUrl } from '../utils/qrUtils';

interface AnunciosViewProps {
  currentUser?: User | null;
  events?: any[];
  onBackToCalendar?: () => void;
  onOpenSacramentosPdf?: () => void;
}

export const AnunciosView: React.FC<AnunciosViewProps> = ({
  currentUser,
  onBackToCalendar,
  onOpenSacramentosPdf
}) => {
  const [pdfInfo, setPdfInfo] = useState<AnuncioPdfInfo | null>(() => loadAnuncioPdfFromStorage());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load PDF info from server on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchAnuncioPdfInfo()
      .then((info) => {
        if (isMounted) {
          setPdfInfo(info);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Generate Sacramentos QR code URL
  const sacramentosPublicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/pdf/all`
    : '/pdf/all';

  useEffect(() => {
    generateQrDataUrl(sacramentosPublicUrl, { width: 400, darkColor: '#1e1b4b' })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [sacramentosPublicUrl]);

  // Handle file selection / upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processAndUploadFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processAndUploadFile = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate mime type or extension
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setErrorMessage('Por favor selecciona un archivo PDF válido (.pdf).');
      return;
    }

    // Max 50 MB
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('El archivo es demasiado grande (máximo 50 MB).');
      return;
    }

    try {
      setIsUploading(true);
      const uploaded = await uploadAnuncioPdfFile(file);
      setPdfInfo(uploaded);
      setSuccessMessage('¡Archivo PDF de Anuncios subido con éxito y vinculado a Sacramentos!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error al subir el PDF de anuncios:', err);
      setErrorMessage(err?.message || 'Error al subir el archivo PDF. Inténtalo de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processAndUploadFile(file);
    }
  };

  // Delete PDF
  const handleDeletePdf = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar el archivo PDF de Anuncios?')) {
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage(null);
      await deleteAnuncioPdf();
      setPdfInfo(null);
      setSuccessMessage('Archivo PDF de Anuncios eliminado correctamente.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al eliminar el archivo PDF.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(sacramentosPublicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Download QR Code PNG
  const handleDownloadQrPng = async () => {
    await downloadHighResCategoryQrPng(
      {
        id: 'all',
        name: 'SACRAMENTOS - Todo en Uno',
        hex: '#4f46e5',
        color: 'indigo',
        bgClass: '',
        borderClass: '',
        textClass: '',
        badgeClass: '',
        dotClass: ''
      },
      sacramentosPublicUrl,
      { width: 1024, darkColor: '#1e1b4b' }
    );
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Top Header Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <FileText className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Anuncios Parroquiales (PDF)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl">
              Sube el archivo PDF de tus anuncios o boletín. Está automáticamente integrado en la categoría{' '}
              <strong className="text-indigo-600 dark:text-indigo-400">Sacramentos</strong> y su código QR para que los feligreses vean tanto los eventos como este PDF en una sola pantalla.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {onBackToCalendar && (
              <button
                type="button"
                onClick={onBackToCalendar}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver al Calendario</span>
              </button>
            )}

            {onOpenSacramentosPdf && (
              <button
                type="button"
                onClick={onOpenSacramentosPdf}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ver Sacramentos (Todo en Uno)</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications & Alerts */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-800 dark:text-rose-200 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-3 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm animate-fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="flex-1 font-semibold">{successMessage}</span>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          className="hidden"
          id="anuncio-pdf-file-input"
        />

        {/* ================================================================= */}
        {/* ACTIVE PDF CARD OR UPLOAD DROPZONE */}
        {/* ================================================================= */}
        {pdfInfo ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Active PDF Toolbar */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                  <FileText className="w-6 h-6 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-white truncate max-w-sm" title={pdfInfo.filename}>
                      {pdfInfo.filename}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Sparkles className="w-3 h-3" />
                      Vinculado a Sacramentos
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/80 mt-0.5">
                    Tamaño: {formatFileSize(pdfInfo.fileSize)} • Subido:{' '}
                    {pdfInfo.uploadedAt ? new Date(pdfInfo.uploadedAt).toLocaleDateString() : 'Recientemente'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href="/api/anuncio/pdf"
                  download={pdfInfo.filename}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-lg transition-all cursor-pointer"
                  title="Descargar archivo PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </a>

                <a
                  href="/api/anuncio/pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-lg transition-all cursor-pointer"
                  title="Abrir en pantalla completa"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Pantalla Completa</span>
                </a>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-all cursor-pointer disabled:opacity-50"
                  title="Subir un nuevo archivo PDF para reemplazar este"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isUploading ? 'animate-spin' : ''}`} />
                  <span>Reemplazar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeletePdf}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                  title="Eliminar este archivo PDF"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>

            {/* Interactive PDF Embedded Viewer */}
            <div className="p-4 sm:p-6 bg-slate-100 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800">
              <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800">
                <iframe
                  src="/api/anuncio/pdf#toolbar=1"
                  className="w-full h-[600px] md:h-[750px] border-none block"
                  title="Vista Previa de Anuncio PDF"
                />
              </div>

              <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 px-1">
                <span>¿No puedes visualizar el documento interactivo en tu dispositivo?</span>
                <a
                  href="/api/anuncio/pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Abrir o descargar el archivo PDF directamente</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State: PDF Dropzone */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-200 bg-white dark:bg-slate-900 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.01]'
                : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm'
            }`}
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5 shadow-inner">
              {isUploading ? (
                <RefreshCw className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-indigo-600" />
              ) : (
                <Upload className="w-8 h-8 sm:w-10 sm:h-10" />
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">
              {isUploading
                ? 'Subiendo y procesando archivo PDF...'
                : 'Arrastra y suelta tu archivo PDF de Anuncios aquí'}
            </h3>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
              O haz clic en cualquier parte de este recuadro para seleccionar el PDF desde tu computadora o teléfono (.pdf, hasta 50 MB).
            </p>

            <button
              type="button"
              disabled={isUploading}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all pointer-events-none"
            >
              <FileText className="w-4 h-4" />
              <span>Seleccionar Archivo PDF</span>
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* SACRAMENTOS CATEGORY QR INTEGRATION (TODO EN UNO) */}
        {/* ================================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Código QR de Sacramentos (Todo en Uno)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Al escanear este código QR, se abre el Calendario de Eventos y el PDF de Anuncios juntos en una sola vista unificada.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* QR Preview Box */}
            <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Código QR Sacramentos"
                  className="w-40 h-40 rounded-xl object-contain bg-white p-2 border border-slate-200 dark:border-slate-700 shadow-sm"
                />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">
                  Generando código QR...
                </div>
              )}
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-2">
                Escanea con la cámara de tu celular
              </span>
            </div>

            {/* Explanation & Action Links */}
            <div className="md:col-span-8 space-y-4">
              <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 text-xs sm:text-sm text-indigo-950 dark:text-indigo-200 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-indigo-900 dark:text-indigo-100">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Integración Automática 100% Sincronizada</span>
                </div>
                <p className="text-xs leading-relaxed">
                  Cualquier feligrés que escanee este código QR con su celular verá:
                </p>
                <ul className="text-xs list-disc list-inside space-y-1 text-slate-700 dark:text-indigo-300">
                  <li>
                    <strong>Anuncios PDF:</strong> El documento subido arriba listo para leer o descargar.
                  </li>
                  <li>
                    <strong>Calendario de Eventos:</strong> Todos los eventos programados en tiempo real con fecha, hora y ubicación.
                  </li>
                  <li>
                    <strong>Sincronización Inmediata:</strong> Si reemplazas el PDF arriba, el código QR muestra el nuevo PDF automáticamente.
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-300">¡Enlace Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Enlace Público</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQrPng}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Código QR (PNG)</span>
                </button>

                <a
                  href="/pdf/all"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir Vista Sacramentos (Todo en Uno)</span>
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

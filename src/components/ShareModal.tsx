import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Edit3,
  Info,
  Link2,
  MessageCircle,
  RotateCcw,
  Share2,
  X,
} from 'lucide-react';
import {
  COMMISSION_STATUS_LABELS,
  type Commission,
} from '../types/operations';
import { formatCoords } from '../lib/geo';

const CUSTOM_SHARE_URL_STORAGE_KEY = 'dcr231_public_share_url';

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function getSavedCustomShareUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = window.localStorage.getItem(CUSTOM_SHARE_URL_STORAGE_KEY) || '';
    return normalizeUrl(saved);
  } catch {
    return '';
  }
}

export function saveCustomShareUrl(url: string): string {
  const normalized = normalizeUrl(url);
  if (typeof window !== 'undefined') {
    try {
      if (normalized) {
        window.localStorage.setItem(CUSTOM_SHARE_URL_STORAGE_KEY, normalized);
      } else {
        window.localStorage.removeItem(CUSTOM_SHARE_URL_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota issues
    }
  }
  return normalized;
}

export function isPreviewHostUrl(url: string): boolean {
  return /:\/\/ais-(dev|pre)-/i.test(url) || /localhost|127\.0\.0\.1/i.test(url);
}

/**
 * Resolves the best public/shareable URL of the app:
 * 1. Custom public URL saved by the operator/command admin (if configured).
 * 2. Current browser origin when already deployed on a standalone public domain.
 * 3. Build-time APP_URL if it points to a public non-preview domain.
 * 4. Fallback converting developer preview host (`ais-dev-`) to shared preview (`ais-pre-`).
 */
export function getShareableAppUrl(): string {
  const custom = getSavedCustomShareUrl();
  if (custom) return custom;

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin && !isPreviewHostUrl(origin)) {
      return origin.endsWith('/') ? origin : `${origin}/`;
    }
  }

  const envAppUrl = normalizeUrl(
    (import.meta.env.VITE_APP_URL as string | undefined) || ''
  );
  if (envAppUrl && !isPreviewHostUrl(envAppUrl)) {
    return envAppUrl;
  }

  if (typeof window === 'undefined') return envAppUrl || '';

  let fallbackOrigin = window.location.origin;
  if (fallbackOrigin.includes('://ais-dev-')) {
    fallbackOrigin = fallbackOrigin.replace('://ais-dev-', '://ais-pre-');
  }
  return fallbackOrigin.endsWith('/') ? fallbackOrigin : `${fallbackOrigin}/`;
}

export function formatAppShareBody(): string {
  return 'CZGNB-23 Trujillo — Comando de Zona Nro. 23 GNB (D-231 · DCR 23-1 · DESUR-23). Abre este enlace en Chrome (Android) o Safari (iPhone) para seguimiento en tiempo real, despliegue de unidades, patrullaje y alertas SOS:';
}

export function formatAppShareText(overrideUrl?: string): string {
  return `${formatAppShareBody()}\n${overrideUrl || getShareableAppUrl()}`;
}

export function formatCommissionShareText(
  commission: Commission,
  overrideUrl?: string
): string {
  const isSos = commission.alertaApoyo || commission.estado === 'apoyo_requerido';
  const modeLabel = commission.modalidad === 'lacustre' ? 'Vía Lacustre' : 'Vía Terrestre';
  const mapsLink = `https://maps.google.com/?q=${commission.lat.toFixed(6)},${commission.lng.toFixed(6)}`;
  const weaponsList = commission.armamento
    .map((w) => `- ${w.tipo} (Serial: ${w.serial})`)
    .join('\n');

  const unitHierarchy = [commission.destacamento, commission.compania, commission.puesto]
    .filter(Boolean)
    .join(' · ');

  const lines = [
    isSos
      ? `ALERTA DE APOYO (SOS) — CZGNB-23 TRUJILLO`
      : `PARTE OPERATIVO — CZGNB-23 TRUJILLO`,
    `Comisión: ${commission.codigo} · ${commission.nombre}`,
    ...(unitHierarchy ? [`Unidad Orgánica: ${unitHierarchy}`] : []),
    `Modalidad: ${modeLabel} | Estado: ${COMMISSION_STATUS_LABELS[commission.estado]}`,
    `Jefe: ${commission.jefeGrado} ${commission.jefeNombre} (${commission.jefeTelefono})`,
    `Efectivos: ${commission.efectivos.length} militares`,
    `Unidad: ${commission.vehiculoTipo} (${commission.vehiculoPlaca})`,
    `Sector: ${commission.sector}`,
    `Coordenadas: ${formatCoords(commission.lat, commission.lng)}`,
    `Ubicación Mapa: ${mapsLink}`,
  ];

  if (isSos && commission.motivoAlerta) {
    lines.push(`Motivo SOS: ${commission.motivoAlerta}`);
  }

  lines.push(`Armamento:\n${weaponsList}`);
  lines.push(`Consola CZGNB-23 Trujillo: ${overrideUrl || getShareableAppUrl()}`);

  return lines.join('\n');
}

async function copyTextReliably(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea copy fallback
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

interface ShareModalProps {
  title: string;
  subtitle?: string;
  shareText: string;
  shareUrl?: string;
  canEditShareLink?: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  title,
  subtitle,
  shareText,
  shareUrl,
  canEditShareLink = false,
  onClose,
}) => {
  const initialUrl = shareUrl || getShareableAppUrl();
  const [activeUrl, setActiveUrl] = useState<string>(initialUrl);
  const [editingUrl, setEditingUrl] = useState(false);
  const [draftUrl, setDraftUrl] = useState<string>(initialUrl);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [hasCustomUrl, setHasCustomUrl] = useState<boolean>(() => Boolean(getSavedCustomShareUrl()));

  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [nativeStatus, setNativeStatus] = useState<string | null>(null);

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const effectiveShareText = useMemo(() => {
    if (activeUrl === initialUrl) return shareText;
    if (initialUrl && shareText.includes(initialUrl)) {
      return shareText.split(initialUrl).join(activeUrl);
    }
    return `${shareText}\n${activeUrl}`;
  }, [activeUrl, initialUrl, shareText]);

  const previewWarning = isPreviewHostUrl(activeUrl);
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(effectiveShareText)}`;

  const handleSaveCustomUrl = () => {
    const normalized = normalizeUrl(draftUrl);
    if (!normalized) {
      setUrlError('Ingresa un enlace válido que comience con https://');
      return;
    }
    saveCustomShareUrl(normalized);
    setActiveUrl(normalized);
    setDraftUrl(normalized);
    setHasCustomUrl(true);
    setEditingUrl(false);
    setUrlError(null);
    setNativeStatus('Enlace público guardado para compartir.');
  };

  const handleResetCustomUrl = () => {
    saveCustomShareUrl('');
    const nextUrl = getShareableAppUrl();
    setActiveUrl(nextUrl);
    setDraftUrl(nextUrl);
    setHasCustomUrl(false);
    setEditingUrl(false);
    setUrlError(null);
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      const textAlreadyHasUrl = effectiveShareText.includes(activeUrl);
      await navigator.share(
        textAlreadyHasUrl
          ? { title, text: effectiveShareText }
          : { title, text: effectiveShareText, url: activeUrl }
      );
      setNativeStatus('Compartido correctamente.');
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setNativeStatus('Usa WhatsApp o Copiar enlace si el navegador bloqueó el panel nativo.');
      }
    }
  };

  const handleCopyText = async () => {
    await copyTextReliably(effectiveShareText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCopyLink = async () => {
    await copyTextReliably(activeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92vh] bg-[#111822] border border-slate-700 rounded-lg overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Share2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display text-xl font-bold text-white truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white cursor-pointer shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto">
          {/* Active shareable link bar with admin-only edit option */}
          <div className="bg-[#0B1117] border border-slate-800 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Link2 className="w-3.5 h-3.5 text-sky-400" />
                Enlace a compartir (Modo Usuario)
              </span>
              {canEditShareLink && (
                <div className="flex items-center gap-1.5">
                  {hasCustomUrl && !editingUrl && (
                    <button
                      type="button"
                      onClick={handleResetCustomUrl}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded cursor-pointer"
                      title="Restablecer enlace automático"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Automático
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUrl((v) => !v);
                      setDraftUrl(activeUrl);
                      setUrlError(null);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-sky-300 hover:text-sky-200 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-500/30 rounded cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    {editingUrl ? 'Cancelar' : 'Cambiar enlace'}
                  </button>
                </div>
              )}
            </div>

            {canEditShareLink && editingUrl ? (
              <div className="space-y-2">
                <input
                  type="url"
                  value={draftUrl}
                  onChange={(e) => {
                    setDraftUrl(e.target.value);
                    setUrlError(null);
                  }}
                  placeholder="https://tu-enlace-publicado.run.app/"
                  className="w-full px-2.5 py-2 text-xs font-mono-tabular bg-[#111822] border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {urlError && <p className="text-[11px] text-red-400">{urlError}</p>}
                <button
                  type="button"
                  onClick={handleSaveCustomUrl}
                  className="w-full py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded cursor-pointer"
                >
                  Guardar enlace público
                </button>
              </div>
            ) : (
              <p className="text-[11px] font-mono-tabular text-emerald-300 break-all select-all">
                {activeUrl}
              </p>
            )}
          </div>

          {canEditShareLink && (
            <div className="bg-emerald-950/40 border border-emerald-500/35 rounded-md p-2.5 flex items-start gap-2 text-[11px] text-emerald-100 leading-relaxed">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Acceso compartido en Modo Usuario:</strong> quienes ingresen con este enlace entrarán sin privilegios para modificar la estructura de la app ni ver el panel de usuarios. Puedes cambiar el privilegio de cada usuario en <strong>Usuarios y Privilegios</strong>.
              </span>
            </div>
          )}

          {canEditShareLink && previewWarning && (
            <div className="bg-amber-950/50 border border-amber-500/40 rounded-md p-2.5 flex items-start gap-2 text-[11px] text-amber-100 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Aviso de acceso externo:</strong> este es un enlace de vista previa. Para que otros usuarios puedan abrir la app directamente en su teléfono sin ser redirigidos, publica o despliega la app primero y pega la dirección definitiva en <strong>Cambiar enlace</strong>.
              </span>
            </div>
          )}

          <div className="bg-[#0B1117] border border-slate-800 rounded-md p-3 max-h-36 overflow-y-auto">
            <pre className="text-[11px] text-slate-300 font-mono-tabular whitespace-pre-wrap break-words leading-relaxed">
              {effectiveShareText}
            </pre>
          </div>

          <div className="bg-sky-950/40 border border-sky-500/30 rounded-md p-2.5 flex items-start gap-2 text-[11px] text-sky-200 leading-relaxed">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span>
              <strong>Recomendación móvil:</strong> indica a la otra persona que abra el enlace en <strong>Chrome (Android)</strong> o <strong>Safari (iPhone)</strong>, fuera del navegador interno de WhatsApp, para iniciar sesión con Google sin bloqueos.
            </span>
          </div>

          {nativeStatus && (
            <p className="text-xs text-emerald-300">{nativeStatus}</p>
          )}

          <div className="space-y-2">
            {canNativeShare && (
              <button
                type="button"
                onClick={() => void handleNativeShare()}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Compartir desde el dispositivo
              </button>
            )}

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-[#1B4332] hover:bg-[#235640] border border-emerald-500/40 text-emerald-100 rounded-md transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-300" />
              Enviar por WhatsApp
            </a>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleCopyText()}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#192332] hover:bg-[#243247] text-slate-100 rounded-md transition-colors cursor-pointer"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Texto copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar texto
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#192332] hover:bg-[#243247] text-slate-100 rounded-md transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Enlace copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar enlace
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ShareAppButtonProps {
  compact?: boolean;
  canEditShareLink?: boolean;
}

export const ShareAppButton: React.FC<ShareAppButtonProps> = ({
  compact = false,
  canEditShareLink = false,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? 'inline-flex items-center justify-center gap-1.5 px-2.5 min-h-[36px] text-xs font-semibold text-slate-200 bg-[#192332] hover:bg-[#233247] border border-slate-700/80 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            : 'w-full inline-flex items-center justify-center gap-2 px-3.5 min-h-[44px] text-xs font-semibold text-slate-100 bg-[#192332] hover:bg-[#233247] border border-slate-700/80 rounded-md transition-colors whitespace-nowrap cursor-pointer'
        }
        title="Compartir enlace de la aplicación"
      >
        <Share2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span>Compartir</span>
      </button>

      {open && (
        <ShareModal
          title="Compartir Aplicación CZGNB-23 Trujillo"
          subtitle="Acceso en Modo Usuario · Compatible con Android y iPhone"
          shareText={formatAppShareText()}
          shareUrl={getShareableAppUrl()}
          canEditShareLink={canEditShareLink}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import {
  Anchor,
  Check,
  Compass,
  Copy,
  LogIn,
  MapPin,
  Radio,
  Shield,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { ShareAppButton, getShareableAppUrl } from './ShareModal';

function detectIosInAppBrowser(): { isIOS: boolean; isInApp: boolean; isIframe: boolean } {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isIOS: false, isInApp: false, isIframe: false };
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isIframe = window.self !== window.top;
  const knownInApp = /WhatsApp|FBAN|FBAV|Instagram|Line|MicroMessenger|Twitter|LinkedInApp/i.test(ua);
  // iOS WKWebView inside WhatsApp/other apps often omits "Safari/" while not being standalone PWA
  const isStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  const isIosWebView = isIOS && !isStandalone && !/Safari\//i.test(ua) && !/CriOS|FxiOS/i.test(ua);

  return {
    isIOS,
    isInApp: knownInApp || isIosWebView,
    isIframe,
  };
}

export const AuthGate: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRedirectFallback, setShowRedirectFallback] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const env = useMemo(() => detectIosInAppBrowser(), []);

  // Complete any redirect-based Google sign-in on iOS Safari
  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      if (err instanceof Error && err.message) {
        setError(err.message);
      }
    });
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';

      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/cancelled-popup-request' ||
        (env.isIOS && code === 'auth/popup-closed-by-user')
      ) {
        if (!env.isIframe && !env.isInApp) {
          // On iPhone Safari / standalone PWA, smoothly fall back to redirect sign-in
          try {
            await signInWithRedirect(auth, googleProvider);
            return;
          } catch (redirErr) {
            setError(
              redirErr instanceof Error
                ? redirErr.message
                : 'Safari bloqueó la ventana emergente. Permite ventanas emergentes o ábrelo en Safari.'
            );
          }
        } else {
          setShowRedirectFallback(!env.isIframe);
          setError(
            'El navegador bloqueó la ventana de Google. En iPhone, abre el enlace en Safari y vuelve a intentar.'
          );
        }
      } else {
        const msg =
          err instanceof Error ? err.message : 'No se pudo completar el inicio de sesión.';
        setError(msg);
      }
      setLoading(false);
    }
  };

  const handleRedirectSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo iniciar sesión por redirección.'
      );
      setLoading(false);
    }
  };

  const handleCopyForSafari = () => {
    const url = getShareableAppUrl();
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0B1117] text-[#F1F5F9] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 border border-slate-800 rounded-lg overflow-hidden bg-[#111822]">
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
          <div className="space-y-4">
            <div className="flex items-center gap-3.5">
              <img
                src="/assets/aistudio/ESCUDO_DCR23-1_11250c43.png"
                alt="Escudo Comando de Zona Nro. 23 GNB Trujillo"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0 drop-shadow"
              />
              <div>
                <p className="text-xs font-mono-tabular text-emerald-400 tracking-wider">
                  COMANDO DE ZONA NRO. 23 GNB · ESTADO TRUJILLO
                </p>
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white leading-[1.05] mt-1">
                  Sala Situacional y Control Operativo CZGNB-23
                </h1>
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
              Consola de mando estadal en tiempo real para los 3 Destacamentos del Estado Trujillo
              (<strong className="text-white">D-231</strong>, <strong className="text-white">DCR 23-1</strong> y{' '}
              <strong className="text-white">DESUR-23</strong>), sus 10 Compañías y 29 Puestos / PACs en tierra y costa lacustre.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/90 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-100 font-semibold">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                3 Destacamentos
              </div>
              <p className="text-slate-400">
                Despliegue orgánico completo: D-231 (Trujillo), DCR 23-1 (La Ceiba) y DESUR-23 (Valera).
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-100 font-semibold">
                <Anchor className="w-4 h-4 text-sky-400 shrink-0" />
                Tierra, Sierra y Lago
              </div>
              <p className="text-slate-400">
                Cobertura de los 20 municipios, Cuadrantes de Paz, troncales viales y eje lacustre.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-100 font-semibold">
                <Radio className="w-4 h-4 text-amber-400 shrink-0" />
                Apoyo e Inteligencia
              </div>
              <p className="text-slate-400">
                Alertas SOS, GEDOs compartidos y enlace directo con PNB, CICPC, CONAS y CPET.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-[#0E151E] space-y-5">
          <div className="space-y-2">
            <div className="w-11 h-11 rounded-md bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white">
              Acceso de Puesto de Comando
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Inicia sesión con tu cuenta autorizada de Google para sincronizar unidades del CZGNB-23, comisiones, mapa de criminalidad y alertas de apoyo en la base de datos segura.
            </p>
          </div>

          {env.isInApp && (
            <div className="p-3 rounded-md bg-amber-950/60 border border-amber-500/40 text-xs text-amber-100 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <Compass className="w-4 h-4 shrink-0" />
                Abrir en Safari (iPhone)
              </div>
              <p className="leading-relaxed">
                Google bloquea el inicio de sesión dentro del navegador de WhatsApp. Toca el ícono de <strong>Safari</strong> abajo a la derecha o copia el enlace y pégalo en Safari.
              </p>
              <button
                type="button"
                onClick={handleCopyForSafari}
                className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-md cursor-pointer"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Enlace copiado — Pégalo en Safari
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar enlace para abrir en Safari
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-red-950/60 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSignIn()}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Verificando credenciales...' : 'Ingresar con Google'}
            </button>

            {(showRedirectFallback || (env.isIOS && !env.isIframe && !env.isInApp)) && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleRedirectSignIn()}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md bg-[#192332] hover:bg-[#243247] border border-slate-700 text-slate-200 transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4 text-sky-400" />
                Acceso directo Safari (si no abre ventana)
              </button>
            )}

            <ShareAppButton />
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Al ingresar, tus registros de comisiones, seriales de armamento y teléfonos de jefes de comisión permanecen aislados y protegidos bajo tu sesión verificada.
          </p>
        </div>
      </div>
    </div>
  );
};

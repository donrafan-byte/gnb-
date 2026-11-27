import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Car,
  CheckCheck,
  Flame,
  Leaf,
  MapPin,
  Megaphone,
  Send,
  ShieldAlert,
  Skull,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  isIOSBrowserNotStandalone,
  type OperationalAlertItem,
  type PushNotificationPrefs,
  type PushPermissionState,
} from '../lib/pushNotifications';

interface NotificationCenterProps {
  permission: PushPermissionState;
  prefs: PushNotificationPrefs;
  alerts: OperationalAlertItem[];
  onRequestPermission: () => Promise<void>;
  onUpdatePrefs: (patch: Partial<PushNotificationPrefs>) => void;
  onSendTestAlert: () => void;
  onLocateAlert: (alert: OperationalAlertItem) => void;
  onOpenAccessControl?: () => void;
  onMarkAllRead: () => void;
  onClearAlerts: () => void;
}

function formatAlertTime(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return 'Ahora';
  }
}

export const NotificationBellMenu: React.FC<NotificationCenterProps> = ({
  permission,
  prefs,
  alerts,
  onRequestPermission,
  onUpdatePrefs,
  onSendTestAlert,
  onLocateAlert,
  onOpenAccessControl,
  onMarkAllRead,
  onClearAlerts,
}) => {
  const [open, setOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = alerts.filter((a) => !a.read).length;
  const iosNeedsInstall = isIOSBrowserNotStandalone();

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleEnablePush = async () => {
    setRequesting(true);
    try {
      await onRequestPermission();
    } finally {
      setRequesting(false);
    }
  };

  const pushActive = permission === 'granted' && prefs.enabled;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Centro de Notificaciones Push"
        title={
          pushActive
            ? 'Notificaciones Push Activas'
            : permission === 'denied'
              ? 'Notificaciones bloqueadas en el navegador'
              : 'Activar notificaciones push de novedades y apoyo'
        }
        className={`relative inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-md border text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
          unreadCount > 0
            ? 'bg-red-950/80 border-red-500/70 text-red-100 hover:bg-red-900/80'
            : pushActive
              ? 'bg-[#162231] border-emerald-500/40 text-emerald-200 hover:bg-[#1E2E42]'
              : 'bg-[#162231] border-slate-700 text-slate-300 hover:text-white hover:bg-[#1E2E42]'
        }`}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-4 h-4 text-red-300" />
        ) : pushActive ? (
          <Bell className="w-4 h-4 text-emerald-400" />
        ) : (
          <BellOff className="w-4 h-4 text-slate-400" />
        )}
        <span className="hidden xl:inline">Alertas</span>
        {unreadCount > 0 && (
          <span className="font-mono-tabular min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold inline-flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-11 w-[calc(100vw-1rem)] sm:w-[390px] max-h-[82dvh] bg-[#111822] border border-slate-700 rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-[#0E151E] border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <BellRing className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-white leading-tight truncate">
                  Alertas Push en Tiempo Real
                </h2>
                <p className="text-[11px] text-slate-400 truncate">
                  Novedades y solicitudes de apoyo CZGNB-23 Trujillo
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
              aria-label="Cerrar notificaciones"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* System Push Permission & Controls */}
          <div className="p-3.5 border-b border-slate-800 space-y-3 bg-[#0B1117]/60 shrink-0">
            {permission === 'default' && (
              <div className="bg-emerald-950/35 border border-emerald-500/40 rounded-md p-3 space-y-2">
                <div className="text-xs font-semibold text-emerald-200">
                  Activa las notificaciones push del dispositivo
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Recibe avisos inmediatos del sistema cuando se registre una nueva novedad o una comisión solicite apoyo (SOS), incluso en segundo plano.
                </p>
                <button
                  type="button"
                  disabled={requesting}
                  onClick={() => void handleEnablePush()}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md cursor-pointer"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  {requesting ? 'Solicitando permiso...' : 'Permitir Notificaciones Push'}
                </button>
              </div>
            )}

            {permission === 'granted' && (
              <div className="flex items-center justify-between gap-2 bg-[#111822] border border-slate-800 rounded-md px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-emerald-300">
                    {prefs.enabled ? 'Push del sistema activado' : 'Push del sistema en pausa'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Permiso concedido en este equipo
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={onSendTestAlert}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-[#192332] hover:bg-[#233247] text-slate-200 rounded cursor-pointer"
                    title="Enviar una notificación de prueba"
                  >
                    <Send className="w-3 h-3 text-sky-400" />
                    Probar
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdatePrefs({ enabled: !prefs.enabled })}
                    className={`px-2.5 py-1.5 text-[11px] font-semibold rounded cursor-pointer ${
                      prefs.enabled
                        ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {prefs.enabled ? 'Activo' : 'Activar'}
                  </button>
                </div>
              </div>
            )}

            {permission === 'denied' && (
              <div className="bg-amber-950/35 border border-amber-500/40 rounded-md p-2.5 text-[11px] text-amber-200 space-y-1">
                <div className="font-semibold">Notificaciones bloqueadas por el navegador</div>
                <p className="text-slate-300">
                  Habilítalas en el candado o ajustes del navegador para este sitio. Mientras tanto, las alertas en pantalla y el sonido siguen activos.
                </p>
              </div>
            )}

            {permission === 'unsupported' && (
              <div className="bg-[#111822] border border-slate-800 rounded-md p-2.5 text-[11px] text-slate-300 space-y-1">
                <div className="font-semibold text-slate-200">
                  Alertas en pantalla activas
                </div>
                <p className="text-slate-400">
                  {iosNeedsInstall
                    ? 'En iPhone/iPad, agrega la app a la Pantalla de Inicio desde Safari para habilitar notificaciones push del sistema.'
                    : 'Este navegador no soporta Web Notifications nativas; seguirás recibiendo alertas instantáneas dentro de la app.'}
                </p>
              </div>
            )}

            {/* Alert Type Toggles */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onUpdatePrefs({ notifySupport: !prefs.notifySupport })}
                className={`px-2 py-1.5 rounded border text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  prefs.notifySupport
                    ? 'bg-red-950/50 border-red-500/60 text-red-200'
                    : 'bg-[#111822] border-slate-800 text-slate-500'
                }`}
              >
                <AlertTriangle className="w-3 h-3 shrink-0" />
                Apoyo SOS
              </button>
              <button
                type="button"
                onClick={() => onUpdatePrefs({ notifyIncidents: !prefs.notifyIncidents })}
                className={`px-2 py-1.5 rounded border text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  prefs.notifyIncidents
                    ? 'bg-amber-950/50 border-amber-500/60 text-amber-200'
                    : 'bg-[#111822] border-slate-800 text-slate-500'
                }`}
              >
                <Flame className="w-3 h-3 shrink-0" />
                Novedades
              </button>
              <button
                type="button"
                onClick={() => onUpdatePrefs({ soundEnabled: !prefs.soundEnabled })}
                className={`px-2 py-1.5 rounded border text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  prefs.soundEnabled
                    ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200'
                    : 'bg-[#111822] border-slate-800 text-slate-500'
                }`}
              >
                {prefs.soundEnabled ? (
                  <Volume2 className="w-3 h-3 shrink-0" />
                ) : (
                  <VolumeX className="w-3 h-3 shrink-0" />
                )}
                Sonido
              </button>
            </div>
          </div>

          {/* Alerts History List */}
          <div className="px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] bg-[#0E151E] shrink-0">
            <span className="text-slate-400 font-semibold">
              Alertas recibidas ({alerts.length})
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Leídas
                </button>
              )}
              {alerts.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAlerts}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-red-400 cursor-pointer"
                  title="Limpiar historial de alertas"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/80 max-h-72">
            {alerts.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <Bell className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Sin alertas nuevas en esta sesión.
                </p>
                <button
                  type="button"
                  onClick={onSendTestAlert}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-[#192332] hover:bg-[#233247] text-slate-200 rounded cursor-pointer"
                >
                  <Send className="w-3 h-3 text-emerald-400" />
                  Enviar Alerta de Prueba
                </button>
              </div>
            ) : (
              alerts.map((item) => {
                const isSupport = item.kind === 'support';
                const isEnv = item.kind === 'environmental';
                const isTraffic = item.kind === 'traffic';
                const isHomicide = item.kind === 'homicide';
                const isPublicOrder = item.kind === 'public_order';
                const isAccess = item.kind === 'access_request';
                return (
                  <div
                    key={item.id}
                    className={`p-3 space-y-1.5 transition-colors ${
                      !item.read ? 'bg-[#16202D]/80' : 'bg-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isSupport ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        ) : isHomicide ? (
                          <Skull className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : isPublicOrder ? (
                          <Megaphone className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                        ) : isTraffic ? (
                          <Car className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        ) : isAccess ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : isEnv ? (
                          <Leaf className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                        ) : (
                          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span
                          className={`text-xs font-bold truncate ${
                            isSupport || isHomicide
                              ? 'text-red-300'
                              : isPublicOrder
                                ? 'text-fuchsia-300'
                                : isTraffic
                                  ? 'text-sky-300'
                                  : isAccess
                                    ? 'text-amber-300'
                                    : isEnv
                                      ? 'text-lime-300'
                                      : 'text-amber-200'
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>
                      <span className="font-mono-tabular text-[10px] text-slate-500 shrink-0">
                        {formatAlertTime(item.timestampMs)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">{item.body}</p>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[10px] text-slate-500 truncate">{item.sector}</span>
                      {isAccess && onOpenAccessControl ? (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenAccessControl();
                            setOpen(false);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer shrink-0"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          Autorizar / Expulsar
                        </button>
                      ) : typeof item.lat === 'number' && typeof item.lng === 'number' ? (
                        <button
                          type="button"
                          onClick={() => {
                            onLocateAlert(item);
                            setOpen(false);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-[#1B2838] hover:bg-[#24354A] text-emerald-300 rounded cursor-pointer shrink-0"
                        >
                          <MapPin className="w-3 h-3" />
                          Ver en Mapa
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface LiveAlertToastStackProps {
  toasts: OperationalAlertItem[];
  onDismiss: (id: string) => void;
  onLocate: (alert: OperationalAlertItem) => void;
  onOpenAccessControl?: () => void;
}

export const LiveAlertToastStack: React.FC<LiveAlertToastStackProps> = ({
  toasts,
  onDismiss,
  onLocate,
  onOpenAccessControl,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed top-16 right-3 z-50 w-[calc(100vw-1.5rem)] max-w-sm space-y-2 pointer-events-none"
    >
      {toasts.map((item) => {
        const isSupport = item.kind === 'support';
        const isEnv = item.kind === 'environmental';
        const isTraffic = item.kind === 'traffic';
        const isHomicide = item.kind === 'homicide';
        const isPublicOrder = item.kind === 'public_order';
        const isAccess = item.kind === 'access_request';
        return (
          <div
            key={item.id}
            className={`pointer-events-auto rounded-lg border p-3.5 shadow-2xl backdrop-blur-md space-y-2 ${
              isSupport || isHomicide
                ? 'bg-red-950/95 border-red-500 text-red-50'
                : isPublicOrder
                  ? 'bg-fuchsia-950/95 border-fuchsia-400 text-fuchsia-50'
                  : isTraffic
                    ? 'bg-sky-950/95 border-sky-400/85 text-sky-50'
                    : isAccess
                      ? 'bg-amber-950/95 border-amber-500 text-amber-50'
                      : isEnv
                        ? 'bg-emerald-950/95 border-lime-500/80 text-lime-50'
                        : 'bg-[#111822]/95 border-amber-500/80 text-slate-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {isSupport ? (
                  <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
                ) : isHomicide ? (
                  <Skull className="w-4 h-4 text-rose-300 shrink-0" />
                ) : isPublicOrder ? (
                  <Megaphone className="w-4 h-4 text-fuchsia-300 shrink-0" />
                ) : isTraffic ? (
                  <Car className="w-4 h-4 text-sky-300 shrink-0" />
                ) : isAccess ? (
                  <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
                ) : isEnv ? (
                  <Leaf className="w-4 h-4 text-lime-400 shrink-0" />
                ) : (
                  <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">
                    {isSupport
                      ? 'Alerta Push · Apoyo Requerido (SOS)'
                      : isHomicide
                        ? 'Alerta Crítica · Homicidio / Hecho Violento'
                        : isPublicOrder
                          ? 'Alerta Orden Público · Manifestación / Cierre de Vía'
                          : isTraffic
                            ? 'Alerta Seguridad Vial · Accidente de Tránsito'
                            : isAccess
                              ? 'Alerta de Seguridad · Solicitud de Acceso'
                              : isEnv
                                ? 'Alerta Push · Delito Ambiental'
                                : item.kind === 'test'
                                  ? 'Alerta Push · Prueba del Sistema'
                                  : 'Alerta Push · Nueva Novedad'}
                  </div>
                  <div className="text-xs font-bold truncate">{item.title}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(item.id)}
                className="p-0.5 opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                aria-label="Descartar alerta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs opacity-90 leading-snug">{item.body}</p>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] opacity-75 truncate">{item.sector}</span>
              {isAccess && onOpenAccessControl ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenAccessControl();
                    onDismiss(item.id);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer shrink-0 bg-white text-amber-950 hover:bg-amber-100"
                >
                  <ShieldAlert className="w-3 h-3" />
                  Gestionar Acceso
                </button>
              ) : typeof item.lat === 'number' && typeof item.lng === 'number' ? (
                <button
                  type="button"
                  onClick={() => {
                    onLocate(item);
                    onDismiss(item.id);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer shrink-0 ${
                    isSupport
                      ? 'bg-white text-red-900 hover:bg-red-100'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  Ubicar en Mapa
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

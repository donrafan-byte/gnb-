import React from 'react';
import { AlertTriangle, CheckCircle2, MapPin, Phone, Share2, Volume2, VolumeX } from 'lucide-react';
import type { Commission, FriendlyForce } from '../types/operations';
import { AGENCY_SHORT_LABELS, AGENCY_STYLES } from '../types/operations';
import { distanceKm, estimateResponseMinutes, sanitizePhoneForTel } from '../lib/geo';

interface EmergencyBannerProps {
  alertCommissions: Commission[];
  allCommissions: Commission[];
  friendlyForces: FriendlyForce[];
  canOperate?: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLocate: (commission: Commission) => void;
  onResolveAlert: (commission: Commission) => void;
  onShareAlert: (commission: Commission) => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({
  alertCommissions,
  allCommissions,
  friendlyForces,
  canOperate = true,
  muted,
  onToggleMute,
  onLocate,
  onResolveAlert,
  onShareAlert,
}) => {
  if (alertCommissions.length === 0) return null;

  return (
    <div
      role="alert"
      className="bg-red-950/95 border-b border-red-500/70 px-4 py-2.5 text-red-50 z-40"
    >
      <div className="max-w-[1600px] mx-auto space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-red-200">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              ALERTA DE APOYO ACTIVA ({alertCommissions.length}{' '}
              {alertCommissions.length === 1 ? 'COMISIÓN REQUIERE REFUERZO' : 'COMISIONES REQUIEREN REFUERZO'})
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-red-900/80 hover:bg-red-800 border border-red-400/30 rounded text-red-100 cursor-pointer whitespace-nowrap shrink-0"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            {muted ? 'Sonido silenciado' : 'Silenciar alerta'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {alertCommissions.map((comm) => {
            const nearestFriendly = friendlyForces
              .filter((f) => f.disponible)
              .map((f) => ({
                force: f,
                dist: distanceKm({ lat: comm.lat, lng: comm.lng }, { lat: f.lat, lng: f.lng }),
              }))
              .sort((a, b) => a.dist - b.dist)[0];

            const nearestPeer = allCommissions
              .filter((c) => c.id !== comm.id && c.estado !== 'finalizada')
              .map((c) => ({
                comm: c,
                dist: distanceKm({ lat: comm.lat, lng: comm.lng }, { lat: c.lat, lng: c.lng }),
              }))
              .sort((a, b) => a.dist - b.dist)[0];

            return (
              <div
                key={comm.id}
                className="bg-red-900/50 border border-red-400/40 rounded-md px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs font-bold text-white truncate">
                    {comm.codigo} · {comm.jefeGrado} {comm.jefeNombre} · {comm.sector}
                  </div>
                  <div className="text-[11px] text-red-100/90 truncate">
                    Motivo: {comm.motivoAlerta || 'Solicitud inmediata de refuerzo táctico'}
                  </div>
                  <div className="text-[11px] text-red-200/85 font-mono-tabular">
                    {nearestFriendly && (
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        <span>Apoyo cercano:</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            AGENCY_STYLES[nearestFriendly.force.organismo].badge
                          }`}
                        >
                          {AGENCY_SHORT_LABELS[nearestFriendly.force.organismo]}
                        </span>
                        <span>
                          ({nearestFriendly.dist.toFixed(1)} km · ~
                          {estimateResponseMinutes(nearestFriendly.dist)} min)
                        </span>
                      </span>
                    )}
                    {nearestFriendly && nearestPeer && <span> / </span>}
                    {nearestPeer && (
                      <span>
                        {nearestPeer.comm.codigo} ({nearestPeer.dist.toFixed(1)} km)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <a
                    href={`tel:${sanitizePhoneForTel(comm.jefeTelefono)}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-white text-red-950 hover:bg-red-50 rounded transition-colors whitespace-nowrap"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Llamar Jefe
                  </a>
                  <button
                    type="button"
                    onClick={() => onLocate(comm)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-red-800 hover:bg-red-700 text-white border border-red-400/40 rounded transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Ubicar
                  </button>
                  <button
                    type="button"
                    onClick={() => onShareAlert(comm)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-red-950 hover:bg-red-800 text-red-100 border border-red-400/40 rounded transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Compartir SOS
                  </button>
                  {canOperate && (
                    <button
                      type="button"
                      onClick={() => onResolveAlert(comm)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Apoyo Resuelto
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

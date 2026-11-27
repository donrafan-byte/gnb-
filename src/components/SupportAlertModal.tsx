import React, { useState } from 'react';
import { AlertTriangle, Phone, Shield, X } from 'lucide-react';
import {
  AGENCY_SHORT_LABELS,
  AGENCY_STYLES,
  type Commission,
  type FriendlyForce,
} from '../types/operations';
import { distanceKm, estimateResponseMinutes, sanitizePhoneForTel } from '../lib/geo';

interface SupportAlertModalProps {
  commission: Commission;
  friendlyForces: FriendlyForce[];
  onClose: () => void;
  onConfirm: (activate: boolean, motivo: string) => Promise<void>;
}

const QUICK_REASONS = [
  'Enfrentamiento armado / Detonaciones en el sector',
  'Superioridad numérica de grupo delictivo',
  'Falla mecánica / Embarcación a la deriva en zona de riesgo',
  'Persecución en caliente hacia Troncal 001 / Lago',
  'Cierre perimetral y apoyo interinstitucional requerido',
];

export const SupportAlertModal: React.FC<SupportAlertModalProps> = ({
  commission,
  friendlyForces,
  onClose,
  onConfirm,
}) => {
  const isCurrentlyActive = commission.alertaApoyo;
  const [motivo, setMotivo] = useState(
    commission.motivoAlerta || QUICK_REASONS[0]
  );
  const [submitting, setSubmitting] = useState(false);

  const nearestForces = friendlyForces
    .filter((f) => f.disponible)
    .map((f) => ({
      force: f,
      dist: distanceKm({ lat: commission.lat, lng: commission.lng }, { lat: f.lat, lng: f.lng }),
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirm(!isCurrentlyActive, isCurrentlyActive ? '' : motivo.trim().slice(0, 300));
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#111822] border border-slate-700 rounded-lg max-w-lg w-full overflow-hidden shadow-2xl">
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isCurrentlyActive
              ? 'bg-emerald-950/50 border-emerald-500/30'
              : 'bg-red-950/60 border-red-500/40'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle
              className={`w-5 h-5 ${isCurrentlyActive ? 'text-emerald-400' : 'text-red-400'}`}
            />
            <h2 className="font-display text-xl font-bold text-white">
              {isCurrentlyActive
                ? `Desactivar Alerta de Apoyo — ${commission.codigo}`
                : `Activar Solicitud de Apoyo — ${commission.codigo}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs text-slate-300 space-y-1">
            <div>
              <span className="text-slate-400">Jefe de Comisión:</span>{' '}
              <span className="font-semibold text-white">
                {commission.jefeGrado} {commission.jefeNombre}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Sector actual:</span>{' '}
              <span className="text-slate-100">{commission.sector}</span>
            </div>
          </div>

          {!isCurrentlyActive ? (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-200">
                  Motivo de la solicitud de apoyo táctico
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setMotivo(reason)}
                      className={`text-[11px] px-2.5 py-1 rounded border text-left transition-colors cursor-pointer ${
                        motivo === reason
                          ? 'bg-red-900/70 border-red-400 text-white'
                          : 'bg-[#0B1117] border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={300}
                  rows={3}
                  required
                  placeholder="Describe la situación táctica y el tipo de refuerzo requerido..."
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              {nearestForces.length > 0 && (
                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-sky-400" />
                    Fuerzas amigas más cercanas disponibles para despacho
                  </div>
                  <div className="space-y-1.5">
                    {nearestForces.map(({ force, dist }) => {
                      const style = AGENCY_STYLES[force.organismo];
                      return (
                        <div
                          key={force.id}
                          className={`flex items-center justify-between gap-2 bg-[#0B1117] border rounded px-3 py-2 text-xs ${style.cardBorder}`}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`px-1.5 py-0.5 text-[10px] font-bold rounded shrink-0 ${style.badge}`}
                              >
                                {AGENCY_SHORT_LABELS[force.organismo]}
                              </span>
                              <span className="font-semibold text-slate-100 truncate">
                                {force.nombre}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono-tabular">
                              {dist.toFixed(1)} km · ~{estimateResponseMinutes(dist)} min ·{' '}
                              {force.frecuenciaRadio}
                            </div>
                          </div>
                          <a
                            href={`tel:${sanitizePhoneForTel(force.telefono)}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 font-semibold rounded text-[11px] shrink-0 transition-colors ${style.callButton}`}
                          >
                            <Phone className="w-3 h-3" />
                            Llamar
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-300 leading-relaxed">
              ¿Confirmas que el apoyo ha sido atendido y la comisión <strong className="text-white">{commission.codigo}</strong> retorna a estado operativo normal?
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#192332] rounded-md cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
                isCurrentlyActive
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-red-600 hover:bg-red-500'
              }`}
            >
              {submitting
                ? 'Actualizando...'
                : isCurrentlyActive
                  ? 'Confirmar Apoyo Resuelto'
                  : 'Activar Alerta de Apoyo Ahora'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

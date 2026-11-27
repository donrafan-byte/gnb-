import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Megaphone,
  Users,
  Wrench,
} from 'lucide-react';
import {
  INCIDENT_TYPE_LABELS,
  ROAD_ACCESS_STATUS_LABELS,
  type Incident,
} from '../types/operations';

interface PublicOrderAlertBannerProps {
  activeAlerts: Incident[];
  canOperate?: boolean;
  onLocate: (incident: Incident) => void;
  onMarkRoadCleared: (incident: Incident) => Promise<void>;
}

export const PublicOrderAlertBanner: React.FC<PublicOrderAlertBannerProps> = ({
  activeAlerts,
  canOperate = true,
  onLocate,
  onMarkRoadCleared,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (activeAlerts.length === 0) return null;

  const closedRoadCount = activeAlerts.filter(
    (inc) => inc.pasoHabilitado === 'cerrado_total' || inc.tipo === 'cierre_via_servicios' || inc.tipo === 'cierre_via_gremial'
  ).length;

  const primary = activeAlerts[0];

  return (
    <div
      role="status"
      className="bg-fuchsia-950/90 border-b border-fuchsia-500/60 text-fuchsia-50 px-3 sm:px-4 py-2 shrink-0"
    >
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 rounded bg-fuchsia-600/35 border border-fuchsia-400/50 shrink-0">
            <Megaphone className="w-4 h-4 text-fuchsia-200" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-fuchsia-200">
                Alerta Orden Público · {activeAlerts.length}{' '}
                {activeAlerts.length === 1 ? 'Evento Activo' : 'Eventos Activos'}
              </span>
              {closedRoadCount > 0 && (
                <span className="font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">
                  {closedRoadCount} {closedRoadCount === 1 ? 'VÍA CERRADA' : 'VÍAS CERRADAS'}
                </span>
              )}
              {primary.pasoHabilitado && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-fuchsia-900/90 border border-fuchsia-400/50 text-fuchsia-100">
                  {ROAD_ACCESS_STATUS_LABELS[primary.pasoHabilitado]}
                </span>
              )}
            </div>
            <div className="text-xs text-fuchsia-100/95 truncate mt-0.5">
              <strong className="text-white">{primary.titulo}</strong>
              {primary.viaAfectada ? ` · ${primary.viaAfectada}` : ` · ${primary.municipio} (${primary.sector})`}
              {primary.servicioPublico ? ` · Reclamo: ${primary.servicioPublico}` : ''}
              {typeof primary.personasConcentradas === 'number' && primary.personasConcentradas > 0
                ? ` · ~${primary.personasConcentradas} pers.`
                : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onLocate(primary)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white text-fuchsia-950 hover:bg-fuchsia-100 rounded cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" />
            Ubicar
          </button>
          {canOperate && (
            <button
              type="button"
              onClick={() => void onMarkRoadCleared(primary)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded cursor-pointer"
              title="Marcar manifestación atendida y vía despejada"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Vía Despejada
            </button>
          )}
          {activeAlerts.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-fuchsia-900/80 hover:bg-fuchsia-800 border border-fuchsia-400/40 text-fuchsia-100 rounded cursor-pointer"
            >
              {expanded ? (
                <>
                  Ocultar
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Ver todos ({activeAlerts.length})
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {expanded && activeAlerts.length > 1 && (
        <div className="max-w-[1600px] mx-auto mt-2 pt-2 border-t border-fuchsia-500/30 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {activeAlerts.map((inc) => (
            <div
              key={inc.id}
              className="bg-[#160A1E]/85 border border-fuchsia-500/40 rounded p-2.5 flex items-start justify-between gap-2"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="text-[11px] font-bold text-white truncate">{inc.titulo}</div>
                <div className="text-[10px] text-fuchsia-200/90 truncate">
                  {INCIDENT_TYPE_LABELS[inc.tipo].replace(/^Orden Público:\s*|^Servicios Públicos:\s*/i, '')}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-300">
                  <span>
                    {inc.municipio} · {inc.viaAfectada || inc.sector}
                  </span>
                  {inc.servicioPublico && (
                    <span className="inline-flex items-center gap-0.5 text-fuchsia-300">
                      <Wrench className="w-2.5 h-2.5" />
                      {inc.servicioPublico}
                    </span>
                  )}
                  {typeof inc.personasConcentradas === 'number' && inc.personasConcentradas > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-amber-200 font-mono-tabular">
                      <Users className="w-2.5 h-2.5" />~{inc.personasConcentradas}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onLocate(inc)}
                  className="px-2 py-1 text-[10px] font-semibold bg-fuchsia-700 hover:bg-fuchsia-600 text-white rounded cursor-pointer"
                >
                  Mapa
                </button>
                {canOperate && (
                  <button
                    type="button"
                    onClick={() => void onMarkRoadCleared(inc)}
                    className="px-2 py-1 text-[10px] font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded cursor-pointer"
                  >
                    Despejada
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

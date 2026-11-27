import React, { useMemo, useState } from 'react';
import {
  Camera,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Crosshair,
  Flame,
  Leaf,
  MapPin,
  Megaphone,
  Phone,
  Search,
  ShieldCheck,
  Skull,
  Trash2,
  X,
} from 'lucide-react';
import {
  ENVIRONMENTAL_INCIDENT_TYPES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  LIGHTING_CONDITION_LABELS,
  PATROL_CONDITION_LABELS,
  PUBLIC_ORDER_INCIDENT_TYPES,
  ROAD_ACCESS_STATUS_LABELS,
  SECURITY_INCIDENT_TYPES,
  TRAFFIC_FLOW_LABELS,
  TRAFFIC_INCIDENT_TYPES,
  TRUJILLO_MUNICIPALITIES,
  VIOLENT_INCIDENT_TYPES,
  getIncidentCategory,
  isTrafficIncidentType,
  isViolentIncidentType,
  type Commission,
  type Incident,
  type IncidentCategoryGroup,
  type IncidentStatus,
  type IncidentType,
  type PatrolCondition,
  type PatrolPoint,
} from '../types/operations';
import {
  CUADRANTE_TYPE_LABELS,
  CUADRANTE_TYPE_STYLES,
  TRUJILLO_CUADRANTES_PAZ,
  getCuadranteByCode,
  type CuadrantePaz,
  type CuadranteType,
} from '../data/trujilloCuadrantes';
import { formatCoords, sanitizePhoneForTel } from '../lib/geo';

interface CrimeMapViewProps {
  incidents: Incident[];
  patrolPoints: PatrolPoint[];
  commissions: Commission[];
  canOperate?: boolean;
  canDelete?: boolean;
  onStartMarkOnMap: () => void;
  onStartMarkPatrolOnMap: () => void;
  onQuickRegisterIncident: (defaultTipo?: IncidentType, cuadrante?: CuadrantePaz) => void;
  onQuickPatrolCuadrante: (cuadrante: CuadrantePaz) => void;
  onLocateCuadrante: (cuadrante: CuadrantePaz) => void;
  onLocateIncident: (incident: Incident) => void;
  onLocatePatrolPoint: (point: PatrolPoint) => void;
  onUpdateStatus: (incident: Incident, status: IncidentStatus) => Promise<void>;
  onDeleteIncident: (incident: Incident) => void;
  onDeletePatrolPoint: (point: PatrolPoint) => void;
}

export const CrimeMapView: React.FC<CrimeMapViewProps> = ({
  incidents,
  patrolPoints,
  commissions,
  canOperate = true,
  canDelete = true,
  onStartMarkOnMap,
  onStartMarkPatrolOnMap,
  onQuickRegisterIncident,
  onQuickPatrolCuadrante,
  onLocateCuadrante,
  onLocateIncident,
  onLocatePatrolPoint,
  onUpdateStatus,
  onDeleteIncident,
  onDeletePatrolPoint,
}) => {
  const [section, setSection] = useState<'novedades' | 'cuadrantes' | 'patrullaje'>('novedades');
  const [categoryFilter, setCategoryFilter] = useState<'all' | IncidentCategoryGroup>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | IncidentType>('all');
  const [cuadranteFilter, setCuadranteFilter] = useState<string>('all');
  const [patrolConditionFilter, setPatrolConditionFilter] = useState<'all' | PatrolCondition>('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'terrestre' | 'lacustre'>('all');

  // Cuadrantes de Paz filters
  const [cuadranteSearch, setCuadranteSearch] = useState('');
  const [cuadranteTypeFilter, setCuadranteTypeFilter] = useState<'all' | CuadranteType>('all');
  const [cuadranteMunFilter, setCuadranteMunFilter] = useState<string>('all');
  const [cuadranteCoverageFilter, setCuadranteCoverageFilter] = useState<
    'all' | 'cubiertos' | 'pendientes'
  >('all');

  const [lightbox, setLightbox] = useState<{ src: string; title: string; coords: string } | null>(
    null
  );

  // Operational statistics across categories
  const stats = useMemo(() => {
    let vialCount = 0;
    let vialLesionados = 0;
    let vialFallecidos = 0;
    let vialVehiculos = 0;

    let violentCount = 0;
    let violentFallecidos = 0;
    let violentLesionados = 0;

    let publicOrderCount = 0;
    let publicOrderOpen = 0;
    let closedRoadsCount = 0;

    let securityCount = 0;
    let securityOpen = 0;

    let environmentalCount = 0;

    incidents.forEach((inc) => {
      const cat = getIncidentCategory(inc.tipo);
      if (cat === 'orden_publico') {
        publicOrderCount += 1;
        if (inc.estado !== 'cerrada') {
          publicOrderOpen += 1;
          if (
            inc.pasoHabilitado === 'cerrado_total' ||
            inc.tipo === 'cierre_via_servicios' ||
            inc.tipo === 'cierre_via_gremial'
          ) {
            closedRoadsCount += 1;
          }
        }
      } else if (cat === 'vial') {
        vialCount += 1;
        vialLesionados += inc.lesionados ?? 0;
        vialFallecidos += inc.fallecidos ?? 0;
        vialVehiculos += inc.vehiculosInvolucrados ?? 0;
      } else if (cat === 'violento') {
        violentCount += 1;
        violentFallecidos += inc.fallecidos ?? 0;
        violentLesionados += inc.lesionados ?? 0;
      } else if (cat === 'ambiental') {
        environmentalCount += 1;
      } else {
        securityCount += 1;
        if (inc.estado !== 'cerrada') securityOpen += 1;
      }
    });

    return {
      publicOrderCount,
      publicOrderOpen,
      closedRoadsCount,
      vialCount,
      vialLesionados,
      vialFallecidos,
      vialVehiculos,
      violentCount,
      violentFallecidos,
      violentLesionados,
      securityCount,
      securityOpen,
      environmentalCount,
    };
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (categoryFilter !== 'all' && getIncidentCategory(inc.tipo) !== categoryFilter) {
        return false;
      }
      if (typeFilter !== 'all' && inc.tipo !== typeFilter) return false;
      if (cuadranteFilter !== 'all' && (inc.cuadrantePaz || '') !== cuadranteFilter) return false;
      if (modeFilter !== 'all' && inc.modalidad !== modeFilter) return false;
      return true;
    });
  }, [incidents, categoryFilter, typeFilter, cuadranteFilter, modeFilter]);

  const filteredPatrols = useMemo(() => {
    return patrolPoints.filter((pt) => {
      if (patrolConditionFilter !== 'all' && pt.condicionSector !== patrolConditionFilter) {
        return false;
      }
      if (cuadranteFilter !== 'all' && (pt.cuadrantePaz || '') !== cuadranteFilter) {
        return false;
      }
      if (modeFilter !== 'all' && pt.modalidad !== modeFilter) return false;
      return true;
    });
  }, [patrolPoints, patrolConditionFilter, cuadranteFilter, modeFilter]);

  const byMunicipality = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach((inc) => {
      counts[inc.municipio] = (counts[inc.municipio] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [incidents]);

  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach((inc) => {
      counts[inc.tipo] = (counts[inc.tipo] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [incidents]);

  // Live Cuadrantes de Paz coverage telemetry
  const cuadrantesCoverage = useMemo(() => {
    return TRUJILLO_CUADRANTES_PAZ.map((q) => {
      const activeComms = commissions.filter(
        (c) => c.estado !== 'finalizada' && c.cuadrantePaz === q.codigo
      );
      const qPatrols = patrolPoints.filter((pt) => pt.cuadrantePaz === q.codigo);
      const qIncidents = incidents.filter((inc) => inc.cuadrantePaz === q.codigo);
      const qRoadIncidents = qIncidents.filter((inc) => isTrafficIncidentType(inc.tipo));
      const qViolentIncidents = qIncidents.filter((inc) => isViolentIncidentType(inc.tipo));
      const covered = activeComms.length > 0 || qPatrols.length > 0;

      return {
        cuadrante: q,
        activeComms,
        patrolCount: qPatrols.length,
        incidentCount: qIncidents.length,
        roadCount: qRoadIncidents.length,
        violentCount: qViolentIncidents.length,
        covered,
      };
    });
  }, [commissions, patrolPoints, incidents]);

  const cuadranteSummary = useMemo(() => {
    const total = cuadrantesCoverage.length;
    const cubiertos = cuadrantesCoverage.filter((c) => c.covered).length;
    const pendientes = total - cubiertos;
    const vialesLacustres = cuadrantesCoverage.filter(
      (c) => c.cuadrante.tipo === 'vial' || c.cuadrante.tipo === 'lacustre'
    ).length;
    return { total, cubiertos, pendientes, vialesLacustres };
  }, [cuadrantesCoverage]);

  const filteredCuadrantes = useMemo(() => {
    const term = cuadranteSearch.trim().toLowerCase();
    return cuadrantesCoverage.filter((entry) => {
      const q = entry.cuadrante;
      if (cuadranteTypeFilter !== 'all' && q.tipo !== cuadranteTypeFilter) return false;
      if (cuadranteMunFilter !== 'all' && q.municipio !== cuadranteMunFilter) return false;
      if (cuadranteCoverageFilter === 'cubiertos' && !entry.covered) return false;
      if (cuadranteCoverageFilter === 'pendientes' && entry.covered) return false;
      if (term) {
        const hay =
          `${q.codigo} ${q.nombre} ${q.municipio} ${q.sectores} ${q.organismo} ${q.telefonoVen911}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [
    cuadrantesCoverage,
    cuadranteSearch,
    cuadranteTypeFilter,
    cuadranteMunFilter,
    cuadranteCoverageFilter,
  ]);

  return (
    <div className="max-w-[1440px] mx-auto p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">
            Seguridad Vial, Criminalidad y Cuadrantes de Paz — Trujillo
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Control de patrullaje por Cuadrantes de Paz del Estado Trujillo, siniestralidad vial en
            troncales, homicidios, delitos graves y registro fotográfico georreferenciado.
          </p>
        </div>
        {canOperate && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onQuickRegisterIncident('cierre_via_servicios')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-fuchsia-700 hover:bg-fuchsia-600 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Megaphone className="w-4 h-4" />
              Manifestación / Cierre
            </button>
            <button
              type="button"
              onClick={() => onQuickRegisterIncident('accidente_colision')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Car className="w-4 h-4" />
              Accidente Vial
            </button>
            <button
              type="button"
              onClick={() => onQuickRegisterIncident('homicidio')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Skull className="w-4 h-4" />
              Homicidio / Grave
            </button>
            <button
              type="button"
              onClick={onStartMarkPatrolOnMap}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <ClipboardCheck className="w-4 h-4" />
              Patrullar Punto
            </button>
            <button
              type="button"
              onClick={onStartMarkOnMap}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Crosshair className="w-4 h-4" />
              Señalar en Mapa
            </button>
          </div>
        )}
      </div>

      {/* Section Switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800">
        <button
          type="button"
          onClick={() => setSection('novedades')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            section === 'novedades'
              ? 'border-amber-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-400" />
          Novedades, Tránsito y Homicidios ({incidents.length})
        </button>
        <button
          type="button"
          onClick={() => setSection('cuadrantes')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            section === 'cuadrantes'
              ? 'border-indigo-400 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          Cuadrantes de Paz — Trujillo ({TRUJILLO_CUADRANTES_PAZ.length})
        </button>
        <button
          type="button"
          onClick={() => setSection('patrullaje')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            section === 'patrullaje'
              ? 'border-teal-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 text-teal-400" />
          Puntos Patrullados ({patrolPoints.length})
        </button>
      </div>

      {section === 'novedades' && (
        <>
          {/* 5-Card Operational KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter(categoryFilter === 'orden_publico' ? 'all' : 'orden_publico');
                setTypeFilter('all');
              }}
              className={`text-left bg-[#111822] border rounded-md p-4 transition-colors cursor-pointer ${
                categoryFilter === 'orden_publico'
                  ? 'border-fuchsia-400 bg-fuchsia-950/25'
                  : 'border-slate-800 hover:border-fuchsia-500/50'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-fuchsia-300 font-semibold">
                <span>Manifestación / Cierres</span>
                <Megaphone className="w-4 h-4" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-white mt-1.5">
                {stats.publicOrderCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-2">
                <span className="text-fuchsia-300">{stats.publicOrderOpen} activas</span>
                {stats.closedRoadsCount > 0 && (
                  <span className="text-red-400 font-semibold">
                    {stats.closedRoadsCount} cierre vial
                  </span>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategoryFilter(categoryFilter === 'vial' ? 'all' : 'vial');
                setTypeFilter('all');
              }}
              className={`text-left bg-[#111822] border rounded-md p-4 transition-colors cursor-pointer ${
                categoryFilter === 'vial'
                  ? 'border-sky-400 bg-sky-950/20'
                  : 'border-slate-800 hover:border-sky-500/50'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-sky-300 font-semibold">
                <span>Seguridad Vial / Tránsito</span>
                <Car className="w-4 h-4" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-white mt-1.5">
                {stats.vialCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-2.5">
                <span>{stats.vialVehiculos} veh.</span>
                <span className="text-amber-300">{stats.vialLesionados} les.</span>
                <span className="text-red-400">{stats.vialFallecidos} fall.</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategoryFilter(categoryFilter === 'violento' ? 'all' : 'violento');
                setTypeFilter('all');
              }}
              className={`text-left bg-[#111822] border rounded-md p-4 transition-colors cursor-pointer ${
                categoryFilter === 'violento'
                  ? 'border-red-500 bg-red-950/25'
                  : 'border-slate-800 hover:border-red-500/50'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-red-400 font-semibold">
                <span>Homicidios y Delitos Graves</span>
                <Skull className="w-4 h-4" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-white mt-1.5">
                {stats.violentCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-2.5">
                <span className="text-red-400 font-medium">{stats.violentFallecidos} fallecidos</span>
                <span className="text-amber-300">{stats.violentLesionados} heridos</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategoryFilter(categoryFilter === 'seguridad' ? 'all' : 'seguridad');
                setTypeFilter('all');
              }}
              className={`text-left bg-[#111822] border rounded-md p-4 transition-colors cursor-pointer ${
                categoryFilter === 'seguridad'
                  ? 'border-amber-400 bg-amber-950/20'
                  : 'border-slate-800 hover:border-amber-500/50'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                <span>Seguridad Ciudadana y Rural</span>
                <Flame className="w-4 h-4" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-white mt-1.5">
                {stats.securityCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {stats.securityOpen} abiertas o en atención
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategoryFilter(categoryFilter === 'ambiental' ? 'all' : 'ambiental');
                setTypeFilter('all');
              }}
              className={`text-left bg-[#111822] border rounded-md p-4 transition-colors cursor-pointer ${
                categoryFilter === 'ambiental'
                  ? 'border-lime-400 bg-lime-950/20'
                  : 'border-slate-800 hover:border-lime-500/50'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-lime-300 font-semibold">
                <span>Delitos Ambientales</span>
                <Leaf className="w-4 h-4" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-white mt-1.5">
                {stats.environmentalCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {incidents.filter((i) => i.modalidad === 'lacustre').length} Lacustres ·{' '}
                {incidents.filter((i) => i.modalidad === 'terrestre').length} Terrestres
              </div>
            </button>
          </div>

          {/* Hotspot Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6 bg-[#111822] border border-slate-800 rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-white">
                  Incidencia por Municipio
                </h2>
                <span className="font-mono-tabular text-xs text-slate-400">
                  Total: {incidents.length} registros
                </span>
              </div>
              {byMunicipality.length === 0 ? (
                <p className="text-xs text-slate-500">Sin novedades registradas todavía.</p>
              ) : (
                <div className="space-y-2">
                  {byMunicipality.slice(0, 6).map(([mun, count]) => {
                    const pct = Math.round((count / Math.max(1, incidents.length)) * 100);
                    return (
                      <div key={mun} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-200 font-medium">{mun}</span>
                          <span className="font-mono-tabular text-slate-400">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#0B1117] rounded overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-6 bg-[#111822] border border-slate-800 rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-white">
                  Tipología Predominante (Vial, Homicidios y Delitos)
                </h2>
                <span className="font-mono-tabular text-xs text-slate-400">
                  <span className="text-sky-400">{stats.vialCount} Vial</span> ·{' '}
                  <span className="text-red-400">{stats.violentCount} Graves</span> ·{' '}
                  <span className="text-lime-400">{stats.environmentalCount} Amb.</span>
                </span>
              </div>
              {byType.length === 0 ? (
                <p className="text-xs text-slate-500">Sin registros.</p>
              ) : (
                <div className="space-y-2">
                  {byType.slice(0, 6).map(([tipo, count]) => {
                    const pct = Math.round((count / Math.max(1, incidents.length)) * 100);
                    const typed = tipo as IncidentType;
                    const cat = getIncidentCategory(typed);
                  const barColor =
                      cat === 'orden_publico'
                        ? 'bg-fuchsia-500'
                        : cat === 'vial'
                          ? 'bg-sky-500'
                          : cat === 'violento'
                            ? 'bg-red-600'
                            : cat === 'ambiental'
                              ? 'bg-lime-500'
                              : 'bg-amber-500';
                    return (
                      <div key={tipo} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-200 font-medium inline-flex items-center gap-1.5">
                            {cat === 'orden_publico' && (
                              <Megaphone className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                            )}
                            {cat === 'vial' && <Car className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                            {cat === 'violento' && (
                              <Skull className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            )}
                            {cat === 'ambiental' && (
                              <Leaf className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                            )}
                            {cat === 'seguridad' && (
                              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            {INCIDENT_TYPE_LABELS[typed]}
                          </span>
                          <span className="font-mono-tabular text-slate-400">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#0B1117] rounded overflow-hidden">
                          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 bg-[#111822] border border-slate-800 rounded-md p-1">
                {(
                  [
                    { id: 'all', label: `Todos (${incidents.length})` },
                    { id: 'orden_publico', label: `Protestas / Cierres (${stats.publicOrderCount})` },
                    { id: 'vial', label: `Seguridad Vial (${stats.vialCount})` },
                    { id: 'violento', label: `Homicidios / Graves (${stats.violentCount})` },
                    { id: 'seguridad', label: `Rural (${stats.securityCount})` },
                    { id: 'ambiental', label: `Ambiental (${stats.environmentalCount})` },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(cat.id);
                      setTypeFilter('all');
                    }}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors ${
                      categoryFilter === cat.id
                        ? cat.id === 'orden_publico'
                          ? 'bg-fuchsia-700 text-white'
                          : cat.id === 'vial'
                            ? 'bg-sky-700 text-white'
                            : cat.id === 'violento'
                              ? 'bg-red-700 text-white'
                              : cat.id === 'ambiental'
                                ? 'bg-emerald-700 text-white'
                                : 'bg-[#1F2D40] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | IncidentType)}
                className="bg-[#111822] border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todas las tipologías</option>
                <optgroup label="Orden Público, Manifestaciones y Cierres de Vías">
                  {PUBLIC_ORDER_INCIDENT_TYPES.map((k) => (
                    <option key={k} value={k}>
                      {INCIDENT_TYPE_LABELS[k]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Seguridad Vial y Accidentes de Tránsito">
                  {TRAFFIC_INCIDENT_TYPES.map((k) => (
                    <option key={k} value={k}>
                      {INCIDENT_TYPE_LABELS[k]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Homicidios y Delitos Graves">
                  {VIOLENT_INCIDENT_TYPES.map((k) => (
                    <option key={k} value={k}>
                      {INCIDENT_TYPE_LABELS[k]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Seguridad Ciudadana y Rural">
                  {SECURITY_INCIDENT_TYPES.map((k) => (
                    <option key={k} value={k}>
                      {INCIDENT_TYPE_LABELS[k]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Delitos en Materia Ambiental">
                  {ENVIRONMENTAL_INCIDENT_TYPES.map((k) => (
                    <option key={k} value={k}>
                      {INCIDENT_TYPE_LABELS[k]}
                    </option>
                  ))}
                </optgroup>
              </select>

              <select
                value={cuadranteFilter}
                onChange={(e) => setCuadranteFilter(e.target.value)}
                className="bg-[#111822] border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-400"
              >
                <option value="all">Todos los Cuadrantes de Paz</option>
                {TRUJILLO_CUADRANTES_PAZ.map((q) => (
                  <option key={q.codigo} value={q.codigo}>
                    {q.codigo} — {q.municipio}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-[#111822] border border-slate-800 rounded-md p-1">
              {(
                [
                  { id: 'all', label: 'Todas las Vías' },
                  { id: 'terrestre', label: 'Terrestre' },
                  { id: 'lacustre', label: 'Lacustre' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setModeFilter(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors ${
                    modeFilter === opt.id
                      ? 'bg-[#1F2D40] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Incidents Table */}
          <div className="bg-[#111822] border border-slate-800 rounded-md overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-semibold">Novedad / Ficha Operacional</th>
                  <th className="py-3 px-4 font-semibold">Municipio / Cuadrante</th>
                  <th className="py-3 px-4 font-semibold">Severidad</th>
                  <th className="py-3 px-4 font-semibold">Coordenadas</th>
                  <th className="py-3 px-4 font-semibold">Estado</th>
                  <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No hay registros que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((inc) => {
                    const cat = getIncidentCategory(inc.tipo);
                    const matchedCuadrante = inc.cuadrantePaz
                      ? getCuadranteByCode(inc.cuadrantePaz)
                      : undefined;
                    const hasStructured =
                      (inc.fallecidos ?? 0) > 0 ||
                      (inc.lesionados ?? 0) > 0 ||
                      (inc.vehiculosInvolucrados ?? 0) > 0 ||
                      (inc.personasConcentradas ?? 0) > 0 ||
                      Boolean(inc.pasoHabilitado) ||
                      Boolean(inc.servicioPublico) ||
                      Boolean(inc.viaAfectada) ||
                      Boolean(inc.causaProbable) ||
                      Boolean(inc.placasInvolucradas);

                    return (
                      <tr key={inc.id} className="hover:bg-[#161F2C]/70 transition-colors">
                        <td className="py-3 px-4 max-w-md">
                          <div className="flex items-start gap-3">
                            {inc.fotoDataUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setLightbox({
                                    src: inc.fotoDataUrl || '',
                                    title: inc.titulo,
                                    coords: inc.fotoCoordenadas || formatCoords(inc.lat, inc.lng),
                                  })
                                }
                                className="shrink-0 cursor-pointer group"
                                title="Ver foto con coordenadas"
                              >
                                <img
                                  src={inc.fotoDataUrl}
                                  alt={inc.titulo}
                                  className="w-16 h-12 object-cover rounded border border-slate-700 group-hover:border-amber-400"
                                />
                              </button>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                {cat === 'orden_publico' ? (
                                  <Megaphone className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                                ) : cat === 'vial' ? (
                                  <Car className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                ) : cat === 'violento' ? (
                                  <Skull className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                ) : cat === 'ambiental' ? (
                                  <Leaf className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                                ) : (
                                  <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                )}
                                <span>{inc.titulo}</span>
                              </div>
                              <div
                                className={`text-[11px] mt-0.5 ${
                                  cat === 'orden_publico'
                                    ? 'text-fuchsia-300'
                                    : cat === 'vial'
                                      ? 'text-sky-300'
                                      : cat === 'violento'
                                        ? 'text-red-300'
                                        : cat === 'ambiental'
                                          ? 'text-lime-300/90'
                                          : 'text-slate-400'
                                }`}
                              >
                                {INCIDENT_TYPE_LABELS[inc.tipo]} ·{' '}
                                {inc.modalidad === 'lacustre' ? 'Vía Lacustre' : 'Vía Terrestre'}
                              </div>
                              <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                                {inc.descripcion}
                              </p>
                              {hasStructured && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] bg-[#0B1117] border border-slate-800/80 rounded px-2 py-1">
                                  {inc.pasoHabilitado && (
                                    <span
                                      className={`font-semibold ${
                                        inc.pasoHabilitado === 'cerrado_total'
                                          ? 'text-red-400'
                                          : inc.pasoHabilitado === 'via_libre'
                                            ? 'text-emerald-400'
                                            : 'text-fuchsia-300'
                                      }`}
                                    >
                                      {ROAD_ACCESS_STATUS_LABELS[inc.pasoHabilitado]}
                                    </span>
                                  )}
                                  {inc.servicioPublico && (
                                    <span className="text-fuchsia-200">
                                      Servicio: <strong>{inc.servicioPublico}</strong>
                                    </span>
                                  )}
                                  {typeof inc.personasConcentradas === 'number' &&
                                    inc.personasConcentradas > 0 && (
                                      <span className="text-amber-300 font-mono-tabular">
                                        Pers: <strong>~{inc.personasConcentradas}</strong>
                                      </span>
                                    )}
                                  {inc.viaAfectada && (
                                    <span className="text-sky-300">
                                      Vía: <strong>{inc.viaAfectada}</strong>
                                    </span>
                                  )}
                                  {typeof inc.vehiculosInvolucrados === 'number' &&
                                    inc.vehiculosInvolucrados > 0 && (
                                      <span className="text-slate-200 font-mono-tabular">
                                        Veh: <strong>{inc.vehiculosInvolucrados}</strong>
                                      </span>
                                    )}
                                  {typeof inc.lesionados === 'number' && inc.lesionados > 0 && (
                                    <span className="text-amber-300 font-mono-tabular">
                                      Lesionados: <strong>{inc.lesionados}</strong>
                                    </span>
                                  )}
                                  {typeof inc.fallecidos === 'number' && inc.fallecidos > 0 && (
                                    <span className="text-red-400 font-mono-tabular font-semibold">
                                      Fallecidos: {inc.fallecidos}
                                    </span>
                                  )}
                                  {inc.causaProbable && (
                                    <span className="text-slate-300">
                                      {cat === 'orden_publico'
                                        ? 'Motivo:'
                                        : cat === 'violento'
                                          ? 'Móvil/Arma:'
                                          : 'Causa:'}{' '}
                                      {inc.causaProbable}
                                    </span>
                                  )}
                                  {inc.placasInvolucradas && (
                                    <span className="text-slate-400 font-mono-tabular">
                                      Ref: {inc.placasInvolucradas}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-100 font-medium">{inc.municipio}</div>
                          <div className="text-[11px] text-slate-400">{inc.sector}</div>
                          {inc.cuadrantePaz && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono-tabular font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-500/40 rounded px-1.5 py-0.5">
                              <ShieldCheck className="w-3 h-3" />
                              {inc.cuadrantePaz}
                              {matchedCuadrante ? ` · ${CUADRANTE_TYPE_LABELS[matchedCuadrante.tipo]}` : ''}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Rep: {inc.reportadoPor}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold ${
                              inc.severidad === 'critica'
                                ? 'text-red-400'
                                : inc.severidad === 'alta'
                                  ? 'text-orange-400'
                                  : inc.severidad === 'media'
                                    ? 'text-amber-300'
                                    : 'text-sky-300'
                            }`}
                          >
                            {INCIDENT_SEVERITY_LABELS[inc.severidad]}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-[11px] text-slate-300 whitespace-nowrap">
                          {formatCoords(inc.lat, inc.lng)}
                        </td>
                        <td className="py-3 px-4">
                          {inc.estado === 'cerrada' || !canOperate ? (
                            <span className="text-slate-300 font-medium">
                              {INCIDENT_STATUS_LABELS[inc.estado]}
                            </span>
                          ) : (
                            <select
                              aria-label={`Estado de ${inc.titulo}`}
                              value={inc.estado}
                              onChange={(e) =>
                                void onUpdateStatus(inc, e.target.value as IncidentStatus)
                              }
                              className="bg-[#0B1117] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 cursor-pointer"
                            >
                              <option value="abierta">Abierta</option>
                              <option value="en_atencion">En Atención</option>
                              <option value="cerrada">Cerrada</option>
                            </select>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onLocateIncident(inc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#192332] hover:bg-[#233247] text-slate-100 rounded cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              Mapa
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => onDeleteIncident(inc)}
                                className="p-1.5 text-slate-500 hover:text-red-400 bg-[#192332] rounded cursor-pointer"
                                title="Eliminar novedad"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {section === 'cuadrantes' && (
        <>
          {/* Cuadrantes de Paz Coverage KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#111822] border border-slate-800 rounded-md p-4">
              <div className="text-xs text-slate-400 font-medium">
                Cuadrantes de Paz — Trujillo
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-white mt-1">
                {cuadranteSummary.total}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Cobertura rural, urbana, vial y lacustre
              </div>
            </div>
            <div className="bg-[#111822] border border-emerald-500/30 rounded-md p-4">
              <div className="text-xs text-emerald-300 font-medium">
                Con Cobertura / Patrullados
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-emerald-400 mt-1">
                {cuadranteSummary.cubiertos}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Comisión desplegada o punto verificado
              </div>
            </div>
            <div className="bg-[#111822] border border-amber-500/30 rounded-md p-4">
              <div className="text-xs text-amber-300 font-medium">Pendientes de Patrullaje</div>
              <div className="font-mono-tabular text-2xl font-bold text-amber-400 mt-1">
                {cuadranteSummary.pendientes}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Sin comisión ni recorrido registrado aún
              </div>
            </div>
            <div className="bg-[#111822] border border-sky-500/30 rounded-md p-4">
              <div className="text-xs text-sky-300 font-medium">
                Cuadrantes Viales y Lacustres
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-sky-400 mt-1">
                {cuadranteSummary.vialesLacustres}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Troncal 001, Troncal 007 y Lago de Maracaibo
              </div>
            </div>
          </div>

          {/* Cuadrantes Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[210px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cuadranteSearch}
                  onChange={(e) => setCuadranteSearch(e.target.value)}
                  placeholder="Buscar cuadrante, troncal, parroquia o sector..."
                  className="w-full bg-[#111822] border border-slate-800 rounded-md pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <select
                value={cuadranteMunFilter}
                onChange={(e) => setCuadranteMunFilter(e.target.value)}
                className="bg-[#111822] border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-400"
              >
                <option value="all">Todos los municipios</option>
                {TRUJILLO_MUNICIPALITIES.map((mun) => (
                  <option key={mun} value={mun}>
                    {mun}
                  </option>
                ))}
              </select>

              <select
                value={cuadranteTypeFilter}
                onChange={(e) => setCuadranteTypeFilter(e.target.value as 'all' | CuadranteType)}
                className="bg-[#111822] border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-400"
              >
                <option value="all">Todos los tipos</option>
                {(Object.keys(CUADRANTE_TYPE_LABELS) as CuadranteType[]).map((t) => (
                  <option key={t} value={t}>
                    {CUADRANTE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-[#111822] border border-slate-800 rounded-md p-1">
              {(
                [
                  { id: 'all', label: `Todos (${cuadranteSummary.total})` },
                  { id: 'cubiertos', label: `Cubiertos (${cuadranteSummary.cubiertos})` },
                  { id: 'pendientes', label: `Pendientes (${cuadranteSummary.pendientes})` },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCuadranteCoverageFilter(opt.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors ${
                    cuadranteCoverageFilter === opt.id
                      ? 'bg-[#1F2D40] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cuadrantes Grid */}
          {filteredCuadrantes.length === 0 ? (
            <div className="bg-[#111822] border border-slate-800 rounded-md p-10 text-center text-sm text-slate-400">
              No se encontraron Cuadrantes de Paz con los filtros aplicados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCuadrantes.map(
                ({
                  cuadrante: q,
                  activeComms,
                  patrolCount,
                  incidentCount,
                  roadCount,
                  violentCount,
                  covered,
                }) => {
                  const typeStyle = CUADRANTE_TYPE_STYLES[q.tipo];
                  return (
                    <div
                      key={q.codigo}
                      className="bg-[#111822] border border-slate-800 rounded-md flex flex-col justify-between overflow-hidden"
                    >
                      <div className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="font-mono-tabular text-xs font-bold px-2 py-0.5 rounded text-white"
                                style={{ backgroundColor: typeStyle.fill }}
                              >
                                {q.codigo}
                              </span>
                              <span
                                className={`text-[11px] font-semibold ${
                                  covered ? 'text-emerald-400' : 'text-amber-400'
                                } inline-flex items-center gap-1`}
                              >
                                {covered && <CheckCircle2 className="w-3.5 h-3.5" />}
                                {covered ? 'Con Cobertura' : 'Pendiente Patrullaje'}
                              </span>
                            </div>
                            <h3 className="font-display text-base font-bold text-white mt-1.5 leading-snug">
                              {q.nombre}
                            </h3>
                            <div className="text-[11px] text-slate-400">
                              {q.municipio} · {CUADRANTE_TYPE_LABELS[q.tipo]} · Radio {q.radioKm} km
                            </div>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-300 bg-[#0B1117] border border-slate-800/80 rounded p-2.5 space-y-1">
                          <div>
                            <span className="text-slate-500">Sectores / Eje:</span> {q.sectores}
                          </div>
                          <div>
                            <span className="text-slate-500">Organismo:</span>{' '}
                            <span className="text-slate-200 font-medium">{q.organismo}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">VEN-911 / Contacto:</span>{' '}
                            <span className="font-mono-tabular text-sky-300">
                              {q.telefonoVen911}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center bg-[#0D141D] border border-slate-800/70 rounded p-2">
                          <div>
                            <div className="font-mono-tabular text-sm font-bold text-emerald-400">
                              {activeComms.length}
                            </div>
                            <div className="text-[10px] text-slate-400">Comisiones</div>
                          </div>
                          <div>
                            <div className="font-mono-tabular text-sm font-bold text-teal-300">
                              {patrolCount}
                            </div>
                            <div className="text-[10px] text-slate-400">Patrullajes</div>
                          </div>
                          <div>
                            <div
                              className={`font-mono-tabular text-sm font-bold ${
                                violentCount > 0
                                  ? 'text-red-400'
                                  : roadCount > 0
                                    ? 'text-sky-400'
                                    : incidentCount > 0
                                      ? 'text-amber-300'
                                      : 'text-slate-300'
                              }`}
                            >
                              {incidentCount}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {violentCount > 0
                                ? `${violentCount} Grav.`
                                : roadCount > 0
                                  ? `${roadCount} Vial`
                                  : 'Novedades'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="px-3.5 py-2.5 bg-[#0E151E] border-t border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {canOperate && (
                            <>
                              <button
                                type="button"
                                onClick={() => onQuickPatrolCuadrante(q)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded cursor-pointer"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                Patrullar
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onQuickRegisterIncident(
                                    q.tipo === 'vial' ? 'accidente_colision' : 'homicidio',
                                    q
                                  )
                                }
                                className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-white rounded cursor-pointer ${
                                  q.tipo === 'vial'
                                    ? 'bg-sky-700 hover:bg-sky-600'
                                    : 'bg-amber-700 hover:bg-amber-600'
                                }`}
                              >
                                {q.tipo === 'vial' ? (
                                  <>
                                    <Car className="w-3.5 h-3.5" />
                                    Vial
                                  </>
                                ) : (
                                  <>
                                    <Flame className="w-3.5 h-3.5" />
                                    Novedad
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${sanitizePhoneForTel(q.telefonoVen911)}`}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium bg-[#192332] hover:bg-[#233247] text-emerald-300 rounded"
                            title={`Llamar ${q.telefonoVen911}`}
                          >
                            <Phone className="w-3 h-3" />
                            911
                          </a>
                          <button
                            type="button"
                            onClick={() => onLocateCuadrante(q)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-[#192332] hover:bg-[#233247] text-slate-100 rounded cursor-pointer"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            Mapa
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </>
      )}

      {section === 'patrullaje' && (
        <>
          {/* Patrol Points Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={patrolConditionFilter}
                onChange={(e) =>
                  setPatrolConditionFilter(e.target.value as 'all' | PatrolCondition)
                }
                className="bg-[#111822] border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="all">Todas las condiciones del sector</option>
                {(Object.keys(PATROL_CONDITION_LABELS) as PatrolCondition[]).map((k) => (
                  <option key={k} value={k}>
                    {PATROL_CONDITION_LABELS[k]}
                  </option>
                ))}
              </select>

              <select
                value={cuadranteFilter}
                onChange={(e) => setCuadranteFilter(e.target.value)}
                className="bg-[#111822] border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-400"
              >
                <option value="all">Todos los Cuadrantes de Paz</option>
                {TRUJILLO_CUADRANTES_PAZ.map((q) => (
                  <option key={q.codigo} value={q.codigo}>
                    {q.codigo} — {q.municipio}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-[#111822] border border-slate-800 rounded-md p-1">
              {(
                [
                  { id: 'all', label: 'Todas las Vías' },
                  { id: 'terrestre', label: 'Terrestre' },
                  { id: 'lacustre', label: 'Lacustre' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setModeFilter(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer transition-colors ${
                    modeFilter === opt.id
                      ? 'bg-[#1F2D40] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filteredPatrols.length === 0 ? (
            <div className="bg-[#111822] border border-slate-800 rounded-md p-10 text-center space-y-3">
              <ClipboardCheck className="w-8 h-8 text-teal-400/70 mx-auto" />
              <p className="text-sm text-slate-300">
                Aún no hay puntos patrullados registrados con estos filtros.
              </p>
              {canOperate && (
                <button
                  type="button"
                  onClick={onStartMarkPatrolOnMap}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-md cursor-pointer"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Señalar Primer Punto Patrullado
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPatrols.map((pt) => {
                const condColor =
                  pt.condicionSector === 'riesgo_alto' ||
                  pt.condicionSector === 'presencia_irregular'
                    ? 'text-red-400'
                    : pt.condicionSector === 'manifestacion_cierre'
                      ? 'text-fuchsia-400'
                      : pt.condicionSector === 'actividad_sospechosa' ||
                          pt.condicionSector === 'via_obstruida'
                        ? 'text-amber-300'
                        : pt.condicionSector === 'control_vial'
                          ? 'text-sky-400'
                          : 'text-teal-400';

                const matchedCuadrante = pt.cuadrantePaz
                  ? getCuadranteByCode(pt.cuadrantePaz)
                  : undefined;

                return (
                  <div
                    key={pt.id}
                    className="bg-[#111822] border border-slate-800 rounded-md overflow-hidden flex flex-col justify-between"
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`font-semibold ${condColor}`}>
                              {PATROL_CONDITION_LABELS[pt.condicionSector]}
                            </span>
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                            <span className="text-slate-400">
                              {pt.modalidad === 'lacustre' ? 'Vía Lacustre' : 'Vía Terrestre'}
                            </span>
                            {pt.cuadrantePaz && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono-tabular font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-500/40 rounded px-1.5 py-0.5">
                                <ShieldCheck className="w-3 h-3" />
                                {pt.cuadrantePaz}
                                {matchedCuadrante ? ` · ${matchedCuadrante.municipio}` : ''}
                              </span>
                            )}
                          </div>
                          <h3 className="font-display text-lg font-bold text-white mt-0.5">
                            {pt.titulo}
                          </h3>
                          <div className="text-[11px] text-slate-400">
                            {pt.municipio} · {pt.sector} · Patrullado por: {pt.patrulladoPor}
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed bg-[#0B1117] border border-slate-800/80 rounded p-3">
                        {pt.caracteristicasVistas}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        <span>
                          Flujo:{' '}
                          <strong className="text-slate-200">
                            {TRAFFIC_FLOW_LABELS[pt.flujoVehicular]}
                          </strong>
                        </span>
                        <span>
                          Visibilidad:{' '}
                          <strong className="text-slate-200">
                            {LIGHTING_CONDITION_LABELS[pt.iluminacion]}
                          </strong>
                        </span>
                        <span className="font-mono-tabular text-teal-300">
                          {formatCoords(pt.lat, pt.lng)}
                        </span>
                      </div>

                      {pt.fotoDataUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setLightbox({
                              src: pt.fotoDataUrl,
                              title: `Punto Patrullado: ${pt.titulo}`,
                              coords: pt.fotoCoordenadas || formatCoords(pt.lat, pt.lng),
                            })
                          }
                          className="block w-full text-left cursor-pointer group"
                        >
                          <div className="relative rounded-md overflow-hidden border border-slate-700 group-hover:border-teal-400 transition-colors">
                            <img
                              src={pt.fotoDataUrl}
                              alt={pt.titulo}
                              className="w-full h-44 object-cover bg-black"
                            />
                            <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-black/75 text-white rounded">
                              <Camera className="w-3 h-3 text-teal-300" />
                              Ampliar foto
                            </div>
                          </div>
                        </button>
                      )}
                    </div>

                    <div className="px-4 py-2.5 bg-[#0E151E] border-t border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono-tabular text-slate-500 truncate">
                        {pt.fotoCoordenadas || formatCoords(pt.lat, pt.lng)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onLocatePatrolPoint(pt)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-[#192332] hover:bg-[#233247] text-slate-100 rounded cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Ver en Mapa
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onDeletePatrolPoint(pt)}
                            className="p-1.5 text-slate-500 hover:text-red-400 bg-[#192332] rounded cursor-pointer"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Fullscreen Photo Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="max-w-3xl w-full bg-[#111822] border border-slate-700 rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{lightbox.title}</div>
                <div className="text-[11px] text-emerald-400 font-mono-tabular truncate">
                  {lightbox.coords}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Cerrar foto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black flex items-center justify-center">
              <img
                src={lightbox.src}
                alt={lightbox.title}
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  Building2,
  Edit3,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Radio,
  Search,
  Shield,
  Trash2,
  Users,
  Waves,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  DESTACAMENTO_META,
  OPERATIONAL_DESTACAMENTOS,
  ZONE_UNIT_LEVEL_LABELS,
  ZONE_UNIT_STATUS_LABELS,
  type Commission,
  type DestacamentoId,
  type Incident,
  type ZoneUnit,
  type ZoneUnitStatus,
} from '../types/operations';
import { formatCoords, sanitizePhoneForTel } from '../lib/geo';

interface ZoneUnitsViewProps {
  zoneUnits: ZoneUnit[];
  commissions: Commission[];
  incidents: Incident[];
  currentUserUid: string;
  canOperate: boolean;
  canModerate: boolean;
  selectedDestacamento: DestacamentoId | 'ALL';
  onSelectDestacamento: (dest: DestacamentoId | 'ALL') => void;
  onLocateUnitOnMap: (unit: ZoneUnit) => void;
  onDeployCommissionFromUnit: (unit: ZoneUnit) => void;
  onAddZoneUnit: (defaultDest?: DestacamentoId) => void;
  onEditZoneUnit: (unit: ZoneUnit) => void;
  onChangeUnitStatus: (unit: ZoneUnit, nextStatus: ZoneUnitStatus) => Promise<void>;
  onDeleteZoneUnit: (unit: ZoneUnit) => Promise<void>;
}

const STATUS_BADGE: Record<ZoneUnitStatus, string> = {
  operativo: 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50',
  reforzado: 'bg-sky-950/90 text-sky-200 border border-sky-500/50',
  alerta: 'bg-amber-950/90 text-amber-200 border border-amber-500/60',
  inactivo: 'bg-slate-800 text-slate-400 border border-slate-600',
};

export const ZoneUnitsView: React.FC<ZoneUnitsViewProps> = ({
  zoneUnits,
  commissions,
  incidents,
  currentUserUid,
  canOperate,
  canModerate,
  selectedDestacamento,
  onSelectDestacamento,
  onLocateUnitOnMap,
  onDeployCommissionFromUnit,
  onAddZoneUnit,
  onEditZoneUnit,
  onChangeUnitStatus,
  onDeleteZoneUnit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ZoneUnitStatus | 'ALL'>('ALL');
  const [busyUnitId, setBusyUnitId] = useState<string | null>(null);

  const hqUnit = useMemo(
    () => zoneUnits.find((u) => u.nivel === 'comando_zona' || u.destacamento === 'CZGNB-23'),
    [zoneUnits]
  );

  const summaryByDest = useMemo(() => {
    const map: Record<
      DestacamentoId,
      {
        hq?: ZoneUnit;
        companiasCount: number;
        puestosCount: number;
        efectivosGuardia: number;
        activeComms: number;
        openIncidents: number;
        alertUnits: number;
      }
    > = {
      'CZGNB-23': {
        companiasCount: 0,
        puestosCount: 0,
        efectivosGuardia: 0,
        activeComms: 0,
        openIncidents: 0,
        alertUnits: 0,
      },
      'D-231': {
        companiasCount: 0,
        puestosCount: 0,
        efectivosGuardia: 0,
        activeComms: 0,
        openIncidents: 0,
        alertUnits: 0,
      },
      'DCR-23-1': {
        companiasCount: 0,
        puestosCount: 0,
        efectivosGuardia: 0,
        activeComms: 0,
        openIncidents: 0,
        alertUnits: 0,
      },
      'DESUR-23': {
        companiasCount: 0,
        puestosCount: 0,
        efectivosGuardia: 0,
        activeComms: 0,
        openIncidents: 0,
        alertUnits: 0,
      },
    };

    for (const u of zoneUnits) {
      const bucket = map[u.destacamento];
      if (!bucket) continue;
      if (u.nivel === 'destacamento' || u.nivel === 'comando_zona') bucket.hq = u;
      if (u.nivel === 'compania') bucket.companiasCount += 1;
      if (u.nivel === 'puesto_pac') bucket.puestosCount += 1;
      if (u.estadoOperativo !== 'inactivo') {
        bucket.efectivosGuardia += Number(u.efectivosGuardia || 0);
      }
      if (u.estadoOperativo === 'alerta') bucket.alertUnits += 1;
    }

    for (const c of commissions) {
      if (c.estado === 'finalizada') continue;
      const dest: DestacamentoId = c.destacamento || 'DCR-23-1';
      if (map[dest]) map[dest].activeComms += 1;
    }

    for (const inc of incidents) {
      if (inc.estado === 'cerrada') continue;
      const dest: DestacamentoId = inc.destacamento || 'DCR-23-1';
      if (map[dest]) map[dest].openIncidents += 1;
    }

    return map;
  }, [zoneUnits, commissions, incidents]);

  const totalStats = useMemo(() => {
    let companias = 0;
    let puestos = 0;
    let guardia = 0;
    for (const u of zoneUnits) {
      if (u.nivel === 'compania') companias += 1;
      if (u.nivel === 'puesto_pac') puestos += 1;
      if (u.estadoOperativo !== 'inactivo') guardia += Number(u.efectivosGuardia || 0);
    }
    return {
      companias,
      puestos,
      guardia,
      activeComms: commissions.filter((c) => c.estado !== 'finalizada').length,
      openIncidents: incidents.filter((i) => i.estado !== 'cerrada').length,
    };
  }, [zoneUnits, commissions, incidents]);

  const filteredUnits = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return zoneUnits.filter((u) => {
      if (selectedDestacamento !== 'ALL' && u.destacamento !== selectedDestacamento) {
        return false;
      }
      if (statusFilter !== 'ALL' && u.estadoOperativo !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        u.nombre.toLowerCase().includes(q) ||
        u.codigo.toLowerCase().includes(q) ||
        u.compania.toLowerCase().includes(q) ||
        u.municipio.toLowerCase().includes(q) ||
        u.sector.toLowerCase().includes(q) ||
        u.comandante.toLowerCase().includes(q)
      );
    });
  }, [zoneUnits, selectedDestacamento, statusFilter, searchTerm]);

  const groupedByDestAndCompania = useMemo(() => {
    const destOrder: DestacamentoId[] =
      selectedDestacamento === 'ALL'
        ? ['D-231', 'DCR-23-1', 'DESUR-23', 'CZGNB-23']
        : [selectedDestacamento];

    return destOrder
      .map((destId) => {
        const destUnits = filteredUnits.filter((u) => u.destacamento === destId);
        if (destUnits.length === 0) return null;

        const hqUnits = destUnits.filter(
          (u) => u.nivel === 'comando_zona' || u.nivel === 'destacamento'
        );
        const companias = destUnits.filter((u) => u.nivel === 'compania');
        const puestos = destUnits.filter((u) => u.nivel === 'puesto_pac');

        // Group puestos by compania name
        const companiaNames = new Set<string>();
        companias.forEach((c) => companiaNames.add(c.compania || c.nombre));
        puestos.forEach((p) => companiaNames.add(p.compania || 'Sin Compañía Asignada'));

        const companiaGroups = Array.from(companiaNames).map((compName) => {
          const compDoc = companias.find(
            (c) => c.compania === compName || c.nombre === compName
          );
          const compPuestos = puestos
            .filter((p) => (p.compania || 'Sin Compañía Asignada') === compName)
            .sort((a, b) => a.codigo.localeCompare(b.codigo));
          return {
            compName,
            compDoc,
            puestos: compPuestos,
          };
        });

        return {
          destId,
          meta: DESTACAMENTO_META[destId],
          hqUnits,
          companiaGroups,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [filteredUnits, selectedDestacamento]);

  const handleCycleStatus = async (unit: ZoneUnit) => {
    const order: ZoneUnitStatus[] = ['operativo', 'reforzado', 'alerta', 'inactivo'];
    const idx = order.indexOf(unit.estadoOperativo);
    const next = order[(idx + 1) % order.length];
    setBusyUnitId(unit.id);
    try {
      await onChangeUnitStatus(unit, next);
    } finally {
      setBusyUnitId(null);
    }
  };

  const canEditUnit = (u: ZoneUnit) =>
    canOperate && (canModerate || u.ownerId === currentUserUid);

  return (
    <div className="h-full overflow-y-auto bg-[#0B1117] p-4 sm:p-5 space-y-5">
      {/* CZGNB-23 Command HQ Banner */}
      <div className="bg-gradient-to-br from-[#2B0C16] via-[#151D28] to-[#0E151E] border border-rose-500/45 rounded-lg p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-rose-300">
              <Shield className="w-4 h-4 text-rose-400" />
              Guardia Nacional Bolivariana · REDI Los Andes · ZODI Nro. 23 Trujillo
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-white uppercase">
              Comando de Zona Nro. 23 (CZGNB-23) — Estado Trujillo
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              Estructura orgánica integrada de los 3 Destacamentos (<strong className="text-emerald-300">D-231</strong>,{' '}
              <strong className="text-sky-300">DCR 23-1</strong> y{' '}
              <strong className="text-amber-300">DESUR-23</strong>), sus Compañías y Puestos / PACs georreferenciados
              y sincronizados en tiempo real para todos los efectivos autorizados.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                Sede Principal: Sector Santa Cruz, Valera
              </span>
              {hqUnit?.telefono && (
                <a
                  href={`tel:${sanitizePhoneForTel(hqUnit.telefono)}`}
                  className="inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 font-semibold"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {hqUnit.telefono}
                </a>
              )}
              {hqUnit?.frecuenciaRadio && (
                <span className="inline-flex items-center gap-1.5 font-mono-tabular text-[11px] text-amber-200">
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                  {hqUnit.frecuenciaRadio}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hqUnit && (
              <button
                type="button"
                onClick={() => onLocateUnitOnMap(hqUnit)}
                className="px-3 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded flex items-center gap-1.5 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                Ubicar Sede CZ-23
              </button>
            )}
            {canOperate && (
              <button
                type="button"
                onClick={() =>
                  onAddZoneUnit(selectedDestacamento === 'ALL' ? 'D-231' : selectedDestacamento)
                }
                className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Plus className="w-4 h-4" />
                Agregar Puesto / Compañía
              </button>
            )}
          </div>
        </div>

        {/* Aggregate KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-rose-500/25">
          <div className="bg-black/30 border border-slate-700/70 rounded p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Destacamentos</div>
            <div className="font-mono-tabular text-xl font-bold text-white">3</div>
            <div className="text-[10px] text-slate-400">D-231 · DCR 23-1 · DESUR</div>
          </div>
          <div className="bg-black/30 border border-slate-700/70 rounded p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Compañías</div>
            <div className="font-mono-tabular text-xl font-bold text-emerald-300">
              {totalStats.companias}
            </div>
            <div className="text-[10px] text-slate-400">Desplegadas en Trujillo</div>
          </div>
          <div className="bg-black/30 border border-slate-700/70 rounded p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Puestos / PACs</div>
            <div className="font-mono-tabular text-xl font-bold text-sky-300">
              {totalStats.puestos}
            </div>
            <div className="text-[10px] text-slate-400">Control vial, rural y urbano</div>
          </div>
          <div className="bg-black/30 border border-slate-700/70 rounded p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Guardia Activa</div>
            <div className="font-mono-tabular text-xl font-bold text-amber-300">
              {totalStats.guardia}
            </div>
            <div className="text-[10px] text-slate-400">Efectivos reportados</div>
          </div>
          <div className="bg-black/30 border border-slate-700/70 rounded p-2.5 col-span-2 sm:col-span-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Comisiones / Nov.</div>
            <div className="font-mono-tabular text-xl font-bold text-white">
              {totalStats.activeComms}{' '}
              <span className="text-xs font-normal text-amber-400">
                / {totalStats.openIncidents} nov.
              </span>
            </div>
            <div className="text-[10px] text-slate-400">En curso en la zona</div>
          </div>
        </div>
      </div>

      {/* 3 Destacamentos Command Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {OPERATIONAL_DESTACAMENTOS.map((destId) => {
          const meta = DESTACAMENTO_META[destId];
          const stat = summaryByDest[destId];
          const isSelected = selectedDestacamento === destId;

          return (
            <div
              key={destId}
              className={`bg-[#111822] rounded-lg border p-4 transition-all flex flex-col justify-between gap-3 ${
                isSelected
                  ? `${meta.borderClass} ring-1 ring-white/25 bg-[#151F2C]`
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${meta.badgeClass}`}>
                    {meta.shortLabel}
                  </span>
                  {stat.alertUnits > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-500/60">
                      <AlertTriangle className="w-3 h-3" />
                      {stat.alertUnits} en alerta
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      Operativo
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white leading-snug">
                    {meta.nombreCompleto}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Building2 className="w-3 h-3 shrink-0" />
                    Sede: {meta.sede}
                  </p>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">{meta.mision}</p>

                <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
                  <div className="bg-[#0B1117] border border-slate-800 rounded py-1.5 px-1">
                    <div className="font-mono-tabular text-sm font-bold text-white">
                      {stat.companiasCount}
                    </div>
                    <div className="text-[9px] uppercase text-slate-400">Cías</div>
                  </div>
                  <div className="bg-[#0B1117] border border-slate-800 rounded py-1.5 px-1">
                    <div className="font-mono-tabular text-sm font-bold text-sky-300">
                      {stat.puestosCount}
                    </div>
                    <div className="text-[9px] uppercase text-slate-400">Puestos</div>
                  </div>
                  <div className="bg-[#0B1117] border border-slate-800 rounded py-1.5 px-1">
                    <div className="font-mono-tabular text-sm font-bold text-emerald-300">
                      {stat.activeComms}
                    </div>
                    <div className="text-[9px] uppercase text-slate-400">Comis.</div>
                  </div>
                  <div className="bg-[#0B1117] border border-slate-800 rounded py-1.5 px-1">
                    <div className="font-mono-tabular text-sm font-bold text-amber-300">
                      {stat.efectivosGuardia}
                    </div>
                    <div className="text-[9px] uppercase text-slate-400">Guardia</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onSelectDestacamento(isSelected ? 'ALL' : destId)}
                  className={`flex-1 px-2.5 py-1.5 text-[11px] font-bold rounded cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                  }`}
                >
                  {isSelected ? 'Mostrando este Destacamento' : 'Filtrar Unidades'}
                </button>
                {stat.hq && (
                  <>
                    <button
                      type="button"
                      onClick={() => onLocateUnitOnMap(stat.hq!)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-1 cursor-pointer"
                      title="Ubicar sede en el mapa"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      Mapa
                    </button>
                    {stat.hq.telefono && (
                      <a
                        href={`tel:${sanitizePhoneForTel(stat.hq.telefono)}`}
                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 border border-emerald-700/60 rounded flex items-center gap-1"
                        title={`Llamar a ${stat.hq.nombre}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#111822] border border-slate-800 rounded-lg p-3 flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar destacamento, compañía, PAC, puesto, municipio o comandante..."
            className="w-full pl-9 pr-3 py-2 bg-[#0B1117] border border-slate-700 rounded text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'D-231', 'DCR-23-1', 'DESUR-23', 'CZGNB-23'] as const).map((dest) => (
            <button
              key={dest}
              type="button"
              onClick={() => onSelectDestacamento(dest)}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded border cursor-pointer transition-colors ${
                selectedDestacamento === dest
                  ? 'bg-emerald-600 border-emerald-400 text-white'
                  : 'bg-[#0B1117] border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {dest === 'ALL' ? 'Todos (CZ-23)' : DESTACAMENTO_META[dest].shortLabel}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ZoneUnitStatus | 'ALL')}
          className="px-2.5 py-1.5 bg-[#0B1117] border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          aria-label="Filtrar por estado operativo"
        >
          <option value="ALL">Todos los estados</option>
          <option value="operativo">Operativo Normal</option>
          <option value="reforzado">Reforzado</option>
          <option value="alerta">En Alerta</option>
          <option value="inactivo">Inactivo</option>
        </select>
      </div>

      {/* Hierarchical Org Breakdown: Destacamento -> Compañías -> Puestos / PACs */}
      {groupedByDestAndCompania.length === 0 ? (
        <div className="bg-[#111822] border border-slate-800 rounded-lg p-8 text-center text-slate-400 text-sm">
          No se encontraron unidades ni puestos que coincidan con el filtro seleccionado.
        </div>
      ) : (
        <div className="space-y-6 pb-8">
          {groupedByDestAndCompania.map((group) => (
            <section
              key={group.destId}
              className={`bg-[#0E151E] border rounded-lg overflow-hidden ${group.meta.borderClass}`}
            >
              {/* Destacamento Header */}
              <div className="px-4 py-3 bg-[#151E2B] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${group.meta.badgeClass}`}>
                    {group.meta.shortLabel}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      {group.meta.nombreCompleto}
                    </h3>
                    <div className="text-[11px] text-slate-400 truncate">
                      Sede: {group.meta.sede}
                    </div>
                  </div>
                </div>
                {canOperate && (
                  <button
                    type="button"
                    onClick={() => onAddZoneUnit(group.destId)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-600 rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Añadir en {group.meta.shortLabel}
                  </button>
                )}
              </div>

              <div className="p-4 space-y-4">
                {/* HQ Unit(s) */}
                {group.hqUnits.map((hq) => (
                  <div
                    key={hq.id}
                    className="bg-[#131C28] border border-slate-700/80 rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono-tabular text-[11px] font-bold text-amber-300">
                          {hq.codigo}
                        </span>
                        <span className="text-xs font-bold text-white">{hq.nombre}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUS_BADGE[hq.estadoOperativo]}`}>
                          {ZONE_UNIT_STATUS_LABELS[hq.estadoOperativo]}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        {hq.sector} ({hq.municipio}) · {hq.comandante || 'Comando de Unidad'} ·{' '}
                        <span className="text-emerald-300 font-semibold">
                          {hq.efectivosGuardia} efectivos
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        {hq.frecuenciaRadio && (
                          <span className="font-mono-tabular text-amber-200/90">
                            Radio: {hq.frecuenciaRadio}
                          </span>
                        )}
                        <span className="font-mono-tabular">
                          {formatCoords(hq.lat, hq.lng)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {hq.telefono && (
                        <a
                          href={`tel:${sanitizePhoneForTel(hq.telefono)}`}
                          className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          {hq.telefono}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onLocateUnitOnMap(hq)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded inline-flex items-center gap-1 cursor-pointer"
                      >
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        Mapa
                      </button>
                      {canEditUnit(hq) && (
                        <button
                          type="button"
                          onClick={() => onEditZoneUnit(hq)}
                          className="px-2 py-1.5 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded inline-flex items-center gap-1 cursor-pointer"
                          title="Editar sede"
                        >
                          <Edit3 className="w-3 h-3" />
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Compañías & their Puestos/PACs */}
                {group.companiaGroups.map((cg) => (
                  <div
                    key={cg.compName}
                    className="border border-slate-800 rounded-md overflow-hidden bg-[#0B1117]/70"
                  >
                    {/* Compañía Header */}
                    <div className="px-3.5 py-2.5 bg-[#121A26] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                            {cg.compDoc ? cg.compDoc.codigo : 'COMPAÑÍA'}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-white">
                            {cg.compDoc ? cg.compDoc.nombre : cg.compName}
                          </span>
                          {cg.compDoc && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUS_BADGE[cg.compDoc.estadoOperativo]}`}
                            >
                              {ZONE_UNIT_STATUS_LABELS[cg.compDoc.estadoOperativo]}
                            </span>
                          )}
                        </div>
                        {cg.compDoc && (
                          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                            <span>{cg.compDoc.sector} ({cg.compDoc.municipio})</span>
                            {cg.compDoc.frecuenciaRadio && (
                              <span className="font-mono-tabular text-amber-200/80">
                                · {cg.compDoc.frecuenciaRadio}
                              </span>
                            )}
                            <span>· {cg.puestos.length} Puestos/PACs</span>
                          </div>
                        )}
                      </div>

                      {cg.compDoc && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onLocateUnitOnMap(cg.compDoc!)}
                            className="px-2 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            Mapa
                          </button>
                          {canEditUnit(cg.compDoc) && (
                            <button
                              type="button"
                              onClick={() => onEditZoneUnit(cg.compDoc!)}
                              className="px-2 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              Editar
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Puestos / PACs Grid */}
                    {cg.puestos.length === 0 ? (
                      <div className="p-3 text-[11px] text-slate-500">
                        Sin puestos/PACs registrados bajo esta compañía.
                      </div>
                    ) : (
                      <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                        {cg.puestos.map((p) => {
                          const canEdit = canEditUnit(p);
                          const canDelete = canModerate && (canModerate || p.ownerId === currentUserUid);
                          return (
                            <div
                              key={p.id}
                              className="bg-[#111822] border border-slate-800 hover:border-slate-700 rounded-md p-3 flex flex-col justify-between gap-2.5"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono-tabular text-[10px] font-bold text-emerald-400">
                                        {p.codigo}
                                      </span>
                                      {p.modalidad === 'lacustre' && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-sky-300">
                                          <Waves className="w-3 h-3" />
                                          Lacustre
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="text-xs font-bold text-white leading-snug mt-0.5">
                                      {p.nombre}
                                    </h4>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={!canEdit || busyUnitId === p.id}
                                    onClick={() => handleCycleStatus(p)}
                                    title={
                                      canEdit
                                        ? 'Tocar para cambiar estado operativo'
                                        : ZONE_UNIT_LEVEL_LABELS[p.nivel]
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${STATUS_BADGE[p.estadoOperativo]} ${
                                      canEdit ? 'cursor-pointer hover:opacity-85' : ''
                                    }`}
                                  >
                                    {ZONE_UNIT_STATUS_LABELS[p.estadoOperativo]}
                                  </button>
                                </div>

                                <div className="text-[11px] text-slate-300 leading-snug">
                                  {p.sector} · <span className="text-slate-400">{p.municipio}</span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                                  <span className="inline-flex items-center gap-1 text-slate-300">
                                    <Users className="w-3 h-3 text-emerald-400" />
                                    {p.efectivosGuardia} guardia
                                  </span>
                                  {p.comandante && <span>Cmdte: {p.comandante}</span>}
                                </div>

                                {p.frecuenciaRadio && (
                                  <div className="text-[10px] font-mono-tabular text-amber-200/85">
                                    Radio: {p.frecuenciaRadio}
                                  </div>
                                )}

                                {p.notas && (
                                  <p className="text-[10px] text-slate-400 line-clamp-2">
                                    {p.notas}
                                  </p>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
                                <button
                                  type="button"
                                  onClick={() => onLocateUnitOnMap(p)}
                                  className="px-2 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <MapPin className="w-3 h-3 text-emerald-400" />
                                  Mapa
                                </button>
                                {canOperate && (
                                  <button
                                    type="button"
                                    onClick={() => onDeployCommissionFromUnit(p)}
                                    className="px-2 py-1 text-[10px] font-bold bg-emerald-700 hover:bg-emerald-600 text-white rounded inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Navigation className="w-3 h-3" />
                                    Desplegar
                                  </button>
                                )}
                                {p.telefono && (
                                  <a
                                    href={`tel:${sanitizePhoneForTel(p.telefono)}`}
                                    className="px-2 py-1 text-[10px] font-bold bg-sky-900/70 hover:bg-sky-800 text-sky-100 rounded inline-flex items-center gap-1"
                                    title={`Llamar ${p.telefono}`}
                                  >
                                    <Phone className="w-3 h-3" />
                                  </a>
                                )}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => onEditZoneUnit(p)}
                                    className="px-2 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 rounded inline-flex items-center gap-1 cursor-pointer ml-auto"
                                    title="Editar puesto"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteZoneUnit(p)}
                                    className="px-2 py-1 text-[10px] font-bold bg-slate-800 hover:bg-red-900/80 text-slate-400 hover:text-red-200 rounded inline-flex items-center gap-1 cursor-pointer"
                                    title="Eliminar puesto"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  Check,
  Copy,
  Crosshair,
  Edit3,
  Flame,
  Navigation,
  Phone,
  Radio,
  Share2,
  Shield,
  Skull,
  Truck,
  Users,
} from 'lucide-react';
import {
  AGENCY_SHORT_LABELS,
  AGENCY_STYLES,
  COMMISSION_STATUS_LABELS,
  DESTACAMENTO_META,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  type Commission,
  type FriendlyForce,
  type GangZone,
  type Incident,
} from '../types/operations';
import {
  computeZoneIntelligence,
  evaluateCommissionDeviation,
  formatCoords,
  sanitizePhoneForTel,
} from '../lib/geo';
import {
  CUADRANTE_TYPE_LABELS,
  findNearestCuadrante,
  getCuadranteByCode,
} from '../data/trujilloCuadrantes';

interface CommissionDetailDrawerProps {
  commission: Commission | null;
  allCommissions: Commission[];
  gangZones: GangZone[];
  friendlyForces: FriendlyForce[];
  incidents: Incident[];
  liveGpsCommissionId: string | null;
  patrolRadiusKm: number;
  canOperate?: boolean;
  onToggleLiveGps: (commissionId: string) => void;
  onStartRelocate: () => void;
  onMarkIncidentHere: (coords: { lat: number; lng: number }, commissionId: string) => void;
  onOpenSupportModal: (commission: Commission) => void;
  onEditCommission: (commission: Commission) => void;
  onShareCommission: (commission: Commission) => void;
  onFocusCoords: (lat: number, lng: number, zoom?: number) => void;
}

export const CommissionDetailDrawer: React.FC<CommissionDetailDrawerProps> = ({
  commission,
  allCommissions,
  gangZones,
  friendlyForces,
  incidents,
  liveGpsCommissionId,
  patrolRadiusKm,
  canOperate = true,
  onToggleLiveGps,
  onStartRelocate,
  onMarkIncidentHere,
  onOpenSupportModal,
  onEditCommission,
  onShareCommission,
  onFocusCoords,
}) => {
  const [activeTab, setActiveTab] = useState<'inteligencia' | 'efectivos' | 'armamento'>('inteligencia');
  const [copiedPhone, setCopiedPhone] = useState(false);

  const intel = useMemo(() => {
    if (!commission) return null;
    return computeZoneIntelligence(
      { lat: commission.lat, lng: commission.lng },
      gangZones,
      friendlyForces,
      incidents,
      allCommissions,
      commission.id
    );
  }, [commission, gangZones, friendlyForces, incidents, allCommissions]);

  const deviation = useMemo(() => {
    if (!commission) return null;
    return evaluateCommissionDeviation(commission, patrolRadiusKm);
  }, [commission, patrolRadiusKm]);

  const cuadranteInfo = useMemo(() => {
    if (!commission) return null;
    const assigned = getCuadranteByCode(commission.cuadrantePaz);
    if (assigned) return { cuadrante: assigned, isAssigned: true };
    const nearest = findNearestCuadrante(commission.lat, commission.lng);
    return { cuadrante: nearest.cuadrante, isAssigned: false };
  }, [commission]);

  if (!commission || !intel) {
    return (
      <div className="h-full bg-[#111822] border-l border-slate-800 p-6 flex flex-col justify-center text-center space-y-2">
        <Shield className="w-7 h-7 text-slate-600 mx-auto" />
        <h3 className="font-display text-lg font-bold text-slate-300">
          Selecciona una Comisión
        </h3>
        <p className="text-xs text-slate-500">
          Haz clic en una comisión del listado o del mapa para ver sus efectivos, seriales de armamento, llamar al jefe y recibir inteligencia de bandas y fuerzas amigas en la zona.
        </p>
      </div>
    );
  }

  const isSos = commission.alertaApoyo || commission.estado === 'apoyo_requerido';
  const isLacustre = commission.modalidad === 'lacustre';
  const isGpsActive = liveGpsCommissionId === commission.id;

  const handleCopyPhone = () => {
    navigator.clipboard?.writeText(commission.jefeTelefono).catch(() => {});
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 1800);
  };

  return (
    <aside className="h-full bg-[#111822] border-l border-slate-800 flex flex-col overflow-hidden">
      {/* Commission Summary Header */}
      <div className="p-4 border-b border-slate-800 space-y-3 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  DESTACAMENTO_META[commission.destacamento || 'DCR-23-1'].badgeClass
                }`}
              >
                {DESTACAMENTO_META[commission.destacamento || 'DCR-23-1'].shortLabel}
              </span>
              <span className="font-mono-tabular font-semibold text-slate-200">
                {commission.codigo}
              </span>
              <span aria-hidden="true">·</span>
              <span className={isLacustre ? 'text-sky-400 font-medium' : 'text-emerald-400 font-medium'}>
                {isLacustre ? 'Vía Lacustre' : 'Vía Terrestre'}
              </span>
              <span aria-hidden="true">·</span>
              <span className={isSos ? 'text-red-400 font-semibold' : 'text-slate-300'}>
                {COMMISSION_STATUS_LABELS[commission.estado]}
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-white leading-tight mt-0.5 truncate">
              {commission.nombre}
            </h2>
            {(commission.compania || commission.puesto) && (
              <p className="text-[11px] text-emerald-300/90 truncate mt-0.5">
                {commission.compania}
                {commission.puesto ? ` · ${commission.puesto}` : ''}
              </p>
            )}
            <p className="text-xs text-slate-400 truncate mt-0.5">{commission.sector}</p>
            {cuadranteInfo && (
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-950/80 border border-teal-500/40 text-teal-200 font-mono-tabular font-semibold">
                  <Shield className="w-3 h-3 text-teal-400 shrink-0" />
                  {cuadranteInfo.cuadrante.codigo}
                </span>
                <span className="text-slate-400 truncate">
                  {cuadranteInfo.isAssigned ? 'Cuadrante asignado' : 'Cuadrante más cercano'} ·{' '}
                  {CUADRANTE_TYPE_LABELS[cuadranteInfo.cuadrante.tipo]} ({cuadranteInfo.cuadrante.municipio})
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onShareCommission(commission)}
              className="p-2 text-sky-300 hover:text-white bg-[#192332] hover:bg-[#233247] rounded transition-colors cursor-pointer shrink-0"
              title="Compartir parte operativo"
              aria-label="Compartir parte operativo"
            >
              <Share2 className="w-4 h-4" />
            </button>
            {canOperate && commission.estado !== 'finalizada' && (
              <button
                type="button"
                onClick={() => onEditCommission(commission)}
                className="p-2 text-slate-400 hover:text-white bg-[#192332] hover:bg-[#233247] rounded transition-colors cursor-pointer shrink-0"
                title="Editar comisión"
                aria-label="Editar comisión"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sector Deviation Visual Alert */}
        {deviation?.isDeviated && (
          <div className="bg-orange-950/60 border border-orange-500/70 rounded-md p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-200">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                DESVÍO DEL SECTOR ASIGNADO
              </span>
              <span className="font-mono-tabular text-[11px] font-bold text-orange-300">
                {deviation.distanceKm.toFixed(1)} km / {deviation.maxRadiusKm} km
              </span>
            </div>
            <p className="text-[11px] text-orange-100/90 leading-snug">
              Fuera de geocerca por <span className="font-semibold">+{deviation.excessKm.toFixed(1)} km</span> respecto a{' '}
              <span className="font-semibold">{deviation.sectorAnchor.label}</span>.
            </p>
            <button
              type="button"
              onClick={() =>
                onFocusCoords(deviation.sectorAnchor.lat, deviation.sectorAnchor.lng, 12)
              }
              className="text-[11px] font-semibold text-orange-300 hover:text-orange-200 underline cursor-pointer"
            >
              Centrar mapa en sector asignado
            </button>
          </div>
        )}

        {/* Commander & Direct Call Bar */}
        <div className="bg-[#0B1117] border border-slate-800 rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400">Jefe de Comisión</div>
              <div className="text-sm font-semibold text-white truncate">
                {commission.jefeGrado} {commission.jefeNombre}
              </div>
              <div className="text-[11px] text-slate-400 font-mono-tabular">
                {commission.jefeCedula} · {commission.jefeTelefono}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleCopyPhone}
                className="p-2 bg-[#16202E] hover:bg-[#1E2C40] text-slate-300 rounded-md cursor-pointer"
                title="Copiar teléfono"
              >
                {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <a
                href={`tel:${sanitizePhoneForTel(commission.jefeTelefono)}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5" />
                Llamar Jefe
              </a>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 truncate">
              {isLacustre ? (
                <Anchor className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              ) : (
                <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span className="truncate">{commission.vehiculoTipo}</span>
            </span>
            <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">
              {commission.vehiculoPlaca}
            </span>
          </div>
        </div>

        {/* Tactical Actions Row */}
        {canOperate && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={commission.estado === 'finalizada'}
              onClick={() => onOpenSupportModal(commission)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap ${
                isSos
                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {isSos ? 'Resolver Apoyo' : 'Pedir Apoyo (SOS)'}
            </button>

            <button
              type="button"
              disabled={commission.estado === 'finalizada'}
              onClick={() => onToggleLiveGps(commission.id)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap ${
                isGpsActive
                  ? 'bg-sky-600/25 border-sky-400 text-sky-200'
                  : 'bg-[#192332] border-slate-700 text-slate-200 hover:bg-[#223044]'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              {isGpsActive ? 'Detener GPS Vivo' : 'Transmitir GPS'}
            </button>

            <button
              type="button"
              disabled={commission.estado === 'finalizada'}
              onClick={onStartRelocate}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#192332] hover:bg-[#223044] border border-slate-700/80 text-slate-200 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
            >
              <Crosshair className="w-3.5 h-3.5 shrink-0" />
              Mover en Mapa
            </button>

            <button
              type="button"
              onClick={() =>
                onMarkIncidentHere({ lat: commission.lat, lng: commission.lng }, commission.id)
              }
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#192332] hover:bg-[#223044] border border-slate-700/80 text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Flame className="w-3.5 h-3.5 shrink-0" />
              Novedad Aquí
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-400">
          <span>POS: {formatCoords(commission.lat, commission.lng)}</span>
          <button
            type="button"
            onClick={() => onFocusCoords(commission.lat, commission.lng, 14)}
            className="text-emerald-400 hover:text-emerald-300 font-sans font-medium cursor-pointer"
          >
            Centrar mapa
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="px-4 pt-2 border-b border-slate-800 flex items-center gap-4 text-xs font-semibold shrink-0">
        {(
          [
            { id: 'inteligencia', label: 'Inteligencia Zona' },
            { id: 'efectivos', label: `Efectivos (${commission.efectivos.length})` },
            { id: 'armamento', label: `Armamento (${commission.armamento.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeTab === 'inteligencia' && (
          <>
            {/* Real-Time Gang Threat Recommendations */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Skull className="w-3.5 h-3.5" />
                  Bandas Criminales en la Zona ({intel.gangMatches.slice(0, 3).length})
                </h3>
                <span className="text-[11px] text-slate-500">Tiempo real por GPS</span>
              </div>

              {intel.gangMatches.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No hay zonas de amenaza criminal registradas cerca de esta ubicación.
                </p>
              ) : (
                <div className="space-y-2">
                  {intel.gangMatches.slice(0, 3).map(({ zone, distanceKm: dist, insideRadius }) => (
                    <div
                      key={zone.id}
                      className={`p-3 rounded-md border space-y-1.5 ${
                        insideRadius
                          ? 'bg-red-950/35 border-red-500/45'
                          : 'bg-[#0B1117] border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white leading-snug">
                            {zone.nombre}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {zone.alias ? `${zone.alias} · ` : ''}
                            <span
                              className={
                                insideRadius ? 'text-red-300 font-semibold' : 'text-amber-300'
                              }
                            >
                              {insideRadius
                                ? `DENTRO DEL RADIO (${dist.toFixed(1)} km)`
                                : `A ${dist.toFixed(1)} km`}
                            </span>
                            {' · '}Nivel {zone.nivelAmenaza}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onFocusCoords(zone.lat, zone.lng, 12)}
                          className="text-[11px] text-amber-300 hover:underline shrink-0 cursor-pointer"
                        >
                          Ver
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        <span className="text-slate-400">Actividad:</span>{' '}
                        {zone.delitos.join(' · ')}
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed pt-1 border-t border-slate-800/80">
                        {zone.recomendacionTactica}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Nearest Friendly Forces (PNB, CICPC, Estadal, Municipal, CONAS, GNB, Guardacostas) */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Fuerzas Amigas Cercanas
                </h3>
                <span className="text-[11px] text-slate-500">PNB · CICPC · CONAS · CPET</span>
              </div>

              <div className="space-y-2">
                {intel.friendlyMatches.slice(0, 5).map(({ force, distanceKm: dist, etaMinutes }) => {
                  const style = AGENCY_STYLES[force.organismo];
                  return (
                    <div
                      key={force.id}
                      className={`p-2.5 rounded-md bg-[#0B1117] border flex items-center justify-between gap-2 ${style.cardBorder}`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded shrink-0 ${style.badge}`}
                          >
                            {AGENCY_SHORT_LABELS[force.organismo]}
                          </span>
                          <span className="text-xs font-semibold text-slate-100 truncate">
                            {force.nombre}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-tabular">
                          {dist.toFixed(1)} km · ETA ~{etaMinutes} min
                          {force.frecuenciaRadio ? ` · ${force.frecuenciaRadio}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onFocusCoords(force.lat, force.lng, 13)}
                          className="px-2 py-1 text-[11px] text-slate-300 hover:text-white bg-[#16202E] rounded cursor-pointer"
                        >
                          Mapa
                        </button>
                        <a
                          href={`tel:${sanitizePhoneForTel(force.telefono)}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${style.callButton}`}
                        >
                          <Phone className="w-3 h-3" />
                          Llamar
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Nearby Crime Map Incidents */}
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                Novedades de Criminalidad Cercanas ({intel.nearbyIncidents.length})
              </h3>
              {intel.nearbyIncidents.length === 0 ? (
                <p className="text-xs text-slate-500">Sin novedades registradas en 30 km.</p>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-md bg-[#0B1117]">
                  {intel.nearbyIncidents.slice(0, 4).map(({ incident, distanceKm: dist }) => (
                    <button
                      key={incident.id}
                      type="button"
                      onClick={() => onFocusCoords(incident.lat, incident.lng, 14)}
                      className="w-full text-left p-2.5 hover:bg-[#141D29] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-100 truncate">
                          {incident.titulo}
                        </span>
                        <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">
                          {dist.toFixed(1)} km
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {INCIDENT_TYPE_LABELS[incident.tipo]} · Severidad{' '}
                        {INCIDENT_SEVERITY_LABELS[incident.severidad]} · {incident.municipio}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Nearby Active Friendly Commissions */}
            {intel.nearbyCommissions.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  Otras Comisiones CZGNB-23 Desplegadas
                </h3>
                <div className="space-y-1.5">
                  {intel.nearbyCommissions.slice(0, 3).map(({ commission: peer, distanceKm: dist, etaMinutes }) => (
                    <div
                      key={peer.id}
                      className="p-2.5 rounded-md bg-[#0B1117] border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-100 truncate">
                          {peer.codigo} · {peer.jefeGrado} {peer.jefeNombre}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-tabular">
                          {dist.toFixed(1)} km · ETA ~{etaMinutes} min ·{' '}
                          {peer.modalidad === 'lacustre' ? 'Lacustre' : 'Terrestre'}
                        </div>
                      </div>
                      <a
                        href={`tel:${sanitizePhoneForTel(peer.jefeTelefono)}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded shrink-0"
                      >
                        <Phone className="w-3 h-3" />
                        Llamar
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === 'efectivos' && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Personal Militar Integrante
              </span>
              <span className="font-mono-tabular text-slate-400">
                Total: {commission.efectivos.length} efectivos
              </span>
            </div>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-md bg-[#0B1117]">
              {commission.efectivos.map((eff, idx) => (
                <div key={idx} className="p-3 space-y-0.5">
                  <div className="text-xs font-semibold text-white">
                    {eff.grado} {eff.nombre}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span className="font-mono-tabular">{eff.cedula}</span>
                    <span aria-hidden="true">·</span>
                    <span>{eff.rol}</span>
                  </div>
                </div>
              ))}
            </div>
            {commission.notas && (
              <div className="p-3 rounded-md bg-[#0B1117] border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="text-[11px] font-semibold text-slate-400">Consigna / Notas</div>
                <p className="leading-relaxed">{commission.notas}</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'armamento' && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">
                Manifiesto de Armamento y Seriales
              </span>
              <span className="font-mono-tabular text-slate-400">
                {commission.armamento.length} piezas
              </span>
            </div>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-md bg-[#0B1117]">
              {commission.armamento.map((wp, idx) => (
                <div key={idx} className="p-3 space-y-1">
                  <div className="text-xs font-semibold text-white">{wp.tipo}</div>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono-tabular text-amber-300 font-semibold">
                      SERIAL: {wp.serial}
                    </span>
                    <span className="text-slate-400">{wp.municion}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Asignado a: <span className="text-slate-200">{wp.asignadoA}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
};

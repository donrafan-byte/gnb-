import React, { useState } from 'react';
import { Edit3, MapPin, Phone, Plus, Shield, Skull, Trash2 } from 'lucide-react';
import {
  AGENCY_LABELS,
  AGENCY_SHORT_LABELS,
  AGENCY_STYLES,
  type FriendlyAgency,
  type FriendlyForce,
  type GangZone,
} from '../types/operations';
import { formatCoords, sanitizePhoneForTel } from '../lib/geo';

interface IntelligenceViewProps {
  gangZones: GangZone[];
  friendlyForces: FriendlyForce[];
  currentUserUid?: string;
  canAdd?: boolean;
  canEditAll?: boolean;
  canDeleteOwn?: boolean;
  canDeleteAll?: boolean;
  onAddGangZone: () => void;
  onEditGangZone: (zone: GangZone) => void;
  onAddFriendlyForce: () => void;
  onEditFriendlyForce: (force: FriendlyForce) => void;
  onToggleGangActive: (zone: GangZone) => Promise<void>;
  onToggleForceAvailable: (force: FriendlyForce) => Promise<void>;
  onDeleteGangZone: (zone: GangZone) => void;
  onDeleteFriendlyForce: (force: FriendlyForce) => void;
  onLocateCoords: (lat: number, lng: number, zoom?: number) => void;
}

export const IntelligenceView: React.FC<IntelligenceViewProps> = ({
  gangZones,
  friendlyForces,
  currentUserUid = '',
  canAdd = true,
  canEditAll = true,
  canDeleteOwn = true,
  canDeleteAll = true,
  onAddGangZone,
  onEditGangZone,
  onAddFriendlyForce,
  onEditFriendlyForce,
  onToggleGangActive,
  onToggleForceAvailable,
  onDeleteGangZone,
  onDeleteFriendlyForce,
  onLocateCoords,
}) => {
  const [agencyFilter, setAgencyFilter] = useState<'all' | FriendlyAgency>('all');

  const filteredForces =
    agencyFilter === 'all'
      ? friendlyForces
      : friendlyForces.filter((f) => f.organismo === agencyFilter);

  return (
    <div className="max-w-[1440px] mx-auto p-6 space-y-8">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="font-display text-3xl font-bold text-white">
          Inteligencia de Zona y Fuerzas Amigas — Estado Trujillo
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Base operativa compartida en tiempo real con todos los usuarios autorizados para generar recomendaciones a cada comisión según su ubicación GPS en tierra o en el Lago de Maracaibo.
        </p>
      </div>

      {/* Section 1: Bandas Criminales (GEDO) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-amber-300 flex items-center gap-2">
              <Skull className="w-5 h-5" />
              Bandas Criminales / GEDO en la Zona ({gangZones.length})
            </h2>
            <p className="text-xs text-slate-400">
              Todas las bandas (GEDO) registradas por el Comando o por usuarios autorizados son visibles para todo el personal y activan alertas automáticas en el mapa.
            </p>
          </div>
          {canAdd && (
            <button
              type="button"
              onClick={onAddGangZone}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-md cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Registrar Banda / Zona
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {gangZones.map((zone) => {
            const isOwner = Boolean(currentUserUid && zone.ownerId === currentUserUid);
            const canEditItem = canAdd && (canEditAll || isOwner);
            const canDeleteItem = canDeleteAll || (canDeleteOwn && isOwner);
            return (
            <div
              key={zone.id}
              className={`bg-[#111822] border rounded-md p-4 space-y-3 ${
                !zone.activa
                  ? 'border-slate-800/60 opacity-60'
                  : zone.nivelAmenaza === 'critico'
                    ? 'border-red-500/45'
                    : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-semibold ${
                        zone.nivelAmenaza === 'critico'
                          ? 'text-red-400'
                          : zone.nivelAmenaza === 'alto'
                            ? 'text-amber-400'
                            : 'text-sky-300'
                      }`}
                    >
                      Amenaza {zone.nivelAmenaza.toUpperCase()}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {zone.modalidad === 'lacustre'
                        ? 'Vía Lacustre'
                        : zone.modalidad === 'mixta'
                          ? 'Tierra y Lago'
                          : 'Vía Terrestre'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">Radio {zone.radioKm} km</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white mt-0.5">
                    {zone.nombre}
                  </h3>
                  {zone.alias && (
                    <div className="text-xs text-amber-200/80">Alias: {zone.alias}</div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {canEditItem ? (
                    <button
                      type="button"
                      onClick={() => void onToggleGangActive(zone)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                        zone.activa
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {zone.activa ? 'Activa' : 'Inactiva'}
                    </button>
                  ) : (
                    <span
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                        zone.activa
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {zone.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onLocateCoords(zone.lat, zone.lng, 12)}
                    className="p-1.5 bg-[#192332] hover:bg-[#233247] text-slate-200 rounded cursor-pointer"
                    title="Ver radio en mapa"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </button>
                  {canEditItem && (
                    <button
                      type="button"
                      onClick={() => onEditGangZone(zone)}
                      className="p-1.5 bg-[#192332] hover:bg-[#233247] text-amber-300 hover:text-amber-200 rounded cursor-pointer"
                      title="Editar banda / zona"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDeleteItem && (
                    <button
                      type="button"
                      onClick={() => onDeleteGangZone(zone)}
                      className="p-1.5 bg-[#192332] hover:text-red-400 text-slate-500 rounded cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <div>
                  <span className="text-slate-400">Sector:</span> {zone.sector}{' '}
                  <span className="font-mono-tabular text-[11px] text-slate-500">
                    ({formatCoords(zone.lat, zone.lng)})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Delitos:</span>{' '}
                  {zone.delitos.join(' · ')}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 text-xs text-slate-200 leading-relaxed">
                <span className="text-slate-400 font-semibold">Recomendación táctica: </span>
                {zone.recomendacionTactica}
              </div>
            </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: Fuerzas Amigas (PNB, CICPC, Estadal, Municipal, CONAS, GNB, Guardacostas) */}
      <section className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-sky-300 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Fuerzas Amigas y Organismos de Apoyo ({friendlyForces.length})
            </h2>
            <p className="text-xs text-slate-400">
              PNB, CICPC, Policía Estadal (CPET), Policía Municipal, CONAS, GNB y Guardacostas visibles para todos los usuarios autorizados en tiempo real.
            </p>
          </div>
          {canAdd && (
            <button
              type="button"
              onClick={onAddFriendlyForce}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-md cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Registrar Fuerza Amiga
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-[#111822] border border-slate-800 rounded-md p-1 w-fit">
          <button
            type="button"
            onClick={() => setAgencyFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer ${
              agencyFilter === 'all' ? 'bg-[#1F2D40] text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos
          </button>
          {(Object.keys(AGENCY_SHORT_LABELS) as FriendlyAgency[]).map((key) => {
            const style = AGENCY_STYLES[key];
            const active = agencyFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setAgencyFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded cursor-pointer whitespace-nowrap transition-colors ${
                  active
                    ? style.badge
                    : 'text-slate-300 hover:text-white hover:bg-[#192332]'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${style.dot}`} />
                {AGENCY_SHORT_LABELS[key]}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredForces.map((force) => {
            const style = AGENCY_STYLES[force.organismo];
            const isOwner = Boolean(currentUserUid && force.ownerId === currentUserUid);
            const canEditItem = canAdd && (canEditAll || isOwner);
            const canDeleteItem = canDeleteAll || (canDeleteOwn && isOwner);
            return (
              <div
                key={force.id}
                className={`bg-[#111822] border rounded-md p-4 flex flex-col justify-between gap-3 ${style.cardBorder} ${
                  !force.disponible ? 'opacity-60' : ''
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${style.badge}`}
                    >
                      {AGENCY_LABELS[force.organismo]}
                    </span>
                    {canEditItem ? (
                      <button
                        type="button"
                        onClick={() => void onToggleForceAvailable(force)}
                        className={`text-[11px] font-semibold cursor-pointer shrink-0 ${
                          force.disponible ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {force.disponible ? 'Disponible' : 'No disp.'}
                      </button>
                    ) : (
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          force.disponible ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {force.disponible ? 'Disponible' : 'No disp.'}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-lg font-bold text-white leading-snug">
                    {force.nombre}
                  </h3>
                  <div className="text-xs text-slate-400">{force.sector}</div>
                  <div className="text-xs text-slate-300">{force.capacidad}</div>
                  <div className="text-[11px] font-mono-tabular text-slate-400 pt-1">
                    Radio: {force.frecuenciaRadio || 'N/A'} · Tel: {force.telefono}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <a
                    href={`tel:${sanitizePhoneForTel(force.telefono)}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${style.callButton}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Llamar
                  </a>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onLocateCoords(force.lat, force.lng, 13)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-200 bg-[#192332] hover:bg-[#233247] rounded cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Mapa
                    </button>
                    {canEditItem && (
                      <button
                        type="button"
                        onClick={() => onEditFriendlyForce(force)}
                        className="p-1.5 text-sky-300 hover:text-sky-200 bg-[#192332] hover:bg-[#233247] rounded cursor-pointer"
                        title="Editar fuerza amiga"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDeleteItem && (
                      <button
                        type="button"
                        onClick={() => onDeleteFriendlyForce(force)}
                        className="p-1.5 text-slate-500 hover:text-red-400 bg-[#192332] rounded cursor-pointer"
                        title="Eliminar"
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
      </section>
    </div>
  );
};

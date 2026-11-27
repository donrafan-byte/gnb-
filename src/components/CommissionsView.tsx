import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  Edit3,
  MapPin,
  Phone,
  Plus,
  Search,
  Share2,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  COMMISSION_STATUS_LABELS,
  DESTACAMENTO_META,
  type Commission,
  type DestacamentoId,
} from '../types/operations';
import { formatCoords, sanitizePhoneForTel } from '../lib/geo';

interface CommissionsViewProps {
  commissions: Commission[];
  selectedDestacamento?: DestacamentoId | 'ALL';
  onSelectDestacamento?: (dest: DestacamentoId | 'ALL') => void;
  canOperate?: boolean;
  canDelete?: boolean;
  onNewCommission: () => void;
  onEditCommission: (commission: Commission) => void;
  onLocateCommission: (commission: Commission) => void;
  onOpenSupportModal: (commission: Commission) => void;
  onShareCommission: (commission: Commission) => void;
  onDeleteCommission: (commission: Commission) => void;
}

export const CommissionsView: React.FC<CommissionsViewProps> = ({
  commissions,
  selectedDestacamento = 'ALL',
  onSelectDestacamento,
  canOperate = true,
  canDelete = true,
  onNewCommission,
  onEditCommission,
  onLocateCommission,
  onOpenSupportModal,
  onShareCommission,
  onDeleteCommission,
}) => {
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'terrestre' | 'lacustre' | 'apoyo'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commissions.filter((c) => {
      if (
        selectedDestacamento !== 'ALL' &&
        (c.destacamento || 'DCR-23-1') !== selectedDestacamento
      ) {
        return false;
      }
      if (modeFilter === 'terrestre' && c.modalidad !== 'terrestre') return false;
      if (modeFilter === 'lacustre' && c.modalidad !== 'lacustre') return false;
      if (modeFilter === 'apoyo' && !c.alertaApoyo && c.estado !== 'apoyo_requerido') return false;

      if (!q) return true;
      const inWeapons = c.armamento.some(
        (w) => w.serial.toLowerCase().includes(q) || w.tipo.toLowerCase().includes(q)
      );
      const inPersonnel = c.efectivos.some(
        (e) => e.nombre.toLowerCase().includes(q) || e.cedula.toLowerCase().includes(q)
      );
      return (
        c.codigo.toLowerCase().includes(q) ||
        c.nombre.toLowerCase().includes(q) ||
        (c.destacamento || '').toLowerCase().includes(q) ||
        (c.compania || '').toLowerCase().includes(q) ||
        (c.puesto || '').toLowerCase().includes(q) ||
        c.jefeNombre.toLowerCase().includes(q) ||
        c.vehiculoTipo.toLowerCase().includes(q) ||
        c.vehiculoPlaca.toLowerCase().includes(q) ||
        c.sector.toLowerCase().includes(q) ||
        inWeapons ||
        inPersonnel
      );
    });
  }, [commissions, query, modeFilter, selectedDestacamento]);

  const totalPersonnel = commissions
    .filter((c) => c.estado !== 'finalizada')
    .reduce((acc, c) => acc + c.efectivos.length, 0);
  const totalWeapons = commissions
    .filter((c) => c.estado !== 'finalizada')
    .reduce((acc, c) => acc + c.armamento.length, 0);
  const activeLacustre = commissions.filter(
    (c) => c.estado !== 'finalizada' && c.modalidad === 'lacustre'
  ).length;
  const activeTerrestre = commissions.filter(
    (c) => c.estado !== 'finalizada' && c.modalidad === 'terrestre'
  ).length;

  return (
    <div className="max-w-[1440px] mx-auto p-6 space-y-6">
      {/* Header & KPI Strip */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">
            Registro de Comisiones, Efectivos y Armamento
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Control simultáneo de comisiones desplegadas en los 3 Destacamentos del Comando de Zona Nro. 23 GNB Trujillo (D-231, DCR 23-1 y DESUR-23).
          </p>
        </div>
        {canOperate && (
          <button
            type="button"
            onClick={onNewCommission}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Desplegar Comisión
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111822] border border-slate-800 rounded-md p-4">
          <div className="text-xs text-slate-400">Comisiones Activas</div>
          <div className="font-mono-tabular text-2xl font-bold text-white mt-1">
            {activeTerrestre + activeLacustre}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {activeTerrestre} Terrestres · {activeLacustre} Lacustres
          </div>
        </div>
        <div className="bg-[#111822] border border-slate-800 rounded-md p-4">
          <div className="text-xs text-slate-400">Efectivos en Campo</div>
          <div className="font-mono-tabular text-2xl font-bold text-emerald-400 mt-1">
            {totalPersonnel}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Personal militar asignado</div>
        </div>
        <div className="bg-[#111822] border border-slate-800 rounded-md p-4">
          <div className="text-xs text-slate-400">Armamento Controlado</div>
          <div className="font-mono-tabular text-2xl font-bold text-amber-300 mt-1">
            {totalWeapons}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Piezas con serial verificado</div>
        </div>
        <div className="bg-[#111822] border border-slate-800 rounded-md p-4">
          <div className="text-xs text-slate-400">Alertas de Apoyo (SOS)</div>
          <div className="font-mono-tabular text-2xl font-bold text-red-400 mt-1">
            {commissions.filter((c) => c.alertaApoyo).length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Solicitudes activas</div>
        </div>
      </div>

      {/* Search & Segmented Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código, jefe, placa, efectivo o serial de arma..."
            className="w-full bg-[#111822] border border-slate-800 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {onSelectDestacamento && (
          <div className="flex items-center gap-1 bg-[#111822] border border-slate-800 rounded-md p-1 overflow-x-auto">
            {(['ALL', 'D-231', 'DCR-23-1', 'DESUR-23'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDestacamento(d)}
                className={`px-2.5 py-1.5 text-xs font-bold rounded transition-colors cursor-pointer whitespace-nowrap ${
                  selectedDestacamento === d
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {d === 'ALL' ? 'CZ-23 Todos' : DESTACAMENTO_META[d].shortLabel}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 bg-[#111822] border border-slate-800 rounded-md p-1">
          {(
            [
              { id: 'all', label: 'Todas' },
              { id: 'terrestre', label: 'Terrestres' },
              { id: 'lacustre', label: 'Lacustres' },
              { id: 'apoyo', label: 'En Apoyo (SOS)' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setModeFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                modeFilter === f.id
                  ? 'bg-[#1F2D40] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Commission Table / Cards */}
      {filtered.length === 0 ? (
        <div className="bg-[#111822] border border-slate-800 rounded-md p-10 text-center space-y-3">
          <p className="text-sm text-slate-400">
            No se encontraron comisiones con los criterios actuales.
          </p>
          {canOperate && (
            <button
              type="button"
              onClick={onNewCommission}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Crear Comisión
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((comm) => {
            const isSos = comm.alertaApoyo || comm.estado === 'apoyo_requerido';
            const isLacustre = comm.modalidad === 'lacustre';
            return (
              <div
                key={comm.id}
                className={`bg-[#111822] border rounded-md p-4 space-y-4 ${
                  isSos ? 'border-red-500/70' : 'border-slate-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          DESTACAMENTO_META[comm.destacamento || 'DCR-23-1'].badgeClass
                        }`}
                      >
                        {DESTACAMENTO_META[comm.destacamento || 'DCR-23-1'].shortLabel}
                      </span>
                      <span className="font-mono-tabular font-bold text-white">
                        {comm.codigo}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          isLacustre ? 'text-sky-400' : 'text-emerald-400'
                        }`}
                      >
                        {isLacustre ? (
                          <Anchor className="w-3.5 h-3.5" />
                        ) : (
                          <Truck className="w-3.5 h-3.5" />
                        )}
                        {isLacustre ? 'Vía Lacustre' : 'Vía Terrestre'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={isSos ? 'text-red-400 font-semibold' : 'text-slate-300'}>
                        {COMMISSION_STATUS_LABELS[comm.estado]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {formatCoords(comm.lat, comm.lng)}
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-bold text-white">
                      {comm.nombre}
                    </h3>
                    {(comm.compania || comm.puesto) && (
                      <div className="text-[11px] text-slate-400">
                        {comm.compania}
                        {comm.puesto ? ` · ${comm.puesto}` : ''}
                      </div>
                    )}
                    <div className="text-xs text-slate-300">
                      <span className="text-slate-400">Jefe:</span>{' '}
                      <span className="font-semibold text-white">
                        {comm.jefeGrado} {comm.jefeNombre}
                      </span>{' '}
                      <span className="text-slate-400 font-mono-tabular">
                        ({comm.jefeCedula} · {comm.jefeTelefono})
                      </span>
                      {' · '}
                      <span className="text-slate-400">Unidad:</span> {comm.vehiculoTipo} (
                      <span className="font-mono-tabular">{comm.vehiculoPlaca}</span>)
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={`tel:${sanitizePhoneForTel(comm.jefeTelefono)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md whitespace-nowrap"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Llamar Jefe
                    </a>
                    <button
                      type="button"
                      onClick={() => onLocateCommission(comm)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#192332] hover:bg-[#233247] text-slate-100 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Ver en Mapa
                    </button>
                    <button
                      type="button"
                      onClick={() => onShareCommission(comm)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#192332] hover:bg-[#233247] text-sky-300 rounded-md cursor-pointer whitespace-nowrap"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Compartir
                    </button>
                    {canOperate && comm.estado !== 'finalizada' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenSupportModal(comm)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap ${
                            isSos
                              ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                              : 'bg-red-600/90 hover:bg-red-500 text-white'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {isSos ? 'Resolver SOS' : 'Pedir Apoyo'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditCommission(comm)}
                          className="p-1.5 text-slate-400 hover:text-white bg-[#192332] rounded-md cursor-pointer"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDeleteCommission(comm)}
                        className="p-1.5 text-slate-500 hover:text-red-400 bg-[#192332] rounded-md cursor-pointer"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Personnel & Weapon Serials Split */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-2">
                      Efectivos Integrantes ({comm.efectivos.length})
                    </div>
                    <div className="space-y-1 text-xs">
                      {comm.efectivos.map((e, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/50 last:border-b-0"
                        >
                          <span className="text-slate-100">
                            {e.grado} {e.nombre}
                          </span>
                          <span className="text-slate-400 font-mono-tabular text-[11px]">
                            {e.cedula} · {e.rol}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-2">
                      Armamento y Seriales ({comm.armamento.length})
                    </div>
                    <div className="space-y-1 text-xs">
                      {comm.armamento.map((w, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/50 last:border-b-0"
                        >
                          <span className="text-slate-200 truncate">{w.tipo}</span>
                          <span className="font-mono-tabular text-amber-300 font-semibold text-[11px] shrink-0">
                            {w.serial}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

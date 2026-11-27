import React, { useEffect, useMemo, useState } from 'react';
import { Crosshair, MapPin, Shield, Trash2, X } from 'lucide-react';
import {
  DESTACAMENTO_META,
  PHONE_REGEX,
  TRUJILLO_BOUNDS,
  TRUJILLO_MUNICIPALITIES,
  ZONE_UNIT_LEVEL_LABELS,
  ZONE_UNIT_STATUS_LABELS,
  type DestacamentoId,
  type GangOperationMode,
  type ZoneUnit,
  type ZoneUnitLevel,
  type ZoneUnitStatus,
} from '../types/operations';
import { getCompaniasForDestacamento } from '../data/czgnb23Structure';

export interface ZoneUnitFormValues {
  codigo: string;
  nombre: string;
  nivel: ZoneUnitLevel;
  destacamento: DestacamentoId;
  compania: string;
  municipio: string;
  sector: string;
  modalidad: GangOperationMode;
  comandante: string;
  telefono: string;
  frecuenciaRadio: string;
  efectivosGuardia: number;
  estadoOperativo: ZoneUnitStatus;
  lat: number;
  lng: number;
  notas: string;
}

interface ZoneUnitFormModalProps {
  open: boolean;
  existingUnit?: ZoneUnit | null;
  defaultDestacamento?: DestacamentoId;
  defaultNivel?: ZoneUnitLevel;
  defaultCompania?: string;
  defaultCoords?: { lat: number; lng: number } | null;
  canDelete?: boolean;
  allUnits: ZoneUnit[];
  onClose: () => void;
  onStartRelocateOnMap?: (unit: ZoneUnit) => void;
  onRequestDelete?: (unit: ZoneUnit) => void;
  onSubmit: (values: ZoneUnitFormValues, editingId?: string) => Promise<void>;
}

export const ZoneUnitFormModal: React.FC<ZoneUnitFormModalProps> = ({
  open,
  existingUnit,
  defaultDestacamento = 'D-231',
  defaultNivel = 'puesto_pac',
  defaultCompania,
  defaultCoords,
  canDelete = false,
  allUnits,
  onClose,
  onStartRelocateOnMap,
  onRequestDelete,
  onSubmit,
}) => {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [nivel, setNivel] = useState<ZoneUnitLevel>('puesto_pac');
  const [destacamento, setDestacamento] = useState<DestacamentoId>(defaultDestacamento);
  const [compania, setCompania] = useState('');
  const [municipio, setMunicipio] = useState('Valera');
  const [sector, setSector] = useState('');
  const [modalidad, setModalidad] = useState<GangOperationMode>('terrestre');
  const [comandante, setComandante] = useState('');
  const [telefono, setTelefono] = useState('');
  const [frecuenciaRadio, setFrecuenciaRadio] = useState('VHF 154.650 MHz');
  const [efectivosGuardia, setEfectivosGuardia] = useState('12');
  const [estadoOperativo, setEstadoOperativo] = useState<ZoneUnitStatus>('operativo');
  const [lat, setLat] = useState('9.3368');
  const [lng, setLng] = useState('-70.6062');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companiaOptions = useMemo(
    () => getCompaniasForDestacamento(allUnits, destacamento),
    [allUnits, destacamento]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (existingUnit) {
      setCodigo(existingUnit.codigo);
      setNombre(existingUnit.nombre);
      setNivel(existingUnit.nivel);
      setDestacamento(existingUnit.destacamento);
      setCompania(existingUnit.compania);
      setMunicipio(existingUnit.municipio);
      setSector(existingUnit.sector);
      setModalidad(existingUnit.modalidad);
      setComandante(existingUnit.comandante);
      setTelefono(existingUnit.telefono);
      setFrecuenciaRadio(existingUnit.frecuenciaRadio);
      setEfectivosGuardia(String(existingUnit.efectivosGuardia ?? 0));
      setEstadoOperativo(existingUnit.estadoOperativo);
      setLat(String(existingUnit.lat));
      setLng(String(existingUnit.lng));
      setNotas(existingUnit.notas);
    } else {
      const meta = DESTACAMENTO_META[defaultDestacamento];
      const comps = getCompaniasForDestacamento(allUnits, defaultDestacamento);
      const levelPrefix =
        defaultNivel === 'compania'
          ? 'CIA'
          : defaultNivel === 'destacamento'
            ? 'DEST'
            : 'PAC';
      setCodigo(`${meta.prefijoComision}-${levelPrefix}-`);
      setNombre('');
      setNivel(defaultNivel);
      setDestacamento(defaultDestacamento);
      setCompania(
        defaultCompania !== undefined
          ? defaultCompania
          : defaultNivel === 'compania'
            ? ''
            : comps[0] || ''
      );
      setMunicipio(meta.municipioSede);
      setSector('');
      setModalidad('terrestre');
      setComandante('');
      setTelefono('');
      setFrecuenciaRadio(
        defaultDestacamento === 'DESUR-23'
          ? 'UHF 456.230 MHz'
          : defaultDestacamento === 'DCR-23-1'
            ? 'VHF 154.825 MHz'
            : 'VHF 154.650 MHz'
      );
      setEfectivosGuardia(defaultNivel === 'compania' ? '28' : '10');
      setEstadoOperativo('operativo');
      setLat((defaultCoords?.lat ?? meta.lat).toFixed(6));
      setLng((defaultCoords?.lng ?? meta.lng).toFixed(6));
      setNotas('');
    }
  }, [open, existingUnit, defaultDestacamento, defaultNivel, defaultCompania, defaultCoords, allUnits]);

  if (!open) return null;

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      setError('El navegador no soporta geolocalización GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setError(null);
      },
      () => {
        setError('No se pudo obtener la posición GPS. Verifique permisos.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedGuard = Math.round(Number(efectivosGuardia));

    if (codigo.trim().length < 2 || codigo.trim().length > 32) {
      setError('El código debe tener entre 2 y 32 caracteres.');
      return;
    }
    if (nombre.trim().length < 2 || nombre.trim().length > 120) {
      setError('El nombre de la unidad/puesto debe tener entre 2 y 120 caracteres.');
      return;
    }
    if (sector.trim().length < 2 || sector.trim().length > 100) {
      setError('Indique el sector o ubicación exacta (2 a 100 caracteres).');
      return;
    }
    if (telefono.trim() && !PHONE_REGEX.test(telefono.trim())) {
      setError('Formato de teléfono inválido (ej: +58 271-2352300 o 0414-7000000).');
      return;
    }
    if (!Number.isFinite(parsedGuard) || parsedGuard < 0 || parsedGuard > 500) {
      setError('Efectivos de guardia debe estar entre 0 y 500.');
      return;
    }
    if (
      !Number.isFinite(parsedLat) ||
      !Number.isFinite(parsedLng) ||
      parsedLat < TRUJILLO_BOUNDS.minLat ||
      parsedLat > TRUJILLO_BOUNDS.maxLat ||
      parsedLng < TRUJILLO_BOUNDS.minLng ||
      parsedLng > TRUJILLO_BOUNDS.maxLng
    ) {
      setError(
        `Coordenadas fuera del Estado Trujillo (Lat ${TRUJILLO_BOUNDS.minLat}..${TRUJILLO_BOUNDS.maxLat}, Lng ${TRUJILLO_BOUNDS.minLng}..${TRUJILLO_BOUNDS.maxLng}).`
      );
      return;
    }

    setSaving(true);
    try {
      const normalizedCompania =
        nivel === 'compania' && !compania.trim()
          ? nombre.trim()
          : compania.trim();
      await onSubmit(
        {
          codigo: codigo.trim().toUpperCase().slice(0, 32),
          nombre: nombre.trim().slice(0, 120),
          nivel,
          destacamento,
          compania: normalizedCompania.slice(0, 100),
          municipio: municipio.trim().slice(0, 80),
          sector: sector.trim().slice(0, 100),
          modalidad,
          comandante: comandante.trim().slice(0, 100),
          telefono: telefono.trim().slice(0, 24),
          frecuenciaRadio: frecuenciaRadio.trim().slice(0, 40),
          efectivosGuardia: parsedGuard,
          estadoOperativo,
          lat: parsedLat,
          lng: parsedLng,
          notas: notas.trim().slice(0, 400),
        },
        existingUnit?.id
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar la unidad. Intente de nuevo.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl bg-[#111822] border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-4 py-3 bg-[#151F2D] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">
              {existingUnit
                ? `Editar Unidad — ${existingUnit.codigo}`
                : 'Registrar Compañía / Puesto / PAC en CZGNB-23'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 bg-red-950/70 border border-red-500/70 rounded text-red-200 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Destacamento *
              </label>
              <select
                value={destacamento}
                onChange={(e) => {
                  const next = e.target.value as DestacamentoId;
                  setDestacamento(next);
                  const comps = getCompaniasForDestacamento(allUnits, next);
                  if (comps.length > 0 && !existingUnit) {
                    setCompania(comps[0]);
                  }
                }}
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="D-231">D-231 (Destacamento 231)</option>
                <option value="DCR-23-1">DCR 23-1 (Comandos Rurales)</option>
                <option value="DESUR-23">DESUR-23 (Seguridad Urbana)</option>
                <option value="CZGNB-23">CZGNB-23 (Comando de Zona)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Nivel Orgánico *
              </label>
              <select
                value={nivel}
                onChange={(e) => setNivel(e.target.value as ZoneUnitLevel)}
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
              >
                {Object.entries(ZONE_UNIT_LEVEL_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Código Táctico *
              </label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                maxLength={32}
                required
                placeholder="Ej. D231-PAC-MOT"
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white font-mono-tabular uppercase focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Nombre de la Unidad / Puesto / PAC *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={120}
                required
                placeholder="Ej. PAC La Lagunita / Puesto GNB Monay"
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Compañía de Adscripción
              </label>
              <input
                type="text"
                list="cz23-companias-list"
                value={compania}
                onChange={(e) => setCompania(e.target.value)}
                maxLength={100}
                placeholder="Ej. 1ra Compañía D-231"
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
              />
              <datalist id="cz23-companias-list">
                {companiaOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Municipio *
              </label>
              <select
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
              >
                {TRUJILLO_MUNICIPALITIES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Modalidad *
              </label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as GangOperationMode)}
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="terrestre">Terrestre</option>
                <option value="lacustre">Lacustre</option>
                <option value="mixta">Mixta (Terrestre / Lacustre)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Estado Operativo *
              </label>
              <select
                value={estadoOperativo}
                onChange={(e) => setEstadoOperativo(e.target.value as ZoneUnitStatus)}
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
              >
                {Object.entries(ZONE_UNIT_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Sector / Dirección Operativa *
            </label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              maxLength={100}
              required
              placeholder="Ej. Distribuidor Agua Viva — Troncal 001"
              className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Comandante / Jefe de Puesto
              </label>
              <input
                type="text"
                value={comandante}
                onChange={(e) => setComandante(e.target.value)}
                maxLength={100}
                placeholder="Ej. Cap. Juan Pérez"
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Teléfono Comando
              </label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                maxLength={24}
                placeholder="+58 271-0000000"
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Efectivos Guardia
              </label>
              <input
                type="number"
                min={0}
                max={500}
                value={efectivosGuardia}
                onChange={(e) => setEfectivosGuardia(e.target.value)}
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white font-mono-tabular focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Frecuencia Radio
              </label>
              <input
                type="text"
                value={frecuenciaRadio}
                onChange={(e) => setFrecuenciaRadio(e.target.value)}
                maxLength={40}
                placeholder="VHF 154.650 MHz"
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white font-mono-tabular focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Latitud (Trujillo) *
              </label>
              <input
                type="number"
                step="0.000001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
                className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white font-mono-tabular focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Longitud (Trujillo) *
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  required
                  className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white font-mono-tabular focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleCaptureGps}
                  className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-600 rounded cursor-pointer shrink-0"
                  title="Usar mi GPS actual"
                >
                  <Crosshair className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Misión / Observaciones Operativas
            </label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={400}
              placeholder="Jurisdicción, puntos de control vial, apoyo lacustre o instalaciones estratégicas bajo resguardo..."
              className="w-full px-2.5 py-2 bg-[#0B1117] border border-slate-700 rounded text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              {existingUnit && onStartRelocateOnMap && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartRelocateOnMap(existingUnit);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-sky-200 hover:text-white bg-sky-900/70 hover:bg-sky-800 border border-sky-600/60 rounded inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Reubicar en Mapa
                </button>
              )}
              {existingUnit && canDelete && onRequestDelete && existingUnit.nivel !== 'comando_zona' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequestDelete(existingUnit);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-red-200 hover:text-white bg-red-950/70 hover:bg-red-800 border border-red-600/60 rounded inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded cursor-pointer"
              >
                {saving
                  ? 'Guardando...'
                  : existingUnit
                    ? 'Guardar Cambios'
                    : nivel === 'compania'
                      ? 'Crear Compañía'
                      : 'Crear Puesto / PAC'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

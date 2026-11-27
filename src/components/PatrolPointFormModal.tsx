import React, { useMemo, useState } from 'react';
import { ClipboardCheck, Crosshair, Shield, X } from 'lucide-react';
import {
  LIGHTING_CONDITION_LABELS,
  PATROL_CONDITION_LABELS,
  TRAFFIC_FLOW_LABELS,
  TRUJILLO_MUNICIPALITIES,
  type Commission,
  type LightingCondition,
  type OperationMode,
  type PatrolCondition,
  type PatrolPoint,
  type TrafficFlow,
} from '../types/operations';
import {
  CUADRANTE_TYPE_LABELS,
  TRUJILLO_CUADRANTES_PAZ,
  findNearestCuadrante,
  getCuadranteByCode,
} from '../data/trujilloCuadrantes';
import { inferOperationModeFromCoords } from '../lib/geo';
import { GeoPhotoPicker } from './GeoPhotoPicker';

export type PatrolPointFormPayload = Omit<
  PatrolPoint,
  'id' | 'ownerId' | 'createdAt' | 'updatedAt'
>;

interface PatrolPointFormModalProps {
  initialCoords: { lat: number; lng: number };
  commissions: Commission[];
  defaultCommissionId?: string;
  defaultOfficerName?: string;
  defaultCuadrantePaz?: string;
  defaultMunicipio?: string;
  defaultSector?: string;
  defaultModalidad?: OperationMode;
  onClose: () => void;
  onSave: (payload: PatrolPointFormPayload) => Promise<void>;
}

export const PatrolPointFormModal: React.FC<PatrolPointFormModalProps> = ({
  initialCoords,
  commissions,
  defaultCommissionId = '',
  defaultOfficerName = 'Oficial de Guardia DCR 23-1',
  defaultCuadrantePaz,
  defaultMunicipio,
  defaultSector,
  defaultModalidad,
  onClose,
  onSave,
}) => {
  const nearest = useMemo(
    () => findNearestCuadrante(initialCoords.lat, initialCoords.lng),
    [initialCoords.lat, initialCoords.lng]
  );
  const inferredMode = inferOperationModeFromCoords(initialCoords.lat, initialCoords.lng);
  const initialComm = commissions.find((c) => c.id === defaultCommissionId);
  const initialCuadrante =
    getCuadranteByCode(defaultCuadrantePaz) ??
    getCuadranteByCode(initialComm?.cuadrantePaz) ??
    nearest.cuadrante;

  const [titulo, setTitulo] = useState(
    defaultCuadrantePaz && initialCuadrante
      ? `Patrullaje Preventivo ${initialCuadrante.codigo}`
      : ''
  );
  const [cuadrantePaz, setCuadrantePaz] = useState(initialCuadrante?.codigo ?? '');
  const [sector, setSector] = useState(
    defaultSector ?? initialComm?.sector ?? initialCuadrante?.sectores.split(',')[0] ?? ''
  );
  const [municipio, setMunicipio] = useState(
    defaultMunicipio ?? initialCuadrante?.municipio ?? 'La Ceiba'
  );
  const [modalidad, setModalidad] = useState<OperationMode>(
    defaultModalidad ?? initialComm?.modalidad ?? initialCuadrante?.modalidad ?? inferredMode
  );
  const [commissionId, setCommissionId] = useState(defaultCommissionId);
  const [patrulladoPor, setPatrulladoPor] = useState(
    initialComm ? `${initialComm.jefeGrado} ${initialComm.jefeNombre}` : defaultOfficerName
  );
  const [condicionSector, setCondicionSector] = useState<PatrolCondition>(
    initialCuadrante?.tipo === 'vial' ? 'control_vial' : 'sin_novedad'
  );
  const [flujoVehicular, setFlujoVehicular] = useState<TrafficFlow>('bajo');
  const [iluminacion, setIluminacion] = useState<LightingCondition>('diurno');
  const [caracteristicasVistas, setCaracteristicasVistas] = useState('');
  const [lat, setLat] = useState(initialCoords.lat.toFixed(6));
  const [lng, setLng] = useState(initialCoords.lng.toFixed(6));
  const [fotoDataUrl, setFotoDataUrl] = useState('');
  const [fotoCoordenadas, setFotoCoordenadas] = useState('');
  const [locatingGps, setLocatingGps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCuadranteObj = getCuadranteByCode(cuadrantePaz);

  const handleCuadranteChange = (code: string) => {
    setCuadrantePaz(code);
    const q = getCuadranteByCode(code);
    if (q) {
      setMunicipio(q.municipio);
      setModalidad(q.modalidad);
      if (q.tipo === 'vial') {
        setCondicionSector('control_vial');
      }
      if (!sector.trim()) {
        setSector(q.sectores.split(',')[0].trim().slice(0, 100));
      }
    }
  };

  const handleUseMyGps = () => {
    if (!navigator.geolocation) {
      setError('Este navegador no soporta GPS.');
      return;
    }
    setLocatingGps(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        setLat(nextLat.toFixed(6));
        setLng(nextLng.toFixed(6));
        const closest = findNearestCuadrante(nextLat, nextLng);
        if (closest?.cuadrante) {
          setCuadrantePaz(closest.cuadrante.codigo);
          setMunicipio(closest.cuadrante.municipio);
        }
        setLocatingGps(false);
      },
      () => {
        setError('No se pudo obtener la señal GPS actual. Verifica los permisos de ubicación.');
        setLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (
      Number.isNaN(parsedLat) ||
      Number.isNaN(parsedLng) ||
      parsedLat < -90 ||
      parsedLat > 90 ||
      parsedLng < -180 ||
      parsedLng > 180
    ) {
      setError('Coordenadas geográficas inválidas.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        titulo: titulo.trim().slice(0, 120),
        sector: sector.trim().slice(0, 100),
        municipio: municipio.trim().slice(0, 80),
        cuadrantePaz: cuadrantePaz.trim().slice(0, 40),
        modalidad,
        commissionId: commissionId.trim().slice(0, 128),
        patrulladoPor: patrulladoPor.trim().slice(0, 100),
        condicionSector,
        flujoVehicular,
        iluminacion,
        caracteristicasVistas: caracteristicasVistas.trim().slice(0, 700),
        lat: Number(parsedLat.toFixed(6)),
        lng: Number(parsedLng.toFixed(6)),
        fotoDataUrl,
        fotoCoordenadas: fotoCoordenadas.slice(0, 140),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el punto patrullado.');
    } finally {
      setSaving(false);
    }
  };

  const numericLat = Number(lat);
  const numericLng = Number(lng);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#111822] border border-slate-700 rounded-lg max-w-xl w-full shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <ClipboardCheck className="w-5 h-5 text-teal-400 shrink-0" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Registrar Patrullaje / Cuadrante de Paz
              </h2>
              <p className="text-[11px] text-slate-400 font-mono-tabular">
                Coordenadas: {Number.isFinite(numericLat) ? numericLat.toFixed(5) : '0'},{' '}
                {Number.isFinite(numericLng) ? numericLng.toFixed(5) : '0'}
                {cuadrantePaz ? ` · ${cuadrantePaz}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded bg-red-950/70 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Cuadrante de Paz Selector */}
          <div className="bg-teal-950/30 border border-teal-500/35 rounded-md p-3 space-y-2">
            <label className="block text-xs font-semibold text-teal-200 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-teal-400" />
              Cuadrante de Paz Patrullado — Estado Trujillo
            </label>
            <select
              value={cuadrantePaz}
              onChange={(e) => handleCuadranteChange(e.target.value)}
              className="w-full bg-[#0B1117] border border-teal-700/60 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-teal-400"
            >
              <option value="">Sin asignar / Patrullaje fuera de cuadrante</option>
              {TRUJILLO_CUADRANTES_PAZ.map((q) => (
                <option key={q.codigo} value={q.codigo}>
                  {q.codigo} · {q.municipio} — {q.nombre} ({CUADRANTE_TYPE_LABELS[q.tipo]})
                </option>
              ))}
            </select>
            {selectedCuadranteObj && (
              <div className="text-[11px] text-teal-200/80 leading-snug">
                <span className="font-semibold text-teal-300">Cobertura:</span>{' '}
                {selectedCuadranteObj.sectores} · <span className="text-slate-300">{selectedCuadranteObj.organismo}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Nombre del Punto / Sector Patrullado
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={120}
              placeholder="Ej. Recorrido Cuadrante Vial Troncal 001 / Verificación Santa Apolonia"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Condición del Sector</label>
              <select
                value={condicionSector}
                onChange={(e) => setCondicionSector(e.target.value as PatrolCondition)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                {(Object.keys(PATROL_CONDITION_LABELS) as PatrolCondition[]).map((key) => (
                  <option key={key} value={key}>
                    {PATROL_CONDITION_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Flujo Vehicular / Lanchas</label>
              <select
                value={flujoVehicular}
                onChange={(e) => setFlujoVehicular(e.target.value as TrafficFlow)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                {(Object.keys(TRAFFIC_FLOW_LABELS) as TrafficFlow[]).map((key) => (
                  <option key={key} value={key}>
                    {TRAFFIC_FLOW_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Iluminación / Visibilidad</label>
              <select
                value={iluminacion}
                onChange={(e) => setIluminacion(e.target.value as LightingCondition)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                {(Object.keys(LIGHTING_CONDITION_LABELS) as LightingCondition[]).map((key) => (
                  <option key={key} value={key}>
                    {LIGHTING_CONDITION_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Municipio</label>
              <select
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                {TRUJILLO_MUNICIPALITIES.map((mun) => (
                  <option key={mun} value={mun}>
                    {mun}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sector / Referencia</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                placeholder="Ej. Km 12 vía Santa Apolonia"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Vía</label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as OperationMode)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                <option value="terrestre">Terrestre</option>
                <option value="lacustre">Lacustre (Lago)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Comisión Patrullera</label>
              <select
                value={commissionId}
                onChange={(e) => {
                  const id = e.target.value;
                  setCommissionId(id);
                  const found = commissions.find((c) => c.id === id);
                  if (found) {
                    setPatrulladoPor(`${found.jefeGrado} ${found.jefeNombre}`);
                    setModalidad(found.modalidad);
                    if (found.cuadrantePaz) setCuadrantePaz(found.cuadrantePaz);
                  }
                }}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                <option value="">Patrullaje Independiente / Puesto</option>
                {commissions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} — {c.jefeGrado} {c.jefeNombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Patrullado Por</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={patrulladoPor}
                onChange={(e) => setPatrulladoPor(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Coordinates with live GPS capture */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-400">Coordenadas del Punto</label>
              <button
                type="button"
                disabled={locatingGps}
                onClick={handleUseMyGps}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-300 hover:text-teal-200 cursor-pointer disabled:opacity-50"
              >
                <Crosshair className="w-3.5 h-3.5" />
                {locatingGps ? 'Obteniendo GPS...' : 'Capturar mi GPS actual'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="0.000001"
                required
                aria-label="Latitud"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs font-mono-tabular text-white"
              />
              <input
                type="number"
                step="0.000001"
                required
                aria-label="Longitud"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs font-mono-tabular text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Características de lo Visto en el Cuadrante / Seguridad Vial
            </label>
            <textarea
              rows={3}
              required
              minLength={3}
              maxLength={700}
              placeholder="Describe estado de la vía o costa, controles de seguridad vial, entrevistas a voceros comunales/fincas, puntos ciegos, señales de alerta..."
              value={caracteristicasVistas}
              onChange={(e) => setCaracteristicasVistas(e.target.value)}
              className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Geotagged Site Photo Picker */}
          <GeoPhotoPicker
            lat={numericLat}
            lng={numericLng}
            sector={sector || municipio}
            label={cuadrantePaz ? `Patrullaje ${cuadrantePaz}` : 'Punto Patrullado'}
            fotoDataUrl={fotoDataUrl}
            fotoCoordenadas={fotoCoordenadas}
            onChange={({ fotoDataUrl: url, fotoCoordenadas: coordsLabel }) => {
              setFotoDataUrl(url);
              setFotoCoordenadas(coordsLabel);
            }}
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-300 bg-[#192332] hover:bg-[#233145] rounded-md cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-md cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Registrar Punto Patrullado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Car, Crosshair, Flame, Leaf, Megaphone, Shield, Skull, X } from 'lucide-react';
import {
  ENVIRONMENTAL_INCIDENT_TYPES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  PUBLIC_ORDER_CAUSE_PRESETS,
  PUBLIC_ORDER_INCIDENT_TYPES,
  PUBLIC_SERVICE_PRESETS,
  ROAD_ACCESS_STATUS_LABELS,
  SECURITY_INCIDENT_TYPES,
  TRAFFIC_CAUSE_PRESETS,
  TRAFFIC_INCIDENT_TYPES,
  TRUJILLO_MAIN_ROADS,
  TRUJILLO_MUNICIPALITIES,
  VIOLENT_CAUSE_PRESETS,
  VIOLENT_INCIDENT_TYPES,
  getIncidentCategory,
  isEnvironmentalIncidentType,
  isPublicOrderIncidentType,
  isTrafficIncidentType,
  isViolentIncidentType,
  type Commission,
  type Incident,
  type IncidentCategoryGroup,
  type IncidentSeverity,
  type IncidentType,
  type OperationMode,
  type RoadAccessStatus,
} from '../types/operations';
import {
  CUADRANTE_TYPE_LABELS,
  TRUJILLO_CUADRANTES_PAZ,
  findNearestCuadrante,
  getCuadranteByCode,
} from '../data/trujilloCuadrantes';
import { inferOperationModeFromCoords } from '../lib/geo';
import { GeoPhotoPicker } from './GeoPhotoPicker';

export type IncidentFormPayload = Omit<
  Incident,
  'id' | 'ownerId' | 'createdAt' | 'updatedAt'
>;

interface IncidentFormModalProps {
  initialCoords: { lat: number; lng: number };
  commissions: Commission[];
  defaultCommissionId?: string;
  defaultTipo?: IncidentType;
  defaultCuadrantePaz?: string;
  defaultMunicipio?: string;
  defaultSector?: string;
  onClose: () => void;
  onSave: (payload: IncidentFormPayload) => Promise<void>;
}

const DEFAULT_TYPE_BY_CATEGORY: Record<IncidentCategoryGroup, IncidentType> = {
  vial: 'accidente_colision',
  violento: 'homicidio',
  orden_publico: 'cierre_via_servicios',
  seguridad: 'extorsion',
  ambiental: 'tala_ilegal',
};

export const IncidentFormModal: React.FC<IncidentFormModalProps> = ({
  initialCoords,
  commissions,
  defaultCommissionId = '',
  defaultTipo,
  defaultCuadrantePaz,
  defaultMunicipio,
  defaultSector,
  onClose,
  onSave,
}) => {
  const nearest = useMemo(
    () => findNearestCuadrante(initialCoords.lat, initialCoords.lng),
    [initialCoords.lat, initialCoords.lng]
  );
  const initialCuadrante =
    getCuadranteByCode(defaultCuadrantePaz) ?? nearest.cuadrante;
  const inferredMode = inferOperationModeFromCoords(initialCoords.lat, initialCoords.lng);

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<IncidentType>(
    defaultTipo ?? (inferredMode === 'lacustre' ? 'pirateria_lacustre' : 'extorsion')
  );
  const [severidad, setSeveridad] = useState<IncidentSeverity>(
    defaultTipo &&
      (isViolentIncidentType(defaultTipo) || defaultTipo === 'manifestacion_violenta')
      ? 'critica'
      : 'alta'
  );
  const [modalidad, setModalidad] = useState<OperationMode>(
    defaultTipo && (isTrafficIncidentType(defaultTipo) || isPublicOrderIncidentType(defaultTipo))
      ? 'terrestre'
      : inferredMode
  );
  const [cuadrantePaz, setCuadrantePaz] = useState<string>(
    defaultCuadrantePaz ?? initialCuadrante?.codigo ?? ''
  );
  const [sector, setSector] = useState(defaultSector ?? '');
  const [municipio, setMunicipio] = useState(
    defaultMunicipio ?? initialCuadrante?.municipio ?? 'Valera'
  );
  const [commissionId, setCommissionId] = useState(defaultCommissionId);
  const [reportadoPor, setReportadoPor] = useState(
    commissions.find((c) => c.id === defaultCommissionId)?.jefeNombre ||
      'Sala Situacional CZGNB-23 Trujillo'
  );
  const [descripcion, setDescripcion] = useState('');
  const [lat, setLat] = useState(initialCoords.lat.toFixed(6));
  const [lng, setLng] = useState(initialCoords.lng.toFixed(6));

  // Structured Road Safety / Homicide / Public Order Fields
  const [fallecidos, setFallecidos] = useState<string>(
    defaultTipo === 'homicidio' || defaultTipo === 'femicidio' ? '1' : '0'
  );
  const [lesionados, setLesionados] = useState<string>('0');
  const [vehiculosInvolucrados, setVehiculosInvolucrados] = useState<string>(
    defaultTipo && isTrafficIncidentType(defaultTipo) ? '2' : '0'
  );
  const [causaProbable, setCausaProbable] = useState('');
  const [viaAfectada, setViaAfectada] = useState('');
  const [placasInvolucradas, setPlacasInvolucradas] = useState('');
  const [servicioPublico, setServicioPublico] = useState<string>(
    defaultTipo === 'cierre_via_servicios' || defaultTipo === 'falla_servicio_critico'
      ? 'Agua Potable / Acueducto'
      : ''
  );
  const [personasConcentradas, setPersonasConcentradas] = useState<string>(
    defaultTipo && isPublicOrderIncidentType(defaultTipo) ? '40' : '0'
  );
  const [pasoHabilitado, setPasoHabilitado] = useState<RoadAccessStatus>(
    defaultTipo === 'cierre_via_servicios' || defaultTipo === 'cierre_via_gremial'
      ? 'cerrado_total'
      : 'paso_parcial'
  );

  const [fotoDataUrl, setFotoDataUrl] = useState('');
  const [fotoCoordenadas, setFotoCoordenadas] = useState('');
  const [locatingGps, setLocatingGps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = getIncidentCategory(tipo);
  const isEnvironmental = isEnvironmentalIncidentType(tipo);
  const isTraffic = isTrafficIncidentType(tipo);
  const isViolent = isViolentIncidentType(tipo);
  const isPublicOrder = isPublicOrderIncidentType(tipo);

  const handleCategoryQuickSwitch = (nextCat: IncidentCategoryGroup) => {
    const nextTipo = DEFAULT_TYPE_BY_CATEGORY[nextCat];
    setTipo(nextTipo);
    if (nextCat === 'violento') {
      setSeveridad('critica');
      if (fallecidos === '0') setFallecidos('1');
    } else if (nextCat === 'vial') {
      setModalidad('terrestre');
      if (vehiculosInvolucrados === '0') setVehiculosInvolucrados('2');
    } else if (nextCat === 'orden_publico') {
      setModalidad('terrestre');
      setSeveridad('alta');
      setPasoHabilitado('cerrado_total');
      if (!servicioPublico) setServicioPublico('Agua Potable / Acueducto');
      if (personasConcentradas === '0') setPersonasConcentradas('40');
    }
  };

  const handleCuadranteChange = (code: string) => {
    setCuadrantePaz(code);
    const q = getCuadranteByCode(code);
    if (q) {
      setMunicipio(q.municipio);
      if (q.modalidad === 'lacustre' && !isTraffic) {
        setModalidad('lacustre');
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
        setError('No se pudo obtener tu GPS actual. Verifica los permisos de ubicación.');
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
      setError('Coordenadas inválidas.');
      return;
    }

    const cleanFallecidos = Math.max(0, Math.min(200, Math.floor(Number(fallecidos) || 0)));
    const cleanLesionados = Math.max(0, Math.min(500, Math.floor(Number(lesionados) || 0)));
    const cleanVehiculos = Math.max(
      0,
      Math.min(50, Math.floor(Number(vehiculosInvolucrados) || 0))
    );

    const payload: IncidentFormPayload = {
      titulo: titulo.trim().slice(0, 120),
      tipo,
      severidad,
      modalidad,
      sector: sector.trim().slice(0, 100),
      municipio: municipio.trim().slice(0, 80),
      cuadrantePaz: cuadrantePaz.trim().slice(0, 40),
      descripcion: descripcion.trim().slice(0, 600),
      commissionId: commissionId.trim().slice(0, 128),
      reportadoPor: reportadoPor.trim().slice(0, 100),
      lat: Number(parsedLat.toFixed(6)),
      lng: Number(parsedLng.toFixed(6)),
      estado: 'abierta',
      fotoDataUrl,
      fotoCoordenadas: fotoCoordenadas.slice(0, 140),
    };

    const cleanPersonas = Math.max(
      0,
      Math.min(50000, Math.floor(Number(personasConcentradas) || 0))
    );

    if (isTraffic || isViolent) {
      payload.fallecidos = cleanFallecidos;
      payload.lesionados = cleanLesionados;
      payload.causaProbable = causaProbable.trim().slice(0, 140);
      payload.placasInvolucradas = placasInvolucradas.trim().slice(0, 120);
    }
    if (isTraffic) {
      payload.vehiculosInvolucrados = cleanVehiculos;
      payload.viaAfectada = viaAfectada.trim().slice(0, 120);
    }
    if (isPublicOrder) {
      payload.viaAfectada = viaAfectada.trim().slice(0, 120);
      payload.causaProbable = causaProbable.trim().slice(0, 140);
      payload.servicioPublico = servicioPublico.trim().slice(0, 80);
      payload.personasConcentradas = cleanPersonas;
      payload.pasoHabilitado = pasoHabilitado;
    }

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la novedad.');
    } finally {
      setSaving(false);
    }
  };

  const numericLat = Number(lat);
  const numericLng = Number(lng);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#111822] border border-slate-700 rounded-lg max-w-2xl w-full shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {isPublicOrder ? (
              <Megaphone className="w-5 h-5 text-fuchsia-400" />
            ) : isTraffic ? (
              <Car className="w-5 h-5 text-sky-400" />
            ) : isViolent ? (
              <Skull className="w-5 h-5 text-red-400" />
            ) : isEnvironmental ? (
              <Leaf className="w-5 h-5 text-lime-400" />
            ) : (
              <Flame className="w-5 h-5 text-amber-400" />
            )}
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                {isPublicOrder
                  ? 'Registrar Alerta de Manifestación / Cierre de Vía'
                  : isTraffic
                    ? 'Registrar Accidente de Tránsito / Seguridad Vial'
                    : isViolent
                      ? 'Registrar Homicidio / Delito Grave contra las Personas'
                      : isEnvironmental
                        ? 'Registrar Delito Ambiental (Guardería Ambiental)'
                        : 'Registrar Novedad en Mapa de Criminalidad'}
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
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
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

          {/* Quick Category Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {(
              [
                {
                  id: 'orden_publico',
                  label: 'Protesta / Cierre',
                  Icon: Megaphone,
                  activeClass: 'bg-fuchsia-950/80 border-fuchsia-400 text-fuchsia-100',
                },
                {
                  id: 'vial',
                  label: 'Seguridad Vial',
                  Icon: Car,
                  activeClass: 'bg-sky-900/60 border-sky-400 text-sky-100',
                },
                {
                  id: 'violento',
                  label: 'Homicidio',
                  Icon: Skull,
                  activeClass: 'bg-red-950/80 border-red-400 text-red-100',
                },
                {
                  id: 'seguridad',
                  label: 'Rural',
                  Icon: Flame,
                  activeClass: 'bg-amber-950/70 border-amber-400 text-amber-100',
                },
                {
                  id: 'ambiental',
                  label: 'Ambiental',
                  Icon: Leaf,
                  activeClass: 'bg-emerald-950/70 border-lime-400 text-lime-100',
                },
              ] as const
            ).map(({ id, label, Icon, activeClass }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleCategoryQuickSwitch(id)}
                className={`flex items-center justify-center gap-1 px-2 py-2 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer ${
                  category === id
                    ? activeClass
                    : 'bg-[#0B1117] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Título del Registro</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={120}
              placeholder={
                isPublicOrder
                  ? 'Ej. Cierre de Troncal 001 en Sabana de Mendoza por falta de agua potable'
                  : isTraffic
                    ? 'Ej. Volcamiento de vehículo de carga en Troncal 001 sector Agua Santa'
                    : isViolent
                      ? 'Ej. Homicidio por arma de fuego en sector El Dividive'
                      : isEnvironmental
                        ? 'Ej. Tala ilegal de bosque protector en cuenca rural'
                        : 'Ej. Detonaciones y amenaza extorsiva en finca ganadera'
              }
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipificación Específica</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as IncidentType)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <optgroup label="Orden Público, Manifestaciones y Cierres de Vías">
                  {PUBLIC_ORDER_INCIDENT_TYPES.map((key) => (
                    <option key={key} value={key}>
                      {INCIDENT_TYPE_LABELS[key]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Seguridad Vial y Accidentes de Tránsito">
                  {TRAFFIC_INCIDENT_TYPES.map((key) => (
                    <option key={key} value={key}>
                      {INCIDENT_TYPE_LABELS[key]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Homicidios y Delitos Graves contra las Personas">
                  {VIOLENT_INCIDENT_TYPES.map((key) => (
                    <option key={key} value={key}>
                      {INCIDENT_TYPE_LABELS[key]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Seguridad Ciudadana y Rural">
                  {SECURITY_INCIDENT_TYPES.map((key) => (
                    <option key={key} value={key}>
                      {INCIDENT_TYPE_LABELS[key]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Delitos en Materia Ambiental (Guardería Ambiental)">
                  {ENVIRONMENTAL_INCIDENT_TYPES.map((key) => (
                    <option key={key} value={key}>
                      {INCIDENT_TYPE_LABELS[key]}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Severidad</label>
              <select
                value={severidad}
                onChange={(e) => setSeveridad(e.target.value as IncidentSeverity)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {(Object.keys(INCIDENT_SEVERITY_LABELS) as IncidentSeverity[]).map((key) => (
                  <option key={key} value={key}>
                    {INCIDENT_SEVERITY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Vía</label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as OperationMode)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="terrestre">Terrestre</option>
                <option value="lacustre">Lacustre (Lago)</option>
              </select>
            </div>
          </div>

          {/* Contextual Road Safety / Traffic Accident Panel */}
          {isTraffic && (
            <div className="bg-sky-950/35 border border-sky-500/40 rounded-md p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-200">
                <Car className="w-4 h-4 text-sky-400" />
                Ficha de Seguridad Vial y Siniestro de Tránsito
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-sky-200/80 mb-1">
                    Arteria / Troncal Vial Afectada
                  </label>
                  <input
                    list="trujillo-roads-list"
                    type="text"
                    maxLength={120}
                    placeholder="Ej. Troncal 001 — Sector Agua Viva"
                    value={viaAfectada}
                    onChange={(e) => setViaAfectada(e.target.value)}
                    className="w-full bg-[#0B1117] border border-sky-700/60 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                  <datalist id="trujillo-roads-list">
                    {TRUJILLO_MAIN_ROADS.map((road) => (
                      <option key={road} value={road} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] text-sky-200/80 mb-1">
                    Causa Probable del Siniestro
                  </label>
                  <input
                    list="traffic-causes-list"
                    type="text"
                    maxLength={140}
                    placeholder="Ej. Exceso de velocidad, falla de frenos..."
                    value={causaProbable}
                    onChange={(e) => setCausaProbable(e.target.value)}
                    className="w-full bg-[#0B1117] border border-sky-700/60 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                  <datalist id="traffic-causes-list">
                    {TRAFFIC_CAUSE_PRESETS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-sky-200/80 mb-1">
                    Vehículos Involucrados
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={vehiculosInvolucrados}
                    onChange={(e) => setVehiculosInvolucrados(e.target.value)}
                    className="w-full bg-[#0B1117] border border-sky-700/60 rounded-md px-2.5 py-1.5 text-xs font-mono-tabular text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-amber-200/90 mb-1">
                    Lesionados / Heridos
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={lesionados}
                    onChange={(e) => setLesionados(e.target.value)}
                    className="w-full bg-[#0B1117] border border-amber-600/60 rounded-md px-2.5 py-1.5 text-xs font-mono-tabular text-amber-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-red-300 mb-1">Fallecidos</label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={fallecidos}
                    onChange={(e) => setFallecidos(e.target.value)}
                    className="w-full bg-[#0B1117] border border-red-600/60 rounded-md px-2.5 py-1.5 text-xs font-mono-tabular text-red-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-sky-200/80 mb-1">
                  Placas / Tipos de Vehículos Involucrados (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Ej. Camión 350 placa A21BC4K y Moto Empire placa AD904M"
                  value={placasInvolucradas}
                  onChange={(e) => setPlacasInvolucradas(e.target.value)}
                  className="w-full bg-[#0B1117] border border-sky-700/60 rounded-md px-2.5 py-1.5 text-xs font-mono-tabular text-white"
                />
              </div>
            </div>
          )}

          {/* Contextual Homicide / Violent Crime Panel */}
          {isViolent && (
            <div className="bg-red-950/35 border border-red-500/45 rounded-md p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-red-200">
                <Skull className="w-4 h-4 text-red-400" />
                Ficha de Hecho Violento / Homicidio (Enlace CICPC / Fiscalía)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] text-red-300 mb-1">Fallecidos</label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={fallecidos}
                    onChange={(e) => setFallecidos(e.target.value)}
                    className="w-full bg-[#0B1117] border border-red-600/60 rounded-md px-2.5 py-1.5 text-xs font-mono-tabular text-red-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-amber-200/90 mb-1">Heridos</label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={lesionados}
                    onChange={(e) => setLesionados(e.target.value)}
                    className="w-full bg-[#0B1117] border border-amber-600/60 rounded-md px-2.5 py-1.5 text-xs font-mono-tabular text-amber-200"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-red-200/80 mb-1">
                    Medio Utilizado / Móvil Presunto
                  </label>
                  <input
                    list="violent-causes-list"
                    type="text"
                    maxLength={140}
                    placeholder="Ej. Arma de fuego, riña, resistencia al robo..."
                    value={causaProbable}
                    onChange={(e) => setCausaProbable(e.target.value)}
                    className="w-full bg-[#0B1117] border border-red-700/60 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-400"
                  />
                  <datalist id="violent-causes-list">
                    {VIOLENT_CAUSE_PRESETS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-red-200/80 mb-1">
                  Vehículo / Moto o Evidencia de Interés Criminalístico (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Ej. Moto negra sin placas huyó sentido Agua Santa"
                  value={placasInvolucradas}
                  onChange={(e) => setPlacasInvolucradas(e.target.value)}
                  className="w-full bg-[#0B1117] border border-red-700/60 rounded-md px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}

          {/* Contextual Public Order / Manifestation / Public-Service Road Closure Panel */}
          {isPublicOrder && (
            <div className="bg-fuchsia-950/35 border border-fuchsia-500/45 rounded-md p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-fuchsia-200">
                <Megaphone className="w-4 h-4 text-fuchsia-400" />
                Ficha de Manifestación / Cierre de Vía por Servicios Públicos
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-fuchsia-200/85 mb-1">
                    Arteria / Troncal o Vía Afectada
                  </label>
                  <input
                    list="public-order-roads-list"
                    type="text"
                    maxLength={120}
                    placeholder="Ej. Troncal 001 — Entrada Sabana de Mendoza"
                    value={viaAfectada}
                    onChange={(e) => setViaAfectada(e.target.value)}
                    className="w-full bg-[#0B1117] border border-fuchsia-700/60 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-fuchsia-400"
                  />
                  <datalist id="public-order-roads-list">
                    {TRUJILLO_MAIN_ROADS.map((road) => (
                      <option key={road} value={road} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] text-fuchsia-200/85 mb-1">
                    Estado del Paso Vehicular
                  </label>
                  <select
                    value={pasoHabilitado}
                    onChange={(e) => setPasoHabilitado(e.target.value as RoadAccessStatus)}
                    className="w-full bg-[#0B1117] border border-fuchsia-700/60 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-fuchsia-400"
                  >
                    {(Object.keys(ROAD_ACCESS_STATUS_LABELS) as RoadAccessStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {ROAD_ACCESS_STATUS_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-fuchsia-200/85 mb-1">
                    Servicio Público / Motivo del Reclamo
                  </label>
                  <input
                    list="public-services-list"
                    type="text"
                    maxLength={80}
                    placeholder="Ej. Agua Potable, Energía Eléctrica, Gas Doméstico, Combustible..."
                    value={servicioPublico}
                    onChange={(e) => setServicioPublico(e.target.value)}
                    className="w-full bg-[#0B1117] border border-fuchsia-700/60 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-fuchsia-400"
                  />
                  <datalist id="public-services-list">
                    {PUBLIC_SERVICE_PRESETS.map((srv) => (
                      <option key={srv} value={srv} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] text-amber-200/90 mb-1">
                    Personas Aprox.
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50000}
                    value={personasConcentradas}
                    onChange={(e) => setPersonasConcentradas(e.target.value)}
                    className="w-full bg-[#0B1117] border border-fuchsia-700/60 rounded-md px-2.5 py-1.5 text-xs font-mono-tabular text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-fuchsia-200/85 mb-1">
                  Exigencia Principal / Situación de Orden Público
                </label>
                <input
                  list="public-order-causes-list"
                  type="text"
                  maxLength={140}
                  placeholder="Ej. Exigencia de restitución de agua potable / cierre con cauchos..."
                  value={causaProbable}
                  onChange={(e) => setCausaProbable(e.target.value)}
                  className="w-full bg-[#0B1117] border border-fuchsia-700/60 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-fuchsia-400"
                />
                <datalist id="public-order-causes-list">
                  {PUBLIC_ORDER_CAUSE_PRESETS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          )}

          {/* Cuadrante de Paz + Municipality + Sector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3 text-teal-400" />
                Cuadrante de Paz (Trujillo)
              </label>
              <select
                value={cuadrantePaz}
                onChange={(e) => handleCuadranteChange(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                <option value="">Sin asignar / Externo</option>
                {TRUJILLO_CUADRANTES_PAZ.map((q) => (
                  <option key={q.codigo} value={q.codigo}>
                    {q.codigo} · {q.municipio} ({CUADRANTE_TYPE_LABELS[q.tipo]})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Municipio (Trujillo)</label>
              <select
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
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
                placeholder="Ej. Km 14 vía La Ceiba"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Comisión Asociada (Opcional)</label>
              <select
                value={commissionId}
                onChange={(e) => {
                  const id = e.target.value;
                  setCommissionId(id);
                  const found = commissions.find((c) => c.id === id);
                  if (found) setReportadoPor(`${found.jefeGrado} ${found.jefeNombre}`);
                }}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">Ninguna / Denuncia Directa / VEN-911</option>
                {commissions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} — {c.jefeGrado} {c.jefeNombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Reportado Por</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={reportadoPor}
                onChange={(e) => setReportadoPor(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-400">Coordenadas del Sitio</label>
              <button
                type="button"
                disabled={locatingGps}
                onClick={handleUseMyGps}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200 cursor-pointer disabled:opacity-50"
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
            <label className="block text-xs text-slate-400 mb-1">Detalle / Relato Operativo</label>
            <textarea
              rows={3}
              required
              minLength={3}
              maxLength={600}
              placeholder={
                isTraffic
                  ? 'Dinámica del siniestro, estado de la vía, traslado de lesionados (Protección Civil / Bomberos / Hospital), desvío de tránsito...'
                  : isViolent
                    ? 'Resguardo de la escena del suceso, notificación a CICPC / Fiscalía, datos de víctimas o posibles responsables...'
                    : isEnvironmental
                      ? 'Especie o área afectada, volumen de madera/mineral, maquinaria, fuente hídrica o posibles responsables (Ley Penal del Ambiente)...'
                      : 'Modus operandi, descripción de sujetos, vehículo o embarcación observada...'
              }
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Geotagged Site Photo Picker */}
          <GeoPhotoPicker
            lat={numericLat}
            lng={numericLng}
            sector={sector || municipio}
            label={
              isTraffic
                ? 'Accidente Vial'
                : isViolent
                  ? 'Hecho Violento / Homicidio'
                  : isEnvironmental
                    ? 'Delito Ambiental'
                    : 'Novedad Criminal'
            }
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
              className={`min-h-[40px] px-5 py-2 text-xs font-semibold text-white disabled:opacity-50 rounded-md cursor-pointer ${
                isTraffic
                  ? 'bg-sky-600 hover:bg-sky-500'
                  : isViolent
                    ? 'bg-red-600 hover:bg-red-500'
                    : isEnvironmental
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              {saving
                ? 'Registrando...'
                : isTraffic
                  ? 'Guardar Accidente / Seguridad Vial'
                  : isViolent
                    ? 'Guardar Hecho Grave / Homicidio'
                    : 'Guardar en Mapa de Criminalidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

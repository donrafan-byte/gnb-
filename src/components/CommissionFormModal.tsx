import React, { useMemo, useState } from 'react';
import { Anchor, Plus, Trash2, Truck, X } from 'lucide-react';
import {
  DESTACAMENTO_META,
  PHONE_REGEX,
  TRUJILLO_SECTORS,
  VEHICLE_PRESETS,
  WEAPON_PRESETS,
  type Commission,
  type CommissionStatus,
  type DestacamentoId,
  type OperationMode,
  type PersonnelMember,
  type WeaponAssignment,
  type ZoneUnit,
} from '../types/operations';
import { clampTrujilloCoords } from '../lib/geo';
import {
  CUADRANTE_TYPE_LABELS,
  TRUJILLO_CUADRANTES_PAZ,
  getCuadranteByCode,
} from '../data/trujilloCuadrantes';
import {
  getCompaniasForDestacamento,
  getPuestosForCompania,
} from '../data/czgnb23Structure';

export type CommissionFormPayload = Omit<
  Commission,
  'id' | 'ownerId' | 'createdAt' | 'updatedAt'
>;

interface CommissionFormModalProps {
  initial?: Commission | null;
  prefillUnit?: ZoneUnit | null;
  zoneUnits?: ZoneUnit[];
  defaultDestacamento?: DestacamentoId;
  nextCode: string;
  onClose: () => void;
  onSave: (payload: CommissionFormPayload, existingId?: string) => Promise<void>;
}

export const CommissionFormModal: React.FC<CommissionFormModalProps> = ({
  initial,
  prefillUnit,
  zoneUnits = [],
  defaultDestacamento = 'D-231',
  nextCode,
  onClose,
  onSave,
}) => {
  const initialDest: DestacamentoId =
    initial?.destacamento ?? prefillUnit?.destacamento ?? defaultDestacamento;
  const initialModalidad: OperationMode =
    initial?.modalidad ??
    (prefillUnit?.modalidad === 'lacustre' ? 'lacustre' : 'terrestre');

  const [destacamento, setDestacamento] = useState<DestacamentoId>(initialDest);
  const [compania, setCompania] = useState(
    initial?.compania ?? prefillUnit?.compania ?? ''
  );
  const [puesto, setPuesto] = useState(
    initial?.puesto ?? (prefillUnit?.nivel === 'puesto_pac' ? prefillUnit.nombre : '')
  );
  const [codigo, setCodigo] = useState(
    initial?.codigo ??
      (prefillUnit
        ? `${DESTACAMENTO_META[prefillUnit.destacamento].prefijoComision}-${nextCode.split('-').pop() || '01'}`
        : nextCode)
  );
  const [nombre, setNombre] = useState(
    initial?.nombre ??
      (prefillUnit ? `Patrullaje ${prefillUnit.nombre}` : '')
  );
  const [modalidad, setModalidad] = useState<OperationMode>(initialModalidad);
  const [estado, setEstado] = useState<CommissionStatus>(
    initial?.estado ?? 'activa'
  );
  const [jefeGrado, setJefeGrado] = useState(initial?.jefeGrado ?? 'Cap.');
  const [jefeNombre, setJefeNombre] = useState(initial?.jefeNombre ?? '');
  const [jefeCedula, setJefeCedula] = useState(initial?.jefeCedula ?? 'V-');
  const [jefeTelefono, setJefeTelefono] = useState(
    initial?.jefeTelefono ?? '+58 414-'
  );
  const [vehiculoTipo, setVehiculoTipo] = useState(
    initial?.vehiculoTipo ?? VEHICLE_PRESETS[initialModalidad][0]
  );
  const [vehiculoPlaca, setVehiculoPlaca] = useState(
    initial?.vehiculoPlaca ?? `GNB-${DESTACAMENTO_META[initialDest].prefijoComision}-`
  );
  const [sector, setSector] = useState(
    initial?.sector ?? prefillUnit?.sector ?? TRUJILLO_SECTORS[0].label
  );
  const [cuadrantePaz, setCuadrantePaz] = useState(initial?.cuadrantePaz ?? '');
  const [lat, setLat] = useState(
    String(initial?.lat ?? prefillUnit?.lat ?? TRUJILLO_SECTORS[0].lat)
  );
  const [lng, setLng] = useState(
    String(initial?.lng ?? prefillUnit?.lng ?? TRUJILLO_SECTORS[0].lng)
  );
  const [notas, setNotas] = useState(initial?.notas ?? '');

  const companiaOptions = useMemo(
    () => getCompaniasForDestacamento(zoneUnits, destacamento),
    [zoneUnits, destacamento]
  );

  const puestoOptions = useMemo(
    () => getPuestosForCompania(zoneUnits, destacamento, compania || undefined),
    [zoneUnits, destacamento, compania]
  );

  const handleDestacamentoChange = (nextDest: DestacamentoId) => {
    setDestacamento(nextDest);
    const comps = getCompaniasForDestacamento(zoneUnits, nextDest);
    setCompania(comps[0] || '');
    setPuesto('');
    if (!initial) {
      const meta = DESTACAMENTO_META[nextDest];
      const suffix = codigo.split('-').pop() || '01';
      setCodigo(`${meta.prefijoComision}-${suffix}`);
      setVehiculoPlaca(`GNB-${meta.prefijoComision}-`);
      setLat(String(meta.lat));
      setLng(String(meta.lng));
      setSector(meta.sede);
    }
  };

  const handlePuestoSelect = (puestoNombre: string) => {
    setPuesto(puestoNombre);
    const match = zoneUnits.find(
      (u) => u.destacamento === destacamento && u.nombre === puestoNombre
    );
    if (match) {
      if (match.compania) setCompania(match.compania);
      setSector(match.sector);
      setLat(String(match.lat));
      setLng(String(match.lng));
      if (match.modalidad === 'lacustre') {
        setModalidad('lacustre');
        if (!initial) setVehiculoTipo(VEHICLE_PRESETS.lacustre[0]);
      } else if (match.modalidad === 'terrestre') {
        setModalidad('terrestre');
        if (!initial) setVehiculoTipo(VEHICLE_PRESETS.terrestre[0]);
      }
    }
  };

  const [efectivos, setEfectivos] = useState<PersonnelMember[]>(
    initial?.efectivos?.length
      ? initial.efectivos
      : [
          {
            grado: 'S/1',
            nombre: '',
            cedula: 'V-',
            rol: 'Conductor / Radio',
          },
        ]
  );

  const [armamento, setArmamento] = useState<WeaponAssignment[]>(
    initial?.armamento?.length
      ? initial.armamento
      : [
          {
            tipo: WEAPON_PRESETS[0],
            serial: '',
            municion: '120 cartuchos',
            asignadoA: '',
          },
        ]
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleModeSwitch = (nextMode: OperationMode) => {
    setModalidad(nextMode);
    if (!initial) {
      setVehiculoTipo(VEHICLE_PRESETS[nextMode][0]);
      if (nextMode === 'lacustre') {
        const lacustreSec = TRUJILLO_SECTORS.find((s) => s.modalidad === 'lacustre');
        if (lacustreSec) {
          setSector(lacustreSec.label);
          setLat(String(lacustreSec.lat));
          setLng(String(lacustreSec.lng));
          setVehiculoPlaca('LAC-DCR231-');
        }
      }
    }
  };

  const handleSectorPreset = (idxStr: string) => {
    const idx = Number(idxStr);
    const preset = TRUJILLO_SECTORS[idx];
    if (!preset) return;
    setSector(preset.label);
    setLat(String(preset.lat));
    setLng(String(preset.lng));
    setModalidad(preset.modalidad);
    if (!initial) {
      setVehiculoTipo(VEHICLE_PRESETS[preset.modalidad][0]);
    }
  };

  const handleCuadranteSelect = (code: string) => {
    setCuadrantePaz(code);
    const q = getCuadranteByCode(code);
    if (!q) return;
    setSector(`${q.codigo} — ${q.municipio} (${q.sectores.split(',')[0].trim()})`.slice(0, 100));
    setLat(String(q.lat));
    setLng(String(q.lng));
    setModalidad(q.modalidad);
    if (!initial) {
      setVehiculoTipo(VEHICLE_PRESETS[q.modalidad][0]);
    }
  };

  const updateEfectivo = (
    index: number,
    field: keyof PersonnelMember,
    value: string
  ) => {
    setEfectivos((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addEfectivo = () => {
    if (efectivos.length >= 20) return;
    setEfectivos((prev) => [
      ...prev,
      { grado: 'S/2', nombre: '', cedula: 'V-', rol: 'Seguridad Perimetral' },
    ]);
  };

  const removeEfectivo = (index: number) => {
    if (efectivos.length <= 1) return;
    setEfectivos((prev) => prev.filter((_, i) => i !== index));
  };

  const updateWeapon = (
    index: number,
    field: keyof WeaponAssignment,
    value: string
  ) => {
    setArmamento((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addWeapon = () => {
    if (armamento.length >= 20) return;
    setArmamento((prev) => [
      ...prev,
      {
        tipo: WEAPON_PRESETS[0],
        serial: '',
        municion: '120 cartuchos',
        asignadoA: '',
      },
    ]);
  };

  const removeWeapon = (index: number) => {
    if (armamento.length <= 1) return;
    setArmamento((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedPhone = jefeTelefono.trim();
    if (!PHONE_REGEX.test(trimmedPhone)) {
      setError('El teléfono del Jefe de Comisión debe tener entre 7 y 20 dígitos (ej. +58 414-7251840).');
      return;
    }

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      setError('Las coordenadas de latitud y longitud deben ser numéricas.');
      return;
    }

    const cleanEfectivos = efectivos
      .map((m) => ({
        grado: m.grado.trim().slice(0, 40),
        nombre: m.nombre.trim().slice(0, 100),
        cedula: m.cedula.trim().slice(0, 24),
        rol: m.rol.trim().slice(0, 60),
      }))
      .filter((m) => m.nombre.length >= 2 && m.cedula.length >= 4);

    if (cleanEfectivos.length === 0) {
      setError('Debes registrar al menos 1 efectivo militar con nombre y cédula válidos.');
      return;
    }

    const cleanArmamento = armamento
      .map((w) => ({
        tipo: w.tipo.trim().slice(0, 80),
        serial: w.serial.trim().slice(0, 48),
        municion: (w.municion.trim() || 'Reglamentaria').slice(0, 40),
        asignadoA: (w.asignadoA.trim() || `${jefeGrado.trim()} ${jefeNombre.trim()}`).slice(0, 100),
      }))
      .filter((w) => w.tipo.length >= 2 && w.serial.length >= 2);

    if (cleanArmamento.length === 0) {
      setError('Debes registrar al menos 1 armamento con tipo y serial exacto.');
      return;
    }

    const coords = clampTrujilloCoords(parsedLat, parsedLng);

    const payload: CommissionFormPayload = {
      codigo: codigo.trim().slice(0, 32),
      nombre: nombre.trim().slice(0, 120),
      modalidad,
      estado,
      jefeGrado: jefeGrado.trim().slice(0, 40),
      jefeNombre: jefeNombre.trim().slice(0, 100),
      jefeCedula: jefeCedula.trim().slice(0, 24),
      jefeTelefono: trimmedPhone.slice(0, 24),
      efectivos: cleanEfectivos,
      vehiculoTipo: vehiculoTipo.trim().slice(0, 80),
      vehiculoPlaca: vehiculoPlaca.trim().slice(0, 32),
      armamento: cleanArmamento,
      sector: sector.trim().slice(0, 100),
      cuadrantePaz: cuadrantePaz.trim().slice(0, 40),
      destacamento,
      compania: compania.trim().slice(0, 100),
      puesto: puesto.trim().slice(0, 100),
      lat: coords.lat,
      lng: coords.lng,
      alertaApoyo: estado === 'apoyo_requerido' ? true : initial?.alertaApoyo ?? false,
      motivoAlerta: initial?.motivoAlerta ?? '',
      notas: notas.trim().slice(0, 500),
    };

    setSaving(true);
    try {
      await onSave(payload, initial?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la comisión.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#111822] border border-slate-700 rounded-lg max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl my-auto">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              {initial ? `Editar Comisión ${initial.codigo}` : 'Desplegar Nueva Comisión'}
            </h2>
            <p className="text-xs text-slate-400">
              Comando de Zona Nro. 23 GNB (CZGNB-23) · D-231 · DCR 23-1 · DESUR-23 · Estado Trujillo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 cursor-pointer"
            aria-label="Cerrar formulario"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-md bg-red-950/70 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* 1. Datos de Operación, Adscripción CZGNB-23 y Modalidad */}
          <section className="space-y-3">
            <h3 className="font-display text-lg font-bold text-slate-100 border-b border-slate-800 pb-1.5">
              1. Adscripción Orgánica CZGNB-23, Identificación y Modalidad
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-[#0D141F] border border-slate-800/90 rounded-md p-3">
              <div className="sm:col-span-4">
                <label className="block text-xs text-emerald-300 font-semibold mb-1">
                  Destacamento (CZGNB-23)
                </label>
                <select
                  value={destacamento}
                  onChange={(e) => handleDestacamentoChange(e.target.value as DestacamentoId)}
                  className="w-full bg-[#0B1117] border border-emerald-700/60 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="D-231">D-231 — Destacamento 231 (Carvajal)</option>
                  <option value="DCR-23-1">DCR 23-1 — Comandos Rurales (La Ceiba)</option>
                  <option value="DESUR-23">DESUR-23 — Seguridad Urbana (Jalisco)</option>
                  <option value="CZGNB-23">CZGNB-23 — Estado Mayor / Zona</option>
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-300 mb-1">Compañía</label>
                <select
                  value={compania}
                  onChange={(e) => {
                    setCompania(e.target.value);
                    setPuesto('');
                  }}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Plana Mayor / General</option>
                  {companiaOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-300 mb-1">Puesto / PAC de Salida</label>
                <select
                  value={puesto}
                  onChange={(e) => handlePuestoSelect(e.target.value)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Sede de Destacamento / Libre</option>
                  {puestoOptions.map((p) => (
                    <option key={p.id} value={p.nombre}>
                      {p.nombre} ({p.municipio})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Código</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="block text-xs text-slate-400 mb-1">
                  Nombre de la Comisión / Misión
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Ej. Patrullaje Preventivo Eje Panamericano"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as CommissionStatus)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="activa">Desplegada</option>
                  <option value="en_curso">En Operación</option>
                  <option value="apoyo_requerido">Requiere Apoyo</option>
                  <option value="finalizada">Finalizada</option>
                </select>
              </div>
            </div>

            {/* Vía Terrestre o Lacustre */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleModeSwitch('terrestre')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-md border text-xs font-semibold transition-colors cursor-pointer ${
                  modalidad === 'terrestre'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                    : 'bg-[#0B1117] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Truck className="w-4 h-4" />
                Operación Vía Terrestre
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('lacustre')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-md border text-xs font-semibold transition-colors cursor-pointer ${
                  modalidad === 'lacustre'
                    ? 'bg-sky-600/20 border-sky-500 text-sky-200'
                    : 'bg-[#0B1117] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Anchor className="w-4 h-4" />
                Operación Vía Lacustre (Lago)
              </button>
            </div>
          </section>

          {/* 2. Jefe de Comisión */}
          <section className="space-y-3">
            <h3 className="font-display text-lg font-bold text-slate-100 border-b border-slate-800 pb-1.5">
              2. Jefe de Comisión y Contacto Directo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Grado</label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={jefeGrado}
                  onChange={(e) => setJefeGrado(e.target.value)}
                  placeholder="Cap."
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-400 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={jefeNombre}
                  onChange={(e) => setJefeNombre(e.target.value)}
                  placeholder="Apellidos y Nombres"
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Cédula / Carnet</label>
                <input
                  type="text"
                  required
                  minLength={4}
                  maxLength={24}
                  value={jefeCedula}
                  onChange={(e) => setJefeCedula(e.target.value)}
                  placeholder="V-18.000.000"
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Teléfono (Llamada Directa)</label>
                <input
                  type="tel"
                  required
                  maxLength={24}
                  value={jefeTelefono}
                  onChange={(e) => setJefeTelefono(e.target.value)}
                  placeholder="+58 414-7251840"
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </section>

          {/* 3. Vehículo o Embarcación y Ubicación Inicial */}
          <section className="space-y-3">
            <h3 className="font-display text-lg font-bold text-slate-100 border-b border-slate-800 pb-1.5">
              3. Vehículo / Embarcación y Sector en Trujillo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-xs text-slate-400 mb-1">
                  Tipo de {modalidad === 'lacustre' ? 'Embarcación' : 'Vehículo'}
                </label>
                <input
                  list="vehicle-presets-list"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={vehiculoTipo}
                  onChange={(e) => setVehiculoTipo(e.target.value)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <datalist id="vehicle-presets-list">
                  {VEHICLE_PRESETS[modalidad].map((preset) => (
                    <option key={preset} value={preset} />
                  ))}
                </datalist>
              </div>
              <div className="sm:col-span-4">
                <label className="block text-xs text-slate-400 mb-1">Placa / Sigla Unidad</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  value={vehiculoPlaca}
                  onChange={(e) => setVehiculoPlaca(e.target.value)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="block text-xs text-teal-300 mb-1">
                  Cuadrante de Paz Asignado (Trujillo)
                </label>
                <select
                  value={cuadrantePaz}
                  onChange={(e) => handleCuadranteSelect(e.target.value)}
                  className="w-full bg-[#0B1117] border border-teal-700/60 rounded-md px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-400"
                >
                  <option value="">Sin cuadrante específico (sector libre)</option>
                  {TRUJILLO_CUADRANTES_PAZ.map((q) => (
                    <option key={q.codigo} value={q.codigo}>
                      {q.codigo} · {q.municipio} — {q.nombre} ({CUADRANTE_TYPE_LABELS[q.tipo]})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-6">
                <label className="block text-xs text-slate-400 mb-1">Sector Rápido (Trujillo)</label>
                <select
                  defaultValue=""
                  onChange={(e) => handleSectorPreset(e.target.value)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="" disabled>
                    Elegir punto de despliegue rápido...
                  </option>
                  {TRUJILLO_SECTORS.map((s, idx) => (
                    <option key={s.label} value={idx}>
                      {s.modalidad === 'lacustre' ? '[Lago] ' : ''}
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-xs text-slate-400 mb-1">Sector / Corredor</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Latitud</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-sm font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Longitud</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-sm font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </section>

          {/* 4. Efectivos Militares Integrantes */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <h3 className="font-display text-lg font-bold text-slate-100">
                4. Efectivos Militares Integrantes ({efectivos.length}/20)
              </h3>
              <button
                type="button"
                onClick={addEfectivo}
                disabled={efectivos.length >= 20}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#192332] hover:bg-[#243248] text-emerald-300 rounded cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Efectivo
              </button>
            </div>
            <div className="space-y-2">
              {efectivos.map((eff, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center bg-[#0B1117] border border-slate-800 rounded-md p-2"
                >
                  <input
                    type="text"
                    placeholder="Grado"
                    maxLength={40}
                    required
                    value={eff.grado}
                    onChange={(e) => updateEfectivo(idx, 'grado', e.target.value)}
                    className="col-span-2 bg-[#111822] border border-slate-700/80 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Nombre completo del efectivo"
                    maxLength={100}
                    required
                    value={eff.nombre}
                    onChange={(e) => updateEfectivo(idx, 'nombre', e.target.value)}
                    className="col-span-4 bg-[#111822] border border-slate-700/80 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Cédula (V-...)"
                    maxLength={24}
                    required
                    value={eff.cedula}
                    onChange={(e) => updateEfectivo(idx, 'cedula', e.target.value)}
                    className="col-span-3 bg-[#111822] border border-slate-700/80 rounded px-2 py-1.5 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Función / Rol"
                    maxLength={60}
                    required
                    value={eff.rol}
                    onChange={(e) => updateEfectivo(idx, 'rol', e.target.value)}
                    className="col-span-2 bg-[#111822] border border-slate-700/80 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeEfectivo(idx)}
                    disabled={efectivos.length <= 1}
                    className="col-span-1 flex justify-center text-slate-500 hover:text-red-400 disabled:opacity-30 cursor-pointer"
                    title="Eliminar efectivo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Armamento y Seriales */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <h3 className="font-display text-lg font-bold text-slate-100">
                5. Tipo de Armamento y Seriales ({armamento.length}/20)
              </h3>
              <button
                type="button"
                onClick={addWeapon}
                disabled={armamento.length >= 20}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#192332] hover:bg-[#243248] text-amber-300 rounded cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Armamento
              </button>
            </div>
            <datalist id="weapon-presets-list">
              {WEAPON_PRESETS.map((wp) => (
                <option key={wp} value={wp} />
              ))}
            </datalist>
            <div className="space-y-2">
              {armamento.map((wp, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center bg-[#0B1117] border border-slate-800 rounded-md p-2"
                >
                  <input
                    list="weapon-presets-list"
                    type="text"
                    placeholder="Tipo de armamento"
                    maxLength={80}
                    required
                    value={wp.tipo}
                    onChange={(e) => updateWeapon(idx, 'tipo', e.target.value)}
                    className="col-span-4 bg-[#111822] border border-slate-700/80 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Serial exacto (ej. AK103-0648291)"
                    maxLength={48}
                    required
                    value={wp.serial}
                    onChange={(e) => updateWeapon(idx, 'serial', e.target.value)}
                    className="col-span-3 bg-[#111822] border border-slate-700/80 rounded px-2 py-1.5 text-xs font-mono-tabular text-amber-200 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    placeholder="Munición"
                    maxLength={40}
                    required
                    value={wp.municion}
                    onChange={(e) => updateWeapon(idx, 'municion', e.target.value)}
                    className="col-span-2 bg-[#111822] border border-slate-700/80 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Asignado a"
                    maxLength={100}
                    value={wp.asignadoA}
                    onChange={(e) => updateWeapon(idx, 'asignadoA', e.target.value)}
                    className="col-span-2 bg-[#111822] border border-slate-700/80 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeWeapon(idx)}
                    disabled={armamento.length <= 1}
                    className="col-span-1 flex justify-center text-slate-500 hover:text-red-400 disabled:opacity-30 cursor-pointer"
                    title="Eliminar armamento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 6. Notas Operativas */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Órdenes / Observaciones Operativas
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Consignas del despliegue, horario de reporte o puntos de control..."
              className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#192332] hover:bg-[#233145] rounded-md cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md cursor-pointer"
            >
              {saving
                ? 'Guardando...'
                : initial
                  ? 'Guardar Cambios'
                  : 'Desplegar Comisión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

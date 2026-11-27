import React, { useState } from 'react';
import { Shield, Skull, X } from 'lucide-react';
import {
  AGENCY_LABELS,
  PHONE_REGEX,
  TRUJILLO_SECTORS,
  type FriendlyAgency,
  type FriendlyForce,
  type GangOperationMode,
  type GangZone,
  type ThreatLevel,
} from '../types/operations';
import { clampTrujilloCoords } from '../lib/geo';

export type GangFormPayload = Omit<
  GangZone,
  'id' | 'ownerId' | 'createdAt' | 'updatedAt'
>;

export type FriendlyForceFormPayload = Omit<
  FriendlyForce,
  'id' | 'ownerId' | 'createdAt' | 'updatedAt'
>;

export const GangZoneFormModal: React.FC<{
  initial?: GangZone | null;
  onClose: () => void;
  onSave: (payload: GangFormPayload, existingId?: string) => Promise<void>;
}> = ({ initial, onClose, onSave }) => {
  const isEditing = Boolean(initial);
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [alias, setAlias] = useState(initial?.alias ?? '');
  const [nivelAmenaza, setNivelAmenaza] = useState<ThreatLevel>(initial?.nivelAmenaza ?? 'alto');
  const [modalidad, setModalidad] = useState<GangOperationMode>(initial?.modalidad ?? 'terrestre');
  const [sector, setSector] = useState(initial?.sector ?? TRUJILLO_SECTORS[3].label);
  const [delitosText, setDelitosText] = useState(
    initial ? initial.delitos.join(', ') : 'Extorsión, Abigeato'
  );
  const [recomendacionTactica, setRecomendacionTactica] = useState(
    initial?.recomendacionTactica ?? ''
  );
  const [lat, setLat] = useState(String(initial?.lat ?? TRUJILLO_SECTORS[3].lat));
  const [lng, setLng] = useState(String(initial?.lng ?? TRUJILLO_SECTORS[3].lng));
  const [radioKm, setRadioKm] = useState(String(initial?.radioKm ?? 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const delitos = delitosText
      .split(',')
      .map((d) => d.trim().slice(0, 80))
      .filter((d) => d.length >= 2)
      .slice(0, 8);

    if (delitos.length === 0) {
      setError('Indica al menos un delito separado por comas.');
      return;
    }

    const coords = clampTrujilloCoords(Number(lat), Number(lng));
    const radius = Math.min(40, Math.max(1, Number(radioKm) || 10));

    setSaving(true);
    try {
      await onSave(
        {
          nombre: nombre.trim().slice(0, 100),
          alias: alias.trim().slice(0, 100),
          nivelAmenaza,
          modalidad,
          sector: sector.trim().slice(0, 100),
          delitos,
          recomendacionTactica: recomendacionTactica.trim().slice(0, 600),
          lat: coords.lat,
          lng: coords.lng,
          radioKm: radius,
          activa: initial ? initial.activa : true,
        },
        initial?.id
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditing
            ? 'Error al actualizar banda.'
            : 'Error al registrar banda.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#111822] border border-slate-700 rounded-lg max-w-xl w-full shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400">
            <Skull className="w-5 h-5" />
            <h2 className="font-display text-xl font-bold text-white">
              {isEditing
                ? 'Editar Banda Criminal / Zona de Amenaza'
                : 'Registrar Banda Criminal / Zona de Amenaza'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded bg-red-950/70 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nombre del Grupo / GEDO</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Alias Operativo</label>
              <input
                type="text"
                maxLength={100}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Amenaza</label>
              <select
                value={nivelAmenaza}
                onChange={(e) => setNivelAmenaza(e.target.value as ThreatLevel)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white"
              >
                <option value="moderado">Moderado</option>
                <option value="alto">Alto</option>
                <option value="critico">Crítico</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ámbito</label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as GangOperationMode)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white"
              >
                <option value="terrestre">Terrestre</option>
                <option value="lacustre">Lacustre</option>
                <option value="mixta">Mixta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Radio (km)</label>
              <input
                type="number"
                min={1}
                max={40}
                required
                value={radioKm}
                onChange={(e) => setRadioKm(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs font-mono-tabular text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <label className="block text-xs text-slate-400 mb-1">Sector de Operación</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs text-slate-400 mb-1">Latitud</label>
              <input
                type="number"
                step="0.0001"
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs font-mono-tabular text-white"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs text-slate-400 mb-1">Longitud</label>
              <input
                type="number"
                step="0.0001"
                required
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs font-mono-tabular text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Delitos Principales (separados por coma)</label>
            <input
              type="text"
              required
              value={delitosText}
              onChange={(e) => setDelitosText(e.target.value)}
              className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Recomendación Táctica en Tiempo Real</label>
            <textarea
              rows={3}
              required
              minLength={5}
              maxLength={600}
              placeholder="Medidas de seguridad, fuerza mínima recomendada y enlaces con fuerzas amigas..."
              value={recomendacionTactica}
              onChange={(e) => setRecomendacionTactica(e.target.value)}
              className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#192332] rounded-md cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-md cursor-pointer disabled:opacity-50">
              {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Guardar Zona de Amenaza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const FriendlyForceFormModal: React.FC<{
  initial?: FriendlyForce | null;
  onClose: () => void;
  onSave: (payload: FriendlyForceFormPayload, existingId?: string) => Promise<void>;
}> = ({ initial, onClose, onSave }) => {
  const isEditing = Boolean(initial);
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [organismo, setOrganismo] = useState<FriendlyAgency>(initial?.organismo ?? 'PNB');
  const [sector, setSector] = useState(initial?.sector ?? TRUJILLO_SECTORS[3].label);
  const [telefono, setTelefono] = useState(initial?.telefono ?? '+58 271-');
  const [frecuenciaRadio, setFrecuenciaRadio] = useState(
    initial?.frecuenciaRadio ?? 'VHF 154.000 MHz'
  );
  const [capacidad, setCapacidad] = useState(initial?.capacidad ?? '');
  const [lat, setLat] = useState(String(initial?.lat ?? TRUJILLO_SECTORS[3].lat));
  const [lng, setLng] = useState(String(initial?.lng ?? TRUJILLO_SECTORS[3].lng));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!PHONE_REGEX.test(telefono.trim())) {
      setError('Teléfono inválido (ej. +58 271-6621145).');
      return;
    }
    const coords = clampTrujilloCoords(Number(lat), Number(lng));
    setSaving(true);
    try {
      await onSave(
        {
          nombre: nombre.trim().slice(0, 120),
          organismo,
          sector: sector.trim().slice(0, 100),
          telefono: telefono.trim().slice(0, 24),
          frecuenciaRadio: frecuenciaRadio.trim().slice(0, 40),
          capacidad: capacidad.trim().slice(0, 150),
          lat: coords.lat,
          lng: coords.lng,
          disponible: initial ? initial.disponible : true,
        },
        initial?.id
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditing
            ? 'Error al actualizar fuerza amiga.'
            : 'Error al guardar fuerza amiga.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#111822] border border-slate-700 rounded-lg max-w-xl w-full shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sky-400">
            <Shield className="w-5 h-5" />
            <h2 className="font-display text-xl font-bold text-white">
              {isEditing
                ? 'Editar Fuerza Amiga'
                : 'Registrar Fuerza Amiga (PNB, CICPC, Estadal, CONAS)'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded bg-red-950/70 border border-red-500/40 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Organismo</label>
              <select
                value={organismo}
                onChange={(e) => setOrganismo(e.target.value as FriendlyAgency)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white"
              >
                {(Object.keys(AGENCY_LABELS) as FriendlyAgency[]).map((key) => (
                  <option key={key} value={key}>
                    {AGENCY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nombre de Estación / Destacamento</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Teléfono Directo</label>
              <input
                type="tel"
                required
                maxLength={24}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm font-mono-tabular text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Frecuencia Radio / Canal</label>
              <input
                type="text"
                maxLength={40}
                value={frecuenciaRadio}
                onChange={(e) => setFrecuenciaRadio(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm font-mono-tabular text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <label className="block text-xs text-slate-400 mb-1">Sector / Jurisdicción</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs text-slate-400 mb-1">Latitud</label>
              <input
                type="number"
                step="0.0001"
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs font-mono-tabular text-white"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs text-slate-400 mb-1">Longitud</label>
              <input
                type="number"
                step="0.0001"
                required
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs font-mono-tabular text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Capacidad Operativa</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={150}
              placeholder="Ej. Patrullaje motorizado, cierre vial, brigada antiextorsión"
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#192332] rounded-md cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md cursor-pointer disabled:opacity-50">
              {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Registrar Fuerza Amiga'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

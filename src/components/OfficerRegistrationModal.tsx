import React, { useMemo, useState } from 'react';
import { ShieldCheck, UserCheck, AlertCircle, X } from 'lucide-react';
import {
  DESTACAMENTO_META,
  OFFICER_RANK_OPTIONS,
  PHONE_REGEX,
  type DestacamentoId,
  type OfficerProfile,
} from '../types/operations';
import {
  INITIAL_ZONE_UNITS,
  getCompaniasForDestacamento,
  getPuestosForCompania,
} from '../data/czgnb23Structure';

export interface OfficerRegistrationPayload {
  grado: string;
  displayName: string;
  cedula: string;
  telefono: string;
  cargo: string;
  destacamento?: DestacamentoId;
  compania?: string;
  puesto?: string;
}

interface OfficerRegistrationModalProps {
  email: string;
  initialProfile: OfficerProfile | null;
  defaultDisplayName: string;
  mandatory?: boolean;
  onClose?: () => void;
  onSave: (payload: OfficerRegistrationPayload) => Promise<void>;
}

const DESTACAMENTO_OPTIONS: DestacamentoId[] = ['CZGNB-23', 'D-231', 'DCR-23-1', 'DESUR-23'];

export const OfficerRegistrationModal: React.FC<OfficerRegistrationModalProps> = ({
  email,
  initialProfile,
  defaultDisplayName,
  mandatory = false,
  onClose,
  onSave,
}) => {
  const [grado, setGrado] = useState(initialProfile?.grado || 'Cap.');
  const [displayName, setDisplayName] = useState(
    initialProfile?.displayName || defaultDisplayName || ''
  );
  const [cedula, setCedula] = useState(initialProfile?.cedula || '');
  const [telefono, setTelefono] = useState(initialProfile?.telefono || '');
  const [destacamento, setDestacamento] = useState<DestacamentoId>(
    initialProfile?.destacamento || 'CZGNB-23'
  );
  const [compania, setCompania] = useState(initialProfile?.compania || '');
  const [puesto, setPuesto] = useState(initialProfile?.puesto || '');
  const [cargo, setCargo] = useState(
    initialProfile?.cargo || 'Oficial de Guardia — CZGNB-23 Trujillo'
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const companiaOptions = useMemo(
    () => getCompaniasForDestacamento(INITIAL_ZONE_UNITS, destacamento),
    [destacamento]
  );

  const puestoOptions = useMemo(
    () => getPuestosForCompania(INITIAL_ZONE_UNITS, destacamento, compania),
    [destacamento, compania]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanGrado = grado.trim();
    const cleanName = displayName.trim();
    const cleanCedula = cedula.trim().toUpperCase();
    const cleanPhone = telefono.trim();
    const cleanCargo = cargo.trim();

    if (cleanGrado.length < 1 || cleanGrado.length > 40) {
      setError('Selecciona o indica tu grado / jerarquía.');
      return;
    }
    if (cleanName.length < 3 || cleanName.length > 100) {
      setError('Indica tus nombres y apellidos completos (mínimo 3 caracteres).');
      return;
    }
    if (cleanCedula.length < 5 || cleanCedula.length > 24) {
      setError('Indica tu número de cédula de identidad (ej. V-19.450.123).');
      return;
    }
    if (!PHONE_REGEX.test(cleanPhone)) {
      setError('Indica un teléfono de contacto válido (ej. 0414-1234567).');
      return;
    }
    if (cleanCargo.length < 2 || cleanCargo.length > 80) {
      setError('Indica tu cargo, escuadrón o unidad asignada.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        grado: cleanGrado,
        displayName: cleanName,
        cedula: cleanCedula,
        telefono: cleanPhone,
        cargo: cleanCargo,
        destacamento,
        compania: compania.trim().slice(0, 80),
        puesto: puesto.trim().slice(0, 80),
      });
    } catch {
      setError('No se pudo guardar tu registro de oficial. Verifica tu conexión e intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-[#111822] border border-slate-700/80 rounded-lg shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 bg-[#0E151E] border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/ESCUDO_DCR23-1_11250c43.png"
              alt="Escudo CZGNB-23 Trujillo"
              className="w-10 h-10 object-contain shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-white leading-tight">
                {mandatory
                  ? 'Registro Obligatorio de Usuario'
                  : 'Actualizar Credenciales de Oficial'}
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Comando de Zona Nro. 23 GNB — Estado Trujillo (CZGNB-23)
              </p>
            </div>
          </div>
          {!mandatory && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          <div className="bg-[#0B1117] border border-emerald-500/30 rounded-md px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-slate-200 font-semibold">
                Cuenta Google verificada:{' '}
                <span className="font-mono-tabular text-emerald-300">{email}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Completa tus datos de identificación militar/policial y tu unidad orgánica dentro
                del Comando de Zona Nro. 23. Todas las operaciones quedan registradas en la
                bitácora de auditoría del Comando.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Grado / Jerarquía *
              </label>
              <select
                value={grado}
                onChange={(e) => setGrado(e.target.value)}
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {OFFICER_RANK_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Nombres y Apellidos Completos *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                placeholder="Ej. Carlos Eduardo Méndez Rivas"
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Cédula de Identidad *
              </label>
              <input
                type="text"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                maxLength={24}
                placeholder="Ej. V-19.450.123"
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white font-mono-tabular placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Teléfono de Contacto *
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                maxLength={24}
                placeholder="Ej. 0414-1234567"
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white font-mono-tabular placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* CZGNB-23 Organic Unit Assignment */}
          <div className="bg-[#0B1117] border border-slate-800 rounded-md p-3 space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Adscripción Orgánica CZGNB-23 Trujillo
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Destacamento / Comando
                </label>
                <select
                  value={destacamento}
                  onChange={(e) => {
                    const next = e.target.value as DestacamentoId;
                    setDestacamento(next);
                    setCompania('');
                    setPuesto('');
                  }}
                  className="w-full bg-[#111822] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {DESTACAMENTO_OPTIONS.map((id) => (
                    <option key={id} value={id}>
                      {DESTACAMENTO_META[id].shortLabel} — {DESTACAMENTO_META[id].municipioSede}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Compañía
                </label>
                <select
                  value={compania}
                  onChange={(e) => {
                    setCompania(e.target.value);
                    setPuesto('');
                  }}
                  className="w-full bg-[#111822] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Plana Mayor / Comando</option>
                  {companiaOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {puestoOptions.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Puesto / PAC (opcional)
                </label>
                <select
                  value={puesto}
                  onChange={(e) => setPuesto(e.target.value)}
                  className="w-full bg-[#111822] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Sede de Compañía</option>
                  {puestoOptions.map((u) => (
                    <option key={u.codigo} value={u.nombre}>
                      {u.nombre} ({u.municipio})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Cargo / Función Operativa *
            </label>
            <input
              type="text"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              maxLength={80}
              placeholder="Ej. Comandante de Compañía / Oficial de Guardia / Jefe de Comisión"
              className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/60 border border-red-500/40 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            {!mandatory && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-[#192332] rounded-md cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-md transition-colors cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              {saving
                ? 'Guardando registro...'
                : mandatory
                  ? 'Confirmar Registro e Ingresar'
                  : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  LogOut,
  Send,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
} from 'lucide-react';
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

export interface AccessRequestPayload {
  grado: string;
  displayName: string;
  cedula: string;
  telefono: string;
  cargo: string;
  destacamento?: DestacamentoId;
  compania?: string;
  puesto?: string;
  solicitudNota: string;
}

interface AccessGateScreenProps {
  mode: 'pendiente' | 'expulsado';
  email: string;
  defaultDisplayName: string;
  profile: OfficerProfile | null;
  onSubmitRequestDetails: (payload: AccessRequestPayload) => Promise<void>;
  onRedeemSecretCode: (code: string) => Promise<{ ok: boolean; message?: string }>;
  onSignOut: () => Promise<void>;
}

function formatDateTime(ms?: number): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export const AccessGateScreen: React.FC<AccessGateScreenProps> = ({
  mode,
  email,
  defaultDisplayName,
  profile,
  onSubmitRequestDetails,
  onRedeemSecretCode,
  onSignOut,
}) => {
  // Secret code redemption state
  const [secretCode, setSecretCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Identification / approval request form state
  const [grado, setGrado] = useState(profile?.grado || 'Cap.');
  const [displayName, setDisplayName] = useState(
    profile?.displayName || defaultDisplayName || ''
  );
  const [cedula, setCedula] = useState(profile?.cedula || '');
  const [telefono, setTelefono] = useState(profile?.telefono || '');
  const [destacamento, setDestacamento] = useState<DestacamentoId>(
    profile?.destacamento || 'D-231'
  );
  const [compania, setCompania] = useState(profile?.compania || '');
  const [puesto, setPuesto] = useState(profile?.puesto || '');
  const [cargo, setCargo] = useState(
    profile?.cargo || 'Oficial de Guardia — CZGNB-23 Trujillo'
  );
  const [solicitudNota, setSolicitudNota] = useState(profile?.solicitudNota || '');
  const [savingRequest, setSavingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(Boolean(profile?.perfilCompleto));

  const companiaOptions = useMemo(
    () => getCompaniasForDestacamento(INITIAL_ZONE_UNITS, destacamento),
    [destacamento]
  );

  const puestoOptions = useMemo(
    () => getPuestosForCompania(INITIAL_ZONE_UNITS, destacamento, compania),
    [destacamento, compania]
  );

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    const trimmed = secretCode.trim();
    if (trimmed.length < 6) {
      setCodeError('Ingresa el código secreto completo proporcionado por el Administrador.');
      return;
    }

    setRedeeming(true);
    try {
      const result = await onRedeemSecretCode(trimmed);
      if (!result.ok) {
        setCodeError(
          result.message ||
            'Código secreto inválido, revocado o sin usos disponibles. Solicita autorización al Administrador.'
        );
      }
    } finally {
      setRedeeming(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);

    const cleanGrado = grado.trim();
    const cleanName = displayName.trim();
    const cleanCedula = cedula.trim().toUpperCase();
    const cleanPhone = telefono.trim();
    const cleanCargo = cargo.trim();
    const cleanNota = solicitudNota.trim();

    if (cleanName.length < 3 || cleanName.length > 100) {
      setRequestError('Indica tus nombres y apellidos completos.');
      return;
    }
    if (cleanCedula.length < 5 || cleanCedula.length > 24) {
      setRequestError('Indica tu cédula de identidad (ej. V-19.450.123).');
      return;
    }
    if (!PHONE_REGEX.test(cleanPhone)) {
      setRequestError('Indica un teléfono de contacto válido (ej. 0414-1234567).');
      return;
    }
    if (cleanCargo.length < 2 || cleanCargo.length > 80) {
      setRequestError('Indica tu cargo, escuadrón o unidad asignada.');
      return;
    }

    setSavingRequest(true);
    try {
      await onSubmitRequestDetails({
        grado: cleanGrado,
        displayName: cleanName,
        cedula: cleanCedula,
        telefono: cleanPhone,
        cargo: cleanCargo,
        destacamento,
        compania: compania.trim().slice(0, 80),
        puesto: puesto.trim().slice(0, 80),
        solicitudNota: cleanNota.slice(0, 240),
      });
      setRequestSent(true);
    } catch {
      setRequestError('No se pudo enviar tu solicitud al Comando. Verifica tu conexión.');
    } finally {
      setSavingRequest(false);
    }
  };

  if (mode === 'expulsado') {
    return (
      <div className="min-h-screen bg-[#0B1117] text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[#111822] border border-red-500/60 rounded-lg shadow-2xl overflow-hidden">
          <div className="px-6 py-5 bg-red-950/60 border-b border-red-500/40 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-lg bg-red-900/70 border border-red-400/50 flex items-center justify-center shrink-0">
              <ShieldBan className="w-6 h-6 text-red-200" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-red-300">
                CZGNB-23 Trujillo · Seguridad de Comando de Zona
              </div>
              <h1 className="font-display text-xl font-bold text-white leading-tight">
                Acceso Revocado / Usuario Expulsado
              </h1>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-200 leading-relaxed">
              Tu cuenta ha sido <strong className="text-red-300">expulsada y restringida</strong>{' '}
              por el Administrador del Comando de Zona Nro. 23. No tienes autorización para
              consultar ni registrar información operativa en el sistema.
            </p>

            <div className="bg-[#0B1117] border border-slate-800 rounded-md p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Cuenta restringida:</span>
                <span className="font-mono-tabular text-slate-200 font-semibold">{email}</span>
              </div>
              {profile?.expulsadoMotivo && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="text-slate-400 mb-1">Motivo registrado por el Comando:</div>
                  <div className="text-red-200 font-medium">{profile.expulsadoMotivo}</div>
                </div>
              )}
              {profile?.expulsadoAt && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <span className="text-slate-400">Fecha de restricción:</span>
                  <span className="font-mono-tabular text-slate-300">
                    {formatDateTime(profile.expulsadoAt.toMillis())}
                  </span>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-900/70 border border-slate-800 rounded-md px-3.5 py-2.5 flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>
                El acceso no puede desbloquearse con códigos secretos mientras la expulsión esté
                vigente. Si consideras que se trata de un error, comunícate directamente con el
                Administrador del Comando de Zona Nro. 23.
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-600 rounded-md cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1117] text-slate-100 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#111822] border border-amber-500/50 rounded-lg shadow-2xl overflow-hidden my-auto">
        {/* Top Header */}
        <div className="px-5 sm:px-6 py-4 bg-[#0E151E] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/ESCUDO_DCR23-1_11250c43.png"
              alt="Escudo CZGNB-23 Trujillo"
              className="w-11 h-11 object-contain shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/90 border border-amber-500/60 text-amber-200 text-[10px] font-bold uppercase tracking-wider">
                  <ShieldAlert className="w-3 h-3" />
                  Acceso Restringido
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-medium">
                  <Clock className="w-3 h-3 animate-pulse" />
                  Esperando autorización del Comando de Zona
                </span>
              </div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-white leading-tight mt-0.5">
                Verificación de Ingreso — CZGNB-23 Trujillo
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void onSignOut()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-[#192332] hover:bg-[#243247] border border-slate-700 rounded-md cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar Sesión
          </button>
        </div>

        {/* Account Banner */}
        <div className="px-5 sm:px-6 py-3 bg-[#0B1117] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Sesión Google verificada:{' '}
              <strong className="font-mono-tabular text-white">{email}</strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Esta pantalla se desbloqueará automáticamente en cuanto seas autorizado.
          </span>
        </div>

        {/* Dual Authorization Paths */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Path 1: Secret Code */}
          <div className="lg:col-span-5 bg-[#0E151E] border border-emerald-500/35 rounded-lg p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-md bg-emerald-950/90 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    Opción 1 · Código Secreto
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Ingreso inmediato con clave emitida por el Administrador
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Si el Comandante o Administrador te envió un <strong>código secreto</strong> de
                autorización, ingrésalo aquí para habilitar tu cuenta de inmediato.
              </p>

              <form onSubmit={(e) => void handleCodeSubmit(e)} className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Código Secreto de Autorización
                  </label>
                  <input
                    type="text"
                    value={secretCode}
                    onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
                    placeholder="CZGNB23-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={64}
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2.5 text-sm font-mono-tabular tracking-wider text-emerald-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                {codeError && (
                  <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/60 border border-red-500/40 rounded-md px-3 py-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{codeError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={redeeming}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-md transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  {redeeming ? 'Verificando código...' : 'Validar Código e Ingresar'}
                </button>
              </form>
            </div>

            <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-800/80">
              Cada código es validado de forma cifrada en la base de datos y queda vinculado a tu
              usuario en la bitácora de auditoría.
            </div>
          </div>

          {/* Path 2: Admin Real-Time Approval Request */}
          <div className="lg:col-span-7 bg-[#0E151E] border border-amber-500/35 rounded-lg p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-md bg-amber-950/90 border border-amber-500/40 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    Opción 2 · Solicitar Aprobación por Alerta al Administrador
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Envía tus credenciales para que el Administrador apruebe tu acceso en vivo
                  </p>
                </div>
              </div>
              {requestSent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  Alerta enviada
                </span>
              )}
            </div>

            <form onSubmit={(e) => void handleRequestSubmit(e)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Grado / Jerarquía *
                  </label>
                  <select
                    value={grado}
                    onChange={(e) => setGrado(e.target.value)}
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
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
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
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
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white font-mono-tabular placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
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
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white font-mono-tabular placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Destacamento
                  </label>
                  <select
                    value={destacamento}
                    onChange={(e) => {
                      setDestacamento(e.target.value as DestacamentoId);
                      setCompania('');
                      setPuesto('');
                    }}
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {(['CZGNB-23', 'D-231', 'DCR-23-1', 'DESUR-23'] as const).map((id) => (
                      <option key={id} value={id}>
                        {DESTACAMENTO_META[id].shortLabel}
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
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Plana Mayor / Sede</option>
                    {companiaOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Puesto / PAC
                  </label>
                  <select
                    value={puesto}
                    onChange={(e) => setPuesto(e.target.value)}
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Sin puesto específico</option>
                    {puestoOptions.map((u) => (
                      <option key={u.codigo} value={u.nombre}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Cargo / Función *
                  </label>
                  <input
                    type="text"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    maxLength={80}
                    placeholder="Ej. Jefe de Comisión / Comandante de Puesto"
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Motivo / Sector de Servicio (opcional)
                  </label>
                  <input
                    type="text"
                    value={solicitudNota}
                    onChange={(e) => setSolicitudNota(e.target.value)}
                    maxLength={240}
                    placeholder="Ej. Guardia PAC Agua Viva / Boconó / Valera"
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {requestError && (
                <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/60 border border-red-500/40 rounded-md px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{requestError}</span>
                </div>
              )}

              {requestSent && (
                <div className="flex items-start gap-2 text-xs text-amber-100 bg-amber-950/50 border border-amber-500/40 rounded-md px-3 py-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Tus datos están visibles en la alerta en tiempo real del Administrador. Permanece
                    en esta pantalla: ingresarás automáticamente al ser aprobado.
                  </span>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingRequest}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 rounded-md transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {savingRequest
                    ? 'Enviando solicitud...'
                    : requestSent
                      ? 'Actualizar Datos de Solicitud'
                      : 'Enviar Alerta de Autorización al Comando'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

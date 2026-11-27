import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileWarning,
  KeyRound,
  Lock,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import {
  ACCESS_STATUS_LABELS,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_SEVERITY_LABELS,
  OFFICER_PRIVILEGE_DESCRIPTIONS,
  OFFICER_PRIVILEGE_LABELS,
  OFFICER_RANK_OPTIONS,
  PHONE_REGEX,
  type AccessCodeRecord,
  type AuditAction,
  type AuditLog,
  type OfficerAccessStatus,
  type OfficerPrivilege,
  type OfficerProfile,
} from '../types/operations';
import { sanitizePhoneForTel } from '../lib/geo';
import { generateRandomSecretCode, normalizeSecretCode } from '../lib/accessCrypto';
import type { OfficerRegistrationPayload } from './OfficerRegistrationModal';

export type AuditModalTab = 'control_acceso' | 'bitacora' | 'usuarios' | 'mi_registro';

interface AuditRegistryModalProps {
  officers: OfficerProfile[];
  auditLogs: AuditLog[];
  accessCodes: AccessCodeRecord[];
  currentUserUid: string;
  currentUserEmail: string;
  isCommandAdmin: boolean;
  isPrimaryAdmin: boolean;
  myProfile: OfficerProfile | null;
  initialTab?: AuditModalTab;
  onUpdateMyProfile: (payload: OfficerRegistrationPayload) => Promise<void>;
  onApproveOfficer: (officer: OfficerProfile, privilegio?: OfficerPrivilege) => Promise<void>;
  onChangeOfficerPrivilege: (officer: OfficerProfile, privilegio: OfficerPrivilege) => Promise<void>;
  onExpelOfficer: (officer: OfficerProfile, motivo: string) => Promise<void>;
  onRehabilitateOfficer: (officer: OfficerProfile) => Promise<void>;
  onCreateAccessCode: (payload: {
    label: string;
    rawCode: string;
    maxUses: number;
  }) => Promise<{ ok: boolean; message?: string }>;
  onToggleAccessCodeActive: (code: AccessCodeRecord) => Promise<void>;
  onDeleteAccessCode: (code: AccessCodeRecord) => Promise<void>;
  onClose: () => void;
}

type ModalTab = AuditModalTab;
type DateRangePreset = 'today' | '7d' | '30d' | 'all' | 'custom';
type RiskFilter =
  | 'all'
  | 'mal_uso'
  | 'sensible_y_mal_uso'
  | 'crear'
  | 'editar'
  | 'sesiones'
  | 'sos'
  | 'gps';

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimestamp(ms?: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeCsvCell(val: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
  const safe = neutralized.replace(/"/g, '""');
  return `"${safe}"`;
}

const EXPEL_REASON_PRESETS = [
  'Acceso no autorizado',
  'Mal uso del sistema / eliminación irregular',
  'Cambio de unidad / Baja del destacamento',
  'Fin de guardia / comisión',
];

function getEffectiveAccessStatus(off: OfficerProfile): OfficerAccessStatus {
  if (off.email === 'donrafan@gmail.com') return 'autorizado';
  if (off.accessStatus === 'autorizado' || off.accessStatus === 'expulsado') {
    return off.accessStatus;
  }
  return 'pendiente';
}

function getEffectivePrivilege(off: OfficerProfile): OfficerPrivilege {
  if (off.email === 'donrafan@gmail.com') return 'administrador';
  if (
    off.privilegio === 'consulta' ||
    off.privilegio === 'operador' ||
    off.privilegio === 'supervisor' ||
    off.privilegio === 'administrador'
  ) {
    return off.privilegio;
  }
  return 'operador';
}

function getPrivilegeBadgeClass(priv: OfficerPrivilege): string {
  switch (priv) {
    case 'administrador':
      return 'bg-emerald-900/80 text-emerald-200 border-emerald-400/50';
    case 'supervisor':
      return 'bg-sky-950/90 text-sky-200 border-sky-400/50';
    case 'operador':
      return 'bg-indigo-950/90 text-indigo-200 border-indigo-400/45';
    case 'consulta':
      return 'bg-slate-800/90 text-slate-300 border-slate-600/60';
  }
}

export const AuditRegistryModal: React.FC<AuditRegistryModalProps> = ({
  officers,
  auditLogs,
  accessCodes,
  currentUserUid,
  currentUserEmail,
  isCommandAdmin,
  isPrimaryAdmin,
  myProfile,
  initialTab,
  onUpdateMyProfile,
  onApproveOfficer,
  onChangeOfficerPrivilege,
  onExpelOfficer,
  onRehabilitateOfficer,
  onCreateAccessCode,
  onToggleAccessCodeActive,
  onDeleteAccessCode,
  onClose,
}) => {
  const [tab, setTab] = useState<ModalTab>(() => {
    if (initialTab && (initialTab !== 'control_acceso' || isCommandAdmin)) {
      return initialTab;
    }
    return isCommandAdmin ? 'usuarios' : 'bitacora';
  });
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('30d');
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toLocalDateKey(d);
  });
  const [customTo, setCustomTo] = useState(() => toLocalDateKey(new Date()));
  const [copiedCsv, setCopiedCsv] = useState(false);

  // Access control, privilege management & expulsion state (Command Admin)
  const [expellingUid, setExpellingUid] = useState<string | null>(null);
  const [expelReason, setExpelReason] = useState('Acceso no autorizado');
  const [busyOfficerUid, setBusyOfficerUid] = useState<string | null>(null);
  const [pendingPrivilegeMap, setPendingPrivilegeMap] = useState<Record<string, OfficerPrivilege>>(
    {}
  );
  const [privilegeFilter, setPrivilegeFilter] = useState<
    'all' | OfficerPrivilege | 'pendiente' | 'expulsado'
  >('all');

  // Secret code creation state
  const [codeLabel, setCodeLabel] = useState('Autorización de Guardia CZGNB-23');
  const [rawSecretCode, setRawSecretCode] = useState(() => generateRandomSecretCode());
  const [codeMaxUses, setCodeMaxUses] = useState<number>(1);
  const [creatingCode, setCreatingCode] = useState(false);
  const [codeFormError, setCodeFormError] = useState<string | null>(null);
  const [lastCreatedCode, setLastCreatedCode] = useState<{
    code: string;
    label: string;
    maxUses: number;
  } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<'code' | 'message' | null>(null);
  const [busyCodeId, setBusyCodeId] = useState<string | null>(null);

  // My profile form state
  const [grado, setGrado] = useState(myProfile?.grado || 'Cap.');
  const [displayName, setDisplayName] = useState(myProfile?.displayName || '');
  const [cedula, setCedula] = useState(myProfile?.cedula || '');
  const [telefono, setTelefono] = useState(myProfile?.telefono || '');
  const [cargo, setCargo] = useState(
    myProfile?.cargo || 'Oficial de Guardia — CZGNB-23 Trujillo'
  );
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Compute per-officer stats from auditLogs
  const officerStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalActions: number;
        creates: number;
        edits: number;
        deletes: number;
        misuseAlerts: number;
        lastActionMs: number;
      }
    >();

    for (const log of auditLogs) {
      const uid = log.actorUid;
      const curr = map.get(uid) ?? {
        totalActions: 0,
        creates: 0,
        edits: 0,
        deletes: 0,
        misuseAlerts: 0,
        lastActionMs: 0,
      };
      curr.totalActions += 1;
      if (log.accion === 'crear') curr.creates += 1;
      if (log.accion === 'editar' || log.accion === 'cambio_estado') curr.edits += 1;
      if (log.accion === 'eliminar') curr.deletes += 1;
      if (log.severidad === 'alerta_mal_uso') curr.misuseAlerts += 1;
      const ms = log.createdAt?.toMillis() ?? 0;
      if (ms > curr.lastActionMs) curr.lastActionMs = ms;
      map.set(uid, curr);
    }
    return map;
  }, [auditLogs]);

  // Automatic burst-deletion detector (>= 3 deletions by same user within 15 minutes)
  const burstDeletionAlerts = useMemo(() => {
    const byActor = new Map<string, AuditLog[]>();
    for (const log of auditLogs) {
      if (log.accion !== 'eliminar') continue;
      const list = byActor.get(log.actorUid) ?? [];
      list.push(log);
      byActor.set(log.actorUid, list);
    }

    const alerts: Array<{
      actorUid: string;
      actorLabel: string;
      actorEmail: string;
      count: number;
      latestMs: number;
    }> = [];

    const windowMs = 15 * 60 * 1000;
    byActor.forEach((logs, uid) => {
      const sorted = [...logs].sort(
        (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
      );
      let maxInWindow = 0;
      let latestMs = sorted[0]?.createdAt?.toMillis() ?? 0;
      for (let i = 0; i < sorted.length; i++) {
        const startMs = sorted[i].createdAt?.toMillis() ?? 0;
        let count = 1;
        for (let j = i + 1; j < sorted.length; j++) {
          const otherMs = sorted[j].createdAt?.toMillis() ?? 0;
          if (startMs - otherMs <= windowMs) {
            count += 1;
          } else {
            break;
          }
        }
        if (count > maxInWindow) {
          maxInWindow = count;
          latestMs = startMs;
        }
      }
      if (maxInWindow >= 3) {
        const sample = sorted[0];
        alerts.push({
          actorUid: uid,
          actorLabel: `${sample.actorGrado ? `${sample.actorGrado} ` : ''}${sample.actorNombre}${
            sample.actorCedula ? ` (${sample.actorCedula})` : ''
          }`,
          actorEmail: sample.actorEmail,
          count: maxInWindow,
          latestMs,
        });
      }
    });

    return alerts;
  }, [auditLogs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const todayKey = toLocalDateKey(now);

    let minMs = 0;
    let maxMs = Number.POSITIVE_INFINITY;

    if (datePreset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      minMs = start.getTime();
    } else if (datePreset === '7d') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      minMs = start.getTime();
    } else if (datePreset === '30d') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
      minMs = start.getTime();
    } else if (datePreset === 'custom') {
      if (customFrom) {
        const [y, m, d] = customFrom.split('-').map(Number);
        if (y && m && d) minMs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
      }
      if (customTo) {
        const [y, m, d] = customTo.split('-').map(Number);
        if (y && m && d) maxMs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
      }
    }

    return auditLogs.filter((log) => {
      if (actorFilter !== 'all' && log.actorUid !== actorFilter) return false;

      if (riskFilter === 'mal_uso' && log.severidad !== 'alerta_mal_uso') return false;
      if (
        riskFilter === 'sensible_y_mal_uso' &&
        log.severidad !== 'alerta_mal_uso' &&
        log.severidad !== 'sensible'
      ) {
        return false;
      }
      if (riskFilter === 'crear' && log.accion !== 'crear') return false;
      if (
        riskFilter === 'editar' &&
        log.accion !== 'editar' &&
        log.accion !== 'cambio_estado'
      ) {
        return false;
      }
      if (
        riskFilter === 'sesiones' &&
        log.accion !== 'sesion_inicio' &&
        log.accion !== 'sesion_cierre' &&
        log.accion !== 'perfil_registrado'
      ) {
        return false;
      }
      if (riskFilter === 'sos' && log.accion !== 'alerta_sos') return false;
      if (riskFilter === 'gps' && log.accion !== 'gps_estado') return false;

      const ms = log.createdAt?.toMillis() ?? Date.now();
      if (datePreset === 'today') {
        if (toLocalDateKey(new Date(ms)) !== todayKey) return false;
      } else if (datePreset !== 'all') {
        if (ms < minMs || ms > maxMs) return false;
      }

      if (!q) return true;
      return (
        log.actorNombre.toLowerCase().includes(q) ||
        log.actorEmail.toLowerCase().includes(q) ||
        log.actorCedula.toLowerCase().includes(q) ||
        log.actorGrado.toLowerCase().includes(q) ||
        log.resumen.toLowerCase().includes(q) ||
        AUDIT_ACTION_LABELS[log.accion].toLowerCase().includes(q) ||
        AUDIT_ENTITY_LABELS[log.entidad].toLowerCase().includes(q)
      );
    });
  }, [auditLogs, actorFilter, riskFilter, datePreset, customFrom, customTo, search]);

  const kpis = useMemo(() => {
    const misuseInFilter = filteredLogs.filter(
      (l) => l.severidad === 'alerta_mal_uso' || l.accion === 'eliminar'
    ).length;
    const sensitiveInFilter = filteredLogs.filter((l) => l.severidad === 'sensible').length;
    const latest = auditLogs[0];
    return {
      totalOfficers: officers.length,
      totalFiltered: filteredLogs.length,
      misuseInFilter,
      sensitiveInFilter,
      latestActor: latest
        ? `${latest.actorGrado ? `${latest.actorGrado} ` : ''}${latest.actorNombre}`
        : 'Sin actividad',
      latestTime: latest ? formatTimestamp(latest.createdAt?.toMillis()) : '—',
    };
  }, [officers.length, filteredLogs, auditLogs]);

  const handleCopyCsv = async () => {
    const headers = [
      'Fecha_Hora',
      'Grado',
      'Nombre',
      'Cedula',
      'Correo_Google',
      'Accion',
      'Entidad',
      'Severidad',
      'Detalle',
      'Dispositivo',
    ];
    const rows = filteredLogs.map((l) =>
      [
        formatTimestamp(l.createdAt?.toMillis()),
        l.actorGrado || '',
        l.actorNombre,
        l.actorCedula || '',
        l.actorEmail,
        AUDIT_ACTION_LABELS[l.accion],
        AUDIT_ENTITY_LABELS[l.entidad],
        AUDIT_SEVERITY_LABELS[l.severidad],
        l.resumen,
        l.dispositivo || '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    try {
      await navigator.clipboard.writeText(csv);
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 2600);
    } catch {
      // Fallback copy via textarea
      const ta = document.createElement('textarea');
      ta.value = csv;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 2600);
    }
  };

  const handleSaveProfileInline = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);

    const cleanGrado = grado.trim();
    const cleanName = displayName.trim();
    const cleanCedula = cedula.trim().toUpperCase();
    const cleanPhone = telefono.trim();
    const cleanCargo = cargo.trim();

    if (cleanName.length < 3 || cleanName.length > 100) {
      setProfileError('Indica tus nombres y apellidos completos.');
      return;
    }
    if (cleanCedula.length < 5 || cleanCedula.length > 24) {
      setProfileError('Indica tu cédula de identidad (ej. V-19.450.123).');
      return;
    }
    if (!PHONE_REGEX.test(cleanPhone)) {
      setProfileError('Indica un teléfono de contacto válido (ej. 0414-1234567).');
      return;
    }
    if (cleanCargo.length < 2 || cleanCargo.length > 80) {
      setProfileError('Indica tu cargo o unidad.');
      return;
    }

    setSavingProfile(true);
    try {
      await onUpdateMyProfile({
        grado: cleanGrado,
        displayName: cleanName,
        cedula: cleanCedula,
        telefono: cleanPhone,
        cargo: cleanCargo,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      setProfileError('No se pudo actualizar tu registro. Intenta nuevamente.');
    } finally {
      setSavingProfile(false);
    }
  };

  const getSeverityBadgeClass = (sev: AuditLog['severidad'], action: AuditAction) => {
    if (sev === 'alerta_mal_uso' || action === 'eliminar') {
      return 'bg-red-950/90 text-red-200 border-red-500/60';
    }
    if (sev === 'sensible') {
      return 'bg-amber-950/80 text-amber-200 border-amber-500/50';
    }
    return 'bg-slate-800/80 text-slate-300 border-slate-700';
  };

  const sortedOfficers = useMemo(() => {
    const orderRank: Record<OfficerAccessStatus, number> = {
      pendiente: 0,
      autorizado: 1,
      expulsado: 2,
    };
    return [...officers].sort((a, b) => {
      const rankDiff = orderRank[getEffectiveAccessStatus(a)] - orderRank[getEffectiveAccessStatus(b)];
      if (rankDiff !== 0) return rankDiff;
      const aMs = a.lastLoginAt?.toMillis() ?? a.updatedAt?.toMillis() ?? 0;
      const bMs = b.lastLoginAt?.toMillis() ?? b.updatedAt?.toMillis() ?? 0;
      return bMs - aMs;
    });
  }, [officers]);

  const pendingOfficers = useMemo(
    () => sortedOfficers.filter((o) => getEffectiveAccessStatus(o) === 'pendiente'),
    [sortedOfficers]
  );

  const expelledOfficers = useMemo(
    () => sortedOfficers.filter((o) => getEffectiveAccessStatus(o) === 'expulsado'),
    [sortedOfficers]
  );

  const userPrivilegeSummary = useMemo(() => {
    let administradores = 0;
    let supervisores = 0;
    let operadores = 0;
    let consultas = 0;
    let pendientes = 0;
    let expulsados = 0;

    for (const off of sortedOfficers) {
      const status = getEffectiveAccessStatus(off);
      if (status === 'pendiente') {
        pendientes += 1;
        continue;
      }
      if (status === 'expulsado') {
        expulsados += 1;
        continue;
      }
      const priv = getEffectivePrivilege(off);
      if (priv === 'administrador') administradores += 1;
      else if (priv === 'supervisor') supervisores += 1;
      else if (priv === 'consulta') consultas += 1;
      else operadores += 1;
    }

    return {
      total: sortedOfficers.length,
      autorizados: administradores + supervisores + operadores + consultas,
      administradores,
      supervisores,
      operadores,
      consultas,
      pendientes,
      expulsados,
    };
  }, [sortedOfficers]);

  const filteredDirectoryOfficers = useMemo(() => {
    if (privilegeFilter === 'all') return sortedOfficers;
    if (privilegeFilter === 'pendiente') {
      return sortedOfficers.filter((o) => getEffectiveAccessStatus(o) === 'pendiente');
    }
    if (privilegeFilter === 'expulsado') {
      return sortedOfficers.filter((o) => getEffectiveAccessStatus(o) === 'expulsado');
    }
    return sortedOfficers.filter(
      (o) => getEffectiveAccessStatus(o) === 'autorizado' && getEffectivePrivilege(o) === privilegeFilter
    );
  }, [sortedOfficers, privilegeFilter]);

  const copyPlainText = async (text: string, mode: 'code' | 'message') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedSecret(mode);
    setTimeout(() => setCopiedSecret(null), 2600);
  };

  const handleGenerateCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeFormError(null);
    const cleanLabel = codeLabel.trim();
    const cleanCode = normalizeSecretCode(rawSecretCode);
    if (cleanLabel.length < 2 || cleanLabel.length > 100) {
      setCodeFormError('Indica una etiqueta o referencia para el código (ej. Guardia Nocturna).');
      return;
    }
    if (cleanCode.length < 6 || cleanCode.length > 48) {
      setCodeFormError('El código secreto debe tener al menos 6 caracteres.');
      return;
    }
    setCreatingCode(true);
    try {
      const res = await onCreateAccessCode({
        label: cleanLabel,
        rawCode: cleanCode,
        maxUses: codeMaxUses,
      });
      if (!res.ok) {
        setCodeFormError(res.message || 'No se pudo crear el código secreto.');
        return;
      }
      setLastCreatedCode({ code: cleanCode, label: cleanLabel, maxUses: codeMaxUses });
      setRawSecretCode(generateRandomSecretCode());
    } finally {
      setCreatingCode(false);
    }
  };

  const handleConfirmExpel = async (officer: OfficerProfile) => {
    const clean = expelReason.trim() || 'Acceso no autorizado';
    setBusyOfficerUid(officer.uid);
    try {
      await onExpelOfficer(officer, clean);
      setExpellingUid(null);
      setExpelReason('Acceso no autorizado');
    } finally {
      setBusyOfficerUid(null);
    }
  };

  const handleApproveClick = async (officer: OfficerProfile, selectedPriv?: OfficerPrivilege) => {
    setBusyOfficerUid(officer.uid);
    try {
      await onApproveOfficer(officer, selectedPriv ?? pendingPrivilegeMap[officer.uid] ?? 'operador');
    } finally {
      setBusyOfficerUid(null);
    }
  };

  const handlePrivilegeChange = async (officer: OfficerProfile, nextPrivilege: OfficerPrivilege) => {
    if (getEffectivePrivilege(officer) === nextPrivilege) return;
    setBusyOfficerUid(officer.uid);
    try {
      await onChangeOfficerPrivilege(officer, nextPrivilege);
    } finally {
      setBusyOfficerUid(null);
    }
  };

  const handleRehabilitateClick = async (officer: OfficerProfile) => {
    setBusyOfficerUid(officer.uid);
    try {
      await onRehabilitateOfficer(officer);
    } finally {
      setBusyOfficerUid(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-6xl h-[92dvh] bg-[#0E151E] border border-slate-700/80 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-[#111822] border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-md bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-tight truncate">
                Usuarios, Privilegios, Accesos y Auditoría
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Panel exclusivo del Administrador · Gestión de usuarios, niveles de privilegio, códigos secretos y bitácora · CZGNB-23 Trujillo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-[#192332] hover:bg-[#243247] rounded-md cursor-pointer shrink-0"
            aria-label="Cerrar panel de administración"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scope & Navigation Tabs */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#0B1117] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'usuarios', label: `Usuarios y Privilegios (${officers.length})`, Icon: Users },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  tab === id
                    ? 'bg-emerald-700 text-white'
                    : 'bg-[#141D29] text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
            {isCommandAdmin && (
              <button
                type="button"
                onClick={() => setTab('control_acceso')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  tab === 'control_acceso'
                    ? 'bg-amber-600 text-white'
                    : pendingOfficers.length > 0
                      ? 'bg-amber-950/80 border border-amber-500/60 text-amber-200 hover:bg-amber-900/70'
                      : 'bg-[#141D29] text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                Solicitudes y Códigos
                {pendingOfficers.length > 0 && (
                  <span className="font-mono-tabular px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-bold">
                    {pendingOfficers.length}
                  </span>
                )}
              </button>
            )}
            {(
              [
                { id: 'bitacora', label: `Bitácora (${auditLogs.length})`, Icon: ShieldAlert },
                { id: 'mi_registro', label: 'Mi Perfil', Icon: UserCog },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  tab === id
                    ? 'bg-emerald-700 text-white'
                    : 'bg-[#141D29] text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              {isPrimaryAdmin ? 'Administrador Principal' : 'Administrador'} · {officers.length}{' '}
              {officers.length === 1 ? 'usuario' : 'usuarios'} · {pendingOfficers.length} pend.
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {tab === 'control_acceso' && isCommandAdmin && (
            <div className="space-y-5">
              {/* Section 1: Pending Requests */}
              <section className="bg-[#111822] border border-amber-500/40 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4.5 h-4.5 text-amber-400 shrink-0" />
                    <div>
                      <h3 className="font-display text-base font-bold text-white">
                        Solicitudes Pendientes de Aprobación ({pendingOfficers.length})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Ningún usuario nuevo puede ver ni escribir datos hasta que apruebes su ingreso o use un código secreto válido.
                      </p>
                    </div>
                  </div>
                </div>

                {pendingOfficers.length === 0 ? (
                  <div className="bg-[#0B1117] border border-slate-800 rounded-md p-4 text-xs text-slate-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    No hay solicitudes de acceso pendientes en este momento.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pendingOfficers.map((off) => {
                      const isBusy = busyOfficerUid === off.uid;
                      const isExpelling = expellingUid === off.uid;
                      return (
                        <div
                          key={off.uid}
                          className="bg-[#0B1117] border border-amber-500/40 rounded-md p-3.5 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white">
                                  {off.grado ? `${off.grado} ` : ''}
                                  {off.displayName}
                                </span>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/50">
                                  Pendiente
                                </span>
                              </div>
                              <div className="text-xs text-slate-300">
                                {off.cargo || off.unit}
                                {off.cedula ? ` · C.I. ${off.cedula}` : ''}
                                {off.telefono ? ` · Tel: ${off.telefono}` : ''}
                              </div>
                              <div className="text-[11px] font-mono-tabular text-slate-400">
                                {off.email} · Solicitado:{' '}
                                {formatTimestamp(off.updatedAt?.toMillis() ?? off.createdAt?.toMillis())}
                              </div>
                              {off.solicitudNota && (
                                <div className="text-xs text-amber-200 bg-amber-950/30 border border-amber-500/30 rounded px-2.5 py-1 mt-1">
                                  Nota del solicitante: &ldquo;{off.solicitudNota}&rdquo;
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <select
                                aria-label={`Privilegio inicial para ${off.displayName}`}
                                value={pendingPrivilegeMap[off.uid] ?? 'operador'}
                                onChange={(e) =>
                                  setPendingPrivilegeMap((prev) => ({
                                    ...prev,
                                    [off.uid]: e.target.value as OfficerPrivilege,
                                  }))
                                }
                                disabled={isBusy}
                                className="bg-[#111822] border border-slate-700 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-100 focus:outline-none focus:border-emerald-500"
                              >
                                <option value="operador">Usuario Operador</option>
                                <option value="consulta">Solo Consulta</option>
                                <option value="supervisor">Supervisor Operativo</option>
                                {isPrimaryAdmin && (
                                  <option value="administrador">Administrador</option>
                                )}
                              </select>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void handleApproveClick(
                                    off,
                                    pendingPrivilegeMap[off.uid] ?? 'operador'
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Autorizar Ingreso
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setExpellingUid(isExpelling ? null : off.uid);
                                  setExpelReason('Acceso no autorizado');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white rounded-md cursor-pointer"
                              >
                                <ShieldBan className="w-3.5 h-3.5" />
                                Rechazar / Expulsar
                              </button>
                            </div>
                          </div>

                          {isExpelling && (
                            <div className="pt-2.5 border-t border-slate-800 space-y-2">
                              <div className="text-[11px] font-semibold text-red-300">
                                Motivo de rechazo / expulsión (quedará bloqueado inmediatamente):
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {EXPEL_REASON_PRESETS.map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setExpelReason(preset)}
                                    className={`px-2 py-0.5 text-[10px] rounded border cursor-pointer ${
                                      expelReason === preset
                                        ? 'bg-red-900 border-red-400 text-white'
                                        : 'bg-[#111822] border-slate-700 text-slate-300 hover:text-white'
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <input
                                  type="text"
                                  value={expelReason}
                                  onChange={(e) => setExpelReason(e.target.value)}
                                  maxLength={240}
                                  className="flex-1 min-w-[200px] bg-[#111822] border border-red-500/40 rounded px-2.5 py-1.5 text-xs text-white"
                                />
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleConfirmExpel(off)}
                                  className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded cursor-pointer"
                                >
                                  Confirmar Expulsión
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpellingUid(null)}
                                  className="px-2.5 py-1.5 text-xs bg-slate-800 text-slate-300 rounded cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Section 2: Secret Authorization Codes */}
              <section className="bg-[#111822] border border-emerald-500/35 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="font-display text-base font-bold text-white">
                      Códigos Secretos de Autorización ({accessCodes.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Genera claves cifradas (SHA-256) para entregarlas por WhatsApp o radio a personal autorizado. Los usuarios expulsados NO pueden usar códigos secretos.
                    </p>
                  </div>
                </div>

                {/* New Secret Code Generator Form */}
                <form
                  onSubmit={(e) => void handleGenerateCodeSubmit(e)}
                  className="bg-[#0B1117] border border-slate-800 rounded-md p-3.5 space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Referencia / Comisión
                      </label>
                      <input
                        type="text"
                        value={codeLabel}
                        onChange={(e) => setCodeLabel(e.target.value)}
                        maxLength={100}
                        placeholder="Ej. Guardia Nocturna Sabana de Mendoza"
                        className="w-full bg-[#111822] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Código Secreto (aleatorio o personalizado)
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={rawSecretCode}
                          onChange={(e) => setRawSecretCode(e.target.value.toUpperCase())}
                          maxLength={48}
                          className="flex-1 min-w-0 bg-[#111822] border border-slate-700 rounded-md px-2.5 py-2 text-xs font-mono-tabular text-emerald-300 focus:outline-none focus:border-emerald-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setRawSecretCode(generateRandomSecretCode())}
                          title="Generar nuevo código aleatorio seguro"
                          className="px-2.5 py-2 bg-[#192332] hover:bg-[#243247] border border-slate-700 text-slate-200 rounded-md cursor-pointer shrink-0"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Usos Permitidos
                      </label>
                      <select
                        value={codeMaxUses}
                        onChange={(e) => setCodeMaxUses(Number(e.target.value))}
                        className="w-full bg-[#111822] border border-slate-700 rounded-md px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value={1}>1 uso (único)</option>
                        <option value={3}>3 usos</option>
                        <option value={5}>5 usos</option>
                        <option value={10}>10 usos</option>
                        <option value={25}>25 usos</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="submit"
                        disabled={creatingCode}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {creatingCode ? 'Creando...' : 'Crear Código'}
                      </button>
                    </div>
                  </div>

                  {codeFormError && (
                    <div className="text-xs text-red-300 bg-red-950/60 border border-red-500/40 rounded px-3 py-2">
                      {codeFormError}
                    </div>
                  )}
                </form>

                {/* Newly Created Plaintext Code Banner (shown once for copy/share) */}
                {lastCreatedCode && (
                  <div className="bg-emerald-950/60 border border-emerald-500/70 rounded-md p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                        <Lock className="w-4 h-4 text-emerald-400" />
                        CÓDIGO SECRETO LISTO — CÓPIALO AHORA (NO SE GUARDA EN TEXTO PLANO)
                      </div>
                      <button
                        type="button"
                        onClick={() => setLastCreatedCode(null)}
                        className="text-xs text-emerald-300/70 hover:text-white cursor-pointer"
                      >
                        Ocultar
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0B1117] border border-emerald-500/40 rounded px-3.5 py-2.5">
                      <div>
                        <div className="font-mono-tabular text-lg font-bold tracking-wider text-emerald-300">
                          {lastCreatedCode.code}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {lastCreatedCode.label} · Máximo {lastCreatedCode.maxUses}{' '}
                          {lastCreatedCode.maxUses === 1 ? 'uso' : 'usos'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void copyPlainText(lastCreatedCode.code, 'code')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                        >
                          {copiedSecret === 'code' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Código Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copiar Código
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void copyPlainText(
                              `🔐 *AUTORIZACIÓN DE ACCESO — CZGNB-23 TRUJILLO*\nReferencia: ${lastCreatedCode.label}\nCódigo Secreto: *${lastCreatedCode.code}*\nInicia sesión con tu cuenta Google e ingresa este código para habilitar el sistema del Comando de Zona Nro. 23 GNB.`,
                              'message'
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#192332] hover:bg-[#243247] border border-slate-700 text-slate-100 rounded cursor-pointer"
                        >
                          {copiedSecret === 'message' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              Mensaje Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copiar Mensaje WhatsApp
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Issued Codes List */}
                {accessCodes.length === 0 ? (
                  <div className="bg-[#0B1117] border border-slate-800 rounded-md p-4 text-xs text-slate-400">
                    Aún no has creado códigos secretos. Crea uno arriba si deseas autorizar personal sin aprobar uno por uno.
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-[#0B1117] border border-slate-800 rounded-md">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                          <th className="py-2 px-3">Referencia</th>
                          <th className="py-2 px-3">Clave (Enmascarada)</th>
                          <th className="py-2 px-3">Usos</th>
                          <th className="py-2 px-3">Estado</th>
                          <th className="py-2 px-3">Último Uso</th>
                          <th className="py-2 px-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-xs">
                        {accessCodes.map((code) => {
                          const exhausted = code.usedCount >= code.maxUses;
                          const isBusy = busyCodeId === code.id;
                          return (
                            <tr key={code.id} className="hover:bg-[#111822]">
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-white">{code.label}</div>
                                <div className="text-[10px] font-mono-tabular text-slate-500">
                                  Creado: {formatTimestamp(code.createdAt?.toMillis())}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono-tabular text-emerald-300 font-semibold">
                                {code.codeHint}
                              </td>
                              <td className="py-2.5 px-3 font-mono-tabular text-slate-200">
                                {code.usedCount} / {code.maxUses}
                              </td>
                              <td className="py-2.5 px-3">
                                {!code.active ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-950 text-red-300 border border-red-500/40">
                                    Revocado
                                  </span>
                                ) : exhausted ? (
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-300 border border-slate-700">
                                    Agotado
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                                    Activo
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-400">
                                {code.lastUsedByEmail ? (
                                  <span className="font-mono-tabular">{code.lastUsedByEmail}</span>
                                ) : (
                                  'Sin usar'
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      setBusyCodeId(code.id);
                                      try {
                                        await onToggleAccessCodeActive(code);
                                      } finally {
                                        setBusyCodeId(null);
                                      }
                                    }}
                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer disabled:opacity-50 ${
                                      code.active
                                        ? 'bg-amber-900/70 hover:bg-amber-800 text-amber-100'
                                        : 'bg-emerald-900/70 hover:bg-emerald-800 text-emerald-100'
                                    }`}
                                  >
                                    {code.active ? 'Revocar' : 'Reactivar'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={async () => {
                                      setBusyCodeId(code.id);
                                      try {
                                        await onDeleteAccessCode(code);
                                      } finally {
                                        setBusyCodeId(null);
                                      }
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-400 bg-[#192332] rounded cursor-pointer disabled:opacity-50"
                                    title="Eliminar código"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === 'bitacora' && (
            <>
              {/* KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[#111822] border border-slate-800 rounded-md p-3">
                  <div className="text-[11px] text-slate-400 font-medium">Usuarios Registrados</div>
                  <div className="font-mono-tabular text-2xl font-bold text-white mt-0.5">
                    {kpis.totalOfficers}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Personal con acceso verificado
                  </div>
                </div>

                <div className="bg-[#111822] border border-slate-800 rounded-md p-3">
                  <div className="text-[11px] text-slate-400 font-medium">Acciones Filtradas</div>
                  <div className="font-mono-tabular text-2xl font-bold text-emerald-400 mt-0.5">
                    {kpis.totalFiltered}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Registro inmutable (no borrable)
                  </div>
                </div>

                <div className="bg-[#111822] border border-slate-800 rounded-md p-3">
                  <div className="text-[11px] text-slate-400 font-medium">
                    Eliminaciones / Mal Uso
                  </div>
                  <div
                    className={`font-mono-tabular text-2xl font-bold mt-0.5 ${
                      kpis.misuseInFilter > 0 ? 'text-red-400' : 'text-slate-200'
                    }`}
                  >
                    {kpis.misuseInFilter}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {kpis.sensitiveInFilter} acciones sensibles adicionales
                  </div>
                </div>

                <div className="bg-[#111822] border border-slate-800 rounded-md p-3">
                  <div className="text-[11px] text-slate-400 font-medium">Último Usuario Activo</div>
                  <div className="text-sm font-bold text-cyan-200 truncate mt-1">
                    {kpis.latestActor}
                  </div>
                  <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5">
                    {kpis.latestTime}
                  </div>
                </div>
              </div>

              {/* Automatic Misuse / Burst Deletion Alert Banner */}
              {burstDeletionAlerts.length > 0 && (
                <div className="bg-red-950/50 border border-red-500/60 rounded-md p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-200">
                    <FileWarning className="w-4 h-4 text-red-400 shrink-0" />
                    ALERTA AUTOMÁTICA DE POSIBLE MAL USO: ELIMINACIONES MÚLTIPLES EN CORTO TIEMPO
                  </div>
                  <div className="space-y-1.5">
                    {burstDeletionAlerts.map((alert) => (
                      <div
                        key={alert.actorUid}
                        className="flex flex-wrap items-center justify-between gap-2 bg-[#140B0E] border border-red-900/70 rounded px-3 py-2 text-xs"
                      >
                        <div className="text-red-100">
                          <span className="font-semibold">{alert.actorLabel}</span> ({alert.actorEmail})
                          realizó <span className="font-mono-tabular font-bold text-red-300">{alert.count} eliminaciones</span> en menos de 15 minutos · Última: {formatTimestamp(alert.latestMs)}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActorFilter(alert.actorUid);
                            setRiskFilter('mal_uso');
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-red-700 hover:bg-red-600 text-white rounded cursor-pointer"
                        >
                          Auditar usuario
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters Toolbar */}
              <div className="bg-[#111822] border border-slate-800 rounded-md p-3 space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                  <div className="md:col-span-4 relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nombre, cédula, correo o acción..."
                      className="w-full bg-[#0B1117] border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <select
                      aria-label="Filtrar por usuario"
                      value={actorFilter}
                      onChange={(e) => setActorFilter(e.target.value)}
                      className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="all">Todos los usuarios</option>
                      {sortedOfficers.map((off) => (
                        <option key={off.uid} value={off.uid}>
                          {off.grado ? `${off.grado} ` : ''}
                          {off.displayName} ({off.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <select
                      aria-label="Filtrar por tipo de acción o riesgo"
                      value={riskFilter}
                      onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
                      className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="all">Todas las acciones</option>
                      <option value="mal_uso">Solo Eliminaciones / Mal Uso</option>
                      <option value="sensible_y_mal_uso">Sensibles + Mal Uso</option>
                      <option value="crear">Solo Creaciones de Datos</option>
                      <option value="editar">Ediciones y Cambios de Estado</option>
                      <option value="sesiones">Inicios / Cierres de Sesión</option>
                      <option value="sos">Alertas SOS / Apoyo</option>
                      <option value="gps">GPS en Tiempo Real</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleCopyCsv()}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#192332] hover:bg-[#243247] border border-slate-700 text-slate-200 rounded-md cursor-pointer"
                    >
                      {copiedCsv ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          CSV Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar CSV
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Date range selector */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 mr-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Período:
                    </span>
                    {(
                      [
                        { id: 'today', label: 'Hoy' },
                        { id: '7d', label: '7 días' },
                        { id: '30d', label: '30 días' },
                        { id: 'all', label: 'Todo' },
                        { id: 'custom', label: 'Personalizado' },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDatePreset(p.id)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                          datePreset === p.id
                            ? 'bg-emerald-700 text-white'
                            : 'bg-[#0B1117] text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {datePreset === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                      <label className="inline-flex items-center gap-1">
                        <span>Desde:</span>
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="bg-[#0B1117] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </label>
                      <label className="inline-flex items-center gap-1">
                        <span>Hasta:</span>
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="bg-[#0B1117] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Chronological Audit Table */}
              <div className="bg-[#111822] border border-slate-800 rounded-md overflow-hidden">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No hay eventos de auditoría que coincidan con los filtros seleccionados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0B1117] border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                          <th className="py-2.5 px-3 whitespace-nowrap">Fecha / Hora</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Usuario Responsable</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Acción y Módulo</th>
                          <th className="py-2.5 px-3">Detalle de Operación</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Nivel</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70 text-xs">
                        {filteredLogs.map((log) => (
                          <tr
                            key={log.id}
                            className={
                              log.severidad === 'alerta_mal_uso' || log.accion === 'eliminar'
                                ? 'bg-red-950/20 hover:bg-red-950/30'
                                : 'hover:bg-[#16202E]'
                            }
                          >
                            <td className="py-2.5 px-3 font-mono-tabular text-[11px] text-slate-300 whitespace-nowrap align-top">
                              {formatTimestamp(log.createdAt?.toMillis())}
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              <div className="font-semibold text-white whitespace-nowrap">
                                {log.actorGrado ? `${log.actorGrado} ` : ''}
                                {log.actorNombre}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono-tabular">
                                {log.actorCedula ? `${log.actorCedula} · ` : ''}
                                {log.actorEmail}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 align-top whitespace-nowrap">
                              <div className="font-semibold text-slate-200">
                                {AUDIT_ACTION_LABELS[log.accion]}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {AUDIT_ENTITY_LABELS[log.entidad]}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 align-top text-slate-200 max-w-md">
                              <div>{log.resumen}</div>
                              {log.dispositivo && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  Dispositivo: {log.dispositivo}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-top whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border ${getSeverityBadgeClass(
                                  log.severidad,
                                  log.accion
                                )}`}
                              >
                                {(log.severidad === 'alerta_mal_uso' ||
                                  log.accion === 'eliminar') && (
                                  <AlertTriangle className="w-3 h-3" />
                                )}
                                {AUDIT_SEVERITY_LABELS[log.severidad]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'usuarios' && (
            <div className="space-y-4">
              {/* Total Users & Privilege Breakdown KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPrivilegeFilter('all')}
                  className={`text-left bg-[#111822] border rounded-md p-3 transition-colors cursor-pointer ${
                    privilegeFilter === 'all'
                      ? 'border-emerald-400 bg-emerald-950/25'
                      : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="text-[11px] text-slate-400 font-medium">Total Usuarios</div>
                  <div className="font-mono-tabular text-2xl font-bold text-white mt-0.5">
                    {userPrivilegeSummary.total}
                  </div>
                  <div className="text-[10px] text-emerald-300 mt-0.5">
                    {userPrivilegeSummary.autorizados} activos
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPrivilegeFilter(
                      privilegeFilter === 'administrador' ? 'all' : 'administrador'
                    )
                  }
                  className={`text-left bg-[#111822] border rounded-md p-3 transition-colors cursor-pointer ${
                    privilegeFilter === 'administrador'
                      ? 'border-emerald-400 bg-emerald-950/30'
                      : 'border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="text-[11px] text-emerald-300 font-medium">Administradores</div>
                  <div className="font-mono-tabular text-2xl font-bold text-emerald-300 mt-0.5">
                    {userPrivilegeSummary.administradores}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Control total</div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPrivilegeFilter(privilegeFilter === 'supervisor' ? 'all' : 'supervisor')
                  }
                  className={`text-left bg-[#111822] border rounded-md p-3 transition-colors cursor-pointer ${
                    privilegeFilter === 'supervisor'
                      ? 'border-sky-400 bg-sky-950/30'
                      : 'border-slate-800 hover:border-sky-500/40'
                  }`}
                >
                  <div className="text-[11px] text-sky-300 font-medium">Supervisores</div>
                  <div className="font-mono-tabular text-2xl font-bold text-sky-300 mt-0.5">
                    {userPrivilegeSummary.supervisores}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Catálogos y campo</div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPrivilegeFilter(privilegeFilter === 'operador' ? 'all' : 'operador')
                  }
                  className={`text-left bg-[#111822] border rounded-md p-3 transition-colors cursor-pointer ${
                    privilegeFilter === 'operador'
                      ? 'border-indigo-400 bg-indigo-950/30'
                      : 'border-slate-800 hover:border-indigo-500/40'
                  }`}
                >
                  <div className="text-[11px] text-indigo-300 font-medium">Operadores</div>
                  <div className="font-mono-tabular text-2xl font-bold text-indigo-300 mt-0.5">
                    {userPrivilegeSummary.operadores}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Modo usuario estándar</div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPrivilegeFilter(privilegeFilter === 'consulta' ? 'all' : 'consulta')
                  }
                  className={`text-left bg-[#111822] border rounded-md p-3 transition-colors cursor-pointer ${
                    privilegeFilter === 'consulta'
                      ? 'border-slate-400 bg-slate-800/60'
                      : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="text-[11px] text-slate-300 font-medium">Solo Consulta</div>
                  <div className="font-mono-tabular text-2xl font-bold text-slate-200 mt-0.5">
                    {userPrivilegeSummary.consultas}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Solo lectura</div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPrivilegeFilter(
                      privilegeFilter === 'pendiente'
                        ? 'expulsado'
                        : privilegeFilter === 'expulsado'
                          ? 'all'
                          : 'pendiente'
                    )
                  }
                  className={`text-left bg-[#111822] border rounded-md p-3 transition-colors cursor-pointer ${
                    privilegeFilter === 'pendiente' || privilegeFilter === 'expulsado'
                      ? 'border-amber-400 bg-amber-950/30'
                      : 'border-slate-800 hover:border-amber-500/40'
                  }`}
                >
                  <div className="text-[11px] text-amber-300 font-medium">Pend. / Expuls.</div>
                  <div className="font-mono-tabular text-2xl font-bold text-amber-300 mt-0.5">
                    {userPrivilegeSummary.pendientes}
                    <span className="text-slate-600 text-base mx-1">/</span>
                    <span className="text-red-400">{userPrivilegeSummary.expulsados}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Sin acceso activo</div>
                </button>
              </div>

              {/* Privilege Level Reference Strip */}
              <div className="bg-[#111822] border border-slate-800 rounded-md p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
                {(
                  ['consulta', 'operador', 'supervisor', 'administrador'] as OfficerPrivilege[]
                ).map((lvl) => (
                  <div key={lvl} className="bg-[#0B1117] border border-slate-800/80 rounded p-2">
                    <span
                      className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border mb-1 ${getPrivilegeBadgeClass(
                        lvl
                      )}`}
                    >
                      {OFFICER_PRIVILEGE_LABELS[lvl]}
                    </span>
                    <p className="text-slate-400 leading-snug">
                      {OFFICER_PRIVILEGE_DESCRIPTIONS[lvl]}
                    </p>
                  </div>
                ))}
              </div>

              {filteredDirectoryOfficers.length === 0 ? (
                <div className="bg-[#111822] border border-slate-800 rounded-md p-8 text-center text-xs text-slate-400">
                  No hay usuarios que coincidan con este filtro de privilegio.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredDirectoryOfficers.map((off) => {
                    const st = officerStatsMap.get(off.uid) ?? {
                      totalActions: 0,
                      creates: 0,
                      edits: 0,
                      deletes: 0,
                      misuseAlerts: 0,
                      lastActionMs: 0,
                    };
                    const isSelf = off.uid === currentUserUid;
                    const isTargetPrimaryAdmin = off.email === 'donrafan@gmail.com';
                    const accessStatus = getEffectiveAccessStatus(off);
                    const currentPrivilege = getEffectivePrivilege(off);
                    const canManage =
                      isCommandAdmin &&
                      !isSelf &&
                      !isTargetPrimaryAdmin &&
                      (isPrimaryAdmin || currentPrivilege !== 'administrador');
                    const isExpelling = expellingUid === off.uid;
                    const isBusy = busyOfficerUid === off.uid;

                    return (
                      <div
                        key={off.uid}
                        className={`bg-[#111822] border rounded-md p-4 space-y-3 ${
                          accessStatus === 'expulsado'
                            ? 'border-red-500/60 bg-red-950/15'
                            : accessStatus === 'pendiente'
                              ? 'border-amber-500/50'
                              : st.deletes > 0
                                ? 'border-amber-500/40'
                                : 'border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-white">
                                {off.grado ? `${off.grado} ` : ''}
                                {off.displayName}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                                  Tú
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getPrivilegeBadgeClass(
                                  currentPrivilege
                                )}`}
                              >
                                {isTargetPrimaryAdmin
                                  ? 'Administrador Principal'
                                  : OFFICER_PRIVILEGE_LABELS[currentPrivilege]}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                  accessStatus === 'autorizado'
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                    : accessStatus === 'pendiente'
                                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                                      : 'bg-red-950/90 text-red-200 border-red-500/60'
                                }`}
                              >
                                {ACCESS_STATUS_LABELS[accessStatus]}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 truncate">
                              {off.cargo || off.unit}
                            </div>
                            <div className="text-[11px] font-mono-tabular text-slate-400 mt-1">
                              {off.cedula ? `C.I. ${off.cedula} · ` : ''}
                              {off.email}
                            </div>
                            {accessStatus === 'autorizado' && off.authorizedBy && (
                              <div className="text-[10px] text-emerald-300/80 mt-0.5">
                                Ingreso:{' '}
                                {off.authorizedBy === 'codigo_secreto'
                                  ? 'Código secreto verificado'
                                  : `Aprobado por ${off.authorizedBy}`}
                              </div>
                            )}
                            {accessStatus === 'expulsado' && off.expulsadoMotivo && (
                              <div className="text-[11px] text-red-300 bg-red-950/50 border border-red-500/40 rounded px-2 py-1 mt-1.5">
                                Expulsado: {off.expulsadoMotivo}
                              </div>
                            )}
                          </div>

                          {off.telefono && (
                            <a
                              href={`tel:${sanitizePhoneForTel(off.telefono)}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded shrink-0"
                            >
                              <Phone className="w-3 h-3" />
                              {off.telefono}
                            </a>
                          )}
                        </div>

                        {/* Privilege Control Section */}
                        {isTargetPrimaryAdmin ? (
                          <div className="bg-emerald-950/35 border border-emerald-500/35 rounded-md px-3 py-2 flex items-center gap-2 text-[11px] text-emerald-200">
                            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>
                              Administrador Principal protegido. Cuenta titular con control permanente de usuarios y privilegios.
                            </span>
                          </div>
                        ) : canManage ? (
                          <div className="bg-[#0B1117] border border-slate-800 rounded-md p-2.5 space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label
                                htmlFor={`priv-select-${off.uid}`}
                                className="text-[11px] font-semibold text-slate-300"
                              >
                                Privilegio del Usuario:
                              </label>
                              <select
                                id={`priv-select-${off.uid}`}
                                value={currentPrivilege}
                                disabled={isBusy}
                                onChange={(e) =>
                                  void handlePrivilegeChange(
                                    off,
                                    e.target.value as OfficerPrivilege
                                  )
                                }
                                className="bg-[#111822] border border-slate-700 rounded px-2.5 py-1 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-50"
                              >
                                <option value="consulta">Solo Consulta (Lectura)</option>
                                <option value="operador">Usuario Operador (Campo)</option>
                                <option value="supervisor">Supervisor Operativo</option>
                                {isPrimaryAdmin && (
                                  <option value="administrador">Administrador</option>
                                )}
                              </select>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-snug">
                              {OFFICER_PRIVILEGE_DESCRIPTIONS[currentPrivilege]}
                            </p>
                          </div>
                        ) : null}

                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center">
                          <div className="bg-[#0B1117] rounded p-2">
                            <div className="text-[10px] text-slate-400">Accesos</div>
                            <div className="font-mono-tabular text-sm font-bold text-white">
                              {off.loginCount ?? 1}
                            </div>
                          </div>
                          <div className="bg-[#0B1117] rounded p-2">
                            <div className="text-[10px] text-slate-400">Acciones</div>
                            <div className="font-mono-tabular text-sm font-bold text-cyan-300">
                              {st.totalActions}
                            </div>
                          </div>
                          <div className="bg-[#0B1117] rounded p-2">
                            <div className="text-[10px] text-slate-400">Creados</div>
                            <div className="font-mono-tabular text-sm font-bold text-emerald-400">
                              {st.creates}
                            </div>
                          </div>
                          <div className="bg-[#0B1117] rounded p-2">
                            <div className="text-[10px] text-slate-400">Eliminados</div>
                            <div
                              className={`font-mono-tabular text-sm font-bold ${
                                st.deletes > 0 ? 'text-red-400' : 'text-slate-300'
                              }`}
                            >
                              {st.deletes}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                          <div>
                            Último ingreso:{' '}
                            <span className="font-mono-tabular text-slate-200">
                              {formatTimestamp(
                                off.lastLoginAt?.toMillis() ?? off.updatedAt?.toMillis()
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActorFilter(off.uid);
                              setRiskFilter('all');
                              setDatePreset('all');
                              setTab('bitacora');
                            }}
                            className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                          >
                            Ver su bitácora →
                          </button>
                        </div>

                        {canManage && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {accessStatus === 'pendiente' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleApproveClick(off, currentPrivilege)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Autorizar Ingreso
                                </button>
                              )}
                              {accessStatus !== 'expulsado' ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    setExpellingUid(isExpelling ? null : off.uid);
                                    setExpelReason(
                                      st.deletes >= 3
                                        ? 'Mal uso del sistema / eliminación irregular'
                                        : 'Acceso no autorizado'
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white rounded cursor-pointer"
                                >
                                  <ShieldBan className="w-3.5 h-3.5" />
                                  Expulsar y Restringir
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleRehabilitateClick(off)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded cursor-pointer"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Rehabilitar Acceso
                                </button>
                              )}
                            </div>

                            {isExpelling && (
                              <div className="bg-[#0B1117] border border-red-500/50 rounded-md p-2.5 space-y-2">
                                <div className="text-[11px] font-semibold text-red-300">
                                  Confirmar expulsión inmediata (bloquea la sesión al instante):
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {EXPEL_REASON_PRESETS.map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => setExpelReason(preset)}
                                      className={`px-2 py-0.5 text-[10px] rounded border cursor-pointer ${
                                        expelReason === preset
                                          ? 'bg-red-900 border-red-400 text-white'
                                          : 'bg-[#111822] border-slate-700 text-slate-300'
                                      }`}
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <input
                                    type="text"
                                    value={expelReason}
                                    onChange={(e) => setExpelReason(e.target.value)}
                                    maxLength={240}
                                    className="flex-1 min-w-[160px] bg-[#111822] border border-red-500/40 rounded px-2 py-1 text-xs text-white"
                                  />
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleConfirmExpel(off)}
                                    className="px-2.5 py-1 text-[11px] font-bold bg-red-600 hover:bg-red-500 text-white rounded cursor-pointer"
                                  >
                                    Expulsar Ahora
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExpellingUid(null)}
                                    className="px-2 py-1 text-[11px] bg-slate-800 text-slate-300 rounded cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'mi_registro' && (
            <div className="max-w-xl mx-auto bg-[#111822] border border-slate-800 rounded-md p-5 space-y-4">
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  Mis Credenciales de Oficial Registrado
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cuenta Google vinculada:{' '}
                  <span className="font-mono-tabular text-emerald-300">{currentUserEmail}</span>
                </p>
              </div>

              <form onSubmit={(e) => void handleSaveProfileInline(e)} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Grado / Jerarquía
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
                      Nombres y Apellidos
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={100}
                      className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Cédula de Identidad
                    </label>
                    <input
                      type="text"
                      value={cedula}
                      onChange={(e) => setCedula(e.target.value)}
                      maxLength={24}
                      placeholder="V-19.450.123"
                      className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white font-mono-tabular focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      maxLength={24}
                      placeholder="0414-1234567"
                      className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white font-mono-tabular focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Cargo / Escuadrón / Unidad
                  </label>
                  <input
                    type="text"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    maxLength={80}
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                {profileError && (
                  <div className="text-xs text-red-300 bg-red-950/60 border border-red-500/40 rounded px-3 py-2">
                    {profileError}
                  </div>
                )}
                {profileSaved && (
                  <div className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 rounded px-3 py-2">
                    Registro actualizado y asentado en la bitácora de auditoría.
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-md cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    {savingProfile ? 'Guardando...' : 'Actualizar mi Registro'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

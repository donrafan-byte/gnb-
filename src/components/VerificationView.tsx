import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon,
  BarChart3,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Crosshair,
  Database,
  History,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  Volume2,
  X,
} from 'lucide-react';
import {
  AGENCY_SHORT_LABELS,
  AGENCY_STYLES,
  TRUJILLO_SECTORS,
  VERIFICATION_RESULT_LABELS,
  WANTED_CRIME_SUGGESTIONS,
  WANTED_DANGER_LABELS,
  WANTED_STATUS_LABELS,
  type Commission,
  type FriendlyForce,
  type VerificationEntityType,
  type VerificationLog,
  type VerificationResult,
  type WantedDangerLevel,
  type WantedRecord,
} from '../types/operations';
import { formatCoords, playTacticalAlertTone, sanitizePhoneForTel } from '../lib/geo';

export type VerificationLogFormPayload = Omit<
  VerificationLog,
  'id' | 'ownerId' | 'createdAt' | 'updatedAt'
>;

export type WantedRecordFormPayload = Omit<
  WantedRecord,
  'id' | 'ownerId' | 'createdAt' | 'updatedAt'
>;

interface VerificationViewProps {
  wantedRecords: WantedRecord[];
  verificationLogs: VerificationLog[];
  commissions: Commission[];
  friendlyForces: FriendlyForce[];
  defaultOfficerName: string;
  myLivePos: { lat: number; lng: number } | null;
  canOperate?: boolean;
  canEditCatalogs?: boolean;
  canDelete?: boolean;
  onSaveVerificationLog: (payload: VerificationLogFormPayload) => Promise<void>;
  onUpdateVerificationResult: (log: VerificationLog, resultado: VerificationResult) => Promise<void>;
  onDeleteVerificationLog: (log: VerificationLog) => Promise<void>;
  onSaveWantedRecord: (payload: WantedRecordFormPayload) => Promise<void>;
  onToggleWantedStatus: (record: WantedRecord) => Promise<void>;
  onDeleteWantedRecord: (record: WantedRecord) => Promise<void>;
  onLocateCoords: (lat: number, lng: number, zoom?: number) => void;
}

type SubTab = 'verificar' | 'estadisticas' | 'verificados' | 'solicitados';
type StatsRange = 'today' | '7d' | '30d' | 'all' | 'custom';

interface DailyBreakdownRow {
  dateKey: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
  personas: number;
  vehiculos: number;
  sinNovedad: number;
  observacion: number;
  solicitados: number;
  retenidos: number;
  total: number;
}

function normalizeId(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function stripNationalityPrefix(normalized: string): string {
  return normalized.replace(/^[VEJP]/, '');
}

function matchesRecord(queryRaw: string, record: WantedRecord, entityFilter: VerificationEntityType): boolean {
  if (record.tipo !== entityFilter) return false;
  const qNorm = normalizeId(queryRaw);
  const qDigits = stripNationalityPrefix(qNorm);
  const qLower = queryRaw.trim().toLowerCase();
  if (qNorm.length < 2 && qLower.length < 3) return false;

  const recNorm = normalizeId(record.identificador);
  const recDigits = stripNationalityPrefix(recNorm);
  const secNorm = normalizeId(record.aliasOSecundario);

  if (qNorm.length >= 3) {
    if (recNorm === qNorm || recNorm.includes(qNorm) || qNorm.includes(recNorm)) return true;
    if (qDigits.length >= 4 && (recDigits === qDigits || recDigits.includes(qDigits))) return true;
    if (secNorm.length >= 4 && secNorm.includes(qNorm)) return true;
  }

  if (qLower.length >= 4) {
    if (record.nombreDescripcion.toLowerCase().includes(qLower)) return true;
    if (record.aliasOSecundario.toLowerCase().includes(qLower)) return true;
  }

  return false;
}

function matchesLog(queryRaw: string, log: VerificationLog, entityFilter: VerificationEntityType): boolean {
  if (log.tipo !== entityFilter) return false;
  const qNorm = normalizeId(queryRaw);
  const qDigits = stripNationalityPrefix(qNorm);
  if (qNorm.length < 3) return false;

  const logNorm = normalizeId(log.identificador);
  const logDigits = stripNationalityPrefix(logNorm);
  const secNorm = normalizeId(log.datoSecundario);

  if (logNorm === qNorm || logNorm.includes(qNorm) || qNorm.includes(logNorm)) return true;
  if (qDigits.length >= 4 && (logDigits === qDigits || logDigits.includes(qDigits))) return true;
  if (secNorm.length >= 4 && secNorm.includes(qNorm)) return true;
  return false;
}

function formatTimestamp(ts?: { toDate: () => Date }): string {
  if (!ts) return 'Reciente';
  try {
    return ts.toDate().toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Reciente';
  }
}

function getLogDate(log: VerificationLog): Date {
  if (log.createdAt && typeof log.createdAt.toDate === 'function') {
    try {
      return log.createdAt.toDate();
    } catch {
      return new Date();
    }
  }
  return new Date();
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function offsetLocalDateKey(daysDelta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysDelta);
  return toLocalDateKey(d);
}

function parseLocalDateKeyStartMs(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function parseLocalDateKeyEndMs(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function formatDateKeyShort(dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDayLabel(dateKey: string, todayKey: string): { label: string; shortLabel: string } {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const formatted = dt.toLocaleDateString('es-VE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const shortFmt = dt.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
  });
  if (dateKey === todayKey) {
    return { label: `Hoy (${shortFmt})`, shortLabel: `Hoy · ${shortFmt}` };
  }
  return { label: formatted, shortLabel: shortFmt };
}

export const VerificationView: React.FC<VerificationViewProps> = ({
  wantedRecords,
  verificationLogs,
  commissions,
  friendlyForces,
  defaultOfficerName,
  myLivePos,
  canOperate = true,
  canEditCatalogs = true,
  canDelete = true,
  onSaveVerificationLog,
  onUpdateVerificationResult,
  onDeleteVerificationLog,
  onSaveWantedRecord,
  onToggleWantedStatus,
  onDeleteWantedRecord,
  onLocateCoords,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('verificar');

  // Instant lookup state
  const [lookupType, setLookupType] = useState<VerificationEntityType>('persona');
  const [lookupQuery, setLookupQuery] = useState('');
  const lastAlertedMatchIdRef = useRef<string | null>(null);

  // Verification log registration form
  const [identificador, setIdentificador] = useState('');
  const [nombreDescripcion, setNombreDescripcion] = useState('');
  const [datoSecundario, setDatoSecundario] = useState('');
  const [conductorAsociado, setConductorAsociado] = useState('');
  const [resultado, setResultado] = useState<VerificationResult>('sin_novedad');
  const [commissionId, setCommissionId] = useState(commissions[0]?.id ?? '');
  const [verificadoPor, setVerificadoPor] = useState(defaultOfficerName);
  const [sector, setSector] = useState(TRUJILLO_SECTORS[0].label);
  const [lat, setLat] = useState<number>(myLivePos?.lat ?? commissions[0]?.lat ?? 9.4685);
  const [lng, setLng] = useState<number>(myLivePos?.lng ?? commissions[0]?.lng ?? -71.0665);
  const [observaciones, setObservaciones] = useState('');
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [savingLog, setSavingLog] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logSavedBanner, setLogSavedBanner] = useState<string | null>(null);

  // Verified DB filter & export state
  const [logsSearch, setLogsSearch] = useState('');
  const [logsFilter, setLogsFilter] = useState<'all' | 'persona' | 'vehiculo' | 'alertas'>('all');
  const [copiedReport, setCopiedReport] = useState(false);

  // Statistics panel state
  const [statsRange, setStatsRange] = useState<StatsRange>('7d');
  const [customStartDate, setCustomStartDate] = useState<string>(() => offsetLocalDateKey(-6));
  const [customEndDate, setCustomEndDate] = useState<string>(() => toLocalDateKey(new Date()));
  const [copiedStats, setCopiedStats] = useState(false);

  // Wanted DB filter & modal state
  const [wantedSearch, setWantedSearch] = useState('');
  const [wantedFilter, setWantedFilter] = useState<'all' | 'solicitado' | 'persona' | 'vehiculo'>('all');
  const [wantedModalOpen, setWantedModalOpen] = useState(false);

  // New Wanted Record modal form
  const [wTipo, setWTipo] = useState<VerificationEntityType>('persona');
  const [wIdentificador, setWIdentificador] = useState('');
  const [wNombre, setWNombre] = useState('');
  const [wAlias, setWAlias] = useState('');
  const [wDelito, setWDelito] = useState('');
  const [wExpediente, setWExpediente] = useState('');
  const [wOrganismo, setWOrganismo] = useState('CICPC Delegación Municipal Sabana de Mendoza');
  const [wPeligrosidad, setWPeligrosidad] = useState<WantedDangerLevel>('alta');
  const [wNotas, setWNotas] = useState('');
  const [savingWanted, setSavingWanted] = useState(false);
  const [wantedError, setWantedError] = useState<string | null>(null);

  // Instant cross-check results
  const matchedWanted = useMemo(() => {
    if (lookupQuery.trim().length < 2) return [];
    return wantedRecords.filter((rec) => matchesRecord(lookupQuery, rec, lookupType));
  }, [wantedRecords, lookupQuery, lookupType]);

  const activeWantedMatches = useMemo(
    () => matchedWanted.filter((r) => r.estado === 'solicitado'),
    [matchedWanted]
  );

  const closedWantedMatches = useMemo(
    () => matchedWanted.filter((r) => r.estado === 'capturado_recuperado'),
    [matchedWanted]
  );

  const priorLogsMatches = useMemo(() => {
    if (lookupQuery.trim().length < 3) return [];
    return verificationLogs.filter((log) => matchesLog(lookupQuery, log, lookupType));
  }, [verificationLogs, lookupQuery, lookupType]);

  // Play tactical alert tone once when a new active wanted match is hit
  useEffect(() => {
    const topMatch = activeWantedMatches[0];
    if (topMatch && lastAlertedMatchIdRef.current !== topMatch.id) {
      lastAlertedMatchIdRef.current = topMatch.id;
      playTacticalAlertTone();
    } else if (!topMatch) {
      lastAlertedMatchIdRef.current = null;
    }
  }, [activeWantedMatches]);

  // Judicial coordination forces (CICPC / CONAS / GNB)
  const judicialContacts = useMemo(() => {
    return friendlyForces
      .filter(
        (f) =>
          f.disponible &&
          (f.organismo === 'CICPC' || f.organismo === 'CONAS' || f.organismo === 'GNB')
      )
      .slice(0, 3);
  }, [friendlyForces]);

  // Sync lookup query into form identifier smoothly when user types
  const handleLookupChange = (val: string) => {
    setLookupQuery(val);
    setIdentificador(val.toUpperCase());
  };

  const applyWantedMatchToForm = (rec: WantedRecord, markAs: VerificationResult = 'solicitado') => {
    setLookupType(rec.tipo);
    setIdentificador(rec.identificador);
    setNombreDescripcion(rec.nombreDescripcion);
    setDatoSecundario(rec.aliasOSecundario);
    setResultado(markAs);
    setObservaciones(
      `Coincidencia con requerimiento ${rec.expediente} (${rec.delito} — ${rec.organismoSolicitante}).`
    );
  };

  const handleCaptureGps = () => {
    if (myLivePos) {
      setLat(Number(myLivePos.lat.toFixed(6)));
      setLng(Number(myLivePos.lng.toFixed(6)));
      setGpsStatus('Coordenadas capturadas desde tu GPS activo en comisión.');
      return;
    }
    if (!navigator.geolocation) {
      setGpsStatus('Este dispositivo no soporta geolocalización.');
      return;
    }
    setGpsStatus('Obteniendo señal GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(6)));
        setLng(Number(pos.coords.longitude.toFixed(6)));
        setGpsStatus(`GPS capturado (±${Math.round(pos.coords.accuracy)}m).`);
      },
      () => {
        setGpsStatus('No se pudo obtener GPS. Verifica los permisos de ubicación.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCommissionChange = (newCommId: string) => {
    setCommissionId(newCommId);
    const found = commissions.find((c) => c.id === newCommId);
    if (found) {
      setSector(found.sector);
      if (!myLivePos) {
        setLat(found.lat);
        setLng(found.lng);
      }
    }
  };

  const handleSubmitVerificationLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogError(null);
    setLogSavedBanner(null);

    const cleanId = identificador.trim().toUpperCase();
    const cleanName = nombreDescripcion.trim();
    const cleanOfficer = verificadoPor.trim();
    const cleanSector = sector.trim();

    if (cleanId.length < 2) {
      setLogError(
        lookupType === 'persona'
          ? 'Ingresa la cédula o pasaporte de la persona.'
          : 'Ingresa la placa o serial del vehículo.'
      );
      return;
    }
    if (cleanName.length < 2) {
      setLogError(
        lookupType === 'persona'
          ? 'Ingresa el nombre y apellido de la persona.'
          : 'Ingresa marca, modelo y color del vehículo.'
      );
      return;
    }
    if (cleanOfficer.length < 2 || cleanSector.length < 2) {
      setLogError('Indica el oficial verificador y el sector del punto de control.');
      return;
    }

    const activeHit = activeWantedMatches[0];
    const finalResult: VerificationResult =
      activeHit && resultado === 'sin_novedad' ? 'solicitado' : resultado;

    setSavingLog(true);
    try {
      await onSaveVerificationLog({
        tipo: lookupType,
        identificador: cleanId.slice(0, 48),
        nombreDescripcion: cleanName.slice(0, 120),
        datoSecundario: datoSecundario.trim().slice(0, 120),
        conductorAsociado: conductorAsociado.trim().slice(0, 120),
        resultado: finalResult,
        wantedRecordId: activeHit ? activeHit.id : '',
        motivoRequerimiento: activeHit
          ? `${activeHit.delito} (${activeHit.expediente})`.slice(0, 220)
          : '',
        commissionId,
        verificadoPor: cleanOfficer.slice(0, 100),
        sector: cleanSector.slice(0, 100),
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        observaciones: observaciones.trim().slice(0, 500),
      });

      setLogSavedBanner(
        `${lookupType === 'persona' ? 'Persona' : 'Vehículo'} ${cleanId} guardado en la Base de Datos de Verificados.`
      );
      setLookupQuery('');
      setIdentificador('');
      setNombreDescripcion('');
      setDatoSecundario('');
      setConductorAsociado('');
      setResultado('sin_novedad');
      setObservaciones('');
    } catch {
      setLogError('No se pudo guardar el registro. Verifica tu conexión e inténtalo nuevamente.');
    } finally {
      setSavingLog(false);
    }
  };

  const handleSubmitWantedRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setWantedError(null);

    if (
      wIdentificador.trim().length < 2 ||
      wNombre.trim().length < 2 ||
      wDelito.trim().length < 2 ||
      wExpediente.trim().length < 2 ||
      wOrganismo.trim().length < 2
    ) {
      setWantedError('Completa todos los campos obligatorios de la orden o requerimiento.');
      return;
    }

    setSavingWanted(true);
    try {
      await onSaveWantedRecord({
        tipo: wTipo,
        identificador: wIdentificador.trim().toUpperCase().slice(0, 48),
        nombreDescripcion: wNombre.trim().slice(0, 120),
        aliasOSecundario: wAlias.trim().slice(0, 100),
        delito: wDelito.trim().slice(0, 120),
        expediente: wExpediente.trim().toUpperCase().slice(0, 80),
        organismoSolicitante: wOrganismo.trim().slice(0, 100),
        peligrosidad: wPeligrosidad,
        estado: 'solicitado',
        notas: wNotas.trim().slice(0, 500),
      });
      setWantedModalOpen(false);
      setWIdentificador('');
      setWNombre('');
      setWAlias('');
      setWDelito('');
      setWExpediente('');
      setWNotas('');
    } catch {
      setWantedError('Error al registrar la orden judicial en Firestore.');
    } finally {
      setSavingWanted(false);
    }
  };

  // Filtered Verified Database
  const filteredLogs = useMemo(() => {
    const q = logsSearch.trim().toLowerCase();
    const qNorm = normalizeId(logsSearch);
    return verificationLogs.filter((log) => {
      if (logsFilter === 'persona' && log.tipo !== 'persona') return false;
      if (logsFilter === 'vehiculo' && log.tipo !== 'vehiculo') return false;
      if (
        logsFilter === 'alertas' &&
        log.resultado !== 'solicitado' &&
        log.resultado !== 'retenido'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        log.identificador.toLowerCase().includes(q) ||
        (qNorm.length >= 2 && normalizeId(log.identificador).includes(qNorm)) ||
        log.nombreDescripcion.toLowerCase().includes(q) ||
        log.datoSecundario.toLowerCase().includes(q) ||
        log.conductorAsociado.toLowerCase().includes(q) ||
        log.sector.toLowerCase().includes(q) ||
        log.verificadoPor.toLowerCase().includes(q)
      );
    });
  }, [verificationLogs, logsSearch, logsFilter]);

  // Filtered Wanted Database
  const filteredWanted = useMemo(() => {
    const q = wantedSearch.trim().toLowerCase();
    const qNorm = normalizeId(wantedSearch);
    return wantedRecords.filter((rec) => {
      if (wantedFilter === 'solicitado' && rec.estado !== 'solicitado') return false;
      if (wantedFilter === 'persona' && rec.tipo !== 'persona') return false;
      if (wantedFilter === 'vehiculo' && rec.tipo !== 'vehiculo') return false;
      if (!q) return true;
      return (
        rec.identificador.toLowerCase().includes(q) ||
        (qNorm.length >= 2 && normalizeId(rec.identificador).includes(qNorm)) ||
        rec.nombreDescripcion.toLowerCase().includes(q) ||
        rec.aliasOSecundario.toLowerCase().includes(q) ||
        rec.delito.toLowerCase().includes(q) ||
        rec.expediente.toLowerCase().includes(q) ||
        rec.organismoSolicitante.toLowerCase().includes(q)
      );
    });
  }, [wantedRecords, wantedSearch, wantedFilter]);

  // KPIs (Global)
  const totalVerified = verificationLogs.length;
  const totalPersonsVerified = verificationLogs.filter((l) => l.tipo === 'persona').length;
  const totalVehiclesVerified = verificationLogs.filter((l) => l.tipo === 'vehiculo').length;
  const totalSolicitadosLogs = verificationLogs.filter((l) => l.resultado === 'solicitado').length;
  const totalRetenidosLogs = verificationLogs.filter((l) => l.resultado === 'retenido').length;
  const totalAlertLogs = totalSolicitadosLogs + totalRetenidosLogs;
  const activeWantedCount = wantedRecords.filter((w) => w.estado === 'solicitado').length;

  const todayKey = toLocalDateKey(new Date());
  const verifiedTodayCount = useMemo(
    () => verificationLogs.filter((l) => toLocalDateKey(getLogDate(l)) === todayKey).length,
    [verificationLogs, todayKey]
  );

  const handleSelectStatsPreset = (preset: StatsRange) => {
    setStatsRange(preset);
    const today = toLocalDateKey(new Date());
    if (preset === 'today') {
      setCustomStartDate(today);
      setCustomEndDate(today);
    } else if (preset === '7d') {
      setCustomStartDate(offsetLocalDateKey(-6));
      setCustomEndDate(today);
    } else if (preset === '30d') {
      setCustomStartDate(offsetLocalDateKey(-29));
      setCustomEndDate(today);
    }
  };

  const handleCustomStartChange = (nextStart: string) => {
    setCustomStartDate(nextStart);
    if (nextStart && customEndDate && nextStart > customEndDate) {
      setCustomEndDate(nextStart);
    }
    setStatsRange('custom');
  };

  const handleCustomEndChange = (nextEnd: string) => {
    setCustomEndDate(nextEnd);
    if (nextEnd && customStartDate && nextEnd < customStartDate) {
      setCustomStartDate(nextEnd);
    }
    setStatsRange('custom');
  };

  const activeRangeLabel = useMemo(() => {
    if (statsRange === 'today') return `Hoy (${formatDateKeyShort(todayKey)})`;
    if (statsRange === '7d') {
      return `Últimos 7 días (${formatDateKeyShort(offsetLocalDateKey(-6))} – ${formatDateKeyShort(todayKey)})`;
    }
    if (statsRange === '30d') {
      return `Últimos 30 días (${formatDateKeyShort(offsetLocalDateKey(-29))} – ${formatDateKeyShort(todayKey)})`;
    }
    if (statsRange === 'custom') {
      if (customStartDate && customEndDate) {
        return customStartDate === customEndDate
          ? `Fecha: ${formatDateKeyShort(customStartDate)}`
          : `Del ${formatDateKeyShort(customStartDate)} al ${formatDateKeyShort(customEndDate)}`;
      }
      if (customStartDate) return `Desde ${formatDateKeyShort(customStartDate)}`;
      if (customEndDate) return `Hasta ${formatDateKeyShort(customEndDate)}`;
      return 'Fecha personalizada';
    }
    return 'Todo el historial';
  }, [statsRange, todayKey, customStartDate, customEndDate]);

  // Period-filtered statistics & daily breakdown
  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfTodayMs = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    ).getTime();

    let startMs: number | null = null;
    let endMs: number | null = null;

    if (statsRange === 'today') {
      startMs = startOfToday.getTime();
      endMs = endOfTodayMs;
    } else if (statsRange === '7d') {
      startMs = startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000;
      endMs = endOfTodayMs;
    } else if (statsRange === '30d') {
      startMs = startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000;
      endMs = endOfTodayMs;
    } else if (statsRange === 'custom') {
      const parsedStart = parseLocalDateKeyStartMs(customStartDate);
      const parsedEnd = parseLocalDateKeyEndMs(customEndDate);
      if (parsedStart !== null && parsedEnd !== null && parsedStart > parsedEnd) {
        startMs = parseLocalDateKeyStartMs(customEndDate);
        endMs = parseLocalDateKeyEndMs(customStartDate);
      } else {
        startMs = parsedStart;
        endMs = parsedEnd;
      }
    }

    const scopedLogs = verificationLogs.filter((log) => {
      const ms = getLogDate(log).getTime();
      if (startMs !== null && ms < startMs) return false;
      if (endMs !== null && ms > endMs) return false;
      return true;
    });

    const totals = {
      total: scopedLogs.length,
      personas: 0,
      vehiculos: 0,
      sinNovedad: 0,
      observacion: 0,
      solicitados: 0,
      retenidos: 0,
      personasByResult: { sin_novedad: 0, observacion_tactica: 0, solicitado: 0, retenido: 0 },
      vehiculosByResult: { sin_novedad: 0, observacion_tactica: 0, solicitado: 0, retenido: 0 },
    };

    const byDayMap = new Map<string, DailyBreakdownRow>();

    for (const log of scopedLogs) {
      const dt = getLogDate(log);
      const key = toLocalDateKey(dt);
      let row = byDayMap.get(key);
      if (!row) {
        const labels = formatDayLabel(key, todayKey);
        row = {
          dateKey: key,
          label: labels.label,
          shortLabel: labels.shortLabel,
          isToday: key === todayKey,
          personas: 0,
          vehiculos: 0,
          sinNovedad: 0,
          observacion: 0,
          solicitados: 0,
          retenidos: 0,
          total: 0,
        };
        byDayMap.set(key, row);
      }

      row.total += 1;
      if (log.tipo === 'persona') {
        totals.personas += 1;
        row.personas += 1;
        totals.personasByResult[log.resultado] += 1;
      } else {
        totals.vehiculos += 1;
        row.vehiculos += 1;
        totals.vehiculosByResult[log.resultado] += 1;
      }

      if (log.resultado === 'sin_novedad') {
        totals.sinNovedad += 1;
        row.sinNovedad += 1;
      } else if (log.resultado === 'observacion_tactica') {
        totals.observacion += 1;
        row.observacion += 1;
      } else if (log.resultado === 'solicitado') {
        totals.solicitados += 1;
        row.solicitados += 1;
      } else if (log.resultado === 'retenido') {
        totals.retenidos += 1;
        row.retenidos += 1;
      }
    }

    const dailyRows = Array.from(byDayMap.values()).sort((a, b) =>
      b.dateKey.localeCompare(a.dateKey)
    );
    const maxDailyTotal = dailyRows.reduce((max, r) => Math.max(max, r.total), 1);

    return { totals, dailyRows, maxDailyTotal };
  }, [verificationLogs, statsRange, customStartDate, customEndDate, todayKey]);

  const handleCopyStatsSummary = async () => {
    const { totals, dailyRows } = stats;

    const lines = [
      `ESTADÍSTICAS DE VERIFICACIÓN — CZGNB-23 TRUJILLO (${activeRangeLabel})`,
      `Total Verificados: ${totals.total} (${totals.personas} personas | ${totals.vehiculos} vehículos)`,
      `Solicitados por la Justicia: ${totals.solicitados} | Retenidos / A la Orden: ${totals.retenidos}`,
      `Observación Táctica: ${totals.observacion} | Sin Novedad: ${totals.sinNovedad}`,
      '',
      'DESGLOSE POR DÍA:',
      ...dailyRows.map(
        (r) =>
          `- ${r.label}: Total ${r.total} (Pers: ${r.personas}, Veh: ${r.vehiculos} | Solicitados: ${r.solicitados}, Retenidos: ${r.retenidos}, Obs: ${r.observacion}, Sin Nov: ${r.sinNovedad})`
      ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedStats(true);
      setTimeout(() => setCopiedStats(false), 3000);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  const handleCopyVerifiedReport = async () => {
    const header =
      'Fecha;Tipo;Identificador;Nombre_o_Vehiculo;Dato_Secundario;Conductor;Resultado;Sector;Verificado_Por;Coordenadas;Observaciones';
    const rows = filteredLogs.map((l) =>
      [
        formatTimestamp(l.createdAt),
        l.tipo.toUpperCase(),
        l.identificador,
        l.nombreDescripcion.replace(/;/g, ','),
        l.datoSecundario.replace(/;/g, ','),
        l.conductorAsociado.replace(/;/g, ','),
        VERIFICATION_RESULT_LABELS[l.resultado],
        l.sector.replace(/;/g, ','),
        l.verificadoPor.replace(/;/g, ','),
        `${l.lat.toFixed(5)},${l.lng.toFixed(5)}`,
        l.observaciones.replace(/;/g, ','),
      ].join(';')
    );
    const text = `BASE DE DATOS DE VERIFICACIONES — CZGNB-23 TRUJILLO\n${header}\n${rows.join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 3000);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
            Verificación de Personas y Vehículos
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Consulta instantánea de requerimientos judiciales y base de datos histórica de verificados del Comando de Zona Nro. 23 GNB Trujillo.
          </p>
        </div>

        {canEditCatalogs && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWantedModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-600 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Cargar Solicitado
            </button>
          </div>
        )}
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#111822] border border-slate-800 rounded-lg p-3.5">
          <div className="text-[11px] font-medium text-slate-400">Personas Verificadas</div>
          <div className="font-mono-tabular text-2xl font-bold text-emerald-300 mt-1">
            {totalPersonsVerified}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {totalVerified > 0
              ? `${Math.round((totalPersonsVerified / totalVerified) * 100)}% del total verificado`
              : 'Sin registros aún'}
          </div>
        </div>

        <div className="bg-[#111822] border border-slate-800 rounded-lg p-3.5">
          <div className="text-[11px] font-medium text-slate-400">Vehículos Verificados</div>
          <div className="font-mono-tabular text-2xl font-bold text-sky-300 mt-1">
            {totalVehiclesVerified}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {totalVerified > 0
              ? `${Math.round((totalVehiclesVerified / totalVerified) * 100)}% del total verificado`
              : 'Sin registros aún'}
          </div>
        </div>

        <div className="bg-[#111822] border border-slate-800 rounded-lg p-3.5">
          <div className="text-[11px] font-medium text-slate-400">Resultaron Solicitados</div>
          <div className="font-mono-tabular text-2xl font-bold text-red-400 mt-1">
            {totalSolicitadosLogs}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            +{totalRetenidosLogs} retenidos · {totalAlertLogs} alertas totales
          </div>
        </div>

        <div className="bg-[#111822] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-400">Total Verificados / Hoy</div>
            <div className="font-mono-tabular text-2xl font-bold text-white mt-1">
              {totalVerified}{' '}
              <span className="text-xs font-semibold text-amber-300">({verifiedTodayCount} hoy)</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSubTab('estadisticas')}
            className="text-left text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 mt-1 cursor-pointer"
          >
            Ver estadísticas y desglose por día →
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {(
          [
            { id: 'verificar', label: 'Consultar y Registrar', Icon: Search },
            { id: 'estadisticas', label: 'Estadísticas por Día', Icon: BarChart3 },
            { id: 'verificados', label: `Base de Verificados (${totalVerified})`, Icon: Database },
            { id: 'solicitados', label: `Solicitados por la Justicia (${activeWantedCount})`, Icon: ShieldAlert },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === id
                ? 'bg-emerald-600 text-white'
                : 'bg-[#111822] border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: CONSULTAR Y REGISTRAR */}
      {subTab === 'verificar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 5 Cols: Real-time Judicial Wanted Check */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#111822] border border-slate-800 rounded-lg p-4 space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  1. Consulta Rápida de Requerimiento
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Escribe la cédula, nombre, placa o serial para verificar si está solicitado o ya fue chequeado antes.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLookupType('persona');
                    setLookupQuery('');
                    setIdentificador('');
                  }}
                  className={`inline-flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                    lookupType === 'persona'
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                      : 'bg-[#0B1117] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  Persona (Cédula)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLookupType('vehiculo');
                    setLookupQuery('');
                    setIdentificador('');
                  }}
                  className={`inline-flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                    lookupType === 'vehiculo'
                      ? 'bg-sky-950/60 border-sky-500 text-sky-200'
                      : 'bg-[#0B1117] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Car className="w-4 h-4" />
                  Vehículo (Placa / Serial)
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={lookupQuery}
                  onChange={(e) => handleLookupChange(e.target.value)}
                  placeholder={
                    lookupType === 'persona'
                      ? 'Ej: V-19.482.710, 19482710 o apellido...'
                      : 'Ej: AA412KM, AB930TR o serial de carrocería...'
                  }
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md pl-9 pr-9 py-2.5 text-sm font-mono-tabular text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {lookupQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setLookupQuery('');
                      setIdentificador('');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    aria-label="Limpiar consulta"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Instant Verification Verdict */}
              {lookupQuery.trim().length < 2 ? (
                <div className="bg-[#0B1117] border border-slate-800/80 rounded-md p-3.5 text-xs text-slate-400 space-y-2">
                  <div className="font-semibold text-slate-300">
                    Ejemplos cargados para prueba inmediata:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {wantedRecords
                      .filter((w) => w.tipo === lookupType && w.estado === 'solicitado')
                      .slice(0, 3)
                      .map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() => handleLookupChange(sample.identificador)}
                          className="px-2 py-1 text-[11px] font-mono-tabular bg-[#16202D] hover:bg-[#1E2C3E] border border-slate-700 text-slate-200 rounded cursor-pointer"
                        >
                          {sample.identificador}
                        </button>
                      ))}
                  </div>
                </div>
              ) : activeWantedMatches.length > 0 ? (
                <div className="space-y-3">
                  {activeWantedMatches.map((hit) => (
                    <div
                      key={hit.id}
                      className="bg-red-950/70 border border-red-500/80 rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 text-red-200">
                          <AlertOctagon className="w-5 h-5 text-red-400 shrink-0" />
                          <div>
                            <div className="font-display text-base font-bold tracking-wide text-white leading-tight">
                              SOLICITADO POR LA JUSTICIA
                            </div>
                            <div className="text-[11px] font-semibold text-red-300">
                              {WANTED_DANGER_LABELS[hit.peligrosidad]} · {hit.expediente}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => playTacticalAlertTone()}
                          className="p-1.5 rounded bg-red-900/80 hover:bg-red-800 text-red-100 cursor-pointer"
                          title="Repetir alerta sonora"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="bg-[#0B1117]/80 border border-red-900/70 rounded p-3 space-y-1.5 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">
                            {hit.tipo === 'persona' ? 'Cédula:' : 'Placa:'}
                          </span>
                          <span className="font-mono-tabular font-bold text-white">
                            {hit.identificador}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">
                            {hit.tipo === 'persona' ? 'Ciudadano:' : 'Vehículo:'}
                          </span>
                          <span className="font-semibold text-white text-right">
                            {hit.nombreDescripcion}
                          </span>
                        </div>
                        {hit.aliasOSecundario && (
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-400">Alias / Serial:</span>
                            <span className="text-slate-200 text-right">{hit.aliasOSecundario}</span>
                          </div>
                        )}
                        <div className="pt-1 border-t border-slate-800">
                          <span className="text-slate-400 block text-[11px]">Delito / Causa:</span>
                          <span className="text-red-200 font-semibold">{hit.delito}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Organismo Solicitante:</span>
                          <span className="text-slate-200">{hit.organismoSolicitante}</span>
                        </div>
                        {hit.notas && (
                          <div className="pt-1 text-[11px] text-amber-200/90">
                            {hit.notas}
                          </div>
                        )}
                      </div>

                      {canOperate && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => applyWantedMatchToForm(hit, 'solicitado')}
                            className="py-2 px-2.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-md cursor-pointer"
                          >
                            Registrar Solicitado
                          </button>
                          <button
                            type="button"
                            onClick={() => applyWantedMatchToForm(hit, 'retenido')}
                            className="py-2 px-2.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-md cursor-pointer"
                          >
                            Marcar Retenido
                          </button>
                        </div>
                      )}

                      {judicialContacts.length > 0 && (
                        <div className="pt-2 border-t border-red-900/60 space-y-1.5">
                          <div className="text-[11px] font-semibold text-red-200">
                            Coordinación Inmediata (Fuerzas Aliadas):
                          </div>
                          <div className="space-y-1">
                            {judicialContacts.map((force) => {
                              const style = AGENCY_STYLES[force.organismo];
                              return (
                                <a
                                  key={force.id}
                                  href={`tel:${sanitizePhoneForTel(force.telefono)}`}
                                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[#0B1117]/80 hover:bg-[#162231] border text-xs text-slate-100 ${style.cardBorder}`}
                                >
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${style.badge}`}
                                    >
                                      {AGENCY_SHORT_LABELS[force.organismo]}
                                    </span>
                                    <span className="truncate font-medium">{force.nombre}</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold shrink-0">
                                    <Phone className="w-3 h-3" />
                                    Llamar
                                  </span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-emerald-950/35 border border-emerald-500/50 rounded-lg p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Sin requerimiento judicial activo en la base local CZGNB-23
                  </div>
                  <p className="text-[11px] text-slate-400">
                    No existen órdenes activas para <span className="font-mono-tabular text-slate-200">{lookupQuery.trim().toUpperCase()}</span> en la base del Comando de Zona. Si hay sospecha, confirma por radio con SIIPOL / CICPC.
                  </p>
                </div>
              )}

              {/* Closed Historical Orders Notice */}
              {closedWantedMatches.length > 0 && (
                <div className="bg-amber-950/30 border border-amber-500/40 rounded-md p-3 text-xs space-y-1">
                  <div className="font-semibold text-amber-300">
                    Antecedente Cerrado ({closedWantedMatches.length})
                  </div>
                  {closedWantedMatches.map((rec) => (
                    <div key={rec.id} className="text-slate-300 text-[11px]">
                      {rec.identificador} — {rec.delito} ({WANTED_STATUS_LABELS[rec.estado]} · {rec.expediente})
                    </div>
                  ))}
                </div>
              )}

              {/* Prior Checkpoint Verifications History */}
              {priorLogsMatches.length > 0 && (
                <div className="bg-[#0B1117] border border-slate-700/80 rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                    <History className="w-3.5 h-3.5" />
                    Verificado anteriormente ({priorLogsMatches.length}{' '}
                    {priorLogsMatches.length === 1 ? 'vez' : 'veces'})
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {priorLogsMatches.slice(0, 4).map((prev) => (
                      <div
                        key={prev.id}
                        className="text-[11px] bg-[#111822] border border-slate-800 rounded p-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-slate-200 font-medium truncate">
                            {prev.nombreDescripcion}
                          </div>
                          <div className="text-slate-400 truncate">
                            {prev.sector} · {formatTimestamp(prev.createdAt)}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-semibold shrink-0 ${
                            prev.resultado === 'solicitado' || prev.resultado === 'retenido'
                              ? 'text-red-400'
                              : prev.resultado === 'observacion_tactica'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }`}
                        >
                          {VERIFICATION_RESULT_LABELS[prev.resultado]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right 7 Cols: Save to Verified Persons & Vehicles Database */}
          {canOperate ? (
          <form
            onSubmit={handleSubmitVerificationLog}
            className="lg:col-span-7 bg-[#111822] border border-slate-800 rounded-lg p-4 md:p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  2. Registrar en Base de Datos de Verificados
                </h2>
                <p className="text-xs text-slate-400">
                  Guarda cada {lookupType === 'persona' ? 'ciudadano' : 'vehículo'} verificado en punto de control con hora, oficial y coordenadas GPS.
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-400">
                {lookupType === 'persona' ? 'Persona' : 'Vehículo'}
              </span>
            </div>

            {logSavedBanner && (
              <div className="bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 rounded-md px-3 py-2 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{logSavedBanner}</span>
              </div>
            )}

            {logError && (
              <div className="bg-red-950/50 border border-red-500/50 text-red-200 rounded-md px-3 py-2 text-xs">
                {logError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lookupType === 'persona' ? 'Cédula / Pasaporte *' : 'Placa del Vehículo *'}
                </label>
                <input
                  type="text"
                  required
                  maxLength={48}
                  value={identificador}
                  onChange={(e) => {
                    setIdentificador(e.target.value.toUpperCase());
                    setLookupQuery(e.target.value);
                  }}
                  placeholder={lookupType === 'persona' ? 'V-20.123.456' : 'AA412KM'}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lookupType === 'persona'
                    ? 'Nombres y Apellidos *'
                    : 'Marca, Modelo, Año y Color *'}
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={nombreDescripcion}
                  onChange={(e) => setNombreDescripcion(e.target.value)}
                  placeholder={
                    lookupType === 'persona'
                      ? 'Ej: Luis Antonio González Briceño'
                      : 'Ej: Toyota Hilux 4x4 Gris 2019'
                  }
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lookupType === 'persona'
                    ? 'Teléfono / Dirección de Residencia'
                    : 'Serial de Carrocería / Motor'}
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={datoSecundario}
                  onChange={(e) => setDatoSecundario(e.target.value)}
                  placeholder={
                    lookupType === 'persona'
                      ? 'Ej: 0414-0000000 · Santa Apolonia'
                      : 'Ej: 8AJFR22G7K0941283'
                  }
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {lookupType === 'persona'
                    ? 'Vehículo Asociado / Acompañantes'
                    : 'Conductor Identificado (Nombre y Cédula)'}
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={conductorAsociado}
                  onChange={(e) => setConductorAsociado(e.target.value)}
                  placeholder={
                    lookupType === 'persona'
                      ? 'Ej: Moto Bera SBR Azul placa AC4K19M'
                      : 'Ej: Pedro Pérez V-17.882.104'
                  }
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Resultado de la Verificación *
                </label>
                <select
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value as VerificationResult)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="sin_novedad">Sin Novedad</option>
                  <option value="observacion_tactica">Observación Táctica / Seguimiento</option>
                  <option value="solicitado">Solicitado por la Justicia</option>
                  <option value="retenido">Retenido / Puesto a la Orden</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Comisión que Verifica
                </label>
                <select
                  value={commissionId}
                  onChange={(e) => handleCommissionChange(e.target.value)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">PAC / Puesto Fijo CZGNB-23</option>
                  {commissions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} — {c.jefeGrado} {c.jefeNombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Oficial Verificador *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={verificadoPor}
                  onChange={(e) => setVerificadoPor(e.target.value)}
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Sector / Punto de Control *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  list="trujillo-sectors-verif"
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <datalist id="trujillo-sectors-verif">
                  {TRUJILLO_SECTORS.map((s) => (
                    <option key={s.label} value={s.label} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* GPS Coordinates Capture */}
            <div className="bg-[#0B1117] border border-slate-800 rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="text-[11px] text-slate-400">Coordenadas del Punto de Verificación</div>
                <div className="font-mono-tabular text-xs text-emerald-300 mt-0.5">
                  {formatCoords(lat, lng)}
                </div>
                {gpsStatus && <div className="text-[11px] text-sky-300 mt-0.5">{gpsStatus}</div>}
              </div>
              <button
                type="button"
                onClick={handleCaptureGps}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#162231] hover:bg-[#1E2E42] border border-slate-700 text-slate-100 rounded-md cursor-pointer shrink-0"
              >
                <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                Capturar mi GPS
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Observaciones Tácticas / Novedades del Chequeo
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Motivo del traslado, carga transportada, confirmación radial SIIPOL, destino declarado..."
                className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingLog}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-md transition-colors cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4" />
                {savingLog ? 'Guardando en Base de Datos...' : 'Guardar en Base de Verificados'}
              </button>
            </div>
          </form>
          ) : (
            <div className="lg:col-span-7 bg-[#111822] border border-slate-800 rounded-lg p-6 flex flex-col justify-center space-y-2">
              <h2 className="font-display text-lg font-bold text-white">
                Modo Solo Consulta
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tu perfil actual tiene privilegio de consulta. Puedes verificar cédulas y placas contra la base de solicitados y revisar estadísticas e historial, pero no registrar ni modificar datos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB: PANEL DE ESTADÍSTICAS Y DESGLOSE POR DÍA */}
      {subTab === 'estadisticas' && (
        <div className="space-y-5">
          {/* Period Filter, Custom Date Pickers & Copy Controls */}
          <div className="bg-[#111822] border border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 bg-[#0B1117] border border-slate-800 rounded-md p-1">
                {(
                  [
                    { id: 'today', label: 'Hoy' },
                    { id: '7d', label: 'Últimos 7 días' },
                    { id: '30d', label: 'Últimos 30 días' },
                    { id: 'all', label: 'Todo' },
                    { id: 'custom', label: 'Personalizado' },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectStatsPreset(r.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                      statsRange === r.id
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void handleCopyStatsSummary()}
                disabled={stats.totals.total === 0}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#162231] hover:bg-[#1E2E42] disabled:opacity-40 border border-slate-700 text-slate-200 rounded-md cursor-pointer shrink-0"
              >
                {copiedStats ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Resumen Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar Resumen Estadístico
                  </>
                )}
              </button>
            </div>

            {/* Custom Date Range Inputs (Desde / Hasta) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="inline-flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-medium text-slate-300">Desde:</span>
                  <input
                    type="date"
                    aria-label="Fecha inicial del filtro"
                    value={customStartDate}
                    max={todayKey}
                    onChange={(e) => handleCustomStartChange(e.target.value)}
                    className="bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-medium text-slate-300">Hasta:</span>
                  <input
                    type="date"
                    aria-label="Fecha final del filtro"
                    value={customEndDate}
                    max={todayKey}
                    onChange={(e) => handleCustomEndChange(e.target.value)}
                    className="bg-[#0B1117] border border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-mono-tabular text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
                  />
                </label>

                {statsRange === 'custom' && (
                  <button
                    type="button"
                    onClick={() => handleSelectStatsPreset('7d')}
                    className="text-[11px] font-semibold text-slate-400 hover:text-emerald-300 cursor-pointer"
                  >
                    Restablecer (7 días)
                  </button>
                )}
              </div>

              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono-tabular text-emerald-300">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>{activeRangeLabel}</span>
              </div>
            </div>
          </div>

          {/* Period Totals Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#111822] border border-slate-800 rounded-lg p-4">
              <div className="text-[11px] font-medium text-slate-400">
                Total Verificados (Período)
              </div>
              <div className="font-mono-tabular text-3xl font-bold text-white mt-1">
                {stats.totals.total}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                En {stats.dailyRows.length} {stats.dailyRows.length === 1 ? 'día activo' : 'días activos'}
              </div>
            </div>

            <div className="bg-[#111822] border border-slate-800 rounded-lg p-4">
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                Personas Verificadas
              </div>
              <div className="font-mono-tabular text-3xl font-bold text-emerald-300 mt-1">
                {stats.totals.personas}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {stats.totals.personasByResult.solicitado} solicitadas ·{' '}
                {stats.totals.personasByResult.retenido} retenidas
              </div>
            </div>

            <div className="bg-[#111822] border border-slate-800 rounded-lg p-4">
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-sky-400" />
                Vehículos Verificados
              </div>
              <div className="font-mono-tabular text-3xl font-bold text-sky-300 mt-1">
                {stats.totals.vehiculos}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {stats.totals.vehiculosByResult.solicitado} solicitados ·{' '}
                {stats.totals.vehiculosByResult.retenido} retenidos
              </div>
            </div>

            <div className="bg-[#111822] border border-red-900/60 rounded-lg p-4">
              <div className="text-[11px] font-medium text-red-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                Resultaron Solicitados
              </div>
              <div className="font-mono-tabular text-3xl font-bold text-red-400 mt-1">
                {stats.totals.solicitados}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {stats.totals.total > 0
                  ? `${(((stats.totals.solicitados + stats.totals.retenidos) / stats.totals.total) * 100).toFixed(1)}% con alerta judicial (+${stats.totals.retenidos} retenidos)`
                  : '0% incidencia judicial'}
              </div>
            </div>
          </div>

          {/* Distribution & Comparison Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6 bg-[#111822] border border-slate-800 rounded-lg p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-white">
                  Distribución por Resultado
                </h2>
                <span className="font-mono-tabular text-xs text-slate-400">
                  {stats.totals.total} registros
                </span>
              </div>

              {/* Proportional Stacked Bar */}
              <div className="h-3.5 w-full bg-[#0B1117] rounded overflow-hidden flex border border-slate-800">
                {stats.totals.total > 0 && (
                  <>
                    {stats.totals.sinNovedad > 0 && (
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${(stats.totals.sinNovedad / stats.totals.total) * 100}%` }}
                        title={`Sin Novedad: ${stats.totals.sinNovedad}`}
                      />
                    )}
                    {stats.totals.observacion > 0 && (
                      <div
                        className="bg-amber-400 h-full"
                        style={{ width: `${(stats.totals.observacion / stats.totals.total) * 100}%` }}
                        title={`Observación Táctica: ${stats.totals.observacion}`}
                      />
                    )}
                    {stats.totals.solicitados > 0 && (
                      <div
                        className="bg-red-500 h-full"
                        style={{ width: `${(stats.totals.solicitados / stats.totals.total) * 100}%` }}
                        title={`Solicitados: ${stats.totals.solicitados}`}
                      />
                    )}
                    {stats.totals.retenidos > 0 && (
                      <div
                        className="bg-rose-600 h-full"
                        style={{ width: `${(stats.totals.retenidos / stats.totals.total) * 100}%` }}
                        title={`Retenidos: ${stats.totals.retenidos}`}
                      />
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                {(
                  [
                    {
                      label: 'Sin Novedad',
                      count: stats.totals.sinNovedad,
                      dot: 'bg-emerald-500',
                      text: 'text-emerald-300',
                    },
                    {
                      label: 'Observación Táctica',
                      count: stats.totals.observacion,
                      dot: 'bg-amber-400',
                      text: 'text-amber-300',
                    },
                    {
                      label: 'Solicitados por la Justicia',
                      count: stats.totals.solicitados,
                      dot: 'bg-red-500',
                      text: 'text-red-400',
                    },
                    {
                      label: 'Retenidos / A la Orden',
                      count: stats.totals.retenidos,
                      dot: 'bg-rose-600',
                      text: 'text-rose-300',
                    },
                  ] as const
                ).map((item) => {
                  const pct =
                    stats.totals.total > 0
                      ? ((item.count / stats.totals.total) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <div
                      key={item.label}
                      className="bg-[#0B1117] border border-slate-800/80 rounded p-2.5 flex items-center justify-between gap-2"
                    >
                      <span className="inline-flex items-center gap-2 text-slate-300 truncate">
                        <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${item.dot}`} />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className={`font-mono-tabular font-bold shrink-0 ${item.text}`}>
                        {item.count} <span className="text-[10px] text-slate-500">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-6 bg-[#111822] border border-slate-800 rounded-lg p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-white">
                  Desglose Personas vs Vehículos
                </h2>
                <span className="font-mono-tabular text-xs text-slate-400">
                  {activeWantedCount} órdenes activas en BD
                </span>
              </div>

              <div className="space-y-3">
                {(
                  [
                    {
                      title: 'Personas',
                      total: stats.totals.personas,
                      accent: 'text-emerald-300',
                      byRes: stats.totals.personasByResult,
                    },
                    {
                      title: 'Vehículos',
                      total: stats.totals.vehiculos,
                      accent: 'text-sky-300',
                      byRes: stats.totals.vehiculosByResult,
                    },
                  ] as const
                ).map((group) => (
                  <div
                    key={group.title}
                    className="bg-[#0B1117] border border-slate-800/80 rounded p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-bold ${group.accent}`}>{group.title}</span>
                      <span className="font-mono-tabular font-bold text-white">
                        Total: {group.total}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <div className="text-slate-500">Sin Nov.</div>
                        <div className="font-mono-tabular font-semibold text-emerald-300">
                          {group.byRes.sin_novedad}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Obs. Táct.</div>
                        <div className="font-mono-tabular font-semibold text-amber-300">
                          {group.byRes.observacion_tactica}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Solicitados</div>
                        <div className="font-mono-tabular font-semibold text-red-400">
                          {group.byRes.solicitado}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Retenidos</div>
                        <div className="font-mono-tabular font-semibold text-rose-300">
                          {group.byRes.retenido}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Daily Breakdown Chart & Table */}
          <div className="bg-[#111822] border border-slate-800 rounded-lg p-4 md:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Desglose de Resultados por Día
                  </h2>
                  <p className="text-xs text-slate-400">
                    Actividad diaria de puntos de control: personas, vehículos y resultado de cada verificación.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  Sin Novedad
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                  Observación
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                  Solicitado
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-600" />
                  Retenido
                </span>
              </div>
            </div>

            {stats.dailyRows.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <BarChart3 className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">
                  No hay verificaciones registradas en el período seleccionado.
                </p>
                <p className="text-xs text-slate-500">
                  Registra personas o vehículos en la pestaña "Consultar y Registrar" para ver el desglose diario.
                </p>
              </div>
            ) : (
              <>
                {/* Visual Daily Horizontal Stacked Bars */}
                <div className="space-y-2.5">
                  {stats.dailyRows.map((day) => {
                    const barWidthPct = Math.max(
                      6,
                      Math.round((day.total / stats.maxDailyTotal) * 100)
                    );
                    return (
                      <div key={day.dateKey} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span
                            className={`font-medium ${
                              day.isToday ? 'text-emerald-300 font-bold' : 'text-slate-200'
                            }`}
                          >
                            {day.label}
                          </span>
                          <span className="font-mono-tabular text-[11px] text-slate-400">
                            {day.personas} pers · {day.vehiculos} veh ·{' '}
                            <strong className="text-white">{day.total} total</strong>
                            {day.solicitados + day.retenidos > 0 && (
                              <span className="text-red-400 font-semibold">
                                {' '}
                                ({day.solicitados} sol / {day.retenidos} ret)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-3 bg-[#0B1117] border border-slate-800/80 rounded overflow-hidden">
                          <div
                            className="h-full flex"
                            style={{ width: `${barWidthPct}%` }}
                          >
                            {day.sinNovedad > 0 && (
                              <div
                                className="bg-emerald-500 h-full"
                                style={{ width: `${(day.sinNovedad / day.total) * 100}%` }}
                                title={`Sin Novedad: ${day.sinNovedad}`}
                              />
                            )}
                            {day.observacion > 0 && (
                              <div
                                className="bg-amber-400 h-full"
                                style={{ width: `${(day.observacion / day.total) * 100}%` }}
                                title={`Observación Táctica: ${day.observacion}`}
                              />
                            )}
                            {day.solicitados > 0 && (
                              <div
                                className="bg-red-500 h-full"
                                style={{ width: `${(day.solicitados / day.total) * 100}%` }}
                                title={`Solicitados: ${day.solicitados}`}
                              />
                            )}
                            {day.retenidos > 0 && (
                              <div
                                className="bg-rose-600 h-full"
                                style={{ width: `${(day.retenidos / day.total) * 100}%` }}
                                title={`Retenidos: ${day.retenidos}`}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Detailed Daily Table */}
                <div className="border border-slate-800 rounded-md overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0E151E] border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3 font-semibold">Fecha</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Personas</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Vehículos</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Sin Novedad</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Obs. Táctica</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Solicitados</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Retenidos</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Total Día</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 font-mono-tabular">
                      {stats.dailyRows.map((day) => (
                        <tr key={day.dateKey} className="hover:bg-[#161F2C]/70 transition-colors">
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-200 whitespace-nowrap">
                            {day.label}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-300">
                            {day.personas}
                          </td>
                          <td className="py-2.5 px-3 text-right text-sky-300">
                            {day.vehiculos}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">
                            {day.sinNovedad}
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-300">
                            {day.observacion}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              day.solicitados > 0 ? 'text-red-400' : 'text-slate-500'
                            }`}
                          >
                            {day.solicitados}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              day.retenidos > 0 ? 'text-rose-300' : 'text-slate-500'
                            }`}
                          >
                            {day.retenidos}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-white">
                            {day.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#0E151E] border-t border-slate-700 font-mono-tabular font-bold">
                        <td className="py-2.5 px-3 font-sans text-white">TOTAL PERÍODO</td>
                        <td className="py-2.5 px-3 text-right text-emerald-300">
                          {stats.totals.personas}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sky-300">
                          {stats.totals.vehiculos}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-200">
                          {stats.totals.sinNovedad}
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-300">
                          {stats.totals.observacion}
                        </td>
                        <td className="py-2.5 px-3 text-right text-red-400">
                          {stats.totals.solicitados}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-300">
                          {stats.totals.retenidos}
                        </td>
                        <td className="py-2.5 px-3 text-right text-white">
                          {stats.totals.total}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BASE DE DATOS DE VERIFICADOS */}
      {subTab === 'verificados' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logsSearch}
                onChange={(e) => setLogsSearch(e.target.value)}
                placeholder="Buscar cédula, placa, nombre, serial, sector..."
                className="w-full bg-[#111822] border border-slate-800 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'persona', label: 'Personas' },
                  { id: 'vehiculo', label: 'Vehículos' },
                  { id: 'alertas', label: 'Solicitados / Retenidos' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLogsFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    logsFilter === f.id
                      ? 'bg-[#1F2D40] text-white border border-slate-600'
                      : 'bg-[#111822] text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => void handleCopyVerifiedReport()}
                disabled={filteredLogs.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#162231] hover:bg-[#1E2E42] disabled:opacity-40 border border-slate-700 text-slate-200 rounded-md cursor-pointer"
              >
                {copiedReport ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Reporte Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar Base (CSV)
                  </>
                )}
              </button>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="bg-[#111822] border border-slate-800 rounded-lg p-10 text-center space-y-2">
              <Database className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-300">
                No hay registros en la Base de Datos de Verificados.
              </p>
              <p className="text-xs text-slate-500">
                Usa la pestaña "Consultar y Registrar" para verificar personas o vehículos y almacenarlos aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => {
                const isAlert = log.resultado === 'solicitado' || log.resultado === 'retenido';
                const comm = commissions.find((c) => c.id === log.commissionId);
                return (
                  <div
                    key={log.id}
                    className={`bg-[#111822] border rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                      isAlert ? 'border-red-500/60' : 'border-slate-800'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            log.tipo === 'persona' ? 'text-emerald-400' : 'text-sky-400'
                          }`}
                        >
                          {log.tipo === 'persona' ? (
                            <UserCheck className="w-3.5 h-3.5" />
                          ) : (
                            <Car className="w-3.5 h-3.5" />
                          )}
                          {log.tipo === 'persona' ? 'Persona' : 'Vehículo'}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="font-mono-tabular font-bold text-white text-sm">
                          {log.identificador}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-200 font-semibold">{log.nombreDescripcion}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                        <span>{formatTimestamp(log.createdAt)}</span>
                        <span>Sector: {log.sector}</span>
                        <span>Oficial: {log.verificadoPor}</span>
                        {comm && <span className="font-mono-tabular text-slate-300">{comm.codigo}</span>}
                      </div>

                      {(log.datoSecundario || log.conductorAsociado) && (
                        <div className="text-[11px] text-slate-300 flex flex-wrap gap-x-4 gap-y-0.5">
                          {log.datoSecundario && (
                            <span>
                              <strong className="text-slate-400 font-medium">
                                {log.tipo === 'persona' ? 'Datos:' : 'Serial:'}
                              </strong>{' '}
                              {log.datoSecundario}
                            </span>
                          )}
                          {log.conductorAsociado && (
                            <span>
                              <strong className="text-slate-400 font-medium">
                                {log.tipo === 'persona' ? 'Vehículo / Acomp.:' : 'Conductor:'}
                              </strong>{' '}
                              {log.conductorAsociado}
                            </span>
                          )}
                        </div>
                      )}

                      {log.motivoRequerimiento && (
                        <div className="text-xs text-red-300 font-medium">
                          Requerimiento: {log.motivoRequerimiento}
                        </div>
                      )}

                      {log.observaciones && (
                        <p className="text-[11px] text-slate-400">{log.observaciones}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {canOperate ? (
                        <select
                          aria-label="Cambiar resultado de verificación"
                          value={log.resultado}
                          onChange={(e) =>
                            void onUpdateVerificationResult(log, e.target.value as VerificationResult)
                          }
                          className={`bg-[#0B1117] border rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none ${
                            isAlert
                              ? 'border-red-500/70 text-red-300'
                              : log.resultado === 'observacion_tactica'
                                ? 'border-amber-500/60 text-amber-300'
                                : 'border-emerald-500/50 text-emerald-300'
                          }`}
                        >
                          <option value="sin_novedad">Sin Novedad</option>
                          <option value="observacion_tactica">Observación Táctica</option>
                          <option value="solicitado">Solicitado</option>
                          <option value="retenido">Retenido / A la Orden</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2.5 py-1.5 text-xs font-semibold rounded border bg-[#0B1117] ${
                            isAlert
                              ? 'border-red-500/70 text-red-300'
                              : log.resultado === 'observacion_tactica'
                                ? 'border-amber-500/60 text-amber-300'
                                : 'border-emerald-500/50 text-emerald-300'
                          }`}
                        >
                          {VERIFICATION_RESULT_LABELS[log.resultado]}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onLocateCoords(log.lat, log.lng, 15)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-[#162231] hover:bg-[#1E2E42] text-slate-200 rounded cursor-pointer"
                        title="Ubicar punto de verificación en el mapa"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        Mapa
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void onDeleteVerificationLog(log)}
                          className="p-1.5 text-slate-400 hover:text-red-400 bg-[#162231] hover:bg-red-950/50 rounded cursor-pointer"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BASE DE DATOS DE SOLICITADOS */}
      {subTab === 'solicitados' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={wantedSearch}
                onChange={(e) => setWantedSearch(e.target.value)}
                placeholder="Buscar cédula, placa, delito, expediente..."
                className="w-full bg-[#111822] border border-slate-800 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'solicitado', label: 'Activos' },
                  { id: 'persona', label: 'Personas' },
                  { id: 'vehiculo', label: 'Vehículos' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setWantedFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    wantedFilter === f.id
                      ? 'bg-[#1F2D40] text-white border border-slate-600'
                      : 'bg-[#111822] text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredWanted.map((rec) => {
              const isActive = rec.estado === 'solicitado';
              return (
                <div
                  key={rec.id}
                  className={`bg-[#111822] border rounded-lg p-4 space-y-3 ${
                    isActive ? 'border-red-500/50' : 'border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`font-semibold ${
                            rec.tipo === 'persona' ? 'text-emerald-400' : 'text-sky-400'
                          }`}
                        >
                          {rec.tipo === 'persona' ? 'Persona' : 'Vehículo'}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono-tabular font-bold text-white text-sm">
                          {rec.identificador}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span
                          className={`text-[11px] font-semibold ${
                            isActive ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {WANTED_STATUS_LABELS[rec.estado]}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white mt-1">
                        {rec.nombreDescripcion}
                      </h3>
                      {rec.aliasOSecundario && (
                        <div className="text-xs text-slate-400">{rec.aliasOSecundario}</div>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
                        rec.peligrosidad === 'extrema'
                          ? 'bg-red-950 text-red-300 border border-red-500/50'
                          : rec.peligrosidad === 'alta'
                            ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                            : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {rec.peligrosidad}
                    </span>
                  </div>

                  <div className="bg-[#0B1117] border border-slate-800/80 rounded p-2.5 text-xs space-y-1">
                    <div className="text-red-200 font-semibold">{rec.delito}</div>
                    <div className="text-slate-400 text-[11px]">
                      Expediente: <span className="font-mono-tabular text-slate-200">{rec.expediente}</span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Organismo: <span className="text-slate-200">{rec.organismoSolicitante}</span>
                    </div>
                    {rec.notas && <p className="text-[11px] text-slate-400 pt-1">{rec.notas}</p>}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSubTab('verificar');
                        setLookupType(rec.tipo);
                        handleLookupChange(rec.identificador);
                      }}
                      className="text-xs font-semibold text-sky-400 hover:underline cursor-pointer"
                    >
                      Probar en Verificador
                    </button>

                    {canEditCatalogs && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onToggleWantedStatus(rec)}
                          className={`px-2.5 py-1.5 text-xs font-semibold rounded cursor-pointer ${
                            isActive
                              ? 'bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100'
                              : 'bg-amber-800/80 hover:bg-amber-700 text-amber-100'
                          }`}
                        >
                          {isActive ? 'Marcar Capturado / Recuperado' : 'Reactivar Orden'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteWantedRecord(rec)}
                          className="p-1.5 text-slate-400 hover:text-red-400 bg-[#162231] rounded cursor-pointer"
                          title="Eliminar orden"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR NUEVA ORDEN / SOLICITADO */}
      {canEditCatalogs && wantedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111822] border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0E151E]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <h2 className="font-display text-lg font-bold text-white">
                  Cargar Persona o Vehículo Solicitado
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setWantedModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitWantedRecord} className="p-5 space-y-3.5">
              {wantedError && (
                <div className="bg-red-950/60 border border-red-500/60 text-red-200 rounded px-3 py-2 text-xs">
                  {wantedError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWTipo('persona')}
                  className={`py-2 text-xs font-semibold rounded border cursor-pointer ${
                    wTipo === 'persona'
                      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                      : 'bg-[#0B1117] border-slate-700 text-slate-400'
                  }`}
                >
                  Persona Solicitada
                </button>
                <button
                  type="button"
                  onClick={() => setWTipo('vehiculo')}
                  className={`py-2 text-xs font-semibold rounded border cursor-pointer ${
                    wTipo === 'vehiculo'
                      ? 'bg-sky-950/70 border-sky-500 text-sky-200'
                      : 'bg-[#0B1117] border-slate-700 text-slate-400'
                  }`}
                >
                  Vehículo Solicitado / Robado
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {wTipo === 'persona' ? 'Cédula / ID *' : 'Placa *'}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={48}
                    value={wIdentificador}
                    onChange={(e) => setWIdentificador(e.target.value.toUpperCase())}
                    placeholder={wTipo === 'persona' ? 'V-22.345.678' : 'AG741KP'}
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs font-mono-tabular text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Peligrosidad *
                  </label>
                  <select
                    value={wPeligrosidad}
                    onChange={(e) => setWPeligrosidad(e.target.value as WantedDangerLevel)}
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="extrema">Extrema</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {wTipo === 'persona' ? 'Nombre Completo *' : 'Marca, Modelo, Color y Año *'}
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={wNombre}
                  onChange={(e) => setWNombre(e.target.value)}
                  placeholder={
                    wTipo === 'persona'
                      ? 'Ej: Carlos Javier Montilla Peña'
                      : 'Ej: Chevrolet Silverado Blanca 2015'
                  }
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {wTipo === 'persona' ? 'Alias / Zona Frecuente' : 'Serial de Carrocería / Motor'}
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={wAlias}
                  onChange={(e) => setWAlias(e.target.value)}
                  placeholder={
                    wTipo === 'persona' ? 'Alias o sector' : 'Serial completo de carrocería o motor'
                  }
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Delito / Motivo de Solicitud *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  list="wanted-crime-suggestions"
                  value={wDelito}
                  onChange={(e) => setWDelito(e.target.value)}
                  placeholder="Ej: Extorsión, Robo Agravado, Abigeato, Ambiental: Tala Ilegal..."
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
                <datalist id="wanted-crime-suggestions">
                  {WANTED_CRIME_SUGGESTIONS.map((crime) => (
                    <option key={crime} value={crime} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nro. de Expediente / Orden *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={wExpediente}
                    onChange={(e) => setWExpediente(e.target.value.toUpperCase())}
                    placeholder="Ej: EXP-TRJ-2025-00912"
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs font-mono-tabular text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Organismo / Tribunal Solicitante *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={wOrganismo}
                    onChange={(e) => setWOrganismo(e.target.value)}
                    className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notas Tácticas / Precauciones
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={wNotas}
                  onChange={(e) => setWNotas(e.target.value)}
                  placeholder="Características físicas, modus operandi, coordinación requerida..."
                  className="w-full bg-[#0B1117] border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWantedModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 bg-[#192332] hover:bg-[#243247] rounded-md cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingWanted}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-600 disabled:opacity-60 rounded-md cursor-pointer"
                >
                  {savingWanted ? 'Registrando...' : 'Guardar Orden Judicial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

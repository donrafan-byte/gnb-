import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertTriangle,
  Anchor,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Flame,
  HelpCircle,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Play,
  Plus,
  Radio,
  Search,
  Shield,
  Square,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import {
  INITIAL_COMMISSIONS,
  INITIAL_FRIENDLY_FORCES,
  INITIAL_GANG_ZONES,
  INITIAL_INCIDENTS,
  INITIAL_WANTED_RECORDS,
} from './data/trujilloSeed';
import { INITIAL_ZONE_UNITS } from './data/czgnb23Structure';
import {
  COMMISSION_STATUS_LABELS,
  DESTACAMENTO_META,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  OFFICER_PRIVILEGE_LABELS,
  OPERATIONAL_DESTACAMENTOS,
  ROAD_ACCESS_STATUS_LABELS,
  TRUJILLO_BOUNDS,
  ZONE_UNIT_LEVEL_LABELS,
  ZONE_UNIT_STATUS_LABELS,
  isEnvironmentalIncidentType,
  isPublicOrderIncidentType,
  isTrafficIncidentType,
  isViolentIncidentType,
  type AccessCodeRecord,
  type AuditAction,
  type AuditEntity,
  type AuditLog,
  type AuditSeverity,
  type Commission,
  type DestacamentoId,
  type FriendlyForce,
  type GangZone,
  type Incident,
  type IncidentStatus,
  type IncidentType,
  type LiveLocation,
  type OfficerPrivilege,
  type OfficerProfile,
  type OperationMode,
  type PatrolPoint,
  type VerificationLog,
  type VerificationResult,
  type WantedRecord,
  type ZoneUnit,
  type ZoneUnitStatus,
} from './types/operations';
import type { CuadrantePaz } from './data/trujilloCuadrantes';
import {
  clampTrujilloCoords,
  evaluateCommissionDeviation,
  formatCoords,
  playIncidentAlertTone,
  playTacticalAlertTone,
  sanitizePhoneForTel,
} from './lib/geo';
import {
  dispatchSystemPushNotification,
  getPushPermissionState,
  loadPushPrefs,
  requestPushPermission,
  savePushPrefs,
  type OperationalAlertItem,
  type PushNotificationPrefs,
  type PushPermissionState,
} from './lib/pushNotifications';
import { AuthGate } from './components/AuthGate';
import { EmergencyBanner } from './components/EmergencyBanner';
import { PublicOrderAlertBanner } from './components/PublicOrderAlertBanner';
import {
  TacticalMap,
  type MapLayerVisibility,
  type TacticalMapMode,
} from './components/TacticalMap';
import { CommissionDetailDrawer } from './components/CommissionDetailDrawer';
import {
  CommissionFormModal,
  type CommissionFormPayload,
} from './components/CommissionFormModal';
import {
  IncidentFormModal,
  type IncidentFormPayload,
} from './components/IncidentFormModal';
import {
  FriendlyForceFormModal,
  GangZoneFormModal,
  type FriendlyForceFormPayload,
  type GangFormPayload,
} from './components/IntelligenceModals';
import { SupportAlertModal } from './components/SupportAlertModal';
import { CommissionsView } from './components/CommissionsView';
import { CrimeMapView } from './components/CrimeMapView';
import { IntelligenceView } from './components/IntelligenceView';
import { ZoneUnitsView } from './components/ZoneUnitsView';
import {
  ZoneUnitFormModal,
  type ZoneUnitFormValues,
} from './components/ZoneUnitFormModal';
import {
  VerificationView,
  type VerificationLogFormPayload,
  type WantedRecordFormPayload,
} from './components/VerificationView';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  ShareAppButton,
  ShareModal,
  formatCommissionShareText,
} from './components/ShareModal';
import {
  PatrolPointFormModal,
  type PatrolPointFormPayload,
} from './components/PatrolPointFormModal';
import {
  LiveAlertToastStack,
  NotificationBellMenu,
} from './components/NotificationCenter';
import {
  OfficerRegistrationModal,
  type OfficerRegistrationPayload,
} from './components/OfficerRegistrationModal';
import {
  AuditRegistryModal,
  type AuditModalTab,
} from './components/AuditRegistryModal';
import {
  AccessGateScreen,
  type AccessRequestPayload,
} from './components/AccessGateScreen';
import { PendingAccessBanner } from './components/PendingAccessBanner';
import { HelpGuideModal } from './components/HelpGuideModal';
import {
  hashSecretCode,
  maskSecretCode,
  normalizeSecretCode,
} from './lib/accessCrypto';

type AppTab =
  | 'mapa'
  | 'unidades'
  | 'comisiones'
  | 'verificacion'
  | 'criminalidad'
  | 'inteligencia';
type MobileMapPane = 'mapa' | 'lista' | 'detalle';

function toMillisSafe(ts?: { toMillis?: () => number } | null): number {
  if (!ts || typeof ts.toMillis !== 'function') return 0;
  try {
    return ts.toMillis();
  } catch {
    return 0;
  }
}

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now()}_${rand}`;
}

function getShortDeviceSummary(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent || '';
  const os = /iPhone|iPad|iPod/i.test(ua)
    ? 'iOS'
    : /Android/i.test(ua)
      ? 'Android'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac OS X/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Dispositivo';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome\//i.test(ua) && !/Edg\//i.test(ua)
      ? 'Chrome'
      : /Safari\//i.test(ua) && !/Chrome\//i.test(ua)
        ? 'Safari'
        : /Firefox\//i.test(ua)
          ? 'Firefox'
          : 'Navegador';
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  return `${os} · ${browser}${standalone ? ' (App Instalada)' : ''}`.slice(0, 120);
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  const [activeTab, setActiveTab] = useState<AppTab>('mapa');
  const [mobileMapPane, setMobileMapPane] = useState<MobileMapPane>('mapa');
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [patrolPoints, setPatrolPoints] = useState<PatrolPoint[]>([]);
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [gangZones, setGangZones] = useState<GangZone[]>([]);
  const [friendlyForces, setFriendlyForces] = useState<FriendlyForce[]>([]);
  const [zoneUnits, setZoneUnits] = useState<ZoneUnit[]>([]);
  const [wantedRecords, setWantedRecords] = useState<WantedRecord[]>([]);
  const [verificationLogs, setVerificationLogs] = useState<VerificationLog[]>([]);
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [myOwnOfficerDoc, setMyOwnOfficerDoc] = useState<OfficerProfile | null>(null);
  const [accessCodes, setAccessCodes] = useState<AccessCodeRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [officerProfileLoaded, setOfficerProfileLoaded] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditModalInitialTab, setAuditModalInitialTab] = useState<AuditModalTab | undefined>(
    undefined
  );
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const sessionLoggedUidRef = useRef<string | null>(null);
  const seededKeyRef = useRef<string | null>(null);
  const officersHydratedRef = useRef(false);
  const seenPendingOfficerUidsRef = useRef<Set<string>>(new Set());

  const [selectedCommissionId, setSelectedCommissionId] = useState<string | null>(null);
  const [selectedDestacamento, setSelectedDestacamento] = useState<DestacamentoId | 'ALL'>('ALL');
  const [railSearch, setRailSearch] = useState('');
  const [railModeFilter, setRailModeFilter] = useState<'all' | 'terrestre' | 'lacustre'>('all');
  const [focusTarget, setFocusTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    seq: number;
  } | null>(null);

  const [mapMode, setMapMode] = useState<TacticalMapMode>('inspect');
  const [patrolRadiusKm, setPatrolRadiusKm] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem('dcr231_patrol_radius_km'));
      return Number.isFinite(saved) && saved >= 1 && saved <= 50 ? saved : 5;
    } catch {
      return 5;
    }
  });
  const [layers, setLayers] = useState<MapLayerVisibility>({
    boundaries: true,
    commissions: true,
    zoneUnits: true,
    sectorGeofence: true,
    cuadrantesPaz: true,
    incidents: true,
    patrolPoints: true,
    liveUsers: true,
    crimeZones: true,
    gangZones: true,
    friendlyForces: true,
  });

  // Modals state
  const [commissionModal, setCommissionModal] = useState<{
    open: boolean;
    editing: Commission | null;
    prefillUnit?: ZoneUnit | null;
  }>({ open: false, editing: null, prefillUnit: null });
  const [zoneUnitModal, setZoneUnitModal] = useState<{
    open: boolean;
    editing: ZoneUnit | null;
    defaultDestacamento: DestacamentoId;
  }>({ open: false, editing: null, defaultDestacamento: 'D-231' });
  const [incidentModal, setIncidentModal] = useState<{
    open: boolean;
    coords: { lat: number; lng: number };
    commissionId: string;
    defaultTipo?: IncidentType;
    defaultCuadrantePaz?: string;
    defaultMunicipio?: string;
    defaultSector?: string;
  } | null>(null);
  const [patrolModal, setPatrolModal] = useState<{
    open: boolean;
    coords: { lat: number; lng: number };
    commissionId: string;
    defaultCuadrantePaz?: string;
    defaultMunicipio?: string;
    defaultSector?: string;
    defaultModalidad?: OperationMode;
  } | null>(null);
  const [supportModalCommission, setSupportModalCommission] = useState<Commission | null>(null);
  const [shareCommission, setShareCommission] = useState<Commission | null>(null);
  const [gangModal, setGangModal] = useState<{
    open: boolean;
    editing: GangZone | null;
  }>({ open: false, editing: null });
  const [friendlyModal, setFriendlyModal] = useState<{
    open: boolean;
    editing: FriendlyForce | null;
  }>({ open: false, editing: null });

  // Live GPS & Simulation state
  const [liveGpsCommissionId, setLiveGpsCommissionId] = useState<string | null>(null);
  const gpsWatchIdRef = useRef<number | null>(null);

  // Real-time User GPS Position while on Commission
  const [myLiveGpsActive, setMyLiveGpsActive] = useState(false);
  const [myLiveCommissionId, setMyLiveCommissionId] = useState('');
  const [myLivePos, setMyLivePos] = useState<{
    lat: number;
    lng: number;
    accuracyMeters: number;
    speedKmh: number;
  } | null>(null);
  const myLiveWatchIdRef = useRef<number | null>(null);
  const myLiveLastWriteRef = useRef<number>(0);
  const myLiveDocExistsRef = useRef<boolean | null>(null);
  const myLiveCenteredOnceRef = useRef<boolean>(false);

  const [patrolSimRunning, setPatrolSimRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [alertMuted, setAlertMuted] = useState(false);
  const alertMutedRef = useRef(alertMuted);
  alertMutedRef.current = alertMuted;

  // Real-time Push Notifications state & idempotent snapshot trackers
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(() =>
    getPushPermissionState()
  );
  const [pushPrefs, setPushPrefs] = useState<PushNotificationPrefs>(() => loadPushPrefs());
  const pushPrefsRef = useRef(pushPrefs);
  pushPrefsRef.current = pushPrefs;
  const [alertHistory, setAlertHistory] = useState<OperationalAlertItem[]>([]);
  const [liveToasts, setLiveToasts] = useState<OperationalAlertItem[]>([]);
  const incidentsHydratedRef = useRef(false);
  const seenIncidentIdsRef = useRef<Set<string>>(new Set());
  const commissionsHydratedRef = useRef(false);
  const activeSosIdsRef = useRef<Set<string>>(new Set());

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((curr) => (curr === msg ? null : curr));
    }, 4500);
  }, []);

  const isPrimaryAdmin = Boolean(
    user && user.email === 'donrafan@gmail.com' && user.emailVerified
  );

  const myOfficerProfile = useMemo(() => {
    if (!user) return null;
    return officers.find((o) => o.uid === user.uid) ?? myOwnOfficerDoc;
  }, [officers, myOwnOfficerDoc, user]);

  const myAccessStatus = useMemo<'loading' | 'autorizado' | 'pendiente' | 'expulsado'>(() => {
    if (!user) return 'loading';
    if (isPrimaryAdmin) return 'autorizado';
    if (!officerProfileLoaded) return 'loading';
    if (myOwnOfficerDoc?.accessStatus === 'autorizado') return 'autorizado';
    if (myOwnOfficerDoc?.accessStatus === 'expulsado') return 'expulsado';
    return 'pendiente';
  }, [user, isPrimaryAdmin, officerProfileLoaded, myOwnOfficerDoc?.accessStatus]);

  const isAccessAuthorized = myAccessStatus === 'autorizado';

  const myPrivilege = useMemo<OfficerPrivilege>(() => {
    if (isPrimaryAdmin) return 'administrador';
    const raw = myOwnOfficerDoc?.privilegio;
    if (
      raw === 'consulta' ||
      raw === 'operador' ||
      raw === 'supervisor' ||
      raw === 'administrador'
    ) {
      return raw;
    }
    return 'operador';
  }, [isPrimaryAdmin, myOwnOfficerDoc?.privilegio]);

  const isCommandAdmin =
    isPrimaryAdmin || (myAccessStatus === 'autorizado' && myPrivilege === 'administrador');
  const canOperateField = myPrivilege !== 'consulta';
  const canEditCatalogs = myPrivilege === 'supervisor' || myPrivilege === 'administrador';
  const canDeleteRecords = myPrivilege === 'supervisor' || myPrivilege === 'administrador';

  const handleChangePatrolRadiusKm = useCallback(
    (km: number) => {
      if (!isCommandAdmin) return;
      setPatrolRadiusKm(km);
      try {
        window.localStorage.setItem('dcr231_patrol_radius_km', String(km));
      } catch {
        // Ignore storage quota errors
      }
    },
    [isCommandAdmin]
  );

  useEffect(() => {
    if (!canOperateField) {
      setMapMode('inspect');
      setPatrolSimRunning(false);
      setLiveGpsCommissionId(null);
      setMyLiveGpsActive(false);
    }
  }, [canOperateField]);

  useEffect(() => {
    if (!isCommandAdmin) {
      setAuditModalOpen(false);
    }
  }, [isCommandAdmin]);

  const effectiveZoneUnits = useMemo<ZoneUnit[]>(() => {
    if (zoneUnits.length > 0) return zoneUnits;
    return INITIAL_ZONE_UNITS.map((u, idx) => ({
      ...u,
      id: `cz23_ref_${idx + 1}`,
      ownerId: 'system_ref',
    }));
  }, [zoneUnits]);

  const filteredMapZoneUnits = useMemo<ZoneUnit[]>(() => {
    if (selectedDestacamento === 'ALL') return effectiveZoneUnits;
    return effectiveZoneUnits.filter(
      (u) => u.nivel === 'comando_zona' || u.destacamento === selectedDestacamento
    );
  }, [effectiveZoneUnits, selectedDestacamento]);

  const effectiveWantedRecords = useMemo<WantedRecord[]>(() => {
    if (wantedRecords.length > 0 || canEditCatalogs) return wantedRecords;
    return INITIAL_WANTED_RECORDS.map((wr, idx) => ({
      ...wr,
      id: `ref_wr_${idx + 1}`,
      ownerId: 'system_ref',
    }));
  }, [wantedRecords, canEditCatalogs]);

  const pendingOfficers = useMemo(() => {
    if (!isCommandAdmin) return [];
    return officers.filter(
      (o) =>
        o.email !== 'donrafan@gmail.com' &&
        o.accessStatus !== 'autorizado' &&
        o.accessStatus !== 'expulsado'
    );
  }, [isCommandAdmin, officers]);

  const myOfficerProfileRef = useRef<OfficerProfile | null>(null);
  myOfficerProfileRef.current = myOfficerProfile;

  const myOfficerDisplayLabel = useMemo(() => {
    if (myOfficerProfile) {
      const prefix = myOfficerProfile.grado ? `${myOfficerProfile.grado} ` : '';
      return `${prefix}${myOfficerProfile.displayName}`.trim().slice(0, 100);
    }
    return (user?.displayName || 'Oficial de Guardia CZGNB-23').slice(0, 100);
  }, [myOfficerProfile, user?.displayName]);

  const writeAuditLog = useCallback(
    async (params: {
      accion: AuditAction;
      entidad: AuditEntity;
      entidadId?: string;
      resumen: string;
      severidad?: AuditSeverity;
      actorOverride?: { nombre?: string; grado?: string; cedula?: string };
    }) => {
      if (!user || !user.email) return;
      const prof = myOfficerProfileRef.current;
      const actorNombre =
        (
          params.actorOverride?.nombre ||
          prof?.displayName ||
          user.displayName ||
          'Oficial de Guardia'
        )
          .trim()
          .slice(0, 100) || 'Oficial de Guardia';
      const actorGrado = (params.actorOverride?.grado ?? prof?.grado ?? '')
        .trim()
        .slice(0, 40);
      const actorCedula = (params.actorOverride?.cedula ?? prof?.cedula ?? '')
        .trim()
        .slice(0, 24);
      const cleanResumen = params.resumen.trim().slice(0, 300);
      if (cleanResumen.length < 2) return;

      const id = makeSafeId('aud');
      try {
        await setDoc(doc(db, 'auditLogs', id), {
          ownerId: user.uid,
          actorUid: user.uid,
          actorEmail: user.email.slice(0, 150),
          actorNombre,
          actorGrado,
          actorCedula,
          accion: params.accion,
          entidad: params.entidad,
          entidadId: (params.entidadId || '').slice(0, 128),
          resumen: cleanResumen,
          severidad: params.severidad ?? 'normal',
          dispositivo: getShortDeviceSummary(),
          createdAt: serverTimestamp(),
        });
      } catch {
        // Never block operational workflow if audit write hits transient network error
      }
    },
    [user]
  );

  const focusAlertOnMap = useCallback((item: OperationalAlertItem) => {
    if (item.commissionId) {
      setSelectedCommissionId(item.commissionId);
    }
    if (typeof item.lat === 'number' && typeof item.lng === 'number') {
      setActiveTab('mapa');
      setMobileMapPane('mapa');
      setFocusTarget({ lat: item.lat, lng: item.lng, zoom: 14, seq: Date.now() });
    }
    setAlertHistory((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, read: true } : a))
    );
  }, []);

  const triggerOperationalAlert = useCallback(
    (payload: Omit<OperationalAlertItem, 'timestampMs' | 'read'>) => {
      const prefs = pushPrefsRef.current;
      if (payload.kind === 'support' && !prefs.notifySupport) return;
      if (
        (payload.kind === 'incident' ||
          payload.kind === 'environmental' ||
          payload.kind === 'traffic' ||
          payload.kind === 'homicide' ||
          payload.kind === 'public_order') &&
        !prefs.notifyIncidents
      ) {
        return;
      }

      const item: OperationalAlertItem = {
        ...payload,
        timestampMs: Date.now(),
        read: false,
      };

      setAlertHistory((prev) => {
        if (prev.some((existing) => existing.id === item.id)) return prev;
        return [item, ...prev].slice(0, 30);
      });

      setLiveToasts((prev) => {
        if (prev.some((existing) => existing.id === item.id)) return prev;
        return [item, ...prev].slice(0, 3);
      });

      const isHighPriority =
        item.kind === 'support' ||
        item.kind === 'access_request' ||
        item.kind === 'homicide' ||
        item.kind === 'public_order';
      const autoDismissMs = isHighPriority ? 14000 : 9000;
      window.setTimeout(() => {
        setLiveToasts((curr) => curr.filter((t) => t.id !== item.id));
      }, autoDismissMs);

      if (prefs.soundEnabled && !alertMutedRef.current) {
        if (isHighPriority) {
          playTacticalAlertTone();
        } else {
          playIncidentAlertTone();
        }
      }

      if (prefs.enabled && getPushPermissionState() === 'granted') {
        void dispatchSystemPushNotification({
          title: item.title,
          body: `${item.body} (${item.sector})`,
          tag: item.id,
          urgent: isHighPriority,
          onClick: () => {
            if (item.kind === 'access_request') {
              setAuditModalInitialTab('control_acceso');
              setAuditModalOpen(true);
              setAlertHistory((prev) =>
                prev.map((a) => (a.id === item.id ? { ...a, read: true } : a))
              );
            } else {
              focusAlertOnMap(item);
            }
          },
        });
      }
    },
    [focusAlertOnMap]
  );

  const handleRequestPushPermission = useCallback(async () => {
    const result = await requestPushPermission();
    setPushPermission(result);
    if (result === 'granted') {
      const next = { ...pushPrefsRef.current, enabled: true };
      setPushPrefs(next);
      savePushPrefs(next);
      showNotice('Notificaciones push activadas para novedades y alertas de apoyo (SOS).');
      void dispatchSystemPushNotification({
        title: 'CZGNB-23 Trujillo — Push Activo',
        body: 'Recibirás alertas en tiempo real del Comando de Zona Nro. 23 GNB (D-231, DCR 23-1, DESUR-23).',
        tag: 'czgnb23_push_enabled',
      });
    } else if (result === 'denied') {
      showNotice('Permiso de notificaciones denegado. Puedes habilitarlo en los ajustes del navegador.');
    }
  }, [showNotice]);

  const handleUpdatePushPrefs = useCallback((patch: Partial<PushNotificationPrefs>) => {
    setPushPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePushPrefs(next);
      return next;
    });
  }, []);

  const handleSendTestPushAlert = useCallback(() => {
    triggerOperationalAlert({
      id: `test_${Date.now()}`,
      kind: 'test',
      title: 'Prueba de Alerta Push — CZGNB-23 Trujillo',
      body: 'Canal de alertas en tiempo real operativo para D-231, DCR 23-1 y DESUR-23.',
      sector: 'Sede Comando de Zona Nro. 23 GNB (Santa Cruz, Valera)',
      lat: 9.3545,
      lng: -70.6085,
    });
  }, [triggerOperationalAlert]);

  // Listen for Google Maps Demo Key quota events
  useEffect(() => {
    const handler = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Firebase Auth Listener (with iOS WebView/ITP safety timeout so login screen never hangs)
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setAuthReady(true);
    }, 3500);
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        clearTimeout(fallbackTimer);
        setUser(u);
        setAuthReady(true);
      },
      () => {
        clearTimeout(fallbackTimer);
        setAuthReady(true);
      }
    );
    return () => {
      clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  // Step 1: Real-time Zero-Trust Officer Gate Listener (runs immediately on auth)
  useEffect(() => {
    if (!user) {
      setMyOwnOfficerDoc(null);
      setOfficerProfileLoaded(false);
      setCommissions([]);
      setIncidents([]);
      setPatrolPoints([]);
      setLiveLocations([]);
      setGangZones([]);
      setFriendlyForces([]);
      setZoneUnits([]);
      setWantedRecords([]);
      setVerificationLogs([]);
      setOfficers([]);
      setAccessCodes([]);
      setAuditLogs([]);
      setAuditModalOpen(false);
      setProfileModalOpen(false);
      sessionLoggedUidRef.current = null;
      seededKeyRef.current = null;
      officersHydratedRef.current = false;
      seenPendingOfficerUidsRef.current = new Set();
      setMyLiveGpsActive(false);
      setMyLivePos(null);
      setAlertHistory([]);
      setLiveToasts([]);
      myLiveDocExistsRef.current = null;
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    const officerRef = doc(db, 'officers', user.uid);
    const adminUser = user.email === 'donrafan@gmail.com' && user.emailVerified;

    const ensureOfficerDocument = async () => {
      try {
        const snap = await getDoc(officerRef);
        if (cancelled) return;
        if (!snap.exists()) {
          await setDoc(officerRef, {
            uid: user.uid,
            displayName: (user.displayName || 'Oficial de Guardia').slice(0, 100),
            email: (user.email || '').slice(0, 150),
            unit: 'Comando de Zona Nro. 23 GNB — Estado Trujillo',
            destacamento: 'CZGNB-23',
            compania: '',
            puesto: '',
            grado: '',
            cedula: '',
            telefono: '',
            cargo: 'Oficial de Guardia — CZGNB-23 Trujillo',
            perfilCompleto: false,
            accessStatus: adminUser ? 'autorizado' : 'pendiente',
            privilegio: adminUser ? 'administrador' : 'operador',
            authorizedBy: adminUser ? 'admin' : '',
            authorizedCodeHash: '',
            ...(adminUser
              ? {
                  privilegioActualizadoPor: 'donrafan@gmail.com',
                  privilegioActualizadoAt: serverTimestamp(),
                  authorizedAt: serverTimestamp(),
                }
              : {}),
            expulsadoMotivo: '',
            expulsadoPor: '',
            solicitudNota: '',
            lastLoginAt: serverTimestamp(),
            loginCount: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const data = snap.data() as Partial<OfficerProfile>;
          // Ensure Primary Admin always has explicit 'autorizado' status & 'administrador' privilege
          if (
            adminUser &&
            (data.accessStatus !== 'autorizado' || data.privilegio !== 'administrador')
          ) {
            const patch: Record<string, unknown> = {
              updatedAt: serverTimestamp(),
            };
            if (data.accessStatus !== 'autorizado') {
              patch.accessStatus = 'autorizado';
              patch.authorizedBy = 'admin';
              patch.authorizedAt = serverTimestamp();
              patch.expulsadoMotivo = '';
              patch.expulsadoPor = '';
            }
            if (data.privilegio !== 'administrador') {
              patch.privilegio = 'administrador';
              patch.privilegioActualizadoPor = 'donrafan@gmail.com';
              patch.privilegioActualizadoAt = serverTimestamp();
            }
            await updateDoc(officerRef, patch);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `officers/${user.uid}`);
      }
    };

    void ensureOfficerDocument();

    const unsubSelfOfficer = onSnapshot(
      officerRef,
      (snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          setMyOwnOfficerDoc({
            id: snap.id,
            ...(snap.data() as Omit<OfficerProfile, 'id'>),
          });
          setOfficerProfileLoaded(true);
        }
      },
      (err) => {
        if (!cancelled) {
          setOfficerProfileLoaded(true);
        }
        handleFirestoreError(err, OperationType.GET, `officers/${user.uid}`);
      }
    );

    return () => {
      cancelled = true;
      unsubSelfOfficer();
    };
  }, [user]);

  // Step 2: Authorized Workspace Bootstrap + Real-Time Subscriptions
  // Immediately tears down all listeners and clears operational data if user is pending or expelled
  useEffect(() => {
    if (!user || !isAccessAuthorized) {
      if (user && !isAccessAuthorized) {
        setCommissions([]);
        setIncidents([]);
        setPatrolPoints([]);
        setLiveLocations([]);
        setGangZones([]);
        setFriendlyForces([]);
        setZoneUnits([]);
        setWantedRecords([]);
        setVerificationLogs([]);
        setOfficers([]);
        setAccessCodes([]);
        setAuditLogs([]);
        setAuditModalOpen(false);
        setProfileModalOpen(false);
        setMyLiveGpsActive(false);
        setMyLivePos(null);
        setDataLoading(false);
      }
      return;
    }

    let cancelled = false;
    incidentsHydratedRef.current = false;
    seenIncidentIdsRef.current = new Set();
    commissionsHydratedRef.current = false;
    activeSosIdsRef.current = new Set();
    officersHydratedRef.current = false;
    seenPendingOfficerUidsRef.current = new Set();

    const adminUser = isCommandAdmin;
    const seedScopeKey = `${user.uid}_${canOperateField ? 1 : 0}_${canEditCatalogs ? 1 : 0}`;

    const bootstrapAuthorizedWorkspace = async () => {
      setDataLoading(true);
      try {
        const officerRef = doc(db, 'officers', user.uid);
        const officerSnap = await getDoc(officerRef);
        const snapProfile = officerSnap.exists()
          ? (officerSnap.data() as Partial<OfficerProfile>)
          : null;

        if (sessionLoggedUidRef.current !== user.uid && !cancelled) {
          sessionLoggedUidRef.current = user.uid;
          if (officerSnap.exists() && snapProfile?.accessStatus !== 'expulsado') {
            const prevCount =
              typeof snapProfile?.loginCount === 'number' &&
              Number.isInteger(snapProfile.loginCount) &&
              snapProfile.loginCount >= 1
                ? snapProfile.loginCount
                : 0;
            await updateDoc(officerRef, {
              lastLoginAt: serverTimestamp(),
              loginCount: prevCount + 1,
              updatedAt: serverTimestamp(),
            });
          }
          void writeAuditLog({
            accion: 'sesion_inicio',
            entidad: 'sesion',
            entidadId: user.uid,
            resumen: `Ingreso autorizado al sistema CZGNB-23 Trujillo (${user.email || 'sin correo'}).`,
            severidad: 'normal',
            actorOverride: snapProfile
              ? {
                  nombre: snapProfile.displayName,
                  grado: snapProfile.grado,
                  cedula: snapProfile.cedula,
                }
              : undefined,
          });
        }

        if (seededKeyRef.current !== seedScopeKey && !cancelled) {
          seededKeyRef.current = seedScopeKey;

          // Seed shared CZGNB-23 operational & intelligence collections ONLY if globally empty (Admin/Supervisor)
          if (canEditCatalogs) {
            const [
              existingCommSnap,
              existingIncSnap,
              existingGangSnap,
              existingForcesSnap,
              existingUnitsSnap,
              existingWantedSnap,
            ] = await Promise.all([
              getDocs(query(collection(db, 'commissions'), limit(1))),
              getDocs(query(collection(db, 'incidents'), limit(1))),
              getDocs(query(collection(db, 'gangZones'), limit(1))),
              getDocs(query(collection(db, 'friendlyForces'), limit(1))),
              getDocs(query(collection(db, 'zoneUnits'), limit(1))),
              getDocs(query(collection(db, 'wantedRecords'), limit(1))),
            ]);

            if ((existingCommSnap.empty || existingIncSnap.empty) && !cancelled) {
              const opsBatch = writeBatch(db);
              if (existingCommSnap.empty) {
                INITIAL_COMMISSIONS.forEach((c, idx) => {
                  const id = `seed_com_${idx + 1}_${user.uid.slice(0, 8)}`;
                  opsBatch.set(doc(db, 'commissions', id), {
                    ...c,
                    ownerId: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                });
              }
              if (existingIncSnap.empty) {
                INITIAL_INCIDENTS.forEach((inc, idx) => {
                  const id = `seed_inc_${idx + 1}_${user.uid.slice(0, 8)}`;
                  opsBatch.set(doc(db, 'incidents', id), {
                    ...inc,
                    ownerId: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                });
              }
              await opsBatch.commit();
            }

            if ((existingGangSnap.empty || existingForcesSnap.empty) && !cancelled) {
              const catalogBatch = writeBatch(db);
              if (existingGangSnap.empty) {
                INITIAL_GANG_ZONES.forEach((gz, idx) => {
                  const id = `seed_gz_${idx + 1}_${user.uid.slice(0, 8)}`;
                  catalogBatch.set(doc(db, 'gangZones', id), {
                    ...gz,
                    ownerId: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                });
              }
              if (existingForcesSnap.empty) {
                INITIAL_FRIENDLY_FORCES.forEach((ff, idx) => {
                  const id = `seed_ff_${idx + 1}_${user.uid.slice(0, 8)}`;
                  catalogBatch.set(doc(db, 'friendlyForces', id), {
                    ...ff,
                    ownerId: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                });
              }
              await catalogBatch.commit();
            }

            if (existingUnitsSnap.empty && !cancelled) {
              const unitsBatch = writeBatch(db);
              INITIAL_ZONE_UNITS.forEach((unit, idx) => {
                const id = `seed_cz23_${String(idx + 1).padStart(2, '0')}`;
                unitsBatch.set(doc(db, 'zoneUnits', id), {
                  ...unit,
                  ownerId: user.uid,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              });
              await unitsBatch.commit();
            }

            if (existingWantedSnap.empty && !cancelled) {
              const wantedBatch = writeBatch(db);
              INITIAL_WANTED_RECORDS.forEach((wr, idx) => {
                const id = `seed_wr_${idx + 1}_${user.uid.slice(0, 8)}`;
                wantedBatch.set(doc(db, 'wantedRecords', id), {
                  ...wr,
                  ownerId: user.uid,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              });
              await wantedBatch.commit();
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error inicializando espacio operativo CZGNB-23:', err);
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    void bootstrapAuthorizedWorkspace();

    // Shared Real-Time Operational Picture: ALL authorized CZGNB-23 officers see live updates
    const unsubComm = onSnapshot(
      collection(db, 'commissions'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Commission, 'id'>) }))
          .sort((a, b) => a.codigo.localeCompare(b.codigo));
        setCommissions(list);
        setSelectedCommissionId((curr) =>
          curr && list.some((c) => c.id === curr) ? curr : list[0]?.id ?? null
        );

        const currentSos = list.filter(
          (c) => (c.alertaApoyo || c.estado === 'apoyo_requerido') && c.estado !== 'finalizada'
        );
        const currentSosIds = new Set(currentSos.map((c) => c.id));

        if (!commissionsHydratedRef.current) {
          commissionsHydratedRef.current = true;
          activeSosIdsRef.current = currentSosIds;
        } else {
          currentSos.forEach((comm) => {
            if (!activeSosIdsRef.current.has(comm.id)) {
              activeSosIdsRef.current.add(comm.id);
              triggerOperationalAlert({
                id: `sos_${comm.id}_${Date.now()}`,
                kind: 'support',
                title: `APOYO REQUERIDO · ${comm.codigo}`,
                body: `${comm.jefeGrado} ${comm.jefeNombre}: ${comm.motivoAlerta || 'Solicita refuerzo táctico inmediato.'}`,
                sector: comm.sector,
                lat: comm.lat,
                lng: comm.lng,
                commissionId: comm.id,
              });
            }
          });
          activeSosIdsRef.current.forEach((id) => {
            if (!currentSosIds.has(id)) {
              activeSosIdsRef.current.delete(id);
            }
          });
        }
      },
      (err) => console.error('Snapshot commissions error:', err)
    );

    const unsubInc = onSnapshot(
      collection(db, 'incidents'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Incident, 'id'>) }))
          .sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setIncidents(list);

        if (!incidentsHydratedRef.current) {
          incidentsHydratedRef.current = true;
          seenIncidentIdsRef.current = new Set(snap.docs.map((d) => d.id));
        } else {
          snap.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            const docId = change.doc.id;
            if (seenIncidentIdsRef.current.has(docId)) return;
            seenIncidentIdsRef.current.add(docId);
            if (docId.startsWith('seed_inc_')) return;

            const inc = change.doc.data() as Omit<Incident, 'id'>;
            const alertKind = isViolentIncidentType(inc.tipo)
              ? 'homicide'
              : isPublicOrderIncidentType(inc.tipo)
                ? 'public_order'
                : isTrafficIncidentType(inc.tipo)
                  ? 'traffic'
                  : isEnvironmentalIncidentType(inc.tipo)
                    ? 'environmental'
                    : 'incident';
            const detailNote = isPublicOrderIncidentType(inc.tipo)
              ? [
                  inc.pasoHabilitado ? ROAD_ACCESS_STATUS_LABELS[inc.pasoHabilitado] : '',
                  inc.servicioPublico || '',
                  (inc.personasConcentradas ?? 0) > 0 ? `~${inc.personasConcentradas} pers.` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : (inc.fallecidos ?? 0) > 0 || (inc.lesionados ?? 0) > 0
                ? `${inc.fallecidos ?? 0} fall., ${inc.lesionados ?? 0} les.`
                : '';
            triggerOperationalAlert({
              id: `inc_${docId}`,
              kind: alertKind,
              title: `${INCIDENT_TYPE_LABELS[inc.tipo]} · ${INCIDENT_SEVERITY_LABELS[inc.severidad]}`,
              body: `${inc.titulo}${detailNote ? ` [${detailNote}]` : ''} — ${inc.descripcion.slice(0, 120)}`,
              sector: `${inc.cuadrantePaz ? `${inc.cuadrantePaz} · ` : ''}${inc.viaAfectada ? `${inc.viaAfectada} · ` : ''}${inc.municipio} · ${inc.sector}`,
              lat: inc.lat,
              lng: inc.lng,
            });
          });
        }
      },
      (err) => console.error('Snapshot incidents error:', err)
    );

    // Shared Command Intelligence: ALL authorized users see all GEDOs (gangZones), Allied Forces (friendlyForces), and CZGNB-23 Organic Units (zoneUnits)
    const unsubGang = onSnapshot(
      collection(db, 'gangZones'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<GangZone, 'id'>),
          }))
          .sort(
            (a, b) =>
              toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt) ||
              (a.nombre || '').localeCompare(b.nombre || '')
          );
        setGangZones(list);
      },
      (err) => {
        console.error('Snapshot gangZones error:', err);
        showNotice('Reintentando sincronización de zonas de bandas (GEDOs)...');
      }
    );

    const unsubForces = onSnapshot(
      collection(db, 'friendlyForces'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<FriendlyForce, 'id'>),
          }))
          .sort(
            (a, b) =>
              toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt) ||
              (a.nombre || '').localeCompare(b.nombre || '')
          );
        setFriendlyForces(list);
      },
      (err) => {
        console.error('Snapshot friendlyForces error:', err);
        showNotice('Reintentando sincronización de fuerzas aliadas...');
      }
    );

    const unsubZoneUnits = onSnapshot(
      collection(db, 'zoneUnits'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ZoneUnit, 'id'>),
          }))
          .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
        setZoneUnits(list);
      },
      (err) => {
        console.error('Snapshot zoneUnits error:', err);
      }
    );

    const unsubPatrols = onSnapshot(
      collection(db, 'patrolPoints'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PatrolPoint, 'id'>) }))
          .sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setPatrolPoints(list);
      },
      (err) => console.error('Snapshot patrolPoints error:', err)
    );

    const unsubLiveUsers = onSnapshot(
      collection(db, 'liveLocations'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<LiveLocation, 'id'>) }))
          .sort((a, b) => toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt));
        setLiveLocations(list);
      },
      (err) => console.error('Snapshot liveLocations error:', err)
    );

    const unsubWanted = onSnapshot(
      collection(db, 'wantedRecords'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<WantedRecord, 'id'>) }))
          .sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setWantedRecords(list);
      },
      (err) => console.error('Snapshot wantedRecords error:', err)
    );

    const unsubVerifications = onSnapshot(
      collection(db, 'verificationLogs'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<VerificationLog, 'id'>) }))
          .sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setVerificationLogs(list);
      },
      (err) => console.error('Snapshot verificationLogs error:', err)
    );

    const unsubOfficers = onSnapshot(
      adminUser
        ? collection(db, 'officers')
        : query(collection(db, 'officers'), where('uid', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OfficerProfile, 'id'>),
        }));
        setOfficers(list);

        if (adminUser) {
          const currentPending = list.filter(
            (o) =>
              o.email !== 'donrafan@gmail.com' &&
              o.accessStatus !== 'autorizado' &&
              o.accessStatus !== 'expulsado'
          );
          const pendingIds = new Set(currentPending.map((o) => o.uid));

          if (!officersHydratedRef.current) {
            officersHydratedRef.current = true;
            seenPendingOfficerUidsRef.current = pendingIds;
          } else {
            currentPending.forEach((off) => {
              if (!seenPendingOfficerUidsRef.current.has(off.uid)) {
                seenPendingOfficerUidsRef.current.add(off.uid);
                triggerOperationalAlert({
                  id: `access_req_${off.uid}_${Date.now()}`,
                  kind: 'access_request',
                  title: `SOLICITUD DE ACCESO · ${off.grado ? `${off.grado} ` : ''}${off.displayName}`,
                  body: `${off.email} solicita autorización para ingresar al sistema.${
                    off.solicitudNota ? ` Nota: "${off.solicitudNota}"` : ''
                  }`,
                  sector: off.cargo || off.unit,
                });
              }
            });
            seenPendingOfficerUidsRef.current.forEach((uid) => {
              if (!pendingIds.has(uid)) {
                seenPendingOfficerUidsRef.current.delete(uid);
              }
            });
          }
        }
      },
      (err) => console.error('Snapshot officers error:', err)
    );

    const unsubAuditLogs = onSnapshot(
      adminUser
        ? collection(db, 'auditLogs')
        : query(collection(db, 'auditLogs'), where('ownerId', '==', user.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))
          .sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
        setAuditLogs(list);
      },
      (err) => console.error('Snapshot auditLogs error:', err)
    );

    const unsubAccessCodes = adminUser
      ? onSnapshot(
          collection(db, 'accessCodes'),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<AccessCodeRecord, 'id'>) }))
              .sort((a, b) => toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt));
            setAccessCodes(list);
          },
          (err) => console.error('Snapshot accessCodes error:', err)
        )
      : () => {};

    return () => {
      cancelled = true;
      unsubComm();
      unsubInc();
      unsubGang();
      unsubForces();
      unsubZoneUnits();
      unsubPatrols();
      unsubLiveUsers();
      unsubWanted();
      unsubVerifications();
      unsubOfficers();
      unsubAuditLogs();
      unsubAccessCodes();
    };
  }, [
    user,
    isAccessAuthorized,
    isCommandAdmin,
    canOperateField,
    canEditCatalogs,
    triggerOperationalAlert,
    writeAuditLog,
    showNotice,
  ]);

  // Real-time User GPS Position Streaming while on Commission (liveLocations/{uid})
  useEffect(() => {
    if (!myLiveGpsActive || !user) {
      if (myLiveWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(myLiveWatchIdRef.current);
        myLiveWatchIdRef.current = null;
      }
      myLiveCenteredOnceRef.current = false;
      return;
    }

    if (!navigator.geolocation) {
      showNotice('Este dispositivo o navegador no soporta GPS en tiempo real.');
      setMyLiveGpsActive(false);
      return;
    }

    const syncLocationToFirestore = async (
      lat: number,
      lng: number,
      accuracyMeters: number,
      speedKmh: number
    ) => {
      const linkedComm = commissions.find((c) => c.id === myLiveCommissionId);
      const docRef = doc(db, 'liveLocations', user.uid);
      const displayName = myOfficerDisplayLabel.slice(0, 100);
      const payload = {
        displayName,
        commissionId: linkedComm?.id || '',
        commissionCodigo: linkedComm?.codigo || '',
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        accuracyMeters: Math.min(50000, Math.max(0, Math.round(accuracyMeters))),
        speedKmh: Math.min(500, Math.max(0, Number(speedKmh.toFixed(1)))),
        enComision: true,
        updatedAt: serverTimestamp(),
      };

      try {
        if (myLiveDocExistsRef.current === null) {
          const snap = await getDoc(docRef);
          myLiveDocExistsRef.current = snap.exists();
        }
        if (myLiveDocExistsRef.current) {
          await updateDoc(docRef, payload);
        } else {
          await setDoc(docRef, {
            uid: user.uid,
            ownerId: user.uid,
            ...payload,
            createdAt: serverTimestamp(),
          });
          myLiveDocExistsRef.current = true;
        }

        // Also update linked commission marker if inside Trujillo bounds
        if (
          linkedComm &&
          linkedComm.estado !== 'finalizada' &&
          lat >= TRUJILLO_BOUNDS.minLat &&
          lat <= TRUJILLO_BOUNDS.maxLat &&
          lng >= TRUJILLO_BOUNDS.minLng &&
          lng <= TRUJILLO_BOUNDS.maxLng
        ) {
          const clamped = clampTrujilloCoords(lat, lng);
          await updateDoc(doc(db, 'commissions', linkedComm.id), {
            lat: clamped.lat,
            lng: clamped.lng,
            sector: linkedComm.sector,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `liveLocations/${user.uid}`);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracyMeters = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 25;
        const speedKmh =
          typeof pos.coords.speed === 'number' && pos.coords.speed > 0
            ? pos.coords.speed * 3.6
            : 0;

        setMyLivePos({ lat, lng, accuracyMeters, speedKmh });

        if (!myLiveCenteredOnceRef.current) {
          myLiveCenteredOnceRef.current = true;
          setFocusTarget({ lat, lng, zoom: 15, seq: Date.now() });
          showNotice('GPS en tiempo real activo. Tu posición de comisión es visible en el mapa.');
        }

        const now = Date.now();
        if (now - myLiveLastWriteRef.current >= 4000) {
          myLiveLastWriteRef.current = now;
          void syncLocationToFirestore(lat, lng, accuracyMeters, speedKmh);
        }
      },
      () => {
        showNotice('No se pudo activar tu GPS. Permite el acceso a la ubicación en tu navegador o teléfono.');
        setMyLiveGpsActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );

    myLiveWatchIdRef.current = watchId;
    return () => {
      navigator.geolocation.clearWatch(watchId);
      myLiveWatchIdRef.current = null;
    };
  }, [myLiveGpsActive, myLiveCommissionId, user, commissions, showNotice, myOfficerDisplayLabel]);

  const handleToggleMyLiveGps = useCallback(async () => {
    if (!user || !canOperateField) return;
    if (myLiveGpsActive) {
      setMyLiveGpsActive(false);
      try {
        const docRef = doc(db, 'liveLocations', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          await updateDoc(docRef, {
            enComision: false,
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Ignore offline deactivation error
      }
      void writeAuditLog({
        accion: 'gps_estado',
        entidad: 'sesion',
        entidadId: user.uid,
        resumen: 'Detuvo la transmisión de ubicación GPS en tiempo real.',
        severidad: 'normal',
      });
      showNotice('Transmisión de tu posición GPS en comisión detenida.');
    } else {
      myLiveLastWriteRef.current = 0;
      setMyLiveGpsActive(true);
      const linked = commissions.find((c) => c.id === myLiveCommissionId);
      void writeAuditLog({
        accion: 'gps_estado',
        entidad: 'sesion',
        entidadId: linked?.id || user.uid,
        resumen: linked
          ? `Activó GPS en tiempo real enlazado a comisión ${linked.codigo}.`
          : 'Activó GPS en tiempo real (patrullaje independiente).',
        severidad: 'normal',
      });
    }
  }, [
    myLiveGpsActive,
    user,
    canOperateField,
    showNotice,
    writeAuditLog,
    commissions,
    myLiveCommissionId,
  ]);

  // Active SOS support commissions
  const alertCommissions = useMemo(
    () =>
      commissions.filter(
        (c) => (c.alertaApoyo || c.estado === 'apoyo_requerido') && c.estado !== 'finalizada'
      ),
    [commissions]
  );

  // Real-time Device GPS Geolocation watcher (explicit user opt-in & revocable)
  useEffect(() => {
    if (!liveGpsCommissionId || !user) {
      if (gpsWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      showNotice('Este navegador no soporta geolocalización GPS en vivo.');
      setLiveGpsCommissionId(null);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;
        const inTrujillo =
          rawLat >= TRUJILLO_BOUNDS.minLat &&
          rawLat <= TRUJILLO_BOUNDS.maxLat &&
          rawLng >= TRUJILLO_BOUNDS.minLng &&
          rawLng <= TRUJILLO_BOUNDS.maxLng;

        if (!inTrujillo) {
          showNotice(
            'Tu ubicación GPS actual está fuera de Trujillo. Usa "Mover en Mapa" o "Simular Patrullaje" para pruebas en el estado.'
          );
          setLiveGpsCommissionId(null);
          return;
        }

        const clamped = clampTrujilloCoords(rawLat, rawLng);
        const target = commissions.find((c) => c.id === liveGpsCommissionId);
        if (!target || target.estado === 'finalizada') return;

        void updateDoc(doc(db, 'commissions', liveGpsCommissionId), {
          lat: clamped.lat,
          lng: clamped.lng,
          sector: target.sector,
          updatedAt: serverTimestamp(),
        }).catch((err) =>
          handleFirestoreError(err, OperationType.UPDATE, `commissions/${liveGpsCommissionId}`)
        );
      },
      () => {
        showNotice('Permiso de GPS denegado o señal no disponible.');
        setLiveGpsCommissionId(null);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );

    gpsWatchIdRef.current = watchId;
    return () => {
      navigator.geolocation.clearWatch(watchId);
      gpsWatchIdRef.current = null;
    };
  }, [liveGpsCommissionId, user, commissions, showNotice]);

  // Optional Tactical Patrol Live Movement Simulator (user-initiated)
  useEffect(() => {
    if (!patrolSimRunning || !user) return;
    const interval = setInterval(() => {
      const active = commissions.filter((c) => c.estado !== 'finalizada');
      active.forEach((c) => {
        const deltaLat = (Math.random() - 0.48) * 0.0045;
        const deltaLng =
          c.modalidad === 'lacustre'
            ? (Math.random() - 0.5) * 0.0025
            : (Math.random() - 0.5) * 0.0045;
        const next = clampTrujilloCoords(
          c.lat + deltaLat,
          c.modalidad === 'lacustre'
            ? Math.min(-71.076, Math.max(-71.135, c.lng + deltaLng))
            : c.lng + deltaLng
        );
        void updateDoc(doc(db, 'commissions', c.id), {
          lat: next.lat,
          lng: next.lng,
          sector: c.sector,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [patrolSimRunning, user, commissions]);

  // Officer Registration & Audited Sign-Out
  const handleSaveOfficerProfile = async (payload: OfficerRegistrationPayload) => {
    if (!user) return;
    const officerRef = doc(db, 'officers', user.uid);
    const wasComplete = Boolean(myOfficerProfile?.perfilCompleto);
    await updateDoc(officerRef, {
      displayName: payload.displayName.slice(0, 100),
      grado: payload.grado.slice(0, 40),
      cedula: payload.cedula.slice(0, 24),
      telefono: payload.telefono.slice(0, 24),
      cargo: payload.cargo.slice(0, 80),
      ...(payload.destacamento ? { destacamento: payload.destacamento } : {}),
      ...(payload.compania !== undefined ? { compania: payload.compania.slice(0, 80) } : {}),
      ...(payload.puesto !== undefined ? { puesto: payload.puesto.slice(0, 80) } : {}),
      perfilCompleto: true,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      accion: 'perfil_registrado',
      entidad: 'perfil',
      entidadId: user.uid,
      resumen: wasComplete
        ? `Actualizó credenciales de usuario: ${payload.grado} ${payload.displayName} (C.I. ${payload.cedula}) · ${payload.destacamento || 'CZGNB-23'} · ${payload.cargo}.`
        : `Completó registro obligatorio de usuario: ${payload.grado} ${payload.displayName} (C.I. ${payload.cedula}) · ${payload.destacamento || 'CZGNB-23'} · ${payload.cargo}.`,
      severidad: 'normal',
      actorOverride: {
        nombre: payload.displayName,
        grado: payload.grado,
        cedula: payload.cedula,
      },
    });
    showNotice(`Registro confirmado: ${payload.grado} ${payload.displayName}.`);
  };

  const handleSignOut = async () => {
    if (user && isAccessAuthorized) {
      await writeAuditLog({
        accion: 'sesion_cierre',
        entidad: 'sesion',
        entidadId: user.uid,
        resumen: `Cerró sesión de forma voluntaria (${user.email || 'usuario'}).`,
        severidad: 'normal',
      });
    }
    await signOut(auth);
  };

  // Pending user: submit identification so Command Admin sees full details in live alert
  const handleSubmitAccessRequest = async (payload: AccessRequestPayload) => {
    if (!user) return;
    const officerRef = doc(db, 'officers', user.uid);
    await updateDoc(officerRef, {
      displayName: payload.displayName.slice(0, 100),
      grado: payload.grado.slice(0, 40),
      cedula: payload.cedula.slice(0, 24),
      telefono: payload.telefono.slice(0, 24),
      cargo: payload.cargo.slice(0, 80),
      ...(payload.destacamento ? { destacamento: payload.destacamento } : {}),
      ...(payload.compania !== undefined ? { compania: payload.compania.slice(0, 80) } : {}),
      ...(payload.puesto !== undefined ? { puesto: payload.puesto.slice(0, 80) } : {}),
      solicitudNota: payload.solicitudNota.slice(0, 240),
      perfilCompleto: true,
      updatedAt: serverTimestamp(),
    });
  };

  // Pending user: atomic SHA-256 secret code redemption verified server-side by Firestore Rules
  const handleRedeemSecretCode = async (
    rawCode: string
  ): Promise<{ ok: boolean; message?: string }> => {
    if (!user || !user.email) {
      return { ok: false, message: 'Sesión no válida. Inicia sesión nuevamente.' };
    }
    try {
      const clean = normalizeSecretCode(rawCode);
      if (clean.length < 6) {
        return { ok: false, message: 'Ingresa el código secreto completo.' };
      }
      const codeHash = await hashSecretCode(clean);
      const batch = writeBatch(db);
      batch.update(doc(db, 'officers', user.uid), {
        accessStatus: 'autorizado',
        authorizedBy: 'codigo_secreto',
        authorizedCodeHash: codeHash,
        authorizedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'accessCodes', codeHash), {
        usedCount: increment(1),
        lastUsedByUid: user.uid,
        lastUsedByEmail: user.email.slice(0, 150),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      void writeAuditLog({
        accion: 'acceso_por_codigo',
        entidad: 'acceso',
        entidadId: user.uid,
        resumen: `Autorizó su ingreso mediante código secreto verificado (${user.email}).`,
        severidad: 'sensible',
      });
      showNotice('Código secreto verificado. Bienvenido al Comando de Zona Nro. 23 GNB Trujillo.');
      return { ok: true };
    } catch {
      return {
        ok: false,
        message:
          'Código secreto inválido, revocado o sin usos disponibles. Solicita autorización al Administrador.',
      };
    }
  };

  // Command Admin: approve pending officer with assigned privilege (defaults to 'operador')
  const handleApproveOfficer = async (
    officer: OfficerProfile,
    privilegio: OfficerPrivilege = 'operador'
  ) => {
    if (!user || !user.email || !isCommandAdmin) return;
    const safePrivilege: OfficerPrivilege =
      !isPrimaryAdmin && privilegio === 'administrador' ? 'operador' : privilegio;
    try {
      await updateDoc(doc(db, 'officers', officer.uid), {
        accessStatus: 'autorizado',
        privilegio: safePrivilege,
        privilegioActualizadoPor: user.email.slice(0, 150),
        privilegioActualizadoAt: serverTimestamp(),
        authorizedBy: user.email.slice(0, 150),
        authorizedAt: serverTimestamp(),
        expulsadoMotivo: '',
        expulsadoPor: '',
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'acceso_aprobado',
        entidad: 'acceso',
        entidadId: officer.uid,
        resumen: `Aprobó el ingreso de ${officer.grado ? `${officer.grado} ` : ''}${officer.displayName} (${officer.email}) con privilegio "${OFFICER_PRIVILEGE_LABELS[safePrivilege]}".`,
        severidad: 'sensible',
      });
      showNotice(
        `Acceso aprobado para ${officer.displayName} (${OFFICER_PRIVILEGE_LABELS[safePrivilege]}).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `officers/${officer.uid}`);
    }
  };

  // Command Admin: change user privilege level (consulta / operador / supervisor / administrador)
  const handleChangeOfficerPrivilege = async (
    officer: OfficerProfile,
    nextPrivilege: OfficerPrivilege
  ) => {
    if (!user || !user.email || !isCommandAdmin) return;
    if (officer.uid === user.uid || officer.email === 'donrafan@gmail.com') return;
    if (
      !isPrimaryAdmin &&
      (nextPrivilege === 'administrador' || officer.privilegio === 'administrador')
    ) {
      showNotice(
        'Solo el Administrador Principal (donrafan@gmail.com) puede asignar o modificar privilegios de Administrador.'
      );
      return;
    }
    const prevPrivilege: OfficerPrivilege = officer.privilegio ?? 'operador';
    if (prevPrivilege === nextPrivilege) return;

    try {
      await updateDoc(doc(db, 'officers', officer.uid), {
        privilegio: nextPrivilege,
        privilegioActualizadoPor: user.email.slice(0, 150),
        privilegioActualizadoAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'cambio_privilegio',
        entidad: 'acceso',
        entidadId: officer.uid,
        resumen: `Cambió privilegio de ${officer.grado ? `${officer.grado} ` : ''}${officer.displayName} (${officer.email}) de "${OFFICER_PRIVILEGE_LABELS[prevPrivilege]}" a "${OFFICER_PRIVILEGE_LABELS[nextPrivilege]}".`,
        severidad: 'sensible',
      });
      showNotice(
        `Privilegio de ${officer.displayName} actualizado a ${OFFICER_PRIVILEGE_LABELS[nextPrivilege]}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `officers/${officer.uid}`);
    }
  };

  // Command Admin: expel & immediately revoke access for any non-admin user
  const handleExpelOfficer = async (officer: OfficerProfile, motivo: string) => {
    if (!user || !isCommandAdmin) return;
    if (officer.uid === user.uid || officer.email === 'donrafan@gmail.com') return;
    if (!isPrimaryAdmin && officer.privilegio === 'administrador') return;
    const cleanReason = (motivo.trim() || 'Acceso no autorizado').slice(0, 240);
    try {
      await updateDoc(doc(db, 'officers', officer.uid), {
        accessStatus: 'expulsado',
        expulsadoMotivo: cleanReason,
        expulsadoPor: (user.email || 'admin').slice(0, 150),
        expulsadoAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Immediately clear live GPS telemetry if the expelled user was broadcasting
      try {
        await deleteDoc(doc(db, 'liveLocations', officer.uid));
      } catch {
        // Ignore if user has no active liveLocation document
      }
      void writeAuditLog({
        accion: 'acceso_expulsado',
        entidad: 'acceso',
        entidadId: officer.uid,
        resumen: `Expulsó y restringió a ${officer.grado ? `${officer.grado} ` : ''}${officer.displayName} (${officer.email}) · Motivo: ${cleanReason}.`,
        severidad: 'alerta_mal_uso',
      });
      showNotice(`Usuario ${officer.displayName} expulsado y bloqueado en tiempo real.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `officers/${officer.uid}`);
    }
  };

  // Command Admin: rehabilitate previously expelled user
  const handleRehabilitateOfficer = async (officer: OfficerProfile) => {
    if (!user || !isCommandAdmin) return;
    try {
      await updateDoc(doc(db, 'officers', officer.uid), {
        accessStatus: 'autorizado',
        authorizedBy: (user.email || 'admin').slice(0, 150),
        authorizedAt: serverTimestamp(),
        expulsadoMotivo: '',
        expulsadoPor: '',
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'acceso_rehabilitado',
        entidad: 'acceso',
        entidadId: officer.uid,
        resumen: `Rehabilitó el acceso de ${officer.grado ? `${officer.grado} ` : ''}${officer.displayName} (${officer.email}).`,
        severidad: 'sensible',
      });
      showNotice(`Acceso rehabilitado para ${officer.displayName}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `officers/${officer.uid}`);
    }
  };

  // Command Admin: create SHA-256 hash-indexed secret code
  const handleCreateAccessCode = async (payload: {
    label: string;
    rawCode: string;
    maxUses: number;
  }): Promise<{ ok: boolean; message?: string }> => {
    if (!user || !user.email || !isCommandAdmin) {
      return { ok: false, message: 'Solo el Administrador puede emitir códigos secretos.' };
    }
    try {
      const normalized = normalizeSecretCode(payload.rawCode);
      const codeHash = await hashSecretCode(normalized);
      const codeRef = doc(db, 'accessCodes', codeHash);
      const existing = await getDoc(codeRef);
      if (existing.exists()) {
        return {
          ok: false,
          message: 'Ese código secreto ya existe. Genera o escribe una clave distinta.',
        };
      }
      const cleanLabel = payload.label.trim().slice(0, 100);
      const safeMaxUses = Math.min(100, Math.max(1, Math.floor(payload.maxUses) || 1));
      const hint = maskSecretCode(normalized);

      await setDoc(codeRef, {
        codeHash,
        label: cleanLabel,
        codeHint: hint,
        active: true,
        maxUses: safeMaxUses,
        usedCount: 0,
        createdByUid: user.uid,
        createdByEmail: user.email.slice(0, 150),
        lastUsedByUid: '',
        lastUsedByEmail: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'codigo_secreto_creado',
        entidad: 'codigo_secreto',
        entidadId: codeHash.slice(0, 16),
        resumen: `Generó código secreto "${cleanLabel}" (${hint}) para ${safeMaxUses} ${
          safeMaxUses === 1 ? 'uso' : 'usos'
        }.`,
        severidad: 'sensible',
      });
      showNotice(`Código secreto "${cleanLabel}" generado y activo.`);
      return { ok: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'accessCodes');
      return { ok: false, message: 'No se pudo guardar el código secreto.' };
    }
  };

  // Command Admin: revoke / reactivate secret code
  const handleToggleAccessCodeActive = async (code: AccessCodeRecord) => {
    if (!user || !isCommandAdmin) return;
    try {
      const nextActive = !code.active;
      await updateDoc(doc(db, 'accessCodes', code.id), {
        active: nextActive,
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'codigo_secreto_revocado',
        entidad: 'codigo_secreto',
        entidadId: code.id.slice(0, 16),
        resumen: `${nextActive ? 'Reactivó' : 'Revocó'} código secreto "${code.label}" (${code.codeHint}).`,
        severidad: 'sensible',
      });
      showNotice(
        nextActive
          ? `Código "${code.label}" reactivado.`
          : `Código "${code.label}" revocado. Ya no permite nuevos ingresos.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `accessCodes/${code.id}`);
    }
  };

  // Command Admin: delete secret code
  const handleDeleteAccessCode = async (code: AccessCodeRecord) => {
    if (!user || !isCommandAdmin) return;
    try {
      await deleteDoc(doc(db, 'accessCodes', code.id));
      void writeAuditLog({
        accion: 'codigo_secreto_revocado',
        entidad: 'codigo_secreto',
        entidadId: code.id.slice(0, 16),
        resumen: `Eliminó código secreto "${code.label}" (${code.codeHint}).`,
        severidad: 'sensible',
      });
      showNotice(`Código "${code.label}" eliminado.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `accessCodes/${code.id}`);
    }
  };

  const openAuditModal = useCallback(
    (initialTab?: AuditModalTab) => {
      if (!isCommandAdmin) return;
      setAuditModalInitialTab(initialTab);
      setAuditModalOpen(true);
    },
    [isCommandAdmin]
  );

  // CRUD Handlers (all actions privilege-checked and automatically logged in immutable auditLogs)
  const handleSaveCommission = async (
    payload: CommissionFormPayload,
    existingId?: string
  ) => {
    if (!user || !canOperateField) return;
    if (existingId) {
      const targetComm = commissions.find((c) => c.id === existingId);
      if (targetComm && !canEditCatalogs && targetComm.ownerId !== user.uid) {
        showNotice('Solo el creador de la comisión o un Supervisor/Administrador puede editarla.');
        return;
      }
      try {
        await updateDoc(doc(db, 'commissions', existingId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        void writeAuditLog({
          accion: 'editar',
          entidad: 'commission',
          entidadId: existingId,
          resumen: `Editó comisión ${payload.codigo} (${payload.nombre}) · Sector: ${payload.sector} · Estado: ${COMMISSION_STATUS_LABELS[payload.estado]}.`,
          severidad: 'normal',
        });
        showNotice(`Comisión ${payload.codigo} actualizada.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `commissions/${existingId}`);
      }
    } else {
      const id = makeSafeId('com');
      try {
        await setDoc(doc(db, 'commissions', id), {
          ...payload,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        void writeAuditLog({
          accion: 'crear',
          entidad: 'commission',
          entidadId: id,
          resumen: `Desplegó comisión ${payload.codigo} (${payload.nombre}) · Jefe: ${payload.jefeGrado} ${payload.jefeNombre} · Sector: ${payload.sector}.`,
          severidad: 'normal',
        });
        setSelectedCommissionId(id);
        setFocusTarget({ lat: payload.lat, lng: payload.lng, zoom: 13, seq: Date.now() });
        showNotice(`Comisión ${payload.codigo} desplegada en el mapa.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `commissions/${id}`);
      }
    }
  };

  const handleDeleteCommission = async (comm: Commission) => {
    if (!canDeleteRecords) return;
    try {
      await deleteDoc(doc(db, 'commissions', comm.id));
      void writeAuditLog({
        accion: 'eliminar',
        entidad: 'commission',
        entidadId: comm.id,
        resumen: `Eliminó comisión ${comm.codigo} (${comm.nombre}) · Jefe: ${comm.jefeGrado} ${comm.jefeNombre} · Sector: ${comm.sector}.`,
        severidad: 'alerta_mal_uso',
      });
      if (selectedCommissionId === comm.id) setSelectedCommissionId(null);
      showNotice(`Comisión ${comm.codigo} eliminada.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `commissions/${comm.id}`);
    }
  };

  const handleRelocateCommission = async (coords: { lat: number; lng: number }) => {
    if (!user || !canOperateField || !selectedCommissionId) return;
    const comm = commissions.find((c) => c.id === selectedCommissionId);
    if (!comm || comm.estado === 'finalizada') return;
    if (!canEditCatalogs && comm.ownerId !== user.uid) {
      setMapMode('inspect');
      showNotice('Solo el responsable de la comisión o un Supervisor/Administrador puede reubicarla.');
      return;
    }
    try {
      await updateDoc(doc(db, 'commissions', comm.id), {
        lat: coords.lat,
        lng: coords.lng,
        sector: comm.sector,
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'editar',
        entidad: 'commission',
        entidadId: comm.id,
        resumen: `Reubicó en mapa la comisión ${comm.codigo} a ${formatCoords(coords.lat, coords.lng)}.`,
        severidad: 'normal',
      });
      setMapMode('inspect');
      showNotice(`Posición en tiempo real de ${comm.codigo} actualizada.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `commissions/${comm.id}`);
    }
  };

  const handleConfirmSupportAlert = async (
    comm: Commission,
    activate: boolean,
    motivo: string
  ) => {
    if (!user || !canOperateField) return;
    if (!canEditCatalogs && comm.ownerId !== user.uid) {
      showNotice('Solo el creador de la comisión o un Supervisor/Administrador puede activar/resolver el SOS.');
      return;
    }
    try {
      await updateDoc(doc(db, 'commissions', comm.id), {
        alertaApoyo: activate,
        motivoAlerta: activate ? motivo : '',
        estado: activate ? 'apoyo_requerido' : 'en_curso',
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'alerta_sos',
        entidad: 'commission',
        entidadId: comm.id,
        resumen: activate
          ? `Activó ALERTA SOS / APOYO para ${comm.codigo} (${comm.sector}): ${motivo || 'Sin motivo especificado'}.`
          : `Desactivó / resolvió alerta SOS para ${comm.codigo} (${comm.sector}).`,
        severidad: 'sensible',
      });
      showNotice(
        activate
          ? `ALERTA DE APOYO activada para ${comm.codigo}.`
          : `Alerta de apoyo resuelta para ${comm.codigo}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `commissions/${comm.id}`);
    }
  };

  const handleSaveIncident = async (payload: IncidentFormPayload) => {
    if (!user || !canOperateField) return;
    const id = makeSafeId('inc');
    try {
      await setDoc(doc(db, 'incidents', id), {
        ...payload,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const isHighImpact =
        payload.severidad === 'critica' ||
        isViolentIncidentType(payload.tipo) ||
        isPublicOrderIncidentType(payload.tipo) ||
        (payload.fallecidos ?? 0) > 0;
      const extraMeta = [
        payload.cuadrantePaz ? `Cuadrante ${payload.cuadrantePaz}` : '',
        payload.viaAfectada ? `Vía: ${payload.viaAfectada}` : '',
        payload.pasoHabilitado ? ROAD_ACCESS_STATUS_LABELS[payload.pasoHabilitado] : '',
        payload.servicioPublico ? `Servicio: ${payload.servicioPublico}` : '',
        (payload.personasConcentradas ?? 0) > 0 ? `~${payload.personasConcentradas} pers.` : '',
        (payload.fallecidos ?? 0) > 0 ? `Fallecidos: ${payload.fallecidos}` : '',
        (payload.lesionados ?? 0) > 0 ? `Lesionados: ${payload.lesionados}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      void writeAuditLog({
        accion: 'crear',
        entidad: 'incident',
        entidadId: id,
        resumen: `Registró novedad "${payload.titulo}" (${INCIDENT_TYPE_LABELS[payload.tipo]}) en ${payload.municipio} · ${payload.sector}${extraMeta ? ` (${extraMeta})` : ''}.`,
        severidad: isHighImpact ? 'sensible' : 'normal',
      });
      setMapMode('inspect');
      setFocusTarget({ lat: payload.lat, lng: payload.lng, zoom: 13, seq: Date.now() });
      showNotice(`Novedad "${payload.titulo}" registrada y georreferenciada.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `incidents/${id}`);
    }
  };

  const handleUpdateIncidentStatus = async (inc: Incident, estado: IncidentStatus) => {
    if (!user || !canOperateField) return;
    if (!canEditCatalogs && inc.ownerId !== user.uid) {
      showNotice('Solo el creador de la novedad o un Supervisor/Administrador puede cambiar su estado.');
      return;
    }
    try {
      await updateDoc(doc(db, 'incidents', inc.id), {
        estado,
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'cambio_estado',
        entidad: 'incident',
        entidadId: inc.id,
        resumen: `Cambió estado de novedad "${inc.titulo}" (${inc.sector}) a "${estado}".`,
        severidad: 'sensible',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${inc.id}`);
    }
  };

  const handleMarkPublicOrderCleared = async (inc: Incident) => {
    if (!user || !canOperateField) return;
    if (!canEditCatalogs && inc.ownerId !== user.uid) {
      showNotice('Solo el creador de la alerta o un Supervisor/Administrador puede marcar la vía despejada.');
      return;
    }
    try {
      await updateDoc(doc(db, 'incidents', inc.id), {
        estado: 'cerrada',
        pasoHabilitado: 'via_libre',
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'cambio_estado',
        entidad: 'incident',
        entidadId: inc.id,
        resumen: `Marcó vía despejada y cerró alerta de orden público "${inc.titulo}" (${inc.municipio} · ${inc.viaAfectada || inc.sector}).`,
        severidad: 'sensible',
      });
      showNotice(`Alerta "${inc.titulo}" marcada como vía despejada.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${inc.id}`);
    }
  };

  const handleDeleteIncident = async (inc: Incident) => {
    if (!canDeleteRecords) return;
    try {
      await deleteDoc(doc(db, 'incidents', inc.id));
      void writeAuditLog({
        accion: 'eliminar',
        entidad: 'incident',
        entidadId: inc.id,
        resumen: `Eliminó novedad "${inc.titulo}" (${INCIDENT_TYPE_LABELS[inc.tipo]}) de ${inc.municipio} · ${inc.sector}.`,
        severidad: 'alerta_mal_uso',
      });
      showNotice('Novedad eliminada del mapa de criminalidad.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `incidents/${inc.id}`);
    }
  };

  const handleSavePatrolPoint = async (payload: PatrolPointFormPayload) => {
    if (!user || !canOperateField) return;
    const id = makeSafeId('pat');
    try {
      await setDoc(doc(db, 'patrolPoints', id), {
        ...payload,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'crear',
        entidad: 'patrolPoint',
        entidadId: id,
        resumen: `Registró punto patrullado "${payload.titulo}"${payload.cuadrantePaz ? ` (${payload.cuadrantePaz})` : ''} en ${payload.municipio} · ${payload.sector}.`,
        severidad: 'normal',
      });
      setMapMode('inspect');
      setFocusTarget({ lat: payload.lat, lng: payload.lng, zoom: 14, seq: Date.now() });
      showNotice(
        `Punto patrullado "${payload.titulo}"${payload.cuadrantePaz ? ` (${payload.cuadrantePaz})` : ''} registrado en el mapa.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `patrolPoints/${id}`);
    }
  };

  const handleDeletePatrolPoint = async (pt: PatrolPoint) => {
    if (!canDeleteRecords) return;
    try {
      await deleteDoc(doc(db, 'patrolPoints', pt.id));
      void writeAuditLog({
        accion: 'eliminar',
        entidad: 'patrolPoint',
        entidadId: pt.id,
        resumen: `Eliminó punto patrullado "${pt.titulo}" (${pt.municipio} · ${pt.sector}).`,
        severidad: 'alerta_mal_uso',
      });
      showNotice('Punto patrullado eliminado.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `patrolPoints/${pt.id}`);
    }
  };

  const handleSaveGangZone = async (payload: GangFormPayload, existingId?: string) => {
    if (!user || !canOperateField) return;
    if (existingId) {
      const target = gangZones.find((z) => z.id === existingId);
      if (!target || (!canEditCatalogs && target.ownerId !== user.uid)) return;
      try {
        await updateDoc(doc(db, 'gangZones', existingId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        void writeAuditLog({
          accion: 'editar',
          entidad: 'gangZone',
          entidadId: existingId,
          resumen: `Editó zona de amenaza "${payload.nombre}" (${payload.sector}) · Amenaza: ${payload.nivelAmenaza}.`,
          severidad: 'normal',
        });
        showNotice(`Zona de amenaza "${payload.nombre}" actualizada para todos los usuarios.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `gangZones/${existingId}`);
      }
      return;
    }

    const id = makeSafeId('gz');
    try {
      await setDoc(doc(db, 'gangZones', id), {
        ...payload,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'crear',
        entidad: 'gangZone',
        entidadId: id,
        resumen: `Registró zona de amenaza "${payload.nombre}" (${payload.sector}) · Amenaza: ${payload.nivelAmenaza}.`,
        severidad: 'normal',
      });
      showNotice(`Zona de amenaza "${payload.nombre}" registrada y visible para todos los usuarios.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `gangZones/${id}`);
    }
  };

  const handleToggleGangActive = async (zone: GangZone) => {
    if (!user || !canOperateField) return;
    if (!canEditCatalogs && zone.ownerId !== user.uid) return;
    try {
      await updateDoc(doc(db, 'gangZones', zone.id), {
        activa: !zone.activa,
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'cambio_estado',
        entidad: 'gangZone',
        entidadId: zone.id,
        resumen: `${zone.activa ? 'Desactivó' : 'Activó'} zona de amenaza "${zone.nombre}" (${zone.sector}).`,
        severidad: 'sensible',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `gangZones/${zone.id}`);
    }
  };

  const handleDeleteGangZone = async (zone: GangZone) => {
    if (!user || !canEditCatalogs) return;
    if (!isCommandAdmin && zone.ownerId !== user.uid) return;
    try {
      await deleteDoc(doc(db, 'gangZones', zone.id));
      void writeAuditLog({
        accion: 'eliminar',
        entidad: 'gangZone',
        entidadId: zone.id,
        resumen: `Eliminó zona de amenaza "${zone.nombre}" (${zone.sector}).`,
        severidad: 'alerta_mal_uso',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `gangZones/${zone.id}`);
    }
  };

  const handleSaveFriendlyForce = async (
    payload: FriendlyForceFormPayload,
    existingId?: string
  ) => {
    if (!user || !canOperateField) return;
    if (existingId) {
      const target = friendlyForces.find((f) => f.id === existingId);
      if (!target || (!canEditCatalogs && target.ownerId !== user.uid)) return;
      try {
        await updateDoc(doc(db, 'friendlyForces', existingId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        void writeAuditLog({
          accion: 'editar',
          entidad: 'friendlyForce',
          entidadId: existingId,
          resumen: `Editó fuerza amiga "${payload.nombre}" (${payload.organismo}) en ${payload.sector}.`,
          severidad: 'normal',
        });
        showNotice(`Fuerza amiga "${payload.nombre}" actualizada para todos los usuarios.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `friendlyForces/${existingId}`);
      }
      return;
    }

    const id = makeSafeId('ff');
    try {
      await setDoc(doc(db, 'friendlyForces', id), {
        ...payload,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'crear',
        entidad: 'friendlyForce',
        entidadId: id,
        resumen: `Registró fuerza amiga "${payload.nombre}" (${payload.organismo}) en ${payload.sector}.`,
        severidad: 'normal',
      });
      showNotice(`Fuerza amiga "${payload.nombre}" registrada y visible para todos los usuarios.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `friendlyForces/${id}`);
    }
  };

  const handleToggleForceAvailable = async (force: FriendlyForce) => {
    if (!user || !canOperateField) return;
    if (!canEditCatalogs && force.ownerId !== user.uid) return;
    try {
      await updateDoc(doc(db, 'friendlyForces', force.id), {
        disponible: !force.disponible,
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'cambio_estado',
        entidad: 'friendlyForce',
        entidadId: force.id,
        resumen: `Marcó fuerza amiga "${force.nombre}" como ${force.disponible ? 'no disponible' : 'disponible'}.`,
        severidad: 'normal',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `friendlyForces/${force.id}`);
    }
  };

  const handleDeleteFriendlyForce = async (force: FriendlyForce) => {
    if (!user || !canEditCatalogs) return;
    if (!isCommandAdmin && force.ownerId !== user.uid) return;
    try {
      await deleteDoc(doc(db, 'friendlyForces', force.id));
      void writeAuditLog({
        accion: 'eliminar',
        entidad: 'friendlyForce',
        entidadId: force.id,
        resumen: `Eliminó fuerza amiga "${force.nombre}" (${force.organismo} · ${force.sector}).`,
        severidad: 'alerta_mal_uso',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `friendlyForces/${force.id}`);
    }
  };

  const handleSaveVerificationLog = async (payload: VerificationLogFormPayload) => {
    if (!user || !canOperateField) return;
    const id = makeSafeId('ver');
    try {
      await setDoc(doc(db, 'verificationLogs', id), {
        ...payload,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'crear',
        entidad: 'verificationLog',
        entidadId: id,
        resumen: `Verificó ${payload.tipo} ${payload.identificador} (${payload.nombreDescripcion}) · Resultado: ${payload.resultado} · Sector: ${payload.sector}.`,
        severidad:
          payload.resultado === 'solicitado' || payload.resultado === 'retenido'
            ? 'sensible'
            : 'normal',
      });
      showNotice(
        `Verificación de ${payload.identificador} guardada en la Base de Datos de Verificados.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `verificationLogs/${id}`);
      throw err;
    }
  };

  const handleUpdateVerificationResult = async (
    log: VerificationLog,
    resultado: VerificationResult
  ) => {
    if (!canOperateField) return;
    try {
      await updateDoc(doc(db, 'verificationLogs', log.id), {
        resultado,
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'cambio_estado',
        entidad: 'verificationLog',
        entidadId: log.id,
        resumen: `Modificó resultado de verificación de ${log.identificador} (${log.nombreDescripcion}) de "${log.resultado}" a "${resultado}".`,
        severidad: 'sensible',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `verificationLogs/${log.id}`);
    }
  };

  const handleDeleteVerificationLog = async (log: VerificationLog) => {
    if (!canDeleteRecords) return;
    try {
      await deleteDoc(doc(db, 'verificationLogs', log.id));
      void writeAuditLog({
        accion: 'eliminar',
        entidad: 'verificationLog',
        entidadId: log.id,
        resumen: `Eliminó registro de verificación de ${log.tipo} ${log.identificador} (${log.nombreDescripcion} · Resultado: ${log.resultado}).`,
        severidad: 'alerta_mal_uso',
      });
      showNotice(`Registro de verificación ${log.identificador} eliminado.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `verificationLogs/${log.id}`);
    }
  };

  const handleSaveWantedRecord = async (payload: WantedRecordFormPayload) => {
    if (!user || !canEditCatalogs) return;
    const id = makeSafeId('wnt');
    try {
      await setDoc(doc(db, 'wantedRecords', id), {
        ...payload,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'crear',
        entidad: 'wantedRecord',
        entidadId: id,
        resumen: `Cargó orden judicial de solicitado (${payload.tipo}) ${payload.identificador} — ${payload.nombreDescripcion} · Delito: ${payload.delito}.`,
        severidad: 'sensible',
      });
      showNotice(`Orden judicial para ${payload.identificador} cargada en la base de solicitados.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `wantedRecords/${id}`);
      throw err;
    }
  };

  const handleToggleWantedStatus = async (record: WantedRecord) => {
    if (!canEditCatalogs) return;
    const nextEstado =
      record.estado === 'solicitado' ? 'capturado_recuperado' : 'solicitado';
    try {
      await updateDoc(doc(db, 'wantedRecords', record.id), {
        estado: nextEstado,
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'cambio_estado',
        entidad: 'wantedRecord',
        entidadId: record.id,
        resumen:
          nextEstado === 'capturado_recuperado'
            ? `Marcó orden judicial ${record.identificador} (${record.nombreDescripcion}) como capturado / recuperado.`
            : `Reactivó orden judicial de solicitado para ${record.identificador} (${record.nombreDescripcion}).`,
        severidad: 'sensible',
      });
      showNotice(
        nextEstado === 'capturado_recuperado'
          ? `${record.identificador} marcado como capturado / recuperado.`
          : `Orden judicial reactivada para ${record.identificador}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `wantedRecords/${record.id}`);
    }
  };

  const handleDeleteWantedRecord = async (record: WantedRecord) => {
    if (!canEditCatalogs) return;
    try {
      await deleteDoc(doc(db, 'wantedRecords', record.id));
      void writeAuditLog({
        accion: 'eliminar',
        entidad: 'wantedRecord',
        entidadId: record.id,
        resumen: `Eliminó orden judicial de solicitado ${record.identificador} (${record.nombreDescripcion} · Exp. ${record.expediente}).`,
        severidad: 'alerta_mal_uso',
      });
      showNotice(`Registro de solicitado ${record.identificador} eliminado.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `wantedRecords/${record.id}`);
    }
  };

  // CZGNB-23 Organic Units CRUD (shared across all authorized users)
  const handleSaveZoneUnit = async (
    values: ZoneUnitFormValues,
    editingId?: string
  ) => {
    if (!user || !canOperateField) return;
    const isExistingRealDoc = Boolean(editingId && !editingId.startsWith('cz23_ref_'));
    if (isExistingRealDoc && editingId) {
      const target = zoneUnits.find((u) => u.id === editingId);
      if (!target || (!canEditCatalogs && target.ownerId !== user.uid)) return;
      try {
        await updateDoc(doc(db, 'zoneUnits', editingId), {
          ...values,
          updatedAt: serverTimestamp(),
        });
        void writeAuditLog({
          accion: 'editar',
          entidad: 'zoneUnit',
          entidadId: editingId,
          resumen: `Editó unidad orgánica ${values.codigo} (${values.nombre}) · ${DESTACAMENTO_META[values.destacamento].shortLabel} · ${ZONE_UNIT_LEVEL_LABELS[values.nivel]}.`,
          severidad: 'normal',
        });
        showNotice(`Unidad ${values.codigo} actualizada para todo el CZGNB-23.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `zoneUnits/${editingId}`);
        throw err;
      }
      return;
    }

    const id = makeSafeId('cz23');
    try {
      await setDoc(doc(db, 'zoneUnits', id), {
        ...values,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'crear',
        entidad: 'zoneUnit',
        entidadId: id,
        resumen: `Registró unidad orgánica ${values.codigo} (${values.nombre}) · ${DESTACAMENTO_META[values.destacamento].shortLabel} · ${values.municipio}.`,
        severidad: 'normal',
      });
      setFocusTarget({ lat: values.lat, lng: values.lng, zoom: 14, seq: Date.now() });
      showNotice(`Unidad ${values.codigo} registrada y visible para todos los usuarios.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `zoneUnits/${id}`);
      throw err;
    }
  };

  const handleChangeZoneUnitStatus = async (
    unit: ZoneUnit,
    nextStatus: ZoneUnitStatus
  ) => {
    if (!user || !canOperateField) return;
    if (unit.id.startsWith('cz23_ref_')) {
      showNotice('Sincronizando estructura inicial del CZGNB-23, intenta en unos segundos.');
      return;
    }
    if (!canEditCatalogs && unit.ownerId !== user.uid) return;
    try {
      await updateDoc(doc(db, 'zoneUnits', unit.id), {
        estadoOperativo: nextStatus,
        updatedAt: serverTimestamp(),
      });
      void writeAuditLog({
        accion: 'cambio_estado',
        entidad: 'zoneUnit',
        entidadId: unit.id,
        resumen: `Cambió estado de ${unit.codigo} (${unit.nombre}) a "${ZONE_UNIT_STATUS_LABELS[nextStatus]}".`,
        severidad: nextStatus === 'alerta' ? 'sensible' : 'normal',
      });
      showNotice(`${unit.codigo} marcado como ${ZONE_UNIT_STATUS_LABELS[nextStatus]}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `zoneUnits/${unit.id}`);
    }
  };

  const handleDeleteZoneUnit = async (unit: ZoneUnit) => {
    if (!user || !canEditCatalogs) return;
    if (unit.id.startsWith('cz23_ref_')) return;
    if (!isCommandAdmin && unit.ownerId !== user.uid) return;
    try {
      await deleteDoc(doc(db, 'zoneUnits', unit.id));
      void writeAuditLog({
        accion: 'eliminar',
        entidad: 'zoneUnit',
        entidadId: unit.id,
        resumen: `Eliminó unidad orgánica ${unit.codigo} (${unit.nombre}) de ${DESTACAMENTO_META[unit.destacamento].shortLabel}.`,
        severidad: 'alerta_mal_uso',
      });
      showNotice(`Unidad ${unit.codigo} eliminada del despliegue orgánico.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `zoneUnits/${unit.id}`);
    }
  };

  const handleLocateZoneUnitOnMap = useCallback((unit: ZoneUnit) => {
    setLayers((prev) => ({ ...prev, zoneUnits: true }));
    setActiveTab('mapa');
    setMobileMapPane('mapa');
    setFocusTarget({ lat: unit.lat, lng: unit.lng, zoom: 14, seq: Date.now() });
  }, []);

  const handleDeployCommissionFromUnit = useCallback(
    (unit: ZoneUnit) => {
      if (!canOperateField) return;
      setCommissionModal({ open: true, editing: null, prefillUnit: unit });
    },
    [canOperateField]
  );

  const selectedCommission = useMemo(
    () => commissions.find((c) => c.id === selectedCommissionId) ?? null,
    [commissions, selectedCommissionId]
  );

  const filteredMapCommissions = useMemo(() => {
    if (selectedDestacamento === 'ALL') return commissions;
    return commissions.filter(
      (c) =>
        c.alertaApoyo ||
        c.estado === 'apoyo_requerido' ||
        c.destacamento === selectedDestacamento
    );
  }, [commissions, selectedDestacamento]);

  const railCommissions = useMemo(() => {
    const q = railSearch.trim().toLowerCase();
    return commissions.filter((c) => {
      if (selectedDestacamento !== 'ALL' && c.destacamento !== selectedDestacamento) {
        return false;
      }
      if (railModeFilter !== 'all' && c.modalidad !== railModeFilter) return false;
      if (!q) return true;
      return (
        c.codigo.toLowerCase().includes(q) ||
        c.nombre.toLowerCase().includes(q) ||
        c.jefeNombre.toLowerCase().includes(q) ||
        c.sector.toLowerCase().includes(q) ||
        (c.compania || '').toLowerCase().includes(q) ||
        (c.puesto || '').toLowerCase().includes(q) ||
        c.armamento.some((w) => w.serial.toLowerCase().includes(q))
      );
    });
  }, [commissions, railSearch, railModeFilter, selectedDestacamento]);

  const nextCommissionCode = useMemo(() => {
    const num = commissions.length + 1;
    const prefix =
      selectedDestacamento === 'D-231'
        ? 'COM-D231'
        : selectedDestacamento === 'DCR-23-1'
          ? 'COM-DCR231'
          : selectedDestacamento === 'DESUR-23'
            ? 'COM-DESUR23'
            : 'COM-CZ23';
    return `${prefix}-${String(num).padStart(2, '0')}`;
  }, [commissions.length, selectedDestacamento]);

  const focusOnCoords = useCallback((lat: number, lng: number, zoom = 13) => {
    setActiveTab('mapa');
    setMobileMapPane('mapa');
    setFocusTarget({ lat, lng, zoom, seq: Date.now() });
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-[100dvh] bg-[#0B1117] flex items-center justify-center text-slate-400 text-sm">
        Inicializando Comando de Zona Nro. 23 GNB — Estado Trujillo...
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  if (myAccessStatus === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-[#0B1117] flex items-center justify-center text-slate-400 text-sm">
        Verificando autorización de acceso — CZGNB-23 Trujillo...
      </div>
    );
  }

  if (myAccessStatus === 'pendiente' || myAccessStatus === 'expulsado') {
    return (
      <AccessGateScreen
        mode={myAccessStatus}
        email={user.email || ''}
        defaultDisplayName={user.displayName || ''}
        profile={myOwnOfficerDoc}
        onSubmitRequestDetails={handleSubmitAccessRequest}
        onRedeemSecretCode={handleRedeemSecretCode}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col bg-[#0B1117] text-[#F1F5F9] overflow-hidden">
      {/* Mandatory Demo Key Quota Notice Banner */}
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract — Comando de Zona Nro. 23 GNB Trujillo */}
      <header className="h-13 md:h-14 bg-[#0E151E] border-b border-slate-800 px-3.5 md:px-5 flex items-center justify-between gap-3 md:gap-6 shrink-0 z-30">
        <button
          type="button"
          onClick={() => {
            setActiveTab('mapa');
            setMobileMapPane('mapa');
          }}
          className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer text-left"
        >
          <img
            src="/assets/aistudio/ESCUDO_DCR23-1_11250c43.png"
            alt="Escudo Comando de Zona Nro. 23 GNB Trujillo"
            className="w-9 h-9 md:w-10 md:h-10 object-contain shrink-0 drop-shadow"
          />
          <div className="leading-tight">
            <span className="block font-display text-base md:text-lg font-bold tracking-wide text-white">
              CZGNB-23 Trujillo
            </span>
            <span className="hidden sm:block text-[10px] font-medium text-emerald-400/90 tracking-wide">
              Comando de Zona Nro. 23 GNB
            </span>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-4 lg:gap-5 text-sm font-medium text-slate-400">
          {(
            [
              { id: 'mapa', label: 'Mapa' },
              { id: 'unidades', label: 'Unidades CZ-23' },
              { id: 'comisiones', label: 'Comisiones' },
              { id: 'verificacion', label: 'Verificación' },
              { id: 'criminalidad', label: 'Criminalidad' },
              { id: 'inteligencia', label: 'Inteligencia' },
            ] as const
          ).map((navItem) => (
            <button
              key={navItem.id}
              type="button"
              onClick={() => setActiveTab(navItem.id)}
              className={`h-14 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === navItem.id
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent hover:text-slate-200'
              }`}
            >
              {navItem.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {isCommandAdmin && (
            <button
              type="button"
              onClick={() =>
                openAuditModal(pendingOfficers.length > 0 ? 'control_acceso' : 'usuarios')
              }
              className={`relative inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold border rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                pendingOfficers.length > 0
                  ? 'bg-amber-950/90 hover:bg-amber-900 border-amber-500/80 text-amber-100'
                  : 'text-slate-200 hover:text-white bg-[#16202E] hover:bg-[#1E2C3E] border-slate-700/80'
              }`}
              title="Usuarios, Privilegios, Control de Acceso y Auditoría (Solo Administrador)"
            >
              <ClipboardList
                className={`w-3.5 h-3.5 ${
                  pendingOfficers.length > 0 ? 'text-amber-300' : 'text-emerald-400'
                }`}
              />
              <span className="hidden lg:inline">
                Usuarios y Privilegios ({officers.length})
              </span>
              {pendingOfficers.length > 0 ? (
                <span className="font-mono-tabular min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold inline-flex items-center justify-center animate-pulse">
                  {pendingOfficers.length}
                </span>
              ) : (
                auditLogs.some((l) => l.severidad === 'alerta_mal_uso') && (
                  <span
                    className="w-2 h-2 rounded-full bg-red-500"
                    aria-label="Alertas de auditoría registradas"
                  />
                )
              )}
            </button>
          )}
          <NotificationBellMenu
            permission={pushPermission}
            prefs={pushPrefs}
            alerts={alertHistory}
            onRequestPermission={handleRequestPushPermission}
            onUpdatePrefs={handleUpdatePushPrefs}
            onSendTestAlert={handleSendTestPushAlert}
            onLocateAlert={focusAlertOnMap}
            onOpenAccessControl={
              isCommandAdmin ? () => openAuditModal('control_acceso') : undefined
            }
            onMarkAllRead={() =>
              setAlertHistory((prev) => prev.map((a) => ({ ...a, read: true })))
            }
            onClearAlerts={() => setAlertHistory([])}
          />
          <button
            type="button"
            onClick={() => setHelpModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-[#16202E] hover:bg-[#1E2C3E] border border-slate-700/80 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Ayuda — Manual de uso de la aplicación"
            aria-label="Abrir ayuda y guía de uso"
          >
            <HelpCircle className="w-4 h-4 text-sky-400" />
            <span className="hidden xl:inline">Ayuda</span>
          </button>
          {canOperateField && (
            <button
              type="button"
              onClick={() => setCommissionModal({ open: true, editing: null })}
              className="inline-flex items-center gap-1.5 px-3 md:px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nueva Comisión</span>
              <span className="sm:hidden">Comisión</span>
            </button>
          )}
        </div>
      </header>

      {/* Active Emergency Support Banner (SOS) */}
      <EmergencyBanner
        alertCommissions={alertCommissions}
        allCommissions={commissions}
        friendlyForces={friendlyForces}
        canOperate={canOperateField}
        muted={alertMuted}
        onToggleMute={() => setAlertMuted((m) => !m)}
        onLocate={(comm) => {
          setSelectedCommissionId(comm.id);
          focusOnCoords(comm.lat, comm.lng, 14);
        }}
        onResolveAlert={(comm) => {
          void handleConfirmSupportAlert(comm, false, '');
        }}
        onShareAlert={(comm) => setShareCommission(comm)}
      />

      {/* Active Public Order / Manifestations & Public-Service Road Closures Banner */}
      <PublicOrderAlertBanner
        activeAlerts={incidents.filter(
          (inc) => isPublicOrderIncidentType(inc.tipo) && inc.estado !== 'cerrada'
        )}
        canOperate={canOperateField}
        onLocate={(inc) => focusOnCoords(inc.lat, inc.lng, 14)}
        onMarkRoadCleared={handleMarkPublicOrderCleared}
      />

      {/* Real-Time Pending Access Requests Alert Banner (Command Admin Only) */}
      {isCommandAdmin && pendingOfficers.length > 0 && (
        <PendingAccessBanner
          pendingOfficers={pendingOfficers}
          onApprove={handleApproveOfficer}
          onExpel={handleExpelOfficer}
          onOpenAccessPanel={() => openAuditModal('control_acceso')}
        />
      )}

      {/* Non-intrusive Operational Toast */}
      {notice && (
        <div className="bg-[#162231] border-b border-emerald-500/40 px-4 py-1.5 text-xs text-emerald-200 text-center shrink-0">
          {notice}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeTab === 'mapa' ? (
          <>
            {/* Mobile Sub-View Switcher + Quick Phone Install CTA */}
            <div className="lg:hidden bg-[#0E151E] border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center bg-[#0B1117] border border-slate-800 rounded-md p-0.5 flex-1">
                {(
                  [
                    { id: 'mapa', label: 'Mapa' },
                    { id: 'lista', label: `Lista (${commissions.length})` },
                    { id: 'detalle', label: 'Detalle' },
                  ] as const
                ).map((pane) => (
                  <button
                    key={pane.id}
                    type="button"
                    onClick={() => setMobileMapPane(pane.id)}
                    className={`flex-1 min-h-[36px] text-xs font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                      mobileMapPane === pane.id
                        ? 'bg-[#1F2D40] text-white'
                        : 'text-slate-400'
                    }`}
                  >
                    {pane.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ShareAppButton compact canEditShareLink={isCommandAdmin} />
              </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Left Command Rail: Simultaneous Commissions List */}
              <aside
                className={`${
                  mobileMapPane === 'lista' ? 'flex' : 'hidden'
                } lg:flex lg:col-span-3 xl:col-span-3 h-full bg-[#111822] border-r border-slate-800 flex-col overflow-hidden`}
              >
              <div className="p-3.5 border-b border-slate-800 space-y-2.5 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white leading-none">
                      Comisiones Activas ({commissions.filter((c) => c.estado !== 'finalizada').length})
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Trujillo · Tierra y Vía Lacustre
                    </p>
                  </div>
                  {canOperateField && (
                    <button
                      type="button"
                      onClick={() => setPatrolSimRunning((v) => !v)}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded border transition-colors cursor-pointer whitespace-nowrap ${
                        patrolSimRunning
                          ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300'
                          : 'bg-[#192332] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                      title="Simular desplazamiento GPS en vivo de las comisiones"
                    >
                      {patrolSimRunning ? (
                        <>
                          <Square className="w-3 h-3" />
                          Pausar Demo
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          Simular GPS
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Real-Time User Position While on Commission Control */}
                {canOperateField ? (
                  <div
                    className={`rounded-md border p-2.5 space-y-2 ${
                      myLiveGpsActive
                        ? 'bg-cyan-950/35 border-cyan-500/50'
                        : 'bg-[#0B1117] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-200 min-w-0">
                        <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">Posición GPS en Comisión</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleToggleMyLiveGps()}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          myLiveGpsActive
                            ? 'bg-red-700 hover:bg-red-600 text-white'
                            : 'bg-cyan-700 hover:bg-cyan-600 text-white'
                        }`}
                      >
                        {myLiveGpsActive ? 'Detener' : 'Activar GPS'}
                      </button>
                    </div>

                    <select
                      aria-label="Asociar mi GPS a comisión"
                      value={myLiveCommissionId}
                      onChange={(e) => setMyLiveCommissionId(e.target.value)}
                      className="w-full bg-[#111822] border border-slate-700/80 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="">Patrullaje Independiente (Solo mi usuario)</option>
                      {commissions
                        .filter((c) => c.estado !== 'finalizada')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            Enlazar con {c.codigo} — {c.jefeGrado} {c.jefeNombre}
                          </option>
                        ))}
                    </select>

                    {myLiveGpsActive && myLivePos && (
                      <div className="space-y-1.5 pt-1 border-t border-cyan-900/60">
                        <div className="flex items-center justify-between text-[10px] font-mono-tabular text-cyan-200">
                          <span>{formatCoords(myLivePos.lat, myLivePos.lng)}</span>
                          <span>±{Math.round(myLivePos.accuracyMeters)}m</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => focusOnCoords(myLivePos.lat, myLivePos.lng, 15)}
                            className="py-1 text-[11px] font-semibold bg-[#162332] hover:bg-[#1E3044] text-cyan-100 rounded cursor-pointer"
                          >
                            Ubicarme
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPatrolModal({
                                open: true,
                                coords: { lat: myLivePos.lat, lng: myLivePos.lng },
                                commissionId: myLiveCommissionId || selectedCommissionId || '',
                              })
                            }
                            className="inline-flex items-center justify-center gap-1 py-1 text-[11px] font-semibold bg-teal-700 hover:bg-teal-600 text-white rounded cursor-pointer"
                          >
                            <ClipboardCheck className="w-3 h-3" />
                            Patrullaje Aquí
                          </button>
                        </div>
                      </div>
                    )}

                    {liveLocations.filter((l) => l.enComision).length > 0 && (
                      <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                        <div className="text-[10px] text-slate-400 font-semibold">
                          Usuarios Transmitiendo en Vivo ({liveLocations.filter((l) => l.enComision).length})
                        </div>
                        {liveLocations
                          .filter((l) => l.enComision)
                          .map((loc) => (
                            <button
                              key={loc.id}
                              type="button"
                              onClick={() => focusOnCoords(loc.lat, loc.lng, 15)}
                              className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#111822] hover:bg-[#192434] text-[11px] text-left cursor-pointer"
                            >
                              <span className="text-cyan-200 font-medium truncate">
                                {loc.displayName}
                                {loc.commissionCodigo ? ` (${loc.commissionCodigo})` : ''}
                              </span>
                              <span className="font-mono-tabular text-[10px] text-slate-400 shrink-0">
                                Ver
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-slate-800 bg-[#0B1117] p-2.5 text-[11px] text-slate-400">
                    <div className="font-semibold text-slate-200">Modo Solo Consulta</div>
                    <p className="mt-0.5 text-[10px] leading-relaxed">
                      Tu cuenta tiene permiso de lectura. El Administrador puede ampliar tus privilegios si necesitas operar en campo.
                    </p>
                  </div>
                )}

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={railSearch}
                    onChange={(e) => setRailSearch(e.target.value)}
                    placeholder="Buscar comisión, unidad, jefe o serial..."
                    className="w-full bg-[#0B1117] border border-slate-800 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* CZGNB-23 Destacamento Filter Bar */}
                <div className="grid grid-cols-4 gap-1 bg-[#0B1117] border border-slate-800 rounded-md p-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDestacamento('ALL')}
                    className={`py-1 text-[10px] font-semibold rounded transition-colors cursor-pointer ${
                      selectedDestacamento === 'ALL'
                        ? 'bg-[#7F1D1D] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    CZ-23
                  </button>
                  {OPERATIONAL_DESTACAMENTOS.map((destId) => {
                    const meta = DESTACAMENTO_META[destId];
                    const active = selectedDestacamento === destId;
                    return (
                      <button
                        key={destId}
                        type="button"
                        onClick={() => setSelectedDestacamento(destId)}
                        className={`py-1 text-[10px] font-semibold rounded transition-colors cursor-pointer truncate px-1 ${
                          active
                            ? meta.badgeClass
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                        title={meta.nombreCompleto}
                      >
                        {meta.shortLabel}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-1 bg-[#0B1117] border border-slate-800 rounded-md p-0.5">
                  {(
                    [
                      { id: 'all', label: 'Todas' },
                      { id: 'terrestre', label: 'Terrestre' },
                      { id: 'lacustre', label: 'Lacustre' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setRailModeFilter(m.id)}
                      className={`py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                        railModeFilter === m.id
                          ? 'bg-[#1F2D40] text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Commission Rows */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70">
                {dataLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-[#161F2C] rounded animate-pulse" />
                    ))}
                  </div>
                ) : railCommissions.length === 0 ? (
                  <div className="p-6 text-center space-y-2">
                    <p className="text-xs text-slate-400">No hay comisiones que coincidan.</p>
                    {canOperateField && (
                      <button
                        type="button"
                        onClick={() => setCommissionModal({ open: true, editing: null })}
                        className="text-xs font-semibold text-emerald-400 hover:underline cursor-pointer"
                      >
                        + Desplegar primera comisión
                      </button>
                    )}
                  </div>
                ) : (
                  railCommissions.map((comm) => {
                    const isSelected = comm.id === selectedCommissionId;
                    const isSos = comm.alertaApoyo || comm.estado === 'apoyo_requerido';
                    const isLacustre = comm.modalidad === 'lacustre';
                    const isGps = liveGpsCommissionId === comm.id;
                    const deviation = evaluateCommissionDeviation(comm, patrolRadiusKm);
                    const isDeviated = Boolean(deviation?.isDeviated);

                    return (
                      <div
                        key={comm.id}
                        onClick={() => {
                          setSelectedCommissionId(comm.id);
                          setMobileMapPane('detalle');
                          setFocusTarget({
                            lat: comm.lat,
                            lng: comm.lng,
                            zoom: 13,
                            seq: Date.now(),
                          });
                        }}
                        className={`p-3.5 transition-colors cursor-pointer space-y-2 ${
                          isSelected
                            ? 'bg-[#182434]'
                            : 'hover:bg-[#151E2B]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-wrap">
                              <span className="font-mono-tabular font-bold text-white">
                                {comm.codigo}
                              </span>
                              {comm.destacamento && DESTACAMENTO_META[comm.destacamento] && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    DESTACAMENTO_META[comm.destacamento].badgeClass
                                  }`}
                                >
                                  {DESTACAMENTO_META[comm.destacamento].shortLabel}
                                </span>
                              )}
                              <span aria-hidden="true">·</span>
                              <span
                                className={`inline-flex items-center gap-1 font-medium ${
                                  isLacustre ? 'text-sky-400' : 'text-emerald-400'
                                }`}
                              >
                                {isLacustre ? (
                                  <Anchor className="w-3 h-3" />
                                ) : (
                                  <Truck className="w-3 h-3" />
                                )}
                                {isLacustre ? 'Lacustre' : 'Terrestre'}
                              </span>
                              {isGps && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-0.5 text-sky-300 font-semibold">
                                    <Navigation className="w-2.5 h-2.5" />
                                    GPS
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-slate-100 truncate mt-0.5">
                              {comm.nombre}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {comm.jefeGrado} {comm.jefeNombre} · {comm.efectivos.length} eff. ·{' '}
                              {comm.armamento.length} armas
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {isSos && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-300 bg-red-950/90 border border-red-500/60 px-1.5 py-0.5 rounded">
                                <AlertTriangle className="w-3 h-3" />
                                SOS
                              </span>
                            )}
                            {isDeviated && deviation && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-200 bg-orange-950/90 border border-orange-500/60 px-1.5 py-0.5 rounded font-mono-tabular"
                                title={`Fuera de sector asignado: ${deviation.distanceKm.toFixed(1)} km (límite ${deviation.maxRadiusKm} km)`}
                              >
                                DESVÍO {deviation.distanceKm.toFixed(1)} km
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-slate-500 truncate">{comm.sector}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={
                                isSos
                                  ? 'text-red-400 font-semibold'
                                  : comm.estado === 'finalizada'
                                    ? 'text-slate-500'
                                    : 'text-slate-400'
                              }
                            >
                              {COMMISSION_STATUS_LABELS[comm.estado]}
                            </span>
                            <a
                              href={`tel:${sanitizePhoneForTel(comm.jefeTelefono)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-700/90 hover:bg-emerald-600 text-white font-semibold rounded text-[10px]"
                              title={`Llamar a ${comm.jefeGrado} ${comm.jefeNombre}`}
                            >
                              <Phone className="w-2.5 h-2.5" />
                              Llamar
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Operator Session & Share Footer inside Left Rail */}
              <div className="p-3 border-t border-slate-800 bg-[#0E151E] space-y-2.5 shrink-0">
                <ShareAppButton canEditShareLink={isCommandAdmin} />
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      isCommandAdmin ? openAuditModal('usuarios') : setProfileModalOpen(true)
                    }
                    className="min-w-0 text-left hover:opacity-90 cursor-pointer"
                    title={
                      isCommandAdmin
                        ? 'Abrir Panel de Usuarios, Privilegios y Auditoría'
                        : 'Editar mis datos de identificación de usuario'
                    }
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {myOfficerDisplayLabel}
                      </span>
                    </div>
                    <div className="text-[10px] font-semibold mt-0.5 truncate">
                      {isPrimaryAdmin ? (
                        <span className="text-amber-300">Administrador Principal</span>
                      ) : isCommandAdmin ? (
                        <span className="text-amber-300">Administrador</span>
                      ) : (
                        <span className="text-emerald-400">
                          Modo Usuario · {OFFICER_PRIVILEGE_LABELS[myPrivilege]}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {myOfficerProfile?.cedula ? `C.I. ${myOfficerProfile.cedula} · ` : ''}
                      {user.email}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white bg-[#192332] hover:bg-[#243247] rounded cursor-pointer shrink-0"
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Salir
                  </button>
                </div>
              </div>
            </aside>

            {/* Center Tactical Google Map */}
            <section
              className={`${
                mobileMapPane === 'mapa' ? 'block' : 'hidden'
              } lg:block lg:col-span-6 xl:col-span-6 h-full min-h-[380px]`}
            >
              <TacticalMap
                commissions={filteredMapCommissions}
                incidents={incidents}
                patrolPoints={patrolPoints}
                liveLocations={liveLocations}
                gangZones={gangZones}
                friendlyForces={friendlyForces}
                zoneUnits={filteredMapZoneUnits}
                currentUserUid={user.uid}
                myLiveGpsActive={myLiveGpsActive}
                selectedCommissionId={selectedCommissionId}
                patrolRadiusKm={patrolRadiusKm}
                canOperate={canOperateField}
                canModerateIntelligence={canEditCatalogs}
                canConfigureStructure={isCommandAdmin}
                onChangePatrolRadiusKm={handleChangePatrolRadiusKm}
                focusTarget={focusTarget}
                mapMode={mapMode}
                layers={layers}
                onToggleLayer={(key) =>
                  setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
                }
                onSelectCommission={(id) => {
                  setSelectedCommissionId(id);
                }}
                onMapModeChange={(nextMode) => {
                  if (!canOperateField && nextMode !== 'inspect') return;
                  setMapMode(nextMode);
                }}
                onToggleMyLiveGps={() => void handleToggleMyLiveGps()}
                onMapClickForIncident={(coords, defaultTipo, cuadrante) => {
                  if (!canOperateField) return;
                  setIncidentModal({
                    open: true,
                    coords,
                    commissionId: selectedCommissionId ?? '',
                    defaultTipo,
                    defaultCuadrantePaz: cuadrante?.codigo,
                    defaultMunicipio: cuadrante?.municipio,
                    defaultSector: cuadrante?.sectores.split(',')[0]?.trim(),
                  });
                }}
                onMapClickForPatrol={(coords, cuadrante) => {
                  if (!canOperateField) return;
                  setPatrolModal({
                    open: true,
                    coords,
                    commissionId: myLiveCommissionId || selectedCommissionId || '',
                    defaultCuadrantePaz: cuadrante?.codigo,
                    defaultMunicipio: cuadrante?.municipio,
                    defaultSector: cuadrante?.sectores.split(',')[0]?.trim(),
                    defaultModalidad: cuadrante?.modalidad,
                  });
                }}
                onMapClickForRelocate={(coords) => void handleRelocateCommission(coords)}
                onEditGangZone={
                  canOperateField
                    ? (zone) => setGangModal({ open: true, editing: zone })
                    : undefined
                }
                onEditFriendlyForce={
                  canOperateField
                    ? (force) => setFriendlyModal({ open: true, editing: force })
                    : undefined
                }
                onEditZoneUnit={
                  canOperateField
                    ? (unit) =>
                        setZoneUnitModal({
                          open: true,
                          editing: unit,
                          defaultDestacamento: unit.destacamento,
                        })
                    : undefined
                }
                onDeployCommissionAtUnit={
                  canOperateField ? handleDeployCommissionFromUnit : undefined
                }
              />
            </section>

            {/* Right Real-Time Commission Inspector & Zone Intelligence */}
            <div
              className={`${
                mobileMapPane === 'detalle' ? 'block' : 'hidden'
              } lg:block lg:col-span-3 xl:col-span-3 h-full overflow-hidden`}
            >
              <CommissionDetailDrawer
                commission={selectedCommission}
                allCommissions={commissions}
                gangZones={gangZones}
                friendlyForces={friendlyForces}
                incidents={incidents}
                liveGpsCommissionId={liveGpsCommissionId}
                patrolRadiusKm={patrolRadiusKm}
                canOperate={canOperateField}
                onToggleLiveGps={(id) => {
                  if (!canOperateField) return;
                  setLiveGpsCommissionId((curr) => (curr === id ? null : id));
                }}
                onStartRelocate={() => {
                  if (!canOperateField) return;
                  setMapMode('relocate_commission');
                  setMobileMapPane('mapa');
                }}
                onMarkIncidentHere={(coords, commissionId) => {
                  if (!canOperateField) return;
                  setIncidentModal({ open: true, coords, commissionId });
                }}
                onOpenSupportModal={(comm) => {
                  if (!canOperateField) return;
                  setSupportModalCommission(comm);
                }}
                onEditCommission={(comm) => {
                  if (!canOperateField) return;
                  setCommissionModal({ open: true, editing: comm });
                }}
                onShareCommission={(comm) => setShareCommission(comm)}
                onFocusCoords={(lat, lng, zoom) => focusOnCoords(lat, lng, zoom)}
              />
            </div>
          </div>
          </>
        ) : (
          <div className="h-full overflow-y-auto pb-16 md:pb-0">
            {activeTab === 'unidades' && (
              <ZoneUnitsView
                zoneUnits={effectiveZoneUnits}
                commissions={commissions}
                incidents={incidents}
                currentUserUid={user.uid}
                canOperate={canOperateField}
                canModerate={canEditCatalogs}
                selectedDestacamento={selectedDestacamento}
                onSelectDestacamento={setSelectedDestacamento}
                onLocateUnitOnMap={handleLocateZoneUnitOnMap}
                onDeployCommissionFromUnit={handleDeployCommissionFromUnit}
                onAddZoneUnit={(defaultDest) =>
                  setZoneUnitModal({
                    open: true,
                    editing: null,
                    defaultDestacamento:
                      defaultDest ??
                      (selectedDestacamento === 'ALL' ? 'D-231' : selectedDestacamento),
                  })
                }
                onEditZoneUnit={(unit) =>
                  setZoneUnitModal({
                    open: true,
                    editing: unit,
                    defaultDestacamento: unit.destacamento,
                  })
                }
                onChangeUnitStatus={handleChangeZoneUnitStatus}
                onDeleteZoneUnit={handleDeleteZoneUnit}
              />
            )}

            {activeTab === 'comisiones' && (
              <CommissionsView
                commissions={commissions}
                canOperate={canOperateField}
                canDelete={canDeleteRecords}
                selectedDestacamento={selectedDestacamento}
                onSelectDestacamento={setSelectedDestacamento}
                onNewCommission={() =>
                  setCommissionModal({ open: true, editing: null, prefillUnit: null })
                }
                onEditCommission={(comm) =>
                  setCommissionModal({ open: true, editing: comm, prefillUnit: null })
                }
                onLocateCommission={(comm) => {
                  setSelectedCommissionId(comm.id);
                  focusOnCoords(comm.lat, comm.lng, 14);
                }}
                onOpenSupportModal={(comm) => setSupportModalCommission(comm)}
                onShareCommission={(comm) => setShareCommission(comm)}
                onDeleteCommission={(comm) => void handleDeleteCommission(comm)}
              />
            )}

            {activeTab === 'verificacion' && (
              <VerificationView
                wantedRecords={effectiveWantedRecords}
                verificationLogs={verificationLogs}
                commissions={commissions}
                friendlyForces={friendlyForces}
                defaultOfficerName={myOfficerDisplayLabel}
                myLivePos={myLivePos ? { lat: myLivePos.lat, lng: myLivePos.lng } : null}
                canOperate={canOperateField}
                canEditCatalogs={canEditCatalogs}
                canDelete={canDeleteRecords}
                onSaveVerificationLog={handleSaveVerificationLog}
                onUpdateVerificationResult={handleUpdateVerificationResult}
                onDeleteVerificationLog={handleDeleteVerificationLog}
                onSaveWantedRecord={handleSaveWantedRecord}
                onToggleWantedStatus={handleToggleWantedStatus}
                onDeleteWantedRecord={handleDeleteWantedRecord}
                onLocateCoords={(lat, lng, zoom) => focusOnCoords(lat, lng, zoom)}
              />
            )}

            {activeTab === 'criminalidad' && (
              <CrimeMapView
                incidents={incidents}
                patrolPoints={patrolPoints}
                commissions={commissions}
                canOperate={canOperateField}
                canDelete={canDeleteRecords}
                onStartMarkOnMap={() => {
                  if (!canOperateField) return;
                  setActiveTab('mapa');
                  setMobileMapPane('mapa');
                  setMapMode('mark_incident');
                }}
                onStartMarkPatrolOnMap={() => {
                  if (!canOperateField) return;
                  setActiveTab('mapa');
                  setMobileMapPane('mapa');
                  setMapMode('mark_patrol');
                }}
                onQuickRegisterIncident={(defaultTipo, cuadrante) => {
                  if (!canOperateField) return;
                  const baseCoords = cuadrante
                    ? { lat: cuadrante.lat, lng: cuadrante.lng }
                    : myLivePos
                      ? { lat: myLivePos.lat, lng: myLivePos.lng }
                      : { lat: 9.4685, lng: -71.0665 };
                  setIncidentModal({
                    open: true,
                    coords: baseCoords,
                    commissionId: selectedCommissionId ?? '',
                    defaultTipo,
                    defaultCuadrantePaz: cuadrante?.codigo,
                    defaultMunicipio: cuadrante?.municipio,
                    defaultSector: cuadrante?.sectores.split(',')[0]?.trim(),
                  });
                }}
                onQuickPatrolCuadrante={(cuadrante: CuadrantePaz) => {
                  if (!canOperateField) return;
                  setPatrolModal({
                    open: true,
                    coords: { lat: cuadrante.lat, lng: cuadrante.lng },
                    commissionId: myLiveCommissionId || selectedCommissionId || '',
                    defaultCuadrantePaz: cuadrante.codigo,
                    defaultMunicipio: cuadrante.municipio,
                    defaultSector: cuadrante.sectores.split(',')[0]?.trim(),
                    defaultModalidad: cuadrante.modalidad,
                  });
                }}
                onLocateCuadrante={(cuadrante: CuadrantePaz) => {
                  setLayers((prev) => ({ ...prev, cuadrantesPaz: true }));
                  focusOnCoords(cuadrante.lat, cuadrante.lng, 13);
                }}
                onLocateIncident={(inc) => focusOnCoords(inc.lat, inc.lng, 14)}
                onLocatePatrolPoint={(pt) => focusOnCoords(pt.lat, pt.lng, 15)}
                onUpdateStatus={handleUpdateIncidentStatus}
                onDeleteIncident={(inc) => void handleDeleteIncident(inc)}
                onDeletePatrolPoint={(pt) => void handleDeletePatrolPoint(pt)}
              />
            )}

            {activeTab === 'inteligencia' && (
              <IntelligenceView
                gangZones={gangZones}
                friendlyForces={friendlyForces}
                currentUserUid={user.uid}
                canAdd={canOperateField}
                canEditAll={canEditCatalogs}
                canDeleteOwn={canEditCatalogs}
                canDeleteAll={isCommandAdmin}
                onAddGangZone={() => setGangModal({ open: true, editing: null })}
                onEditGangZone={(z) => setGangModal({ open: true, editing: z })}
                onAddFriendlyForce={() => setFriendlyModal({ open: true, editing: null })}
                onEditFriendlyForce={(f) => setFriendlyModal({ open: true, editing: f })}
                onToggleGangActive={handleToggleGangActive}
                onToggleForceAvailable={handleToggleForceAvailable}
                onDeleteGangZone={(z) => void handleDeleteGangZone(z)}
                onDeleteFriendlyForce={(f) => void handleDeleteFriendlyForce(f)}
                onLocateCoords={(lat, lng, zoom) => focusOnCoords(lat, lng, zoom)}
              />
            )}
          </div>
        )}
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation Bar */}
      <nav
        aria-label="Navegación principal móvil"
        className="md:hidden h-14 bg-[#0E151E] border-t border-slate-800 grid grid-cols-6 items-center shrink-0 z-30 pb-[env(safe-area-inset-bottom)]"
      >
        {(
          [
            { id: 'mapa', label: 'Mapa', Icon: MapPin },
            { id: 'unidades', label: 'CZ-23', Icon: Building2 },
            { id: 'comisiones', label: 'Comis.', Icon: Users },
            { id: 'verificacion', label: 'Verif.', Icon: UserCheck },
            { id: 'criminalidad', label: 'Delitos', Icon: Flame },
            { id: 'inteligencia', label: 'Aliados', Icon: Shield },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                active ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Floating Real-Time Push Alert Toasts */}
      <LiveAlertToastStack
        toasts={liveToasts}
        onDismiss={(id) => setLiveToasts((curr) => curr.filter((t) => t.id !== id))}
        onLocate={focusAlertOnMap}
        onOpenAccessControl={
          isCommandAdmin ? () => openAuditModal('control_acceso') : undefined
        }
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

      {/* Modals */}
      {canOperateField && commissionModal.open && (
        <CommissionFormModal
          initial={commissionModal.editing}
          nextCode={nextCommissionCode}
          zoneUnits={effectiveZoneUnits}
          prefillUnit={commissionModal.prefillUnit}
          defaultDestacamento={
            selectedDestacamento === 'ALL' ? 'D-231' : selectedDestacamento
          }
          onClose={() =>
            setCommissionModal({ open: false, editing: null, prefillUnit: null })
          }
          onSave={handleSaveCommission}
        />
      )}

      {canOperateField && zoneUnitModal.open && (
        <ZoneUnitFormModal
          open={zoneUnitModal.open}
          existingUnit={zoneUnitModal.editing}
          defaultDestacamento={zoneUnitModal.defaultDestacamento}
          allUnits={effectiveZoneUnits}
          onClose={() =>
            setZoneUnitModal({
              open: false,
              editing: null,
              defaultDestacamento: 'D-231',
            })
          }
          onSubmit={handleSaveZoneUnit}
        />
      )}

      {canOperateField && incidentModal?.open && (
        <IncidentFormModal
          initialCoords={incidentModal.coords}
          commissions={commissions}
          defaultCommissionId={incidentModal.commissionId}
          defaultTipo={incidentModal.defaultTipo}
          defaultCuadrantePaz={incidentModal.defaultCuadrantePaz}
          defaultMunicipio={incidentModal.defaultMunicipio}
          defaultSector={incidentModal.defaultSector}
          onClose={() => setIncidentModal(null)}
          onSave={handleSaveIncident}
        />
      )}

      {canOperateField && patrolModal?.open && (
        <PatrolPointFormModal
          initialCoords={patrolModal.coords}
          commissions={commissions}
          defaultCommissionId={patrolModal.commissionId}
          defaultOfficerName={myOfficerDisplayLabel}
          defaultCuadrantePaz={patrolModal.defaultCuadrantePaz}
          defaultMunicipio={patrolModal.defaultMunicipio}
          defaultSector={patrolModal.defaultSector}
          defaultModalidad={patrolModal.defaultModalidad}
          onClose={() => setPatrolModal(null)}
          onSave={handleSavePatrolPoint}
        />
      )}

      {canOperateField && supportModalCommission && (
        <SupportAlertModal
          commission={supportModalCommission}
          friendlyForces={friendlyForces}
          onClose={() => setSupportModalCommission(null)}
          onConfirm={(activate, motivo) =>
            handleConfirmSupportAlert(supportModalCommission, activate, motivo)
          }
        />
      )}

      {canOperateField && gangModal.open && (
        <GangZoneFormModal
          initial={gangModal.editing}
          onClose={() => setGangModal({ open: false, editing: null })}
          onSave={handleSaveGangZone}
        />
      )}

      {canOperateField && friendlyModal.open && (
        <FriendlyForceFormModal
          initial={friendlyModal.editing}
          onClose={() => setFriendlyModal({ open: false, editing: null })}
          onSave={handleSaveFriendlyForce}
        />
      )}

      {shareCommission && (
        <ShareModal
          title={
            shareCommission.alertaApoyo || shareCommission.estado === 'apoyo_requerido'
              ? `Compartir Alerta SOS — ${shareCommission.codigo}`
              : `Compartir Parte — ${shareCommission.codigo}`
          }
          subtitle={`${shareCommission.jefeGrado} ${shareCommission.jefeNombre} · ${shareCommission.sector}`}
          shareText={formatCommissionShareText(shareCommission)}
          canEditShareLink={isCommandAdmin}
          onClose={() => setShareCommission(null)}
        />
      )}

      {isCommandAdmin && auditModalOpen && (
        <AuditRegistryModal
          officers={officers}
          auditLogs={auditLogs}
          accessCodes={accessCodes}
          currentUserUid={user.uid}
          currentUserEmail={user.email || ''}
          isCommandAdmin={isCommandAdmin}
          isPrimaryAdmin={isPrimaryAdmin}
          myProfile={myOfficerProfile}
          initialTab={auditModalInitialTab}
          onUpdateMyProfile={handleSaveOfficerProfile}
          onApproveOfficer={handleApproveOfficer}
          onChangeOfficerPrivilege={handleChangeOfficerPrivilege}
          onExpelOfficer={handleExpelOfficer}
          onRehabilitateOfficer={handleRehabilitateOfficer}
          onCreateAccessCode={handleCreateAccessCode}
          onToggleAccessCodeActive={handleToggleAccessCodeActive}
          onDeleteAccessCode={handleDeleteAccessCode}
          onClose={() => {
            setAuditModalOpen(false);
            setAuditModalInitialTab(undefined);
          }}
        />
      )}

      {helpModalOpen && (
        <HelpGuideModal
          isCommandAdmin={isCommandAdmin}
          onClose={() => setHelpModalOpen(false)}
          onNavigateTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'mapa') {
              setMobileMapPane('mapa');
            }
            setHelpModalOpen(false);
          }}
        />
      )}

      {!isCommandAdmin &&
        profileModalOpen &&
        isAccessAuthorized &&
        myOfficerProfile?.perfilCompleto && (
          <OfficerRegistrationModal
            email={user.email || ''}
            initialProfile={myOfficerProfile}
            defaultDisplayName={user.displayName || ''}
            mandatory={false}
            onClose={() => setProfileModalOpen(false)}
            onSave={async (payload) => {
              await handleSaveOfficerProfile(payload);
              setProfileModalOpen(false);
            }}
          />
        )}

      {isAccessAuthorized &&
        officerProfileLoaded &&
        myOfficerProfile &&
        !myOfficerProfile.perfilCompleto && (
          <OfficerRegistrationModal
            email={user.email || ''}
            initialProfile={myOfficerProfile}
            defaultDisplayName={user.displayName || ''}
            mandatory
            onSave={handleSaveOfficerProfile}
          />
        )}
    </div>
  );
}

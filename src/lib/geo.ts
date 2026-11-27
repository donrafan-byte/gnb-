import {
  TRUJILLO_BOUNDS,
  TRUJILLO_SECTORS,
  type Commission,
  type FriendlyForce,
  type GangZone,
  type Incident,
  type OperationMode,
} from '../types/operations';
import { getCuadranteByCode } from '../data/trujilloCuadrantes';

const EARTH_RADIUS_KM = 6371;

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function estimateResponseMinutes(
  km: number,
  mode: OperationMode | 'mixta' = 'terrestre'
): number {
  const speedKmh = mode === 'lacustre' ? 38 : 58;
  return Math.max(3, Math.round((km / speedKmh) * 60));
}

export function clampTrujilloCoords(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.min(TRUJILLO_BOUNDS.maxLat, Math.max(TRUJILLO_BOUNDS.minLat, Number(lat.toFixed(6)))),
    lng: Math.min(TRUJILLO_BOUNDS.maxLng, Math.max(TRUJILLO_BOUNDS.minLng, Number(lng.toFixed(6)))),
  };
}

/**
 * Heuristic check for Lake Maracaibo eastern shore near Puerto La Ceiba / Moporo.
 */
export function inferOperationModeFromCoords(lat: number, lng: number): OperationMode {
  if (lng <= -71.072 && lat >= 9.25 && lat <= 9.75) {
    return 'lacustre';
  }
  return 'terrestre';
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}° N, ${Math.abs(lng).toFixed(4)}° O`;
}

export function sanitizePhoneForTel(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export interface AssignedSectorAnchor {
  label: string;
  lat: number;
  lng: number;
}

export interface CommissionDeviationInfo {
  commission: Commission;
  sectorAnchor: AssignedSectorAnchor;
  distanceKm: number;
  maxRadiusKm: number;
  excessKm: number;
  isDeviated: boolean;
}

function normalizeGeoText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const SECTOR_KEYWORD_ANCHORS: Array<{ keywords: string[]; anchor: AssignedSectorAnchor }> = [
  {
    keywords: ['puerto la ceiba', 'costa lacustre'],
    anchor: { label: 'Puerto La Ceiba — Costa Lacustre', lat: 9.4662, lng: -71.0845 },
  },
  {
    keywords: ['moporo', 'tomoporo'],
    anchor: { label: 'Muelle Moporo / Tomoporo (Lago)', lat: 9.575, lng: -71.105 },
  },
  {
    keywords: ['santa apolonia', 'sede dcr', 'dcr 23-1'],
    anchor: { label: 'Sede DCR 23-1 La Ceiba (Santa Apolonia)', lat: 9.4685, lng: -71.0665 },
  },
  {
    keywords: ['sabana de mendoza', 'eje panamericano'],
    anchor: { label: 'Sabana de Mendoza (Eje Panamericano)', lat: 9.4375, lng: -70.7745 },
  },
  {
    keywords: ['el dividive', 'dividive'],
    anchor: { label: 'El Dividive — Miranda', lat: 9.4795, lng: -70.742 },
  },
  {
    keywords: ['agua santa', 'agua viva'],
    anchor: { label: 'Agua Santa — Troncal 001', lat: 9.5355, lng: -70.665 },
  },
  {
    keywords: ['betijoque', 'rafael rangel'],
    anchor: { label: 'Betijoque — Rafael Rangel', lat: 9.3761, lng: -70.7336 },
  },
  {
    keywords: ['motatan'],
    anchor: { label: 'Motatán — Corredor Vial', lat: 9.3928, lng: -70.5964 },
  },
  {
    keywords: ['carvajal'],
    anchor: { label: 'San Rafael de Carvajal', lat: 9.3072, lng: -70.5861 },
  },
  {
    keywords: ['escuque'],
    anchor: { label: 'Escuque', lat: 9.2956, lng: -70.6725 },
  },
  {
    keywords: ['valera'],
    anchor: { label: 'Valera — Zona Urbana', lat: 9.3178, lng: -70.6036 },
  },
  {
    keywords: ['pampanito'],
    anchor: { label: 'Pampanito', lat: 9.4108, lng: -70.4958 },
  },
  {
    keywords: ['pampan', 'flor de patria'],
    anchor: { label: 'Pampán — Flor de Patria', lat: 9.4422, lng: -70.4767 },
  },
  {
    keywords: ['bocono'],
    anchor: { label: 'Boconó — Zona Alta', lat: 9.2539, lng: -70.2489 },
  },
  {
    keywords: ['monte carmelo'],
    anchor: { label: 'Monte Carmelo', lat: 9.1885, lng: -70.8165 },
  },
  {
    keywords: ['sabana grande', 'bolivar'],
    anchor: { label: 'Sabana Grande — Bolívar', lat: 9.379, lng: -70.768 },
  },
  {
    keywords: ['santa isabel', 'andres bello'],
    anchor: { label: 'Santa Isabel — Andrés Bello', lat: 9.615, lng: -70.865 },
  },
  {
    keywords: ['la ceiba'],
    anchor: { label: 'Sede DCR 23-1 La Ceiba (Santa Apolonia)', lat: 9.4685, lng: -71.0665 },
  },
  {
    keywords: ['miranda'],
    anchor: { label: 'El Dividive — Miranda', lat: 9.4795, lng: -70.742 },
  },
  {
    keywords: ['sucre'],
    anchor: { label: 'Sabana de Mendoza (Eje Panamericano)', lat: 9.4375, lng: -70.7745 },
  },
  {
    keywords: ['carache', 'cuicas'],
    anchor: { label: 'Carache — Cuicas', lat: 9.6335, lng: -70.2285 },
  },
  {
    keywords: ['candelaria', 'chejende', 'monay'],
    anchor: { label: 'Candelaria — Chejendé', lat: 9.6165, lng: -70.351 },
  },
  {
    keywords: ['urdaneta', 'la quebrada', 'jajo', 'tuname'],
    anchor: { label: 'Urdaneta — La Quebrada', lat: 9.152, lng: -70.585 },
  },
  {
    keywords: ['trujillo'],
    anchor: { label: 'Trujillo Capital', lat: 9.3667, lng: -70.4369 },
  },
];

export function resolveAssignedSectorPoint(
  sectorText: string,
  cuadrantePaz?: string
): AssignedSectorAnchor | null {
  // 0. If commission has an explicit Cuadrante de Paz assigned, anchor to it
  const cuadrante = getCuadranteByCode(cuadrantePaz);
  if (cuadrante) {
    return {
      label: `${cuadrante.codigo} — ${cuadrante.nombre}`,
      lat: cuadrante.lat,
      lng: cuadrante.lng,
    };
  }

  const normalized = normalizeGeoText(sectorText);
  if (!normalized) return null;

  // 1. Exact match against registered Trujillo sectors
  for (const sec of TRUJILLO_SECTORS) {
    if (normalizeGeoText(sec.label) === normalized) {
      return { label: sec.label, lat: sec.lat, lng: sec.lng };
    }
  }

  // 2. Specific sector / town / municipality keyword match
  for (const entry of SECTOR_KEYWORD_ANCHORS) {
    if (entry.keywords.some((kw) => normalized.includes(kw))) {
      return entry.anchor;
    }
  }

  return null;
}

export function evaluateCommissionDeviation(
  commission: Commission,
  maxRadiusKm: number
): CommissionDeviationInfo | null {
  if (commission.estado === 'finalizada') return null;
  const anchor = resolveAssignedSectorPoint(commission.sector, commission.cuadrantePaz);
  if (!anchor) return null;

  const dist = distanceKm(
    { lat: commission.lat, lng: commission.lng },
    { lat: anchor.lat, lng: anchor.lng }
  );
  const excessKm = Math.max(0, dist - maxRadiusKm);

  return {
    commission,
    sectorAnchor: anchor,
    distanceKm: dist,
    maxRadiusKm,
    excessKm,
    isDeviated: dist > maxRadiusKm,
  };
}

export interface GangAdvisoryMatch {
  zone: GangZone;
  distanceKm: number;
  insideRadius: boolean;
}

export interface FriendlySupportMatch {
  force: FriendlyForce;
  distanceKm: number;
  etaMinutes: number;
}

export interface NearbyCommissionMatch {
  commission: Commission;
  distanceKm: number;
  etaMinutes: number;
}

export interface NearbyIncidentMatch {
  incident: Incident;
  distanceKm: number;
}

export function computeZoneIntelligence(
  point: { lat: number; lng: number },
  gangZones: GangZone[],
  friendlyForces: FriendlyForce[],
  incidents: Incident[],
  commissions: Commission[],
  excludeCommissionId?: string
): {
  gangMatches: GangAdvisoryMatch[];
  friendlyMatches: FriendlySupportMatch[];
  nearbyIncidents: NearbyIncidentMatch[];
  nearbyCommissions: NearbyCommissionMatch[];
} {
  const gangMatches: GangAdvisoryMatch[] = gangZones
    .filter((z) => z.activa)
    .map((zone) => {
      const dist = distanceKm(point, { lat: zone.lat, lng: zone.lng });
      return {
        zone,
        distanceKm: dist,
        insideRadius: dist <= zone.radioKm,
      };
    })
    .sort((a, b) => {
      if (a.insideRadius !== b.insideRadius) return a.insideRadius ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    });

  const friendlyMatches: FriendlySupportMatch[] = friendlyForces
    .map((force) => {
      const dist = distanceKm(point, { lat: force.lat, lng: force.lng });
      const mode: OperationMode = force.organismo === 'GUARDACOSTAS' ? 'lacustre' : 'terrestre';
      return {
        force,
        distanceKm: dist,
        etaMinutes: estimateResponseMinutes(dist, mode),
      };
    })
    .sort((a, b) => {
      if (a.force.disponible !== b.force.disponible) return a.force.disponible ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    });

  const nearbyIncidents: NearbyIncidentMatch[] = incidents
    .map((incident) => ({
      incident,
      distanceKm: distanceKm(point, { lat: incident.lat, lng: incident.lng }),
    }))
    .filter((m) => m.distanceKm <= 30)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearbyCommissions: NearbyCommissionMatch[] = commissions
    .filter((c) => c.id !== excludeCommissionId && c.estado !== 'finalizada')
    .map((commission) => {
      const dist = distanceKm(point, { lat: commission.lat, lng: commission.lng });
      return {
        commission,
        distanceKm: dist,
        etaMinutes: estimateResponseMinutes(dist, commission.modalidad),
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return { gangMatches, friendlyMatches, nearbyIncidents, nearbyCommissions };
}

/**
 * Generates a short dual-tone tactical alert chime using Web Audio API.
 */
export function playTacticalAlertTone(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [880, 660, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);
      gain.gain.setValueAtTime(0.001, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.15);
    });
  } catch {
    // Ignore autoplay blocks silently
  }
}

/**
 * Generates a crisp two-tone dispatch notification chime for newly registered incidents.
 */
export function playIncidentAlertTone(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.1, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.18);
    });
  } catch {
    // Ignore autoplay blocks silently
  }
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  type MapMouseEvent,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Anchor,
  Camera,
  Car,
  ClipboardCheck,
  Crosshair,
  Edit3,
  Flame,
  Layers,
  Leaf,
  MapPin,
  Maximize2,
  Megaphone,
  Navigation,
  Phone,
  Radio,
  Route as RouteIcon,
  Search,
  Shield,
  Skull,
  Truck,
  X,
} from 'lucide-react';
import {
  MapSearchAndRoutePanel,
  RoutePolylineOverlay,
  type ComputedRouteSummary,
  type MapPlacePoint,
  type RouteTravelMode,
} from './MapSearchAndRoutePanel';
import {
  AGENCY_SHORT_LABELS,
  AGENCY_STYLES,
  COMMISSION_STATUS_LABELS,
  DESTACAMENTO_META,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  LIGHTING_CONDITION_LABELS,
  PATROL_CONDITION_LABELS,
  ROAD_ACCESS_STATUS_LABELS,
  TRAFFIC_FLOW_LABELS,
  TRUJILLO_SECTORS,
  ZONE_UNIT_LEVEL_LABELS,
  ZONE_UNIT_STATUS_LABELS,
  isEnvironmentalIncidentType,
  isPublicOrderIncidentType,
  isTrafficIncidentType,
  isViolentIncidentType,
  type Commission,
  type FriendlyForce,
  type GangZone,
  type Incident,
  type IncidentType,
  type LiveLocation,
  type PatrolPoint,
  type ZoneUnit,
} from '../types/operations';
import {
  CUADRANTE_TYPE_LABELS,
  CUADRANTE_TYPE_STYLES,
  TRUJILLO_CUADRANTES_PAZ,
  getCuadranteByCode,
  type CuadrantePaz,
} from '../data/trujilloCuadrantes';
import {
  TRUJILLO_MUNICIPALITY_BOUNDARIES,
  TRUJILLO_STATE_BOUNDARY,
  type MunicipalityBoundary,
} from '../data/trujilloBoundaries';
import {
  clampTrujilloCoords,
  evaluateCommissionDeviation,
  formatCoords,
  sanitizePhoneForTel,
  type CommissionDeviationInfo,
} from '../lib/geo';

export type TacticalMapMode =
  | 'inspect'
  | 'mark_incident'
  | 'mark_patrol'
  | 'relocate_commission';

export interface MapLayerVisibility {
  boundaries: boolean;
  commissions: boolean;
  zoneUnits: boolean;
  cuadrantesPaz: boolean;
  sectorGeofence: boolean;
  incidents: boolean;
  patrolPoints: boolean;
  liveUsers: boolean;
  crimeZones: boolean;
  gangZones: boolean;
  friendlyForces: boolean;
}

interface TacticalMapProps {
  commissions: Commission[];
  zoneUnits: ZoneUnit[];
  incidents: Incident[];
  patrolPoints: PatrolPoint[];
  liveLocations: LiveLocation[];
  gangZones: GangZone[];
  friendlyForces: FriendlyForce[];
  currentUserUid: string;
  myLiveGpsActive: boolean;
  selectedCommissionId: string | null;
  patrolRadiusKm: number;
  onChangePatrolRadiusKm: (km: number) => void;
  focusTarget: { lat: number; lng: number; zoom?: number; seq: number } | null;
  mapMode: TacticalMapMode;
  layers: MapLayerVisibility;
  onToggleLayer: (layer: keyof MapLayerVisibility) => void;
  onSelectCommission: (id: string) => void;
  onMapModeChange: (mode: TacticalMapMode) => void;
  onToggleMyLiveGps: () => void;
  onMapClickForIncident: (coords: { lat: number; lng: number }, defaultTipo?: IncidentType, cuadrante?: CuadrantePaz) => void;
  onMapClickForPatrol: (coords: { lat: number; lng: number }, cuadrante?: CuadrantePaz) => void;
  onMapClickForRelocate: (coords: { lat: number; lng: number }) => void;
  onEditGangZone?: (zone: GangZone) => void;
  onEditFriendlyForce?: (force: FriendlyForce) => void;
  onEditZoneUnit?: (unit: ZoneUnit) => void;
  onDeployCommissionAtUnit?: (unit: ZoneUnit) => void;
  canOperate?: boolean;
  canModerateIntelligence?: boolean;
  canConfigureStructure?: boolean;
}

const DEFAULT_CENTER = { lat: 9.385, lng: -70.64 };
const DEFAULT_ZOOM = 10;

type ActivePopup =
  | { kind: 'commission'; item: Commission }
  | { kind: 'zone_unit'; item: ZoneUnit }
  | { kind: 'cuadrante'; item: CuadrantePaz }
  | { kind: 'municipality'; item: MunicipalityBoundary & { lat: number; lng: number } }
  | { kind: 'incident'; item: Incident }
  | { kind: 'patrol'; item: PatrolPoint }
  | { kind: 'live_user'; item: LiveLocation }
  | { kind: 'gang'; item: GangZone }
  | { kind: 'friendly'; item: FriendlyForce }
  | { kind: 'search_place'; item: MapPlacePoint }
  | null;

const SEVERITY_RADIUS_M: Record<Incident['severidad'], number> = {
  baja: 1600,
  media: 2600,
  alta: 3900,
  critica: 5400,
};

const SEVERITY_COLORS: Record<Incident['severidad'], { stroke: string; fill: string }> = {
  baja: { stroke: '#38BDF8', fill: '#0284C7' },
  media: { stroke: '#FBBF24', fill: '#D97706' },
  alta: { stroke: '#FB923C', fill: '#EA580C' },
  critica: { stroke: '#F87171', fill: '#DC2626' },
};

function CameraController({
  focusTarget,
  fitAllSeq,
  commissions,
  liveLocations,
}: {
  focusTarget: { lat: number; lng: number; zoom?: number; seq: number } | null;
  fitAllSeq: number;
  commissions: Commission[];
  liveLocations: LiveLocation[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !focusTarget) return;
    map.panTo({ lat: focusTarget.lat, lng: focusTarget.lng });
    if (focusTarget.zoom) {
      map.setZoom(focusTarget.zoom);
    }
  }, [map, focusTarget]);

  useEffect(() => {
    if (!map || fitAllSeq === 0) return;
    const active = commissions.filter((c) => c.estado !== 'finalizada');
    const activeUsers = liveLocations.filter((l) => l.enComision);
    const totalPoints = active.length + activeUsers.length;

    if (totalPoints === 0) {
      map.panTo(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
      return;
    }
    if (totalPoints === 1) {
      const only = active[0] || activeUsers[0];
      map.panTo({ lat: only.lat, lng: only.lng });
      map.setZoom(13);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    active.forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }));
    activeUsers.forEach((u) => bounds.extend({ lat: u.lat, lng: u.lng }));
    map.fitBounds(bounds, { top: 72, right: 60, bottom: 72, left: 60 });
  }, [map, fitAllSeq, commissions, liveLocations]);

  return null;
}

function TrujilloBoundariesOverlay({
  visible,
  clickable,
  selectedMunicipalityId,
  onSelectMunicipality,
}: {
  visible: boolean;
  clickable: boolean;
  selectedMunicipalityId: string | null;
  onSelectMunicipality: (muni: MunicipalityBoundary, coords: { lat: number; lng: number }) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !visible) return;
    const polygons: google.maps.Polygon[] = [];
    const listeners: google.maps.MapsEventListener[] = [];

    // Outer Estado Trujillo Perimeter (crisp luminous border + subtle transparent tint)
    const statePolygon = new google.maps.Polygon({
      map,
      paths: TRUJILLO_STATE_BOUNDARY,
      clickable: false,
      strokeColor: '#F8FAFC',
      strokeOpacity: 0.92,
      strokeWeight: 3.2,
      fillColor: '#0EA5E9',
      fillOpacity: 0.04,
      zIndex: 2,
    });
    polygons.push(statePolygon);

    // 20 Trujillo Municipalities with distinct translucent colors
    TRUJILLO_MUNICIPALITY_BOUNDARIES.forEach((muni) => {
      const isSelected = muni.id === selectedMunicipalityId;
      const poly = new google.maps.Polygon({
        map,
        paths: muni.polygon,
        clickable,
        strokeColor: muni.strokeColor,
        strokeOpacity: isSelected ? 0.98 : 0.8,
        strokeWeight: isSelected ? 2.6 : 1.4,
        fillColor: muni.fillColor,
        fillOpacity: isSelected ? 0.34 : 0.18,
        zIndex: isSelected ? 4 : 3,
      });

      if (clickable) {
        listeners.push(
          poly.addListener('mouseover', () => {
            poly.setOptions({
              fillOpacity: isSelected ? 0.38 : 0.3,
              strokeWeight: 2.3,
              strokeOpacity: 0.96,
            });
          })
        );
        listeners.push(
          poly.addListener('mouseout', () => {
            poly.setOptions({
              fillOpacity: isSelected ? 0.34 : 0.18,
              strokeWeight: isSelected ? 2.6 : 1.4,
              strokeOpacity: isSelected ? 0.98 : 0.8,
            });
          })
        );
        listeners.push(
          poly.addListener('click', (e: google.maps.PolyMouseEvent) => {
            const clickLat = e.latLng ? e.latLng.lat() : muni.center.lat;
            const clickLng = e.latLng ? e.latLng.lng() : muni.center.lng;
            onSelectMunicipality(muni, { lat: clickLat, lng: clickLng });
          })
        );
      }

      polygons.push(poly);
    });

    return () => {
      listeners.forEach((l) => l.remove());
      polygons.forEach((p) => p.setMap(null));
    };
  }, [map, visible, clickable, selectedMunicipalityId, onSelectMunicipality]);

  return null;
}

function TacticalCirclesOverlay({
  incidents,
  gangZones,
  liveLocations,
  deviations,
  selectedCommissionId,
  showCrimeZones,
  showGangZones,
  showLiveUsers,
  showSectorGeofence,
  showCuadrantesPaz,
}: {
  incidents: Incident[];
  gangZones: GangZone[];
  liveLocations: LiveLocation[];
  deviations: CommissionDeviationInfo[];
  selectedCommissionId: string | null;
  showCrimeZones: boolean;
  showGangZones: boolean;
  showLiveUsers: boolean;
  showSectorGeofence: boolean;
  showCuadrantesPaz: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const circles: google.maps.Circle[] = [];
    const polylines: google.maps.Polyline[] = [];

    if (showCuadrantesPaz) {
      TRUJILLO_CUADRANTES_PAZ.forEach((q) => {
        const st = CUADRANTE_TYPE_STYLES[q.tipo];
        const circle = new google.maps.Circle({
          map,
          center: { lat: q.lat, lng: q.lng },
          radius: q.radioKm * 1000,
          clickable: false,
          strokeColor: st.stroke,
          strokeOpacity: 0.52,
          strokeWeight: 1.4,
          fillColor: st.fill,
          fillOpacity: 0.06,
        });
        circles.push(circle);
      });
    }

    if (showSectorGeofence) {
      deviations.forEach((dev) => {
        const shouldDrawCircle =
          dev.isDeviated || dev.commission.id === selectedCommissionId;
        if (!shouldDrawCircle) return;

        const circle = new google.maps.Circle({
          map,
          center: { lat: dev.sectorAnchor.lat, lng: dev.sectorAnchor.lng },
          radius: dev.maxRadiusKm * 1000,
          clickable: false,
          strokeColor: dev.isDeviated ? '#F97316' : '#10B981',
          strokeOpacity: dev.isDeviated ? 0.9 : 0.65,
          strokeWeight: dev.isDeviated ? 2.5 : 1.5,
          fillColor: dev.isDeviated ? '#EA580C' : '#10B981',
          fillOpacity: dev.isDeviated ? 0.11 : 0.06,
        });
        circles.push(circle);

        if (dev.isDeviated) {
          const dashedLine = new google.maps.Polyline({
            map,
            path: [
              { lat: dev.sectorAnchor.lat, lng: dev.sectorAnchor.lng },
              { lat: dev.commission.lat, lng: dev.commission.lng },
            ],
            clickable: false,
            strokeOpacity: 0,
            icons: [
              {
                icon: {
                  path: 'M 0,-1 0,1',
                  strokeOpacity: 0.95,
                  strokeColor: '#FB923C',
                  scale: 3,
                },
                offset: '0',
                repeat: '14px',
              },
            ],
          });
          polylines.push(dashedLine);
        }
      });
    }

    if (showGangZones) {
      gangZones
        .filter((z) => z.activa)
        .forEach((zone) => {
          const isCritical = zone.nivelAmenaza === 'critico';
          const circle = new google.maps.Circle({
            map,
            center: { lat: zone.lat, lng: zone.lng },
            radius: zone.radioKm * 1000,
            clickable: false,
            strokeColor: isCritical ? '#EF4444' : '#F59E0B',
            strokeOpacity: 0.75,
            strokeWeight: isCritical ? 2 : 1.5,
            fillColor: isCritical ? '#DC2626' : '#D97706',
            fillOpacity: isCritical ? 0.13 : 0.09,
          });
          circles.push(circle);
        });
    }

    if (showCrimeZones) {
      incidents.forEach((inc) => {
        const isEnv = isEnvironmentalIncidentType(inc.tipo);
        const isTraffic = isTrafficIncidentType(inc.tipo);
        const isViolent = isViolentIncidentType(inc.tipo);
        const isPublicOrder = isPublicOrderIncidentType(inc.tipo);
        const colors = isPublicOrder
          ? { stroke: '#E879F9', fill: '#A21CAF' }
          : isEnv
            ? { stroke: '#84CC16', fill: '#16A34A' }
            : isTraffic
              ? { stroke: '#38BDF8', fill: '#0284C7' }
              : isViolent
                ? { stroke: '#F43F5E', fill: '#9F1239' }
                : SEVERITY_COLORS[inc.severidad];
        const circle = new google.maps.Circle({
          map,
          center: { lat: inc.lat, lng: inc.lng },
          radius: SEVERITY_RADIUS_M[inc.severidad],
          clickable: false,
          strokeColor: colors.stroke,
          strokeOpacity: 0.62,
          strokeWeight: isPublicOrder ? 1.8 : 1.3,
          fillColor: colors.fill,
          fillOpacity:
            inc.severidad === 'critica' || isViolent || isPublicOrder ? 0.25 : 0.16,
        });
        circles.push(circle);
      });
    }

    if (showLiveUsers) {
      liveLocations
        .filter((loc) => loc.enComision)
        .forEach((loc) => {
          const radius = Math.max(35, Math.min(loc.accuracyMeters || 60, 1200));
          const circle = new google.maps.Circle({
            map,
            center: { lat: loc.lat, lng: loc.lng },
            radius,
            clickable: false,
            strokeColor: '#22D3EE',
            strokeOpacity: 0.75,
            strokeWeight: 1.5,
            fillColor: '#06B6D4',
            fillOpacity: 0.15,
          });
          circles.push(circle);
        });
    }

    return () => {
      circles.forEach((c) => c.setMap(null));
      polylines.forEach((p) => p.setMap(null));
    };
  }, [
    map,
    incidents,
    gangZones,
    liveLocations,
    deviations,
    selectedCommissionId,
    showCrimeZones,
    showGangZones,
    showLiveUsers,
    showSectorGeofence,
    showCuadrantesPaz,
  ]);

  return null;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  commissions,
  zoneUnits,
  incidents,
  patrolPoints,
  liveLocations,
  gangZones,
  friendlyForces,
  currentUserUid,
  myLiveGpsActive,
  selectedCommissionId,
  patrolRadiusKm,
  onChangePatrolRadiusKm,
  focusTarget,
  mapMode,
  layers,
  onToggleLayer,
  onSelectCommission,
  onMapModeChange,
  onToggleMyLiveGps,
  onMapClickForIncident,
  onMapClickForPatrol,
  onMapClickForRelocate,
  onEditGangZone,
  onEditFriendlyForce,
  onEditZoneUnit,
  onDeployCommissionAtUnit,
  canOperate = true,
  canModerateIntelligence = false,
  canConfigureStructure = true,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [mapTypeId, setMapTypeId] = useState<'hybrid' | 'roadmap' | 'terrain'>('hybrid');
  const [activePopup, setActivePopup] = useState<ActivePopup>(null);
  const [deviationBannerCollapsed, setDeviationBannerCollapsed] = useState(false);

  const commissionDeviations = useMemo(() => {
    const list: CommissionDeviationInfo[] = [];
    for (const c of commissions) {
      const info = evaluateCommissionDeviation(c, patrolRadiusKm);
      if (info) list.push(info);
    }
    return list;
  }, [commissions, patrolRadiusKm]);

  const deviationByCommissionId = useMemo(() => {
    const map = new Map<string, CommissionDeviationInfo>();
    for (const d of commissionDeviations) {
      map.set(d.commission.id, d);
    }
    return map;
  }, [commissionDeviations]);

  const deviatedCommissions = useMemo(
    () =>
      commissionDeviations
        .filter((d) => d.isDeviated)
        .sort((a, b) => b.excessKm - a.excessKm),
    [commissionDeviations]
  );

  const [lightboxPhoto, setLightboxPhoto] = useState<{
    src: string;
    title: string;
    coords: string;
  } | null>(null);
  const [fitAllSeq, setFitAllSeq] = useState(0);
  const [sectorJumpTarget, setSectorJumpTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    seq: number;
  } | null>(null);

  // Place Search & Route Planning state
  const [searchPanelOpen, setSearchPanelOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [routeModeActive, setRouteModeActive] = useState(false);
  const [searchedPlace, setSearchedPlace] = useState<MapPlacePoint | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<MapPlacePoint | null>(null);
  const [routeDestination, setRouteDestination] = useState<MapPlacePoint | null>(null);
  const [travelMode, setTravelMode] = useState<RouteTravelMode>('DRIVING');
  const [routeSummary, setRouteSummary] = useState<ComputedRouteSummary | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const handleSelectMunicipality = useCallback(
    (muni: MunicipalityBoundary, coords: { lat: number; lng: number }) => {
      setActivePopup({
        kind: 'municipality',
        item: { ...muni, lat: coords.lat, lng: coords.lng },
      });
    },
    []
  );

  const selectedCommission =
    commissions.find((c) => c.id === selectedCommissionId) ?? null;
  const myLiveLocationDoc = liveLocations.find(
    (l) => l.uid === currentUserUid && l.enComision
  );
  const myLiveCoords = myLiveLocationDoc
    ? { lat: myLiveLocationDoc.lat, lng: myLiveLocationDoc.lng }
    : null;

  const startRouteTo = useCallback(
    (dest: MapPlacePoint, preferLacustre = false) => {
      setRouteOrigin((prev) => {
        if (prev) return prev;
        if (myLiveCoords) {
          return {
            label: 'Mi Posición GPS Actual',
            address: formatCoords(myLiveCoords.lat, myLiveCoords.lng),
            lat: myLiveCoords.lat,
            lng: myLiveCoords.lng,
          };
        }
        if (selectedCommission) {
          return {
            label: `${selectedCommission.codigo} — ${selectedCommission.sector}`,
            address: `${selectedCommission.jefeGrado} ${selectedCommission.jefeNombre}`,
            lat: selectedCommission.lat,
            lng: selectedCommission.lng,
          };
        }
        return {
          label: 'Sede Comando de Zona Nro. 23 GNB (Santa Cruz, Valera)',
          address: 'Valera, Estado Trujillo',
          lat: 9.3368,
          lng: -70.6062,
        };
      });
      setRouteDestination(dest);
      setTravelMode(preferLacustre ? 'LACUSTRE' : 'DRIVING');
      setRouteModeActive(true);
      setSearchPanelOpen(true);
      setActivePopup(null);
    },
    [myLiveCoords, selectedCommission]
  );

  const handleClearRoute = useCallback(() => {
    setRouteOrigin(null);
    setRouteDestination(null);
    setRouteSummary(null);
    setRouteError(null);
  }, []);

  const handleSwapEndpoints = useCallback(() => {
    setRouteOrigin(routeDestination);
    setRouteDestination(routeOrigin);
  }, [routeOrigin, routeDestination]);

  const effectiveFocus =
    sectorJumpTarget && (!focusTarget || sectorJumpTarget.seq > focusTarget.seq)
      ? sectorJumpTarget
      : focusTarget;

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      const latLng = event.detail.latLng;
      if (!latLng) return;

      if (mapMode === 'mark_incident') {
        onMapClickForIncident({
          lat: Number(latLng.lat.toFixed(6)),
          lng: Number(latLng.lng.toFixed(6)),
        });
        return;
      }

      if (mapMode === 'mark_patrol') {
        onMapClickForPatrol({
          lat: Number(latLng.lat.toFixed(6)),
          lng: Number(latLng.lng.toFixed(6)),
        });
        return;
      }

      if (mapMode === 'relocate_commission') {
        const clamped = clampTrujilloCoords(latLng.lat, latLng.lng);
        onMapClickForRelocate(clamped);
        return;
      }

      setActivePopup(null);
    },
    [mapMode, onMapClickForIncident, onMapClickForPatrol, onMapClickForRelocate]
  );

  const handleJumpSector = (lat: number, lng: number) => {
    setSectorJumpTarget({ lat, lng, zoom: 13, seq: Date.now() });
  };

  if (!apiKey) {
    return (
      <div className="w-full h-full min-h-[540px] bg-[#0D1520] border border-slate-800 rounded-lg flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <MapPin className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="font-display text-xl font-bold text-slate-100">
            Clave de Google Maps no configurada
          </h3>
          <p className="text-sm text-slate-400">
            Asegúrate de haber habilitado Google Maps Platform en el entorno para visualizar el mapa operativo del Estado Trujillo.
          </p>
        </div>
      </div>
    );
  }

  const activeLiveLocations = liveLocations.filter((l) => l.enComision);

  return (
    <div className="relative w-full h-full min-h-[540px] bg-[#0B1117] overflow-hidden flex flex-col">
      {/* Map Action & Layer Toolbar */}
      <div className="bg-[#111822] border-b border-slate-800/90 px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSearchPanelOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              searchPanelOpen || routeSummary
                ? 'bg-emerald-600 text-white'
                : 'bg-[#192332] text-emerald-200 hover:bg-[#223044] border border-slate-700/80'
            }`}
            title="Buscar sitio o trazar ruta en el mapa"
          >
            {routeSummary ? (
              <RouteIcon className="w-3.5 h-3.5" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            {routeSummary ? `Ruta (${routeSummary.distanceText})` : 'Buscar / Ruta'}
          </button>

          {canOperate && (
            <>
              <button
                type="button"
                onClick={() =>
                  onMapModeChange(mapMode === 'mark_incident' ? 'inspect' : 'mark_incident')
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mapMode === 'mark_incident'
                    ? 'bg-amber-600 text-white'
                    : 'bg-[#192332] text-amber-200 hover:bg-[#223044] border border-slate-700/80'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                {mapMode === 'mark_incident' ? 'Cancelar Novedad' : 'Novedad'}
              </button>

              <button
                type="button"
                onClick={() =>
                  onMapModeChange(mapMode === 'mark_patrol' ? 'inspect' : 'mark_patrol')
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mapMode === 'mark_patrol'
                    ? 'bg-teal-600 text-white'
                    : 'bg-[#192332] text-teal-200 hover:bg-[#223044] border border-slate-700/80'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                {mapMode === 'mark_patrol' ? 'Cancelar Patrullaje' : 'Punto Patrullado'}
              </button>

              <button
                type="button"
                onClick={onToggleMyLiveGps}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  myLiveGpsActive
                    ? 'bg-cyan-700/90 border-cyan-300 text-white'
                    : 'bg-[#192332] border-slate-700/80 text-cyan-200 hover:bg-[#223044]'
                }`}
                title="Transmitir tu posición GPS en tiempo real mientras estás de comisión"
              >
                <Navigation className="w-3.5 h-3.5" />
                {myLiveGpsActive ? 'GPS Activo' : 'Mi GPS'}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setFitAllSeq((s) => s + 1)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#192332] text-slate-200 hover:bg-[#223044] border border-slate-700/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Encuadrar todas las comisiones activas simultáneamente"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Ver Todas ({commissions.filter((c) => c.estado !== 'finalizada').length})
          </button>

          <select
            aria-label="Ir a sector de Trujillo"
            defaultValue=""
            onChange={(e) => {
              const idx = Number(e.target.value);
              if (!Number.isNaN(idx) && TRUJILLO_SECTORS[idx]) {
                handleJumpSector(TRUJILLO_SECTORS[idx].lat, TRUJILLO_SECTORS[idx].lng);
              }
              e.target.value = '';
            }}
            className="bg-[#192332] text-slate-200 text-xs font-medium border border-slate-700/80 rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="" disabled>
              Sector Trujillo...
            </option>
            {TRUJILLO_SECTORS.map((sec, idx) => (
              <option key={sec.label} value={idx}>
                {sec.modalidad === 'lacustre' ? '[Lacustre] ' : ''}
                {sec.label}
              </option>
            ))}
          </select>
        </div>

        {/* Layer Toggles & Map Type */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-[#0B1117] border border-slate-800 rounded-md p-0.5 flex-wrap">
            {(
              [
                { key: 'boundaries', label: 'Límites Edo/Mun' },
                { key: 'commissions', label: 'Comisiones' },
                { key: 'zoneUnits', label: 'Unidades GNB' },
                { key: 'cuadrantesPaz', label: 'Cuadrantes' },
                { key: 'sectorGeofence', label: 'Geocerca' },
                { key: 'liveUsers', label: 'GPS Vivo' },
                { key: 'patrolPoints', label: 'Patrullaje' },
                { key: 'incidents', label: 'Novedades' },
                { key: 'crimeZones', label: 'Criminalidad' },
                { key: 'gangZones', label: 'Bandas' },
                { key: 'friendlyForces', label: 'F. Amigas' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onToggleLayer(item.key)}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  layers[item.key]
                    ? item.key === 'sectorGeofence' && deviatedCommissions.length > 0
                      ? 'bg-orange-900/80 text-orange-100'
                      : item.key === 'boundaries'
                        ? 'bg-indigo-700/80 text-indigo-50'
                        : 'bg-[#1F2D40] text-slate-100'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {item.label}
                {item.key === 'sectorGeofence' && deviatedCommissions.length > 0
                  ? ` (${deviatedCommissions.length})`
                  : ''}
              </button>
            ))}
          </div>

          <div
            className="flex items-center gap-1 bg-[#0B1117] border border-slate-800 rounded-md px-2 py-0.5 text-[11px]"
            title={
              canConfigureStructure
                ? 'Radio máximo permitido desde el sector asignado antes de activar alerta visual de desvío'
                : 'Radio de desvío configurado por el Administrador'
            }
          >
            <span className="text-slate-400 whitespace-nowrap">Radio:</span>
            {canConfigureStructure ? (
              <select
                aria-label="Radio permitido del sector asignado"
                value={patrolRadiusKm}
                onChange={(e) => onChangePatrolRadiusKm(Number(e.target.value))}
                className="bg-transparent text-orange-300 font-mono-tabular font-semibold focus:outline-none cursor-pointer py-0.5"
              >
                {[2, 5, 10, 15, 20].map((km) => (
                  <option key={km} value={km} className="bg-[#0B1117] text-white">
                    {km} km
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-orange-300 font-mono-tabular font-semibold py-0.5">
                {patrolRadiusKm} km
              </span>
            )}
          </div>

          <div className="flex items-center bg-[#0B1117] border border-slate-800 rounded-md p-0.5">
            <Layers className="w-3.5 h-3.5 text-slate-500 mx-1.5 shrink-0" />
            {(
              [
                { id: 'hybrid', label: 'Satélite' },
                { id: 'terrain', label: 'Relieve' },
                { id: 'roadmap', label: 'Vial' },
              ] as const
            ).map((mt) => (
              <button
                key={mt.id}
                type="button"
                onClick={() => setMapTypeId(mt.id)}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mapTypeId === mt.id
                    ? 'bg-emerald-700/80 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Mode Guidance Banner */}
      {mapMode !== 'inspect' && (
        <div
          className={`px-4 py-2 text-xs font-medium flex items-center justify-between gap-3 border-b ${
            mapMode === 'mark_incident'
              ? 'bg-amber-950/90 border-amber-500/40 text-amber-100'
              : mapMode === 'mark_patrol'
                ? 'bg-teal-950/90 border-teal-500/40 text-teal-100'
                : 'bg-sky-950/90 border-sky-500/40 text-sky-100'
          }`}
        >
          <span className="flex items-center gap-2">
            {mapMode === 'mark_patrol' ? (
              <ClipboardCheck className="w-4 h-4 shrink-0" />
            ) : (
              <Crosshair className="w-4 h-4 shrink-0" />
            )}
            {mapMode === 'mark_incident'
              ? 'Toca cualquier punto del mapa para georreferenciar una nueva novedad criminal y adjuntar foto con coordenadas.'
              : mapMode === 'mark_patrol'
                ? 'Toca cualquier punto del mapa para registrar un sector patrullado, lo observado y adjuntar foto del sitio.'
                : 'Toca la nueva posición sobre el mapa para actualizar en tiempo real las coordenadas de la comisión seleccionada.'}
          </span>
          <button
            type="button"
            onClick={() => onMapModeChange('inspect')}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-black/30 hover:bg-black/50 rounded text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      )}

      {/* Map Canvas (Explicit full height container) */}
      <div
        className={`relative flex-1 w-full min-h-[480px] ${
          mapMode !== 'inspect' ? 'cursor-crosshair' : ''
        }`}
      >
        <APIProvider
          apiKey={apiKey}
          language="es"
          region="VE"
          libraries={['marker', 'places', 'routes']}
        >
          <GoogleMap
            id="tactical-map"
            mapId="DEMO_MAP_ID"
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={DEFAULT_ZOOM}
            mapTypeId={mapTypeId}
            gestureHandling="greedy"
            streetViewControl={false}
            fullscreenControl={false}
            mapTypeControl={false}
            onClick={handleMapClick}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio', 'gmp_git_agentskills_v1']}
            style={{ width: '100%', height: '100%' }}
          >
            <CameraController
              focusTarget={effectiveFocus}
              fitAllSeq={fitAllSeq}
              commissions={commissions}
              liveLocations={activeLiveLocations}
            />

            <TrujilloBoundariesOverlay
              visible={layers.boundaries}
              clickable={mapMode === 'inspect'}
              selectedMunicipalityId={
                activePopup?.kind === 'municipality' ? activePopup.item.id : null
              }
              onSelectMunicipality={handleSelectMunicipality}
            />

            {/* Subtle Translucent Municipality Name Labels */}
            {layers.boundaries &&
              TRUJILLO_MUNICIPALITY_BOUNDARIES.map((muni) => (
                <AdvancedMarker
                  key={`muni_lbl_${muni.id}`}
                  position={muni.center}
                  zIndex={5}
                  clickable={false}
                >
                  <div
                    className="pointer-events-none select-none px-1.5 py-0.5 rounded bg-slate-950/65 backdrop-blur-[1px] border text-[9px] font-semibold tracking-wide text-slate-100/95 shadow whitespace-nowrap"
                    style={{ borderColor: `${muni.strokeColor}99` }}
                  >
                    {muni.nombre}
                  </div>
                </AdvancedMarker>
              ))}

            <TacticalCirclesOverlay
              incidents={incidents}
              gangZones={gangZones}
              liveLocations={activeLiveLocations}
              deviations={commissionDeviations}
              selectedCommissionId={selectedCommissionId}
              showCrimeZones={layers.crimeZones}
              showGangZones={layers.gangZones}
              showLiveUsers={layers.liveUsers}
              showSectorGeofence={layers.sectorGeofence}
              showCuadrantesPaz={layers.cuadrantesPaz}
            />

            <RoutePolylineOverlay
              origin={routeOrigin}
              destination={routeDestination}
              travelMode={travelMode}
              onRouteComputed={setRouteSummary}
              onRouteLoading={setRouteLoading}
              onRouteError={setRouteError}
            />

            {/* Searched Place Marker */}
            {searchedPlace && (
              <AdvancedMarker
                position={{ lat: searchedPlace.lat, lng: searchedPlace.lng }}
                zIndex={96}
                onClick={() => setActivePopup({ kind: 'search_place', item: searchedPlace })}
                title={searchedPlace.label}
              >
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-700 border-2 border-white text-white shadow-xl">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] font-bold max-w-[140px] truncate whitespace-nowrap">
                    {searchedPlace.label}
                  </span>
                </div>
              </AdvancedMarker>
            )}

            {/* Route Origin (A) & Destination (B) Markers */}
            {routeOrigin && (
              <AdvancedMarker
                position={{ lat: routeOrigin.lat, lng: routeOrigin.lng }}
                zIndex={97}
                title={`Origen: ${routeOrigin.label}`}
              >
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-600 border-2 border-white text-white shadow-xl">
                  <span className="font-mono-tabular text-[11px] font-extrabold">A</span>
                  <span className="text-[10px] font-semibold max-w-[110px] truncate whitespace-nowrap">
                    {routeOrigin.label}
                  </span>
                </div>
              </AdvancedMarker>
            )}

            {routeDestination && (
              <AdvancedMarker
                position={{ lat: routeDestination.lat, lng: routeDestination.lng }}
                zIndex={98}
                title={`Destino: ${routeDestination.label}`}
              >
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-600 border-2 border-white text-white shadow-xl">
                  <span className="font-mono-tabular text-[11px] font-extrabold">B</span>
                  <span className="text-[10px] font-semibold max-w-[110px] truncate whitespace-nowrap">
                    {routeDestination.label}
                  </span>
                </div>
              </AdvancedMarker>
            )}

            {/* CZGNB-23 Organic Units (HQ, 3 Destacamentos, Companias, Puestos / PACs) */}
            {layers.zoneUnits &&
              zoneUnits.map((unit) => {
                const meta = DESTACAMENTO_META[unit.destacamento];
                const isHq = unit.nivel === 'comando_zona' || unit.nivel === 'destacamento';
                const isCompania = unit.nivel === 'compania';
                const shortName = unit.nombre
                  .replace(/^Puesto\s+(GNB|Rural|DESUR)\s+/i, '')
                  .replace(/^Sede\s+/i, '')
                  .slice(0, 24);
                return (
                  <AdvancedMarker
                    key={unit.id}
                    position={{ lat: unit.lat, lng: unit.lng }}
                    zIndex={
                      unit.nivel === 'comando_zona'
                        ? 65
                        : unit.nivel === 'destacamento'
                          ? 58
                          : isCompania
                            ? 28
                            : 24
                    }
                    onClick={() => setActivePopup({ kind: 'zone_unit', item: unit })}
                    title={`${meta.shortLabel} · ${unit.codigo} — ${unit.nombre}`}
                  >
                    <div
                      className={`flex items-center gap-1 rounded border shadow-lg hover:scale-105 transition-transform ${
                        meta.markerClass
                      } ${
                        isHq
                          ? 'px-2.5 py-1 border-2 ring-2 ring-white/30'
                          : isCompania
                            ? 'px-2 py-0.5 text-[10px]'
                            : 'px-1.5 py-0.5 text-[9px] opacity-95'
                      } ${unit.estadoOperativo === 'inactivo' ? 'opacity-50 grayscale' : ''} ${
                        unit.estadoOperativo === 'alerta' ? 'ring-2 ring-amber-400 animate-pulse' : ''
                      }`}
                    >
                      <Shield className={isHq ? 'w-3.5 h-3.5 shrink-0' : 'w-2.5 h-2.5 shrink-0'} />
                      <span className="font-mono-tabular font-bold tracking-tight whitespace-nowrap">
                        {unit.nivel === 'comando_zona'
                          ? 'HQ CZGNB-23'
                          : unit.nivel === 'destacamento'
                            ? `SEDE ${meta.shortLabel}`
                            : `${unit.codigo.split('-').slice(-1)[0]} · ${shortName}`}
                      </span>
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* Friendly Forces Markers (Differentiated by Institutional Color) */}
            {layers.friendlyForces &&
              friendlyForces.map((force) => {
                const style = AGENCY_STYLES[force.organismo];
                return (
                  <AdvancedMarker
                    key={force.id}
                    position={{ lat: force.lat, lng: force.lng }}
                    zIndex={20}
                    onClick={() => setActivePopup({ kind: 'friendly', item: force })}
                    title={`${AGENCY_SHORT_LABELS[force.organismo]} — ${force.nombre}`}
                  >
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded border shadow-md hover:scale-105 transition-transform ${style.markerBg} ${
                        !force.disponible ? 'opacity-65' : ''
                      }`}
                    >
                      <Shield className={`w-3 h-3 shrink-0 ${style.markerIcon}`} />
                      <span className="font-mono-tabular text-[10px] font-bold tracking-tight whitespace-nowrap">
                        {AGENCY_SHORT_LABELS[force.organismo]}
                      </span>
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* Gang Zone Center Markers */}
            {layers.gangZones &&
              gangZones
                .filter((z) => z.activa)
                .map((zone) => (
                  <AdvancedMarker
                    key={zone.id}
                    position={{ lat: zone.lat, lng: zone.lng }}
                    zIndex={15}
                    onClick={() => setActivePopup({ kind: 'gang', item: zone })}
                    title={`Zona de Amenaza: ${zone.nombre}`}
                  >
                    <div
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold shadow-md whitespace-nowrap ${
                        zone.nivelAmenaza === 'critico'
                          ? 'bg-red-950/95 border-red-400/80 text-red-100'
                          : 'bg-amber-950/95 border-amber-400/80 text-amber-100'
                      }`}
                    >
                      GEDO · {zone.alias || zone.nombre}
                    </div>
                  </AdvancedMarker>
                ))}

            {/* Patrolled Checkpoints Markers */}
            {layers.patrolPoints &&
              patrolPoints.map((pt) => {
                const styleClass =
                  pt.condicionSector === 'riesgo_alto' ||
                  pt.condicionSector === 'presencia_irregular'
                    ? 'bg-rose-950/95 border-rose-400 text-rose-100'
                    : pt.condicionSector === 'actividad_sospechosa' ||
                        pt.condicionSector === 'via_obstruida'
                      ? 'bg-amber-950/95 border-amber-400 text-amber-100'
                      : 'bg-teal-950/95 border-teal-400 text-teal-100';

                return (
                  <AdvancedMarker
                    key={pt.id}
                    position={{ lat: pt.lat, lng: pt.lng }}
                    zIndex={30}
                    onClick={() => setActivePopup({ kind: 'patrol', item: pt })}
                    title={`Punto Patrullado: ${pt.titulo}`}
                  >
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border shadow-md hover:scale-105 transition-transform ${styleClass}`}
                    >
                      <ClipboardCheck className="w-3 h-3 shrink-0" />
                      <span className="text-[10px] font-semibold whitespace-nowrap max-w-[110px] truncate">
                        {pt.sector || pt.titulo}
                      </span>
                      {pt.fotoDataUrl && <Camera className="w-2.5 h-2.5 shrink-0 opacity-90" />}
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* Cuadrantes de Paz del Estado Trujillo */}
            {layers.cuadrantesPaz &&
              TRUJILLO_CUADRANTES_PAZ.map((q) => {
                const st = CUADRANTE_TYPE_STYLES[q.tipo];
                const patrolsInQ = patrolPoints.filter((p) => p.cuadrantePaz === q.codigo).length;
                return (
                  <AdvancedMarker
                    key={q.codigo}
                    position={{ lat: q.lat, lng: q.lng }}
                    zIndex={12}
                    onClick={() => setActivePopup({ kind: 'cuadrante', item: q })}
                    title={`${q.codigo} — ${q.nombre} (${q.municipio})`}
                  >
                    <div
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono-tabular font-bold shadow hover:scale-105 transition-transform whitespace-nowrap ${st.markerBg}`}
                    >
                      <span>{q.codigo.replace('CUPAZ-', 'CP-')}</span>
                      {patrolsInQ > 0 && (
                        <span className="px-1 rounded bg-black/40 text-emerald-300">
                          {patrolsInQ}✓
                        </span>
                      )}
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* Crime Map Incident Markers (Orden Público, Seguridad Vial, Homicidios, Seguridad Rural, Ambiental) */}
            {layers.incidents &&
              incidents.map((inc) => {
                const isCrit = inc.severidad === 'critica' || inc.severidad === 'alta';
                const isEnv = isEnvironmentalIncidentType(inc.tipo);
                const isTraffic = isTrafficIncidentType(inc.tipo);
                const isViolent = isViolentIncidentType(inc.tipo);
                const isPublicOrder = isPublicOrderIncidentType(inc.tipo);
                const shortLabel = INCIDENT_TYPE_LABELS[inc.tipo]
                  .replace(/^(Ambiental|Tránsito|Seguridad Vial|Orden Público|Servicios Públicos):\s*/i, '')
                  .split(' / ')[0];
                return (
                  <AdvancedMarker
                    key={inc.id}
                    position={{ lat: inc.lat, lng: inc.lng }}
                    zIndex={isViolent || isPublicOrder ? 40 : isCrit ? 35 : 25}
                    onClick={() => setActivePopup({ kind: 'incident', item: inc })}
                    title={`Novedad: ${inc.titulo}`}
                  >
                    <div
                      className={`flex items-center gap-1 px-1.5 py-1 rounded-md border shadow-lg hover:scale-105 transition-transform ${
                        isPublicOrder
                          ? 'bg-fuchsia-950/95 border-fuchsia-300 text-fuchsia-50'
                          : isTraffic
                            ? 'bg-sky-950/95 border-sky-300 text-sky-50'
                            : isViolent
                              ? 'bg-[#4C0519]/95 border-rose-300 text-rose-50'
                              : isEnv
                                ? 'bg-emerald-950/95 border-lime-400 text-lime-100'
                                : inc.severidad === 'critica'
                                  ? 'bg-red-900/95 border-red-300 text-white'
                                  : inc.severidad === 'alta'
                                    ? 'bg-orange-900/95 border-orange-300 text-orange-50'
                                    : 'bg-amber-900/95 border-amber-300 text-amber-50'
                      }`}
                    >
                      {isPublicOrder ? (
                        <Megaphone className="w-3 h-3 text-fuchsia-300 shrink-0" />
                      ) : isTraffic ? (
                        <Car className="w-3 h-3 text-sky-300 shrink-0" />
                      ) : isViolent ? (
                        <Skull className="w-3 h-3 text-rose-300 shrink-0" />
                      ) : isEnv ? (
                        <Leaf className="w-3 h-3 text-lime-400 shrink-0" />
                      ) : (
                        <Flame className="w-3 h-3 shrink-0" />
                      )}
                      <span className="text-[10px] font-semibold whitespace-nowrap max-w-[115px] truncate">
                        {isPublicOrder && inc.pasoHabilitado === 'cerrado_total'
                          ? `CIERRE · ${shortLabel}`
                          : shortLabel}
                      </span>
                      {inc.fotoDataUrl && <Camera className="w-2.5 h-2.5 shrink-0 opacity-90" />}
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* Assigned Sector Center Anchors for Deviated or Selected Commissions */}
            {layers.sectorGeofence &&
              commissionDeviations
                .filter((d) => d.isDeviated || d.commission.id === selectedCommissionId)
                .map((dev) => (
                  <AdvancedMarker
                    key={`sector_anchor_${dev.commission.id}`}
                    position={{ lat: dev.sectorAnchor.lat, lng: dev.sectorAnchor.lng }}
                    zIndex={42}
                    title={`Sector asignado a ${dev.commission.codigo}: ${dev.sectorAnchor.label}`}
                    onClick={() => {
                      onSelectCommission(dev.commission.id);
                      setSectorJumpTarget({
                        lat: dev.commission.lat,
                        lng: dev.commission.lng,
                        zoom: 12,
                        seq: Date.now(),
                      });
                    }}
                  >
                    <div
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold shadow-md whitespace-nowrap ${
                        dev.isDeviated
                          ? 'bg-orange-950/95 border-orange-400 text-orange-100'
                          : 'bg-emerald-950/90 border-emerald-400/70 text-emerald-200'
                      }`}
                    >
                      Sector {dev.commission.codigo} (R {dev.maxRadiusKm} km)
                    </div>
                  </AdvancedMarker>
                ))}

            {/* Simultaneous Active Military/Police Commissions */}
            {layers.commissions &&
              commissions.map((comm) => {
                const isSelected = comm.id === selectedCommissionId;
                const isSos = comm.alertaApoyo || comm.estado === 'apoyo_requerido';
                const isLacustre = comm.modalidad === 'lacustre';
                const isDone = comm.estado === 'finalizada';
                const deviation = deviationByCommissionId.get(comm.id);
                const isDeviated = Boolean(layers.sectorGeofence && deviation?.isDeviated);

                const bgClass = isSos
                  ? 'bg-red-600 border-white text-white ring-4 ring-red-500/60'
                  : isDeviated
                    ? 'bg-orange-600 border-amber-200 text-white ring-4 ring-orange-500/65'
                    : isDone
                      ? 'bg-slate-800/90 border-slate-500 text-slate-300'
                      : isLacustre
                        ? 'bg-sky-600 border-sky-100 text-white'
                        : 'bg-emerald-600 border-emerald-100 text-white';

                return (
                  <AdvancedMarker
                    key={comm.id}
                    position={{ lat: comm.lat, lng: comm.lng }}
                    zIndex={isSos ? 90 : isDeviated ? 82 : isSelected ? 70 : 50}
                    onClick={() => {
                      onSelectCommission(comm.id);
                      setActivePopup({ kind: 'commission', item: comm });
                    }}
                    title={
                      isDeviated && deviation
                        ? `${comm.codigo} — DESVÍO DE SECTOR (${deviation.distanceKm.toFixed(1)} km / límite ${deviation.maxRadiusKm} km)`
                        : `${comm.codigo} — ${comm.jefeGrado} ${comm.jefeNombre}`
                    }
                  >
                    <div className="relative flex flex-col items-center">
                      {isDeviated && deviation && (
                        <div className="mb-1 px-1.5 py-0.5 rounded bg-orange-950/95 border border-orange-400 text-orange-100 font-mono-tabular text-[9px] font-extrabold tracking-tight shadow-lg whitespace-nowrap animate-pulse">
                          DESVÍO · {deviation.distanceKm.toFixed(1)} km
                        </div>
                      )}
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border-2 shadow-xl transition-transform ${bgClass} ${
                          isSelected ? 'scale-110 ring-2 ring-white/80' : 'hover:scale-105'
                        }`}
                      >
                        {isSos || isDeviated ? (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        ) : isLacustre ? (
                          <Anchor className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Truck className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <div className="flex flex-col leading-none">
                          <span className="font-mono-tabular text-[11px] font-bold whitespace-nowrap">
                            {comm.codigo}
                            {isSos ? ' · APOYO' : isDeviated ? ' · FUERA SECTOR' : ''}
                          </span>
                          <span className="text-[9px] opacity-90 whitespace-nowrap">
                            {isLacustre ? 'Lacustre' : 'Terrestre'} · {comm.efectivos.length} eff.
                          </span>
                        </div>
                      </div>
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* Real-Time Officer GPS Beacons (Users on Commission) */}
            {layers.liveUsers &&
              activeLiveLocations.map((loc) => {
                const isMe = loc.uid === currentUserUid;
                return (
                  <AdvancedMarker
                    key={loc.id}
                    position={{ lat: loc.lat, lng: loc.lng }}
                    zIndex={isMe ? 95 : 85}
                    onClick={() => setActivePopup({ kind: 'live_user', item: loc })}
                    title={`GPS en Vivo: ${loc.displayName}`}
                  >
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/95 border-2 border-cyan-300 text-cyan-50 shadow-xl ring-2 ring-cyan-400/40 hover:scale-105 transition-transform">
                      <Radio className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-bold whitespace-nowrap">
                          {isMe ? 'MI GPS' : loc.displayName.split(' ')[0]}
                          {loc.commissionCodigo ? ` · ${loc.commissionCodigo}` : ''}
                        </span>
                        <span className="font-mono-tabular text-[9px] text-cyan-200 whitespace-nowrap">
                          ±{Math.round(loc.accuracyMeters)}m
                          {loc.speedKmh > 1 ? ` · ${Math.round(loc.speedKmh)} km/h` : ''}
                        </span>
                      </div>
                    </div>
                  </AdvancedMarker>
                );
              })}

            {/* InfoWindow for Selected Map Entity */}
            {activePopup && (
              <InfoWindow
                position={{
                  lat: activePopup.item.lat,
                  lng: activePopup.item.lng,
                }}
                onCloseClick={() => setActivePopup(null)}
                maxWidth={310}
              >
                <div className="text-slate-900 p-1 space-y-1.5 text-xs">
                  {activePopup.kind === 'commission' && (() => {
                    const dev = deviationByCommissionId.get(activePopup.item.id);
                    return (
                      <>
                        <div className="font-bold text-sm text-slate-950">
                          {activePopup.item.codigo} — {activePopup.item.nombre}
                        </div>
                        <div className="text-slate-600">
                          {activePopup.item.modalidad === 'lacustre' ? 'Vía Lacustre' : 'Vía Terrestre'} ·{' '}
                          {COMMISSION_STATUS_LABELS[activePopup.item.estado]}
                        </div>
                        <div>
                          <span className="font-semibold">Jefe:</span> {activePopup.item.jefeGrado}{' '}
                          {activePopup.item.jefeNombre}
                        </div>
                        <div>
                          <span className="font-semibold">Unidad:</span> {activePopup.item.vehiculoTipo} (
                          {activePopup.item.vehiculoPlaca})
                        </div>
                        <div className="font-mono text-[11px] text-slate-600">
                          {formatCoords(activePopup.item.lat, activePopup.item.lng)}
                        </div>
                        {dev && dev.isDeviated && (
                          <div className="p-2 bg-orange-100 border border-orange-300 text-orange-950 rounded space-y-1">
                            <div className="font-bold flex items-center gap-1 text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-orange-700 shrink-0" />
                              ALERTA DE DESVÍO DE SECTOR
                            </div>
                            <div className="text-[11px] leading-snug">
                              A <span className="font-bold">{dev.distanceKm.toFixed(1)} km</span> de{' '}
                              <span className="font-semibold">{dev.sectorAnchor.label}</span>{' '}
                              (exceso +{dev.excessKm.toFixed(1)} km sobre radio de {dev.maxRadiusKm} km).
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setSectorJumpTarget({
                                  lat: dev.sectorAnchor.lat,
                                  lng: dev.sectorAnchor.lng,
                                  zoom: 12,
                                  seq: Date.now(),
                                })
                              }
                              className="text-[10px] font-bold text-orange-800 underline cursor-pointer"
                            >
                              Ver sector asignado en el mapa
                            </button>
                          </div>
                        )}
                        {dev && !dev.isDeviated && (
                          <div className="text-[11px] text-emerald-800 font-medium">
                            Dentro del sector asignado ({dev.distanceKm.toFixed(1)} km / radio {dev.maxRadiusKm} km).
                          </div>
                        )}
                        {activePopup.item.alertaApoyo && (
                          <div className="p-1.5 bg-red-100 text-red-900 rounded font-semibold">
                            SOLICITUD DE APOYO: {activePopup.item.motivoAlerta || 'Refuerzo inmediato'}
                          </div>
                        )}
                        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                          <a
                            href={`tel:${sanitizePhoneForTel(activePopup.item.jefeTelefono)}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 text-white font-semibold rounded hover:bg-emerald-800"
                          >
                            <Phone className="w-3 h-3" />
                            Llamar al Jefe
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              startRouteTo(
                                {
                                  label: `${activePopup.item.codigo} — ${activePopup.item.sector}`,
                                  address: activePopup.item.nombre,
                                  lat: activePopup.item.lat,
                                  lng: activePopup.item.lng,
                                },
                                activePopup.item.modalidad === 'lacustre'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-white font-semibold rounded hover:bg-slate-700 cursor-pointer"
                          >
                            <RouteIcon className="w-3 h-3" />
                            Trazar Ruta
                          </button>
                        </div>
                      </>
                    );
                  })()}

                  {activePopup.kind === 'zone_unit' && (() => {
                    const u = activePopup.item;
                    const meta = DESTACAMENTO_META[u.destacamento];
                    return (
                      <>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                            {meta.shortLabel} · {u.codigo}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-700">
                            {ZONE_UNIT_LEVEL_LABELS[u.nivel]}
                          </span>
                        </div>
                        <div className="font-bold text-sm text-slate-950">{u.nombre}</div>
                        {u.compania && (
                          <div className="text-[11px] text-slate-700">
                            <span className="font-semibold">Adscripción:</span> {u.compania}
                          </div>
                        )}
                        <div className="text-slate-700">
                          <span className="font-semibold">Ubicación:</span> {u.sector} ({u.municipio})
                        </div>
                        <div className="text-[11px] text-slate-700">
                          <span className="font-semibold">Comandante:</span> {u.comandante || 'Por asignar'} ·{' '}
                          <span className="font-semibold">{u.efectivosGuardia}</span> eff. guardia
                        </div>
                        <div className="text-[11px] text-slate-600 flex flex-wrap gap-2">
                          <span>Estado: <strong>{ZONE_UNIT_STATUS_LABELS[u.estadoOperativo]}</strong></span>
                          {u.frecuenciaRadio && <span className="font-mono">{u.frecuenciaRadio}</span>}
                        </div>
                        {u.notas && <div className="text-[11px] text-slate-600">{u.notas}</div>}
                        <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                          {u.telefono && (
                            <a
                              href={`tel:${sanitizePhoneForTel(u.telefono)}`}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-700 text-white font-semibold rounded hover:bg-emerald-800"
                            >
                              <Phone className="w-3 h-3" />
                              Llamar
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              startRouteTo(
                                {
                                  label: `${u.codigo} — ${u.nombre}`,
                                  address: `${u.sector}, ${u.municipio}`,
                                  lat: u.lat,
                                  lng: u.lng,
                                },
                                u.modalidad === 'lacustre'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 text-white font-semibold rounded hover:bg-slate-700 cursor-pointer"
                          >
                            <RouteIcon className="w-3 h-3" />
                            Ruta
                          </button>
                          {canOperate && onDeployCommissionAtUnit && (
                            <button
                              type="button"
                              onClick={() => {
                                setActivePopup(null);
                                onDeployCommissionAtUnit(u);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-sky-700 text-white font-semibold rounded hover:bg-sky-800 cursor-pointer"
                            >
                              <Navigation className="w-3 h-3" />
                              Desplegar Aquí
                            </button>
                          )}
                          {canOperate &&
                            onEditZoneUnit &&
                            (canModerateIntelligence || u.ownerId === currentUserUid) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const latest =
                                    zoneUnits.find((z) => z.id === u.id) ?? u;
                                  setActivePopup(null);
                                  onEditZoneUnit(latest);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 text-white font-semibold rounded hover:bg-amber-700 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                Editar
                              </button>
                            )}
                        </div>
                      </>
                    );
                  })()}

                  {activePopup.kind === 'live_user' && (
                    <>
                      <div className="font-bold text-sm text-cyan-950">
                        {activePopup.item.displayName}
                        {activePopup.item.uid === currentUserUid ? ' (Tú)' : ''}
                      </div>
                      <div className="text-cyan-800 font-semibold">
                        En Comisión ·{' '}
                        {activePopup.item.commissionCodigo || 'Patrullaje Independiente'}
                      </div>
                      <div className="font-mono text-[11px] text-slate-700">
                        {formatCoords(activePopup.item.lat, activePopup.item.lng)}
                      </div>
                      <div className="text-slate-600 text-[11px]">
                        Precisión: ±{Math.round(activePopup.item.accuracyMeters)} m · Velocidad:{' '}
                        {Math.round(activePopup.item.speedKmh)} km/h
                      </div>
                      {canOperate && (
                        <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const coords = {
                                lat: activePopup.item.lat,
                                lng: activePopup.item.lng,
                              };
                              setActivePopup(null);
                              onMapClickForPatrol(coords);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-teal-700 text-white font-semibold rounded hover:bg-teal-800 cursor-pointer"
                          >
                            <ClipboardCheck className="w-3 h-3" />
                            Patrullaje Aquí
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const coords = {
                                lat: activePopup.item.lat,
                                lng: activePopup.item.lng,
                              };
                              setActivePopup(null);
                              onMapClickForIncident(coords);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 text-white font-semibold rounded hover:bg-amber-700 cursor-pointer"
                          >
                            <Flame className="w-3 h-3" />
                            Novedad Aquí
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {activePopup.kind === 'cuadrante' && (() => {
                    const q = activePopup.item;
                    const patrolsCount = patrolPoints.filter((p) => p.cuadrantePaz === q.codigo).length;
                    const assignedComms = commissions.filter(
                      (c) => c.cuadrantePaz === q.codigo && c.estado !== 'finalizada'
                    );
                    const incidentsCount = incidents.filter((i) => i.cuadrantePaz === q.codigo).length;
                    return (
                      <>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-teal-800 text-white font-mono text-[10px] font-bold">
                            {q.codigo}
                          </span>
                          <span className="text-[11px] font-semibold text-teal-800">
                            {CUADRANTE_TYPE_LABELS[q.tipo]} · {q.municipio}
                          </span>
                        </div>
                        <div className="font-bold text-sm text-slate-950">{q.nombre}</div>
                        <div className="text-slate-700 leading-snug">
                          <span className="font-semibold">Sectores:</span> {q.sectores}
                        </div>
                        <div className="text-slate-600 text-[11px]">
                          <span className="font-semibold">Responsable:</span> {q.organismo} · Radio{' '}
                          {q.radioKm} km
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-semibold pt-0.5">
                          <span className="text-teal-700">{patrolsCount} patrullajes</span>
                          <span>·</span>
                          <span className="text-emerald-700">{assignedComms.length} comisiones</span>
                          <span>·</span>
                          <span className="text-amber-700">{incidentsCount} novedades</span>
                        </div>
                        <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                          {canOperate && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePopup(null);
                                  onMapClickForPatrol({ lat: q.lat, lng: q.lng }, q);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-teal-700 text-white font-semibold rounded hover:bg-teal-800 cursor-pointer"
                              >
                                <ClipboardCheck className="w-3 h-3" />
                                Patrullar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePopup(null);
                                  onMapClickForIncident(
                                    { lat: q.lat, lng: q.lng },
                                    q.tipo === 'vial' ? 'accidente_colision' : undefined,
                                    q
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-sky-700 text-white font-semibold rounded hover:bg-sky-800 cursor-pointer"
                              >
                                <Car className="w-3 h-3" />
                                {q.tipo === 'vial' ? 'Accidente Vial' : 'Novedad'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePopup(null);
                                  onMapClickForIncident(
                                    { lat: q.lat, lng: q.lng },
                                    'cierre_via_servicios',
                                    q
                                  );
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-fuchsia-700 text-white font-semibold rounded hover:bg-fuchsia-800 cursor-pointer"
                              >
                                <Megaphone className="w-3 h-3" />
                                Protesta / Cierre
                              </button>
                            </>
                          )}
                          <a
                            href={`tel:${sanitizePhoneForTel(q.telefonoVen911)}`}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-700 text-white font-semibold rounded hover:bg-emerald-800"
                          >
                            <Phone className="w-3 h-3" />
                            VEN-911
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              startRouteTo(
                                {
                                  label: `${q.codigo} — ${q.municipio}`,
                                  address: q.sectores,
                                  lat: q.lat,
                                  lng: q.lng,
                                },
                                q.modalidad === 'lacustre'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 text-white font-semibold rounded hover:bg-slate-700 cursor-pointer"
                          >
                            <RouteIcon className="w-3 h-3" />
                            Ruta
                          </button>
                        </div>
                      </>
                    );
                  })()}

                  {activePopup.kind === 'patrol' && (
                    <>
                      <div className="font-bold text-sm text-teal-950">
                        {activePopup.item.titulo}
                      </div>
                      <div className="text-teal-800 font-semibold">
                        {PATROL_CONDITION_LABELS[activePopup.item.condicionSector]}
                        {activePopup.item.cuadrantePaz ? ` · ${activePopup.item.cuadrantePaz}` : ''}
                      </div>
                      <div className="text-slate-700">
                        {activePopup.item.caracteristicasVistas}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Flujo: {TRAFFIC_FLOW_LABELS[activePopup.item.flujoVehicular]} · Luz:{' '}
                        {LIGHTING_CONDITION_LABELS[activePopup.item.iluminacion]}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {activePopup.item.sector} · {activePopup.item.municipio} ·{' '}
                        {activePopup.item.patrulladoPor}
                      </div>
                      <div className="font-mono text-[10px] text-slate-600">
                        {formatCoords(activePopup.item.lat, activePopup.item.lng)}
                      </div>
                      {activePopup.item.fotoDataUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxPhoto({
                              src: activePopup.item.fotoDataUrl,
                              title: `Punto Patrullado: ${activePopup.item.titulo}`,
                              coords:
                                activePopup.item.fotoCoordenadas ||
                                formatCoords(activePopup.item.lat, activePopup.item.lng),
                            })
                          }
                          className="block w-full pt-1 cursor-pointer group"
                        >
                          <img
                            src={activePopup.item.fotoDataUrl}
                            alt={activePopup.item.titulo}
                            className="w-full h-32 object-cover rounded border border-slate-300 group-hover:opacity-90"
                          />
                          <span className="text-[10px] text-teal-700 font-semibold">
                            Toca para ampliar fotografía georreferenciada
                          </span>
                        </button>
                      )}
                    </>
                  )}

                  {activePopup.kind === 'incident' && (() => {
                    const inc = activePopup.item;
                    const isTraffic = isTrafficIncidentType(inc.tipo);
                    const isViolent = isViolentIncidentType(inc.tipo);
                    const isEnv = isEnvironmentalIncidentType(inc.tipo);
                    const isPublicOrder = isPublicOrderIncidentType(inc.tipo);
                    const qObj = getCuadranteByCode(inc.cuadrantePaz);
                    return (
                      <>
                        <div className="font-bold text-sm text-slate-950">{inc.titulo}</div>
                        <div
                          className={`font-semibold ${
                            isPublicOrder
                              ? 'text-fuchsia-800'
                              : isTraffic
                                ? 'text-sky-700'
                                : isViolent
                                  ? 'text-rose-800'
                                  : isEnv
                                    ? 'text-emerald-700'
                                    : 'text-red-700'
                          }`}
                        >
                          {INCIDENT_TYPE_LABELS[inc.tipo]} · Severidad{' '}
                          {INCIDENT_SEVERITY_LABELS[inc.severidad]}
                        </div>
                        {(inc.pasoHabilitado || inc.servicioPublico || inc.personasConcentradas) ? (
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold bg-fuchsia-50 border border-fuchsia-200 rounded px-2 py-1">
                            {inc.pasoHabilitado && (
                              <span
                                className={
                                  inc.pasoHabilitado === 'cerrado_total'
                                    ? 'text-red-700'
                                    : inc.pasoHabilitado === 'via_libre'
                                      ? 'text-emerald-700'
                                      : 'text-fuchsia-800'
                                }
                              >
                                {ROAD_ACCESS_STATUS_LABELS[inc.pasoHabilitado]}
                              </span>
                            )}
                            {inc.servicioPublico && (
                              <span className="text-slate-800">· {inc.servicioPublico}</span>
                            )}
                            {typeof inc.personasConcentradas === 'number' &&
                              inc.personasConcentradas > 0 && (
                                <span className="text-amber-800">
                                  · ~{inc.personasConcentradas} pers.
                                </span>
                              )}
                          </div>
                        ) : null}
                        {(inc.fallecidos || inc.lesionados || inc.vehiculosInvolucrados) ? (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold bg-slate-100 border border-slate-200 rounded px-2 py-1">
                            {typeof inc.fallecidos === 'number' && inc.fallecidos > 0 && (
                              <span className="text-red-700">Fallecidos: {inc.fallecidos}</span>
                            )}
                            {typeof inc.lesionados === 'number' && inc.lesionados > 0 && (
                              <span className="text-amber-700">Lesionados: {inc.lesionados}</span>
                            )}
                            {typeof inc.vehiculosInvolucrados === 'number' &&
                              inc.vehiculosInvolucrados > 0 && (
                                <span className="text-sky-800">
                                  Vehículos: {inc.vehiculosInvolucrados}
                                </span>
                              )}
                          </div>
                        ) : null}
                        {inc.viaAfectada && (
                          <div className="text-[11px] text-slate-700">
                            <span className="font-semibold">Vía:</span> {inc.viaAfectada}
                          </div>
                        )}
                        {inc.causaProbable && (
                          <div className="text-[11px] text-slate-700">
                            <span className="font-semibold">
                              {isPublicOrder
                                ? 'Exigencia / Motivo:'
                                : isTraffic
                                  ? 'Causa probable:'
                                  : 'Móvil / Medio:'}
                            </span>{' '}
                            {inc.causaProbable}
                          </div>
                        )}
                        {inc.placasInvolucradas && (
                          <div className="text-[11px] font-mono text-slate-700">
                            <span className="font-sans font-semibold">Placas/Veh.:</span>{' '}
                            {inc.placasInvolucradas}
                          </div>
                        )}
                        <div className="text-slate-700">{inc.descripcion}</div>
                        <div className="text-slate-500">
                          {inc.sector} · {inc.municipio}
                          {qObj ? ` · ${qObj.codigo}` : ''}
                        </div>
                        <div className="font-mono text-[10px] text-slate-600">
                          {formatCoords(inc.lat, inc.lng)}
                        </div>
                        {inc.fotoDataUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxPhoto({
                                src: inc.fotoDataUrl || '',
                                title: `Novedad: ${inc.titulo}`,
                                coords:
                                  inc.fotoCoordenadas || formatCoords(inc.lat, inc.lng),
                              })
                            }
                            className="block w-full pt-1 cursor-pointer group"
                          >
                            <img
                              src={inc.fotoDataUrl}
                              alt={inc.titulo}
                              className="w-full h-32 object-cover rounded border border-slate-300 group-hover:opacity-90"
                            />
                            <span className="text-[10px] text-amber-800 font-semibold">
                              Toca para ampliar fotografía con coordenadas
                            </span>
                          </button>
                        )}
                      </>
                    );
                  })()}

                  {activePopup.kind === 'gang' && (
                    <>
                      <div className="font-bold text-sm text-red-900">
                        {activePopup.item.nombre}
                      </div>
                      <div className="text-amber-800 font-semibold">
                        Nivel {activePopup.item.nivelAmenaza.toUpperCase()} · Radio{' '}
                        {activePopup.item.radioKm} km
                      </div>
                      <div className="text-slate-700">
                        <span className="font-semibold">Delitos:</span>{' '}
                        {activePopup.item.delitos.join(', ')}
                      </div>
                      <div className="text-slate-800 pt-1 border-t border-slate-200">
                        <span className="font-semibold">Recomendación:</span>{' '}
                        {activePopup.item.recomendacionTactica}
                      </div>
                      {onEditGangZone &&
                        canOperate &&
                        (canModerateIntelligence ||
                          activePopup.item.ownerId === currentUserUid) && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const latest =
                                gangZones.find((g) => g.id === activePopup.item.id) ??
                                activePopup.item;
                              setActivePopup(null);
                              onEditGangZone(latest);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white font-semibold rounded hover:bg-amber-700 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            Editar Banda
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {activePopup.kind === 'friendly' && (() => {
                    const style = AGENCY_STYLES[activePopup.item.organismo];
                    return (
                      <>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${style.popupAccent}`}
                          >
                            {AGENCY_SHORT_LABELS[activePopup.item.organismo]}
                          </span>
                          <span className="text-[11px] text-slate-600 font-medium">
                            {activePopup.item.sector}
                          </span>
                        </div>
                        <div className="font-bold text-sm text-slate-950">
                          {activePopup.item.nombre}
                        </div>
                        <div className="text-slate-700">{activePopup.item.capacidad}</div>
                        <div className="font-mono text-[11px] text-slate-600">
                          Radio: {activePopup.item.frecuenciaRadio || 'N/A'}
                        </div>
                        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                          <a
                            href={`tel:${sanitizePhoneForTel(activePopup.item.telefono)}`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 font-semibold rounded ${style.callButton}`}
                          >
                            <Phone className="w-3 h-3" />
                            Llamar {activePopup.item.telefono}
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              startRouteTo({
                                label: activePopup.item.nombre,
                                address: activePopup.item.sector,
                                lat: activePopup.item.lat,
                                lng: activePopup.item.lng,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-white font-semibold rounded hover:bg-slate-700 cursor-pointer"
                          >
                            <RouteIcon className="w-3 h-3" />
                            Ruta
                          </button>
                          {onEditFriendlyForce &&
                            canOperate &&
                            (canModerateIntelligence ||
                              activePopup.item.ownerId === currentUserUid) && (
                            <button
                              type="button"
                              onClick={() => {
                                const latest =
                                  friendlyForces.find((f) => f.id === activePopup.item.id) ??
                                  activePopup.item;
                                setActivePopup(null);
                                onEditFriendlyForce(latest);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-700 text-white font-semibold rounded hover:bg-sky-800 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              Editar
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {activePopup.kind === 'municipality' && (() => {
                    const muni = activePopup.item;
                    const destMeta = DESTACAMENTO_META[muni.destacamento];
                    const muniNameLower = muni.nombre.toLowerCase();
                    const muniUnits = zoneUnits.filter((u) =>
                      u.municipio.toLowerCase().includes(muniNameLower)
                    );
                    const muniIncidents = incidents.filter((i) =>
                      i.municipio.toLowerCase().includes(muniNameLower)
                    );
                    const muniComms = commissions.filter(
                      (c) =>
                        c.estado !== 'finalizada' &&
                        (c.sector.toLowerCase().includes(muniNameLower) ||
                          c.destacamento === muni.destacamento)
                    );
                    return (
                      <>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-block w-3 h-3 rounded-sm border shrink-0"
                            style={{
                              backgroundColor: `${muni.fillColor}55`,
                              borderColor: muni.strokeColor,
                            }}
                          />
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            Estado Trujillo · Municipio
                          </span>
                        </div>
                        <div className="font-bold text-sm text-slate-950">
                          Municipio {muni.nombre}
                        </div>
                        <div className="text-slate-700">
                          <span className="font-semibold">Capital:</span> {muni.capital}
                        </div>
                        <div className="text-slate-700">
                          <span className="font-semibold">Jurisdicción CZGNB-23:</span>{' '}
                          <span className="font-bold">{destMeta.shortLabel}</span> ({destMeta.nombreCompleto})
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                          <div className="bg-slate-100 rounded px-1.5 py-1">
                            <div className="font-mono font-bold text-slate-900">
                              {muniUnits.length}
                            </div>
                            <div className="text-[9px] text-slate-600">Unid. GNB</div>
                          </div>
                          <div className="bg-slate-100 rounded px-1.5 py-1">
                            <div className="font-mono font-bold text-emerald-700">
                              {muniComms.length}
                            </div>
                            <div className="text-[9px] text-slate-600">Comis. Dest.</div>
                          </div>
                          <div className="bg-slate-100 rounded px-1.5 py-1">
                            <div className="font-mono font-bold text-amber-700">
                              {muniIncidents.length}
                            </div>
                            <div className="text-[9px] text-slate-600">Novedades</div>
                          </div>
                        </div>
                        <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSectorJumpTarget({
                                lat: muni.center.lat,
                                lng: muni.center.lng,
                                zoom: 12,
                                seq: Date.now(),
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-700 text-white font-semibold rounded hover:bg-indigo-800 cursor-pointer"
                          >
                            <Crosshair className="w-3 h-3" />
                            Enfocar Municipio
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActivePopup(null);
                              onToggleLayer('boundaries');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-200 text-slate-800 font-semibold rounded hover:bg-slate-300 cursor-pointer"
                          >
                            Ocultar Límites
                          </button>
                        </div>
                      </>
                    );
                  })()}

                  {activePopup.kind === 'search_place' && (
                    <>
                      <div className="font-bold text-sm text-slate-950">
                        {activePopup.item.label}
                      </div>
                      {activePopup.item.address && (
                        <div className="text-slate-600">{activePopup.item.address}</div>
                      )}
                      <div className="font-mono text-[11px] text-slate-600">
                        {formatCoords(activePopup.item.lat, activePopup.item.lng)}
                      </div>
                      <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => startRouteTo(activePopup.item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 text-white font-semibold rounded hover:bg-emerald-800 cursor-pointer"
                        >
                          <RouteIcon className="w-3 h-3" />
                          Trazar Ruta Aquí
                        </button>
                        {canOperate && (
                          <button
                            type="button"
                            onClick={() => {
                              const coords = {
                                lat: activePopup.item.lat,
                                lng: activePopup.item.lng,
                              };
                              setActivePopup(null);
                              onMapClickForIncident(coords);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 text-white font-semibold rounded hover:bg-amber-700 cursor-pointer"
                          >
                            <Flame className="w-3 h-3" />
                            Novedad
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {(activePopup.kind === 'incident' || activePopup.kind === 'patrol' || activePopup.kind === 'gang') && (
                    <div className="pt-1.5 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() =>
                          startRouteTo(
                            {
                              label:
                                activePopup.kind === 'gang'
                                  ? activePopup.item.nombre
                                  : activePopup.item.titulo,
                              address: activePopup.item.sector,
                              lat: activePopup.item.lat,
                              lng: activePopup.item.lng,
                            },
                            activePopup.item.modalidad === 'lacustre'
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-white font-semibold rounded hover:bg-slate-700 cursor-pointer"
                      >
                        <RouteIcon className="w-3 h-3" />
                        Trazar Ruta hacia este Punto
                      </button>
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          <MapSearchAndRoutePanel
            open={searchPanelOpen}
            routeModeActive={routeModeActive}
            onClose={() => setSearchPanelOpen(false)}
            onToggleRoutePanel={setRouteModeActive}
            searchedPlace={searchedPlace}
            onSelectSearchedPlace={(place) => {
              setSearchedPlace(place);
              if (place) {
                setActivePopup({ kind: 'search_place', item: place });
              }
            }}
            routeOrigin={routeOrigin}
            routeDestination={routeDestination}
            travelMode={travelMode}
            routeSummary={routeSummary}
            routeLoading={routeLoading}
            routeError={routeError}
            onChangeOrigin={setRouteOrigin}
            onChangeDestination={setRouteDestination}
            onChangeTravelMode={setTravelMode}
            onClearRoute={handleClearRoute}
            onSwapEndpoints={handleSwapEndpoints}
            commissions={commissions}
            selectedCommission={selectedCommission}
            myLiveCoords={myLiveCoords}
            canOperate={canOperate}
            onMarkIncidentAtPlace={onMapClickForIncident}
            onMarkPatrolAtPlace={onMapClickForPatrol}
          />
        </APIProvider>

        {/* Floating Visual Alert Card for Sector Deviation (> patrolRadiusKm) */}
        {layers.sectorGeofence && deviatedCommissions.length > 0 && (
          <div className="absolute top-3 left-3 z-20 max-w-sm bg-[#1A1008]/95 backdrop-blur-sm border border-orange-500/80 rounded-md shadow-2xl overflow-hidden pointer-events-auto">
            <div className="px-3 py-2 bg-orange-950/90 border-b border-orange-500/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-200">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 animate-pulse" />
                <span>
                  DESVÍO DE SECTOR ({deviatedCommissions.length}) · Radio {patrolRadiusKm} km
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDeviationBannerCollapsed((v) => !v)}
                className="text-[10px] font-semibold text-orange-300 hover:text-white cursor-pointer whitespace-nowrap"
              >
                {deviationBannerCollapsed ? 'Ver' : 'Ocultar'}
              </button>
            </div>
            {!deviationBannerCollapsed && (
              <div className="p-2 space-y-1.5 max-h-44 overflow-y-auto">
                {deviatedCommissions.map((dev) => (
                  <div
                    key={dev.commission.id}
                    className="flex items-center justify-between gap-2 bg-black/35 border border-orange-500/30 rounded px-2.5 py-1.5 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-orange-100 truncate">
                        {dev.commission.codigo} ·{' '}
                        <span className="font-mono-tabular text-orange-300">
                          {dev.distanceKm.toFixed(1)} km
                        </span>{' '}
                        <span className="text-[10px] text-orange-400">
                          (+{dev.excessKm.toFixed(1)} km)
                        </span>
                      </div>
                      <div className="text-[10px] text-orange-200/80 truncate">
                        Sector: {dev.sectorAnchor.label}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCommission(dev.commission.id);
                        setActivePopup({ kind: 'commission', item: dev.commission });
                        setSectorJumpTarget({
                          lat: dev.commission.lat,
                          lng: dev.commission.lng,
                          zoom: 12,
                          seq: Date.now(),
                        });
                      }}
                      className="px-2 py-1 text-[10px] font-bold bg-orange-600 hover:bg-orange-500 text-white rounded cursor-pointer shrink-0"
                    >
                      Ubicar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Compact Map Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-[#0B1117]/92 backdrop-blur-sm border border-slate-700/80 rounded-md px-3 py-2 text-[11px] text-slate-300 space-y-1.5 pointer-events-auto max-w-[92%]">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              Terrestre
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" />
              Lacustre
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" />
              Desvío (&gt;{patrolRadiusKm} km)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
              Usuario GPS
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" />
              Cuadrantes / Patrullaje
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 inline-block" />
              Manifestación / Cierre
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
              Seguridad Vial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
              Homicidio / Grave
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
              Novedad Rural
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400 inline-block" />
              Ambiental
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block" />
              SOS
            </span>
          </div>
          {layers.boundaries && (
            <div className="pt-1 border-t border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-300">
              <span className="text-indigo-300 font-semibold">Límites Territoriales:</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-2 rounded-xs inline-block border-2 border-slate-100 bg-sky-500/20" />
                Estado Trujillo
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-2 rounded-xs inline-block border border-indigo-400 bg-indigo-500/35" />
                20 Municipios (color transparente · toca un municipio para ver detalle)
              </span>
            </div>
          )}
          {layers.zoneUnits && (
            <div className="pt-1 border-t border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-300">
              <span className="text-slate-400 font-semibold">Unidades CZ-23:</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#7A142B] border border-amber-300" />
                HQ CZGNB-23
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block bg-emerald-700 border border-emerald-300" />
                D-231
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block bg-sky-700 border border-sky-300" />
                DCR 23-1
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block bg-amber-600 border border-amber-200" />
                DESUR-23
              </span>
            </div>
          )}
          {layers.friendlyForces && (
            <div className="pt-1 border-t border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-300">
              <span className="text-slate-400 font-semibold">F. Amigas:</span>
              <span className="inline-flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-sm inline-block ${AGENCY_STYLES.GNB.dot}`} />
                GNB
              </span>
              <span className="inline-flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-sm inline-block ${AGENCY_STYLES.PNB.dot}`} />
                PNB
              </span>
              <span className="inline-flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-sm inline-block ${AGENCY_STYLES.POLICIA_ESTADAL.dot}`} />
                Estadal
              </span>
              <span className="inline-flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-sm inline-block ${AGENCY_STYLES.POLICIA_MUNICIPAL.dot}`} />
                Municipal
              </span>
              <span className="inline-flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-sm inline-block ${AGENCY_STYLES.CONAS.dot}`} />
                CONAS
              </span>
              <span className="inline-flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-sm inline-block ${AGENCY_STYLES.CICPC.dot}`} />
                CICPC
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Geotagged Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="max-w-3xl w-full bg-[#111822] border border-slate-700 rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {lightboxPhoto.title}
                </div>
                <div className="text-[11px] text-emerald-400 font-mono-tabular truncate">
                  {lightboxPhoto.coords}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer shrink-0"
                aria-label="Cerrar foto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black flex items-center justify-center">
              <img
                src={lightboxPhoto.src}
                alt={lightboxPhoto.title}
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

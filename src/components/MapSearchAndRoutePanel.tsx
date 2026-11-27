import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  Anchor,
  ArrowUpDown,
  Bike,
  Car,
  ChevronDown,
  ChevronUp,
  Crosshair,
  ExternalLink,
  Footprints,
  Loader2,
  MapPin,
  Navigation,
  Route as RouteIcon,
  Search,
  X,
} from 'lucide-react';
import { TRUJILLO_SECTORS, type Commission } from '../types/operations';
import { distanceKm, formatCoords } from '../lib/geo';

export interface MapPlacePoint {
  label: string;
  address?: string;
  lat: number;
  lng: number;
  viewport?: google.maps.LatLngBounds | null;
}

export type RouteTravelMode = 'DRIVING' | 'TWO_WHEELER' | 'WALKING' | 'LACUSTRE';

export interface ComputedRouteStep {
  instruction: string;
  distanceText: string;
}

export interface ComputedRouteSummary {
  distanceMeters: number;
  durationMillis: number;
  distanceText: string;
  durationText: string;
  isDirectLine: boolean;
  nauticalMiles?: number;
  steps: ComputedRouteStep[];
}

interface SdkRouteStep {
  instructions?: string | null;
  distanceMeters?: number | null;
}

interface SdkRouteLeg {
  steps?: SdkRouteStep[];
}

interface SdkRouteInstance {
  distanceMeters?: number | null;
  durationMillis?: number | null;
  viewport?: google.maps.LatLngBounds | null;
  legs?: SdkRouteLeg[];
  createPolylines: () => google.maps.Polyline[];
}

interface RoutesLibWithCompute {
  Route?: {
    computeRoutes: (request: Record<string, unknown>) => Promise<{
      routes?: SdkRouteInstance[];
    }>;
  };
}

const TRUJILLO_BIAS_RECT = {
  south: 8.5,
  west: -72.0,
  north: 10.5,
  east: -69.5,
};

const HQ_POINT: MapPlacePoint = {
  label: 'Sede CZGNB-23 Trujillo (Santa Cruz, Valera)',
  address: 'Sector Santa Cruz, Municipio Valera, Estado Trujillo',
  lat: 9.3545,
  lng: -70.6085,
};

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('QuotaExceededError') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('429')
  );
}

function formatDistanceMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDurationMillis(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}

function parseDirectCoordinates(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(-?\d{1,2}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

/**
 * Renders the active route polyline inside <GoogleMap> using the modern
 * Google Maps JS Routes Library (`Route.computeRoutes` + `createPolylines()`).
 * Falls back to a geodesic lacustrine line when `travelMode === 'LACUSTRE'`.
 */
export const RoutePolylineOverlay: React.FC<{
  origin: MapPlacePoint | null;
  destination: MapPlacePoint | null;
  travelMode: RouteTravelMode;
  onRouteComputed: (summary: ComputedRouteSummary | null) => void;
  onRouteLoading: (loading: boolean) => void;
  onRouteError: (error: string | null) => void;
}> = ({
  origin,
  destination,
  travelMode,
  onRouteComputed,
  onRouteLoading,
  onRouteError,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    const clearPolylines = () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };

    clearPolylines();

    if (!map || !origin || !destination) {
      onRouteComputed(null);
      onRouteError(null);
      onRouteLoading(false);
      return;
    }

    // Direct Lacustrine / Tactical Geodesic Line
    if (travelMode === 'LACUSTRE') {
      onRouteLoading(false);
      onRouteError(null);

      const km = distanceKm(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng }
      );
      const distanceMeters = Math.round(km * 1000);
      const nauticalMiles = km / 1.852;
      // Estimated patrol boat speed ~40 km/h (~21.6 knots)
      const durationMillis = Math.max(60000, Math.round((km / 40) * 3600 * 1000));

      const line = new google.maps.Polyline({
        path: [
          { lat: origin.lat, lng: origin.lng },
          { lat: destination.lat, lng: destination.lng },
        ],
        geodesic: true,
        strokeColor: '#38BDF8',
        strokeOpacity: 0.95,
        strokeWeight: 4,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 3.2,
              strokeColor: '#E0F2FE',
              fillColor: '#0284C7',
              fillOpacity: 1,
            },
            offset: '50%',
          },
        ],
        zIndex: 45,
        map,
      });
      polylinesRef.current = [line];

      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: origin.lat, lng: origin.lng });
      bounds.extend({ lat: destination.lat, lng: destination.lng });
      map.fitBounds(bounds, { top: 96, right: 64, bottom: 96, left: 64 });

      onRouteComputed({
        distanceMeters,
        durationMillis,
        distanceText: `${km.toFixed(1)} km (${nauticalMiles.toFixed(1)} MN)`,
        durationText: `~${formatDurationMillis(durationMillis)} (22 nd)`,
        isDirectLine: true,
        nauticalMiles,
        steps: [
          {
            instruction: `Navegación / rumbo directo desde ${origin.label} hacia ${destination.label}.`,
            distanceText: `${km.toFixed(1)} km`,
          },
        ],
      });

      return clearPolylines;
    }

    if (!routesLib) return;

    const routeClass = (routesLib as unknown as RoutesLibWithCompute).Route;
    if (!routeClass?.computeRoutes) {
      onRouteError('La librería moderna de Rutas no está disponible en este momento.');
      return;
    }

    let cancelled = false;
    onRouteLoading(true);
    onRouteError(null);

    // Modern Google Maps Platform JS SDK Routes API (replaces legacy DirectionsService)
    // Docs: https://developers.google.com/maps/documentation/javascript/reference/route?utm_campaign=gmp_mcp_codeassist_v1_aistudio
    routeClass
      .computeRoutes({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode,
        language: 'es',
        fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
      })
      .then(({ routes }) => {
        if (cancelled) return;
        onRouteLoading(false);

        const primaryRoute = routes?.[0];
        if (!primaryRoute) {
          onRouteComputed(null);
          onRouteError(
            'No se encontró ruta vial entre estos puntos. Si el destino es lacustre o rural sin carretera, selecciona "Lacustre".'
          );
          return;
        }

        const strokeColor =
          travelMode === 'DRIVING'
            ? '#10B981'
            : travelMode === 'TWO_WHEELER'
              ? '#F59E0B'
              : '#A855F7';

        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((poly) => {
          poly.setOptions({
            strokeColor,
            strokeOpacity: 0.94,
            strokeWeight: 6,
            zIndex: 45,
          });
          poly.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport, {
            top: 96,
            right: 64,
            bottom: 96,
            left: 64,
          });
        } else {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: origin.lat, lng: origin.lng });
          bounds.extend({ lat: destination.lat, lng: destination.lng });
          map.fitBounds(bounds, { top: 96, right: 64, bottom: 96, left: 64 });
        }

        const distanceMeters = primaryRoute.distanceMeters ?? 0;
        const durationMillis = primaryRoute.durationMillis ?? 0;
        const rawSteps = primaryRoute.legs?.[0]?.steps ?? [];
        const steps: ComputedRouteStep[] = rawSteps
          .filter((s) => Boolean(s.instructions))
          .map((s) => ({
            instruction: String(s.instructions || '').trim(),
            distanceText: s.distanceMeters ? formatDistanceMeters(s.distanceMeters) : '',
          }));

        onRouteComputed({
          distanceMeters,
          durationMillis,
          distanceText: formatDistanceMeters(distanceMeters),
          durationText: formatDurationMillis(durationMillis),
          isDirectLine: false,
          steps,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onRouteLoading(false);
        onRouteComputed(null);
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onRouteError(
          'No se pudo calcular la ruta vial. Puedes probar modo "Lacustre / Directa" o verificar conexión.'
        );
      });

    return () => {
      cancelled = true;
      clearPolylines();
    };
  }, [
    map,
    routesLib,
    origin,
    destination,
    travelMode,
    onRouteComputed,
    onRouteLoading,
    onRouteError,
  ]);

  return null;
};

interface PlaceAutocompleteInputProps {
  value: string;
  onChangeText: (val: string) => void;
  onSelectPoint: (point: MapPlacePoint) => void;
  placeholder: string;
  commissions: Commission[];
  icon?: React.ReactNode;
  ariaLabel: string;
  onClear?: () => void;
}

const PlaceAutocompleteInput: React.FC<PlaceAutocompleteInputProps> = ({
  value,
  onChangeText,
  onSelectPoint,
  placeholder,
  commissions,
  icon,
  ariaLabel,
  onClear,
}) => {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
  }, []);

  // Debounced Places API (New) AutocompleteSuggestion fetch with session token
  useEffect(() => {
    const trimmed = value.trim();
    if (!placesLib || trimmed.length < 2 || parseDirectCoordinates(trimmed)) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }

      setLoading(true);
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: trimmed,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ['ve'],
        locationBias: TRUJILLO_BIAS_RECT,
        language: 'es',
        region: 'VE',
      })
        .then((res) => {
          if (cancelled) return;
          setSuggestions(res.suggestions ?? []);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setSuggestions([]);
          setLoading(false);
          if (isQuotaError(err)) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
        });
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, value]);

  const handlePickSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!suggestion.placePrediction) return;
      setPicking(true);
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
        });
        const loc = place.location;
        if (loc) {
          const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
          const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
          const label =
            place.displayName ||
            suggestion.placePrediction.mainText?.text ||
            suggestion.placePrediction.text.text;
          onSelectPoint({
            label,
            address: place.formattedAddress || suggestion.placePrediction.text.text,
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            viewport: place.viewport ?? null,
          });
          onChangeText(label);
        }
      } catch (err: unknown) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      } finally {
        resetSession();
        setFocused(false);
        setPicking(false);
      }
    },
    [onSelectPoint, onChangeText, resetSession]
  );

  const directCoords = parseDirectCoordinates(value);

  // Local tactical quick matches (Trujillo sectors & active commissions)
  const localMatches = React.useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: MapPlacePoint[] = [];
    commissions.forEach((c) => {
      if (
        c.codigo.toLowerCase().includes(q) ||
        c.nombre.toLowerCase().includes(q) ||
        c.sector.toLowerCase().includes(q)
      ) {
        results.push({
          label: `${c.codigo} — ${c.sector}`,
          address: `${c.jefeGrado} ${c.jefeNombre}`,
          lat: c.lat,
          lng: c.lng,
        });
      }
    });
    TRUJILLO_SECTORS.forEach((s) => {
      if (s.label.toLowerCase().includes(q) || s.municipio.toLowerCase().includes(q)) {
        results.push({
          label: s.label,
          address: `Municipio ${s.municipio}, Trujillo`,
          lat: s.lat,
          lng: s.lng,
        });
      }
    });
    return results.slice(0, 3);
  }, [value, commissions]);

  const showDropdown =
    focused && (Boolean(directCoords) || suggestions.length > 0 || localMatches.length > 0);

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <span className="absolute left-2.5 text-slate-400 pointer-events-none">
          {picking || loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          ) : (
            icon || <Search className="w-3.5 h-3.5" />
          )}
        </span>
        <input
          type="text"
          aria-label={ariaLabel}
          value={value}
          onFocus={() => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
            setFocused(true);
          }}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => setFocused(false), 180);
          }}
          onChange={(e) => onChangeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (directCoords) {
                onSelectPoint({
                  label: formatCoords(directCoords.lat, directCoords.lng),
                  address: 'Coordenadas GPS directas',
                  lat: directCoords.lat,
                  lng: directCoords.lng,
                });
                setFocused(false);
              } else if (suggestions[0]) {
                void handlePickSuggestion(suggestions[0]);
              } else if (localMatches[0]) {
                onSelectPoint(localMatches[0]);
                onChangeText(localMatches[0].label);
                setFocused(false);
              }
            }
          }}
          placeholder={placeholder}
          className="w-full bg-[#0B1117] border border-slate-700/90 rounded-md pl-8 pr-7 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChangeText('');
              resetSession();
              onClear?.();
            }}
            className="absolute right-2 text-slate-400 hover:text-white cursor-pointer"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#0E151E] border border-slate-700 rounded-md shadow-2xl max-h-60 overflow-y-auto z-40 divide-y divide-slate-800/80">
          {directCoords && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelectPoint({
                  label: formatCoords(directCoords.lat, directCoords.lng),
                  address: 'Coordenadas GPS directas',
                  lat: directCoords.lat,
                  lng: directCoords.lng,
                });
                setFocused(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-[#192434] flex items-start gap-2 cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-emerald-300 font-mono-tabular">
                  Ir a {formatCoords(directCoords.lat, directCoords.lng)}
                </div>
                <div className="text-[10px] text-slate-400">Coordenadas directas</div>
              </div>
            </button>
          )}

          {suggestions.map((sug, idx) => {
            const pred = sug.placePrediction;
            if (!pred) return null;
            return (
              <button
                key={pred.placeId || idx}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void handlePickSuggestion(sug)}
                className="w-full px-3 py-2 text-left hover:bg-[#192434] flex items-start gap-2 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-sky-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-100 truncate">
                    {pred.mainText?.text || pred.text.text}
                  </div>
                  {pred.secondaryText?.text && (
                    <div className="text-[10px] text-slate-400 truncate">
                      {pred.secondaryText.text}
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {localMatches.map((loc, idx) => (
            <button
              key={`local-${idx}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelectPoint(loc);
                onChangeText(loc.label);
                setFocused(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-[#192434] flex items-start gap-2 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-emerald-200 truncate">{loc.label}</div>
                {loc.address && (
                  <div className="text-[10px] text-slate-400 truncate">{loc.address}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface MapSearchAndRoutePanelProps {
  open: boolean;
  routeModeActive: boolean;
  onClose: () => void;
  onToggleRoutePanel: (showRoute: boolean) => void;
  searchedPlace: MapPlacePoint | null;
  onSelectSearchedPlace: (place: MapPlacePoint | null) => void;
  routeOrigin: MapPlacePoint | null;
  routeDestination: MapPlacePoint | null;
  travelMode: RouteTravelMode;
  routeSummary: ComputedRouteSummary | null;
  routeLoading: boolean;
  routeError: string | null;
  onChangeOrigin: (point: MapPlacePoint | null) => void;
  onChangeDestination: (point: MapPlacePoint | null) => void;
  onChangeTravelMode: (mode: RouteTravelMode) => void;
  onClearRoute: () => void;
  onSwapEndpoints: () => void;
  commissions: Commission[];
  selectedCommission: Commission | null;
  myLiveCoords: { lat: number; lng: number } | null;
  canOperate?: boolean;
  onMarkIncidentAtPlace: (coords: { lat: number; lng: number }) => void;
  onMarkPatrolAtPlace: (coords: { lat: number; lng: number }) => void;
}

export const MapSearchAndRoutePanel: React.FC<MapSearchAndRoutePanelProps> = ({
  open,
  routeModeActive,
  onClose,
  onToggleRoutePanel,
  searchedPlace,
  onSelectSearchedPlace,
  routeOrigin,
  routeDestination,
  travelMode,
  routeSummary,
  routeLoading,
  routeError,
  onChangeOrigin,
  onChangeDestination,
  onChangeTravelMode,
  onClearRoute,
  onSwapEndpoints,
  commissions,
  selectedCommission,
  myLiveCoords,
  canOperate = true,
  onMarkIncidentAtPlace,
  onMarkPatrolAtPlace,
}) => {
  const map = useMap('tactical-map');
  const [searchText, setSearchText] = useState('');
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [gpsLocating, setGpsLocating] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);

  // Keep text inputs synced when origin/destination are set externally (e.g. from map InfoWindow)
  useEffect(() => {
    setOriginText(routeOrigin?.label ?? '');
  }, [routeOrigin]);

  useEffect(() => {
    setDestText(routeDestination?.label ?? '');
  }, [routeDestination]);

  const handleSearchPick = useCallback(
    (point: MapPlacePoint) => {
      onSelectSearchedPlace(point);
      if (map) {
        if (point.viewport) {
          map.fitBounds(point.viewport);
        } else {
          map.panTo({ lat: point.lat, lng: point.lng });
          map.setZoom(15);
        }
      }
    },
    [map, onSelectSearchedPlace]
  );

  const handleUseMyGpsAsOrigin = useCallback(() => {
    if (myLiveCoords) {
      onChangeOrigin({
        label: 'Mi Posición GPS Actual',
        address: formatCoords(myLiveCoords.lat, myLiveCoords.lng),
        lat: myLiveCoords.lat,
        lng: myLiveCoords.lng,
      });
      return;
    }
    if (!navigator.geolocation) return;
    setGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        onChangeOrigin({
          label: 'Mi Posición GPS Actual',
          address: formatCoords(lat, lng),
          lat,
          lng,
        });
      },
      () => {
        setGpsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [myLiveCoords, onChangeOrigin]);

  const handleRouteToSearchedPlace = useCallback(() => {
    if (!searchedPlace) return;
    if (!routeOrigin) {
      if (myLiveCoords) {
        onChangeOrigin({
          label: 'Mi Posición GPS Actual',
          address: formatCoords(myLiveCoords.lat, myLiveCoords.lng),
          lat: myLiveCoords.lat,
          lng: myLiveCoords.lng,
        });
      } else if (selectedCommission) {
        onChangeOrigin({
          label: `${selectedCommission.codigo} — ${selectedCommission.sector}`,
          address: `${selectedCommission.jefeGrado} ${selectedCommission.jefeNombre}`,
          lat: selectedCommission.lat,
          lng: selectedCommission.lng,
        });
      } else {
        onChangeOrigin(HQ_POINT);
      }
    }
    onChangeDestination(searchedPlace);
    onToggleRoutePanel(true);
  }, [
    searchedPlace,
    routeOrigin,
    myLiveCoords,
    selectedCommission,
    onChangeOrigin,
    onChangeDestination,
    onToggleRoutePanel,
  ]);

  if (!open) return null;

  const googleMapsExternalUrl =
    routeOrigin && routeDestination
      ? `https://www.google.com/maps/dir/?api=1&origin=${routeOrigin.lat},${routeOrigin.lng}&destination=${routeDestination.lat},${routeDestination.lng}&travelmode=${
          travelMode === 'WALKING' ? 'walking' : 'driving'
        }`
      : null;

  return (
    <div className="absolute top-3 left-3 z-20 w-[min(360px,calc(100%-24px))] bg-[#111822]/96 backdrop-blur-md border border-slate-700/90 rounded-lg shadow-2xl overflow-visible">
      {/* Mode Header Tabs */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-[#0E151E]/95 rounded-t-lg">
        <div className="flex items-center gap-1 bg-[#0B1117] border border-slate-800 rounded p-0.5">
          <button
            type="button"
            onClick={() => onToggleRoutePanel(false)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
              !routeModeActive ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3 h-3" />
            Buscar Sitio
          </button>
          <button
            type="button"
            onClick={() => onToggleRoutePanel(true)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
              routeModeActive ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RouteIcon className="w-3 h-3" />
            Trazar Ruta
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white cursor-pointer"
          aria-label="Ocultar buscador y rutas"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* MODE A: PLACE SEARCH */}
      {!routeModeActive ? (
        <div className="p-3 space-y-2.5">
          <PlaceAutocompleteInput
            ariaLabel="Buscar sitio, dirección o coordenadas"
            value={searchText}
            onChangeText={setSearchText}
            onSelectPoint={handleSearchPick}
            placeholder="Buscar sitio, calle, poblado o lat, lng..."
            commissions={commissions}
            onClear={() => onSelectSearchedPlace(null)}
          />

          {searchedPlace && (
            <div className="bg-[#0B1117] border border-slate-800 rounded-md p-2.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {searchedPlace.label}
                  </div>
                  {searchedPlace.address && (
                    <div className="text-[11px] text-slate-400 line-clamp-2">
                      {searchedPlace.address}
                    </div>
                  )}
                  <div className="font-mono-tabular text-[10px] text-emerald-400 mt-0.5">
                    {formatCoords(searchedPlace.lat, searchedPlace.lng)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectSearchedPlace(null);
                    setSearchText('');
                  }}
                  className="text-slate-500 hover:text-slate-300 cursor-pointer shrink-0"
                  aria-label="Quitar marcador de búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className={canOperate ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-1 gap-1.5'}>
                <button
                  type="button"
                  onClick={handleRouteToSearchedPlace}
                  className="inline-flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                >
                  <RouteIcon className="w-3 h-3" />
                  Trazar Ruta
                </button>
                {canOperate && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onMarkIncidentAtPlace({ lat: searchedPlace.lat, lng: searchedPlace.lng })
                      }
                      className="py-1.5 px-2 text-[11px] font-semibold bg-amber-700/90 hover:bg-amber-600 text-white rounded cursor-pointer"
                    >
                      Novedad
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onMarkPatrolAtPlace({ lat: searchedPlace.lat, lng: searchedPlace.lng })
                      }
                      className="py-1.5 px-2 text-[11px] font-semibold bg-teal-700/90 hover:bg-teal-600 text-white rounded cursor-pointer"
                    >
                      Patrullado
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* MODE B: ROUTE PLANNER */
        <div className="p-3 space-y-2.5 max-h-[68vh] overflow-y-auto">
          {/* Origin Input + Quick Pickers */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-emerald-300">Origen (A)</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUseMyGpsAsOrigin}
                  disabled={gpsLocating}
                  className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#192332] hover:bg-[#223044] border border-slate-700 text-cyan-300 rounded cursor-pointer"
                >
                  {gpsLocating ? 'GPS...' : 'Mi GPS'}
                </button>
                {selectedCommission && (
                  <button
                    type="button"
                    onClick={() =>
                      onChangeOrigin({
                        label: `${selectedCommission.codigo} — ${selectedCommission.sector}`,
                        address: `${selectedCommission.jefeGrado} ${selectedCommission.jefeNombre}`,
                        lat: selectedCommission.lat,
                        lng: selectedCommission.lng,
                      })
                    }
                    className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#192332] hover:bg-[#223044] border border-slate-700 text-emerald-300 rounded cursor-pointer"
                  >
                    {selectedCommission.codigo}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChangeOrigin(HQ_POINT)}
                  className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#192332] hover:bg-[#223044] border border-slate-700 text-slate-300 rounded cursor-pointer"
                >
                  Sede CZ-23
                </button>
              </div>
            </div>
            <PlaceAutocompleteInput
              ariaLabel="Origen de la ruta"
              value={originText}
              onChangeText={setOriginText}
              onSelectPoint={onChangeOrigin}
              placeholder="Punto de partida, comisión o lat, lng..."
              commissions={commissions}
              icon={<span className="text-[10px] font-bold text-emerald-400">A</span>}
              onClear={() => onChangeOrigin(null)}
            />
          </div>

          {/* Destination Input + Swap */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-amber-300">Destino (B)</span>
              <button
                type="button"
                onClick={onSwapEndpoints}
                disabled={!routeOrigin && !routeDestination}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-[#192332] hover:bg-[#223044] disabled:opacity-40 border border-slate-700 text-slate-300 rounded cursor-pointer"
              >
                <ArrowUpDown className="w-2.5 h-2.5" />
                Invertir A/B
              </button>
            </div>
            <PlaceAutocompleteInput
              ariaLabel="Destino de la ruta"
              value={destText}
              onChangeText={setDestText}
              onSelectPoint={onChangeDestination}
              placeholder="Buscar destino, sector o lat, lng..."
              commissions={commissions}
              icon={<span className="text-[10px] font-bold text-amber-400">B</span>}
              onClear={() => onChangeDestination(null)}
            />
          </div>

          {/* Travel Mode Selector */}
          <div className="grid grid-cols-4 gap-1 bg-[#0B1117] border border-slate-800 rounded-md p-0.5">
            {(
              [
                { id: 'DRIVING', label: 'Patrulla', Icon: Car },
                { id: 'TWO_WHEELER', label: 'Moto', Icon: Bike },
                { id: 'WALKING', label: 'A Pie', Icon: Footprints },
                { id: 'LACUSTRE', label: 'Lacustre', Icon: Anchor },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onChangeTravelMode(id)}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold rounded transition-colors cursor-pointer ${
                  travelMode === id
                    ? id === 'LACUSTRE'
                      ? 'bg-sky-700 text-white'
                      : 'bg-emerald-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Route Loading / Error / Summary */}
          {routeLoading && (
            <div className="flex items-center gap-2 text-xs text-emerald-300 bg-[#0B1117] border border-slate-800 rounded-md p-2.5">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Calculando ruta óptima...
            </div>
          )}

          {routeError && (
            <div className="bg-amber-950/50 border border-amber-500/50 rounded-md p-2.5 text-[11px] text-amber-200 space-y-2">
              <div>{routeError}</div>
              {travelMode !== 'LACUSTRE' && (
                <button
                  type="button"
                  onClick={() => onChangeTravelMode('LACUSTRE')}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-sky-700 hover:bg-sky-600 text-white rounded cursor-pointer"
                >
                  <Anchor className="w-3 h-3" />
                  Trazar Línea Directa / Lacustre
                </button>
              )}
            </div>
          )}

          {routeSummary && !routeLoading && (
            <div className="bg-[#0B1117] border border-emerald-500/40 rounded-md p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-mono-tabular text-base font-bold text-white leading-none">
                    {routeSummary.distanceText}
                  </div>
                  <div className="text-xs text-emerald-300 font-semibold mt-0.5">
                    Tiempo est.: {routeSummary.durationText}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClearRoute}
                  className="px-2 py-1 text-[11px] font-medium bg-[#192332] hover:bg-[#243247] text-slate-300 rounded cursor-pointer"
                >
                  Limpiar
                </button>
              </div>

              {routeSummary.steps.length > 0 && (
                <div className="border-t border-slate-800 pt-2">
                  <button
                    type="button"
                    onClick={() => setStepsExpanded((v) => !v)}
                    className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer"
                  >
                    <span>Indicaciones ({routeSummary.steps.length} tramos)</span>
                    {stepsExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {stepsExpanded && (
                    <ol className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1 text-[11px] text-slate-300 list-decimal list-inside">
                      {routeSummary.steps.map((step, i) => (
                        <li key={i} className="leading-snug">
                          <span>{step.instruction}</span>
                          {step.distanceText && (
                            <span className="font-mono-tabular text-slate-500 ml-1">
                              ({step.distanceText})
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {googleMapsExternalUrl && (
                <a
                  href={googleMapsExternalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-[11px] font-semibold bg-[#162332] hover:bg-[#1E3044] border border-slate-700 text-sky-200 rounded transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir Navegación GPS en Google Maps
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

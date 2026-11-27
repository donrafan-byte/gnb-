import type { Timestamp } from 'firebase/firestore';

export type OperationMode = 'terrestre' | 'lacustre';
export type GangOperationMode = 'terrestre' | 'lacustre' | 'mixta';

export type DestacamentoId = 'CZGNB-23' | 'D-231' | 'DCR-23-1' | 'DESUR-23';

export type ZoneUnitLevel =
  | 'comando_zona'
  | 'destacamento'
  | 'compania'
  | 'puesto_pac';

export type ZoneUnitStatus = 'operativo' | 'alerta' | 'reforzado' | 'inactivo';

export interface ZoneUnit {
  id: string;
  ownerId: string;
  codigo: string;
  nombre: string;
  nivel: ZoneUnitLevel;
  destacamento: DestacamentoId;
  compania: string;
  municipio: string;
  sector: string;
  modalidad: GangOperationMode;
  comandante: string;
  telefono: string;
  frecuenciaRadio: string;
  efectivosGuardia: number;
  estadoOperativo: ZoneUnitStatus;
  lat: number;
  lng: number;
  notas: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface DestacamentoMeta {
  id: DestacamentoId;
  shortLabel: string;
  nombreCompleto: string;
  sede: string;
  municipioSede: string;
  mision: string;
  prefijoComision: string;
  lat: number;
  lng: number;
  badgeClass: string;
  borderClass: string;
  markerClass: string;
  dotClass: string;
  accentText: string;
}

export const DESTACAMENTO_META: Record<DestacamentoId, DestacamentoMeta> = {
  'CZGNB-23': {
    id: 'CZGNB-23',
    shortLabel: 'CZGNB-23',
    nombreCompleto: 'Comando de Zona Nro. 23 de la GNB — Estado Trujillo',
    sede: 'Sector Santa Cruz — Valera',
    municipioSede: 'Valera',
    mision: 'Estado Mayor, Comando, Control Estratégico y Despacho General del Estado Trujillo.',
    prefijoComision: 'CZ23',
    lat: 9.3368,
    lng: -70.6062,
    badgeClass: 'bg-[#7A142B] text-rose-50 border border-rose-400/75',
    borderClass: 'border-rose-500/60',
    markerClass: 'bg-[#7A142B] border-amber-300 text-white',
    dotClass: 'bg-[#9F1239]',
    accentText: 'text-rose-300',
  },
  'D-231': {
    id: 'D-231',
    shortLabel: 'D-231',
    nombreCompleto: 'Destacamento Nro. 231 (Seguridad Territorial y Vial)',
    sede: 'Antiguo Aeropuerto — La Hoyada, San Rafael de Carvajal',
    municipioSede: 'San Rafael de Carvajal',
    mision: 'Control territorial, Puntos de Atención al Ciudadano (PAC) en ejes viales, zona alta (Boconó, Carache) y Troncal 001 Norte.',
    prefijoComision: 'D231',
    lat: 9.3408,
    lng: -70.5841,
    badgeClass: 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/70',
    borderClass: 'border-emerald-500/60',
    markerClass: 'bg-emerald-800 border-emerald-300 text-white',
    dotClass: 'bg-emerald-500',
    accentText: 'text-emerald-300',
  },
  'DCR-23-1': {
    id: 'DCR-23-1',
    shortLabel: 'DCR 23-1',
    nombreCompleto: 'Destacamento de Comandos Rurales Nro. 23-1 (La Ceiba)',
    sede: 'Santa Apolonia / Valle Verde — Municipio La Ceiba',
    municipioSede: 'La Ceiba',
    mision: 'Operaciones rurales agropecuarias, eje panamericano sur y vigilancia lacustre en la costa oriental del Lago de Maracaibo.',
    prefijoComision: 'DCR231',
    lat: 9.4685,
    lng: -71.0665,
    badgeClass: 'bg-sky-950/90 text-sky-200 border border-sky-500/70',
    borderClass: 'border-sky-500/60',
    markerClass: 'bg-sky-800 border-sky-300 text-white',
    dotClass: 'bg-sky-400',
    accentText: 'text-sky-300',
  },
  'DESUR-23': {
    id: 'DESUR-23',
    shortLabel: 'DESUR-23',
    nombreCompleto: 'Destacamento de Seguridad Urbana Nro. 23',
    sede: 'Sector Jalisco — Municipio Motatán',
    municipioSede: 'Motatán',
    mision: 'Seguridad urbana, patrullaje metropolitano, orden público y Cuadrantes de Paz en Valera, Motatán, Carvajal y Trujillo Capital.',
    prefijoComision: 'DESUR23',
    lat: 9.3832,
    lng: -70.5978,
    badgeClass: 'bg-amber-950/90 text-amber-200 border border-amber-500/70',
    borderClass: 'border-amber-500/60',
    markerClass: 'bg-amber-700 border-amber-200 text-white',
    dotClass: 'bg-amber-400',
    accentText: 'text-amber-300',
  },
};

export const OPERATIONAL_DESTACAMENTOS: DestacamentoId[] = ['D-231', 'DCR-23-1', 'DESUR-23'];

export const ZONE_UNIT_LEVEL_LABELS: Record<ZoneUnitLevel, string> = {
  comando_zona: 'Comando de Zona (Sede HQ)',
  destacamento: 'Destacamento (Sede)',
  compania: 'Compañía',
  puesto_pac: 'Puesto / PAC',
};

export const ZONE_UNIT_STATUS_LABELS: Record<ZoneUnitStatus, string> = {
  operativo: 'Operativo Normal',
  alerta: 'En Alerta / Novedad',
  reforzado: 'Reforzado',
  inactivo: 'Temporalmente Inactivo',
};

export type CommissionStatus =
  | 'activa'
  | 'en_curso'
  | 'apoyo_requerido'
  | 'finalizada';

export type IncidentType =
  // Delitos Graves / Contra las Personas (Homicidios y Violentos)
  | 'homicidio'
  | 'femicidio'
  | 'lesiones_graves'
  | 'enfrentamiento'
  | 'secuestro'
  // Seguridad Ciudadana y Rural
  | 'extorsion'
  | 'abigeato'
  | 'pirateria_lacustre'
  | 'robo'
  | 'hurto_vehiculo'
  | 'trafico'
  | 'sospechoso'
  // Seguridad Vial y Accidentes de Tránsito
  | 'accidente_colision'
  | 'accidente_volcamiento'
  | 'accidente_arrollamiento'
  | 'accidente_moto'
  | 'obstruccion_vial'
  | 'infraccion_vial_grave'
  // Delitos en Materia Ambiental
  | 'tala_ilegal'
  | 'incendio_forestal'
  | 'mineria_ilegal'
  | 'contaminacion_hidrica'
  | 'trafico_fauna'
  | 'desechos_toxicos'
  // Orden Público, Manifestaciones y Cierres de Vías por Servicios Públicos
  | 'manifestacion_pacifica'
  | 'manifestacion_violenta'
  | 'cierre_via_servicios'
  | 'cierre_via_gremial'
  | 'falla_servicio_critico';

export type IncidentCategoryGroup =
  | 'violento'
  | 'vial'
  | 'orden_publico'
  | 'seguridad'
  | 'ambiental';

export type RoadAccessStatus =
  | 'cerrado_total'
  | 'paso_parcial'
  | 'paso_intermitente'
  | 'via_libre';

export type IncidentSeverity = 'baja' | 'media' | 'alta' | 'critica';
export type IncidentStatus = 'abierta' | 'en_atencion' | 'cerrada';

export type PatrolCondition =
  | 'sin_novedad'
  | 'control_vial'
  | 'manifestacion_cierre'
  | 'actividad_sospechosa'
  | 'presencia_irregular'
  | 'via_obstruida'
  | 'riesgo_alto';

export type TrafficFlow = 'nulo' | 'bajo' | 'moderado' | 'alto';
export type LightingCondition = 'diurno' | 'buena' | 'deficiente' | 'nula';

export type ThreatLevel = 'moderado' | 'alto' | 'critico';

export type FriendlyAgency =
  | 'PNB'
  | 'CICPC'
  | 'POLICIA_ESTADAL'
  | 'POLICIA_MUNICIPAL'
  | 'CONAS'
  | 'GNB'
  | 'GUARDACOSTAS';

export interface PersonnelMember {
  grado: string;
  nombre: string;
  cedula: string;
  rol: string;
}

export interface WeaponAssignment {
  tipo: string;
  serial: string;
  municion: string;
  asignadoA: string;
}

export interface LiveLocation {
  id: string;
  uid: string;
  ownerId: string;
  displayName: string;
  commissionId: string;
  commissionCodigo: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  speedKmh: number;
  enComision: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Commission {
  id: string;
  ownerId: string;
  codigo: string;
  nombre: string;
  modalidad: OperationMode;
  estado: CommissionStatus;
  jefeGrado: string;
  jefeNombre: string;
  jefeCedula: string;
  jefeTelefono: string;
  efectivos: PersonnelMember[];
  vehiculoTipo: string;
  vehiculoPlaca: string;
  armamento: WeaponAssignment[];
  sector: string;
  cuadrantePaz?: string;
  destacamento?: DestacamentoId;
  compania?: string;
  puesto?: string;
  lat: number;
  lng: number;
  alertaApoyo: boolean;
  motivoAlerta: string;
  notas: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Incident {
  id: string;
  ownerId: string;
  titulo: string;
  tipo: IncidentType;
  severidad: IncidentSeverity;
  modalidad: OperationMode;
  sector: string;
  municipio: string;
  cuadrantePaz?: string;
  destacamento?: DestacamentoId;
  compania?: string;
  puesto?: string;
  descripcion: string;
  commissionId: string;
  reportadoPor: string;
  lat: number;
  lng: number;
  estado: IncidentStatus;
  fallecidos?: number;
  lesionados?: number;
  vehiculosInvolucrados?: number;
  causaProbable?: string;
  viaAfectada?: string;
  placasInvolucradas?: string;
  servicioPublico?: string;
  personasConcentradas?: number;
  pasoHabilitado?: RoadAccessStatus;
  fotoDataUrl?: string;
  fotoCoordenadas?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PatrolPoint {
  id: string;
  ownerId: string;
  titulo: string;
  sector: string;
  municipio: string;
  cuadrantePaz?: string;
  destacamento?: DestacamentoId;
  compania?: string;
  puesto?: string;
  modalidad: OperationMode;
  commissionId: string;
  patrulladoPor: string;
  condicionSector: PatrolCondition;
  flujoVehicular: TrafficFlow;
  iluminacion: LightingCondition;
  caracteristicasVistas: string;
  lat: number;
  lng: number;
  fotoDataUrl: string;
  fotoCoordenadas: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GangZone {
  id: string;
  ownerId: string;
  nombre: string;
  alias: string;
  nivelAmenaza: ThreatLevel;
  modalidad: GangOperationMode;
  sector: string;
  delitos: string[];
  recomendacionTactica: string;
  lat: number;
  lng: number;
  radioKm: number;
  activa: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FriendlyForce {
  id: string;
  ownerId: string;
  nombre: string;
  organismo: FriendlyAgency;
  sector: string;
  telefono: string;
  frecuenciaRadio: string;
  capacidad: string;
  lat: number;
  lng: number;
  disponible: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type VerificationEntityType = 'persona' | 'vehiculo';
export type WantedDangerLevel = 'media' | 'alta' | 'extrema';
export type WantedStatus = 'solicitado' | 'capturado_recuperado';
export type VerificationResult =
  | 'sin_novedad'
  | 'solicitado'
  | 'observacion_tactica'
  | 'retenido';

export interface WantedRecord {
  id: string;
  ownerId: string;
  tipo: VerificationEntityType;
  identificador: string;
  nombreDescripcion: string;
  aliasOSecundario: string;
  delito: string;
  expediente: string;
  organismoSolicitante: string;
  peligrosidad: WantedDangerLevel;
  estado: WantedStatus;
  notas: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface VerificationLog {
  id: string;
  ownerId: string;
  tipo: VerificationEntityType;
  identificador: string;
  nombreDescripcion: string;
  datoSecundario: string;
  conductorAsociado: string;
  resultado: VerificationResult;
  wantedRecordId: string;
  motivoRequerimiento: string;
  commissionId: string;
  verificadoPor: string;
  sector: string;
  lat: number;
  lng: number;
  observaciones: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const PHONE_REGEX = /^\+?[0-9\-\s]{7,20}$/;

export const TRUJILLO_BOUNDS = {
  minLat: 8.5,
  maxLat: 10.5,
  minLng: -72.0,
  maxLng: -69.5,
} as const;

export const TRUJILLO_MUNICIPALITIES = [
  'La Ceiba',
  'Sucre',
  'Miranda',
  'Rafael Rangel',
  'Andrés Bello',
  'Bolívar',
  'Motatán',
  'Valera',
  'San Rafael de Carvajal',
  'Escuque',
  'Trujillo',
  'Pampán',
  'Pampanito',
  'Boconó',
  'Carache',
  'Candelaria',
  'Monte Carmelo',
  'Urdaneta',
  'José Felipe Márquez Cañizales',
  'Juan Vicente Campo Elías',
];

export const TRUJILLO_SECTORS: Array<{
  label: string;
  municipio: string;
  lat: number;
  lng: number;
  modalidad: OperationMode;
  destacamento?: DestacamentoId;
}> = [
  { label: 'Sede CZGNB-23 (Santa Cruz, Valera)', municipio: 'Valera', lat: 9.3368, lng: -70.6062, modalidad: 'terrestre', destacamento: 'CZGNB-23' },
  { label: 'Sede D-231 — Antiguo Aeropuerto Carvajal', municipio: 'San Rafael de Carvajal', lat: 9.3408, lng: -70.5841, modalidad: 'terrestre', destacamento: 'D-231' },
  { label: 'Sede DESUR-23 — Sector Jalisco, Motatán', municipio: 'Motatán', lat: 9.3832, lng: -70.5978, modalidad: 'terrestre', destacamento: 'DESUR-23' },
  { label: 'Sede DCR 23-1 — Santa Apolonia, La Ceiba', municipio: 'La Ceiba', lat: 9.4685, lng: -71.0665, modalidad: 'terrestre', destacamento: 'DCR-23-1' },
  { label: 'Puerto La Ceiba — Costa Lacustre', municipio: 'La Ceiba', lat: 9.4662, lng: -71.0845, modalidad: 'lacustre', destacamento: 'DCR-23-1' },
  { label: 'Muelle Moporo / Tomoporo (Lago)', municipio: 'La Ceiba', lat: 9.5750, lng: -71.1050, modalidad: 'lacustre', destacamento: 'DCR-23-1' },
  { label: 'PAC Sabana de Mendoza (Eje Panamericano)', municipio: 'Sucre', lat: 9.4375, lng: -70.7745, modalidad: 'terrestre', destacamento: 'DCR-23-1' },
  { label: 'El Dividive — Miranda', municipio: 'Miranda', lat: 9.4795, lng: -70.7420, modalidad: 'terrestre', destacamento: 'DCR-23-1' },
  { label: 'PAC Agua Viva — Troncal 001 Norte', municipio: 'Miranda', lat: 9.5355, lng: -70.6650, modalidad: 'terrestre', destacamento: 'D-231' },
  { label: 'PAC El Gallo — Límite Trujillo / Zulia', municipio: 'Miranda', lat: 9.6410, lng: -70.8220, modalidad: 'terrestre', destacamento: 'D-231' },
  { label: 'Betijoque — Rafael Rangel', municipio: 'Rafael Rangel', lat: 9.3761, lng: -70.7336, modalidad: 'terrestre', destacamento: 'D-231' },
  { label: 'PAC Chiquiao — Eje La Puerta / Valera', municipio: 'Valera', lat: 9.1930, lng: -70.6685, modalidad: 'terrestre', destacamento: 'D-231' },
  { label: 'Valera — Zona Urbana Metropolitana', municipio: 'Valera', lat: 9.3178, lng: -70.6036, modalidad: 'terrestre', destacamento: 'DESUR-23' },
  { label: 'Trujillo Capital — Eje Vial', municipio: 'Trujillo', lat: 9.3667, lng: -70.4369, modalidad: 'terrestre', destacamento: 'DESUR-23' },
  { label: 'PAC El Cruce — Flor de Patria (Pampán)', municipio: 'Pampán', lat: 9.4422, lng: -70.4767, modalidad: 'terrestre', destacamento: 'D-231' },
  { label: 'Candelaria / Monay — Cemento Andino', municipio: 'Candelaria', lat: 9.5470, lng: -70.4380, modalidad: 'terrestre', destacamento: 'D-231' },
  { label: 'Carache — Eje Límite Lara', municipio: 'Carache', lat: 9.6312, lng: -70.2285, modalidad: 'terrestre', destacamento: 'D-231' },
  { label: 'PAC Boconó / Mosquey — Zona Alta', municipio: 'Boconó', lat: 9.2539, lng: -70.2489, modalidad: 'terrestre', destacamento: 'D-231' },
];

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  activa: 'Desplegada',
  en_curso: 'En Operación',
  apoyo_requerido: 'Requiere Apoyo',
  finalizada: 'Finalizada',
};

export const VIOLENT_INCIDENT_TYPES: IncidentType[] = [
  'homicidio',
  'femicidio',
  'lesiones_graves',
  'enfrentamiento',
  'secuestro',
];

export const TRAFFIC_INCIDENT_TYPES: IncidentType[] = [
  'accidente_colision',
  'accidente_volcamiento',
  'accidente_arrollamiento',
  'accidente_moto',
  'obstruccion_vial',
  'infraccion_vial_grave',
];

export const SECURITY_INCIDENT_TYPES: IncidentType[] = [
  'extorsion',
  'abigeato',
  'pirateria_lacustre',
  'robo',
  'hurto_vehiculo',
  'trafico',
  'sospechoso',
];

export const ENVIRONMENTAL_INCIDENT_TYPES: IncidentType[] = [
  'tala_ilegal',
  'incendio_forestal',
  'mineria_ilegal',
  'contaminacion_hidrica',
  'trafico_fauna',
  'desechos_toxicos',
];

export const PUBLIC_ORDER_INCIDENT_TYPES: IncidentType[] = [
  'cierre_via_servicios',
  'manifestacion_pacifica',
  'manifestacion_violenta',
  'cierre_via_gremial',
  'falla_servicio_critico',
];

export function isEnvironmentalIncidentType(tipo: IncidentType): boolean {
  return ENVIRONMENTAL_INCIDENT_TYPES.includes(tipo);
}

export function isTrafficIncidentType(tipo: IncidentType): boolean {
  return TRAFFIC_INCIDENT_TYPES.includes(tipo);
}

export function isViolentIncidentType(tipo: IncidentType): boolean {
  return VIOLENT_INCIDENT_TYPES.includes(tipo);
}

export function isPublicOrderIncidentType(tipo: IncidentType): boolean {
  return PUBLIC_ORDER_INCIDENT_TYPES.includes(tipo);
}

export function getIncidentCategory(tipo: IncidentType): IncidentCategoryGroup {
  if (isPublicOrderIncidentType(tipo)) return 'orden_publico';
  if (isTrafficIncidentType(tipo)) return 'vial';
  if (isViolentIncidentType(tipo)) return 'violento';
  if (isEnvironmentalIncidentType(tipo)) return 'ambiental';
  return 'seguridad';
}

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  // Delitos Graves / Violentos
  homicidio: 'Homicidio / Muerte Violenta',
  femicidio: 'Femicidio / Violencia Extrema',
  lesiones_graves: 'Lesiones Graves / Herido por Arma',
  enfrentamiento: 'Enfrentamiento / Detonaciones',
  secuestro: 'Secuestro / Privación Ilegítima',
  // Seguridad Ciudadana y Rural
  extorsion: 'Extorsión / Cobro de Vacuna',
  abigeato: 'Abigeato / Hurto de Ganado',
  pirateria_lacustre: 'Piratería Lacustre',
  robo: 'Robo / Hurto a Mano Armada',
  hurto_vehiculo: 'Robo / Hurto de Vehículo o Moto',
  trafico: 'Tráfico Ilícito / Contrabando',
  sospechoso: 'Sujetos o Vehículo Sospechoso',
  // Seguridad Vial y Accidentes de Tránsito
  accidente_colision: 'Tránsito: Colisión / Choque de Vehículos',
  accidente_volcamiento: 'Tránsito: Volcamiento / Desbarrancamiento',
  accidente_arrollamiento: 'Tránsito: Arrollamiento de Peatón / Ciclista',
  accidente_moto: 'Tránsito: Accidente de Motocicleta / Derrape',
  obstruccion_vial: 'Seguridad Vial: Derrumbe / Falla de Borde / Vía Cerrada',
  infraccion_vial_grave: 'Seguridad Vial: Conducción Temeraria / Ebriedad / Fuga',
  // Materia Ambiental
  tala_ilegal: 'Ambiental: Tala / Deforestación Ilegal',
  incendio_forestal: 'Ambiental: Incendio Forestal / Quema',
  mineria_ilegal: 'Ambiental: Minería / Extracción Ilegal',
  contaminacion_hidrica: 'Ambiental: Contaminación de Aguas / Lago',
  trafico_fauna: 'Ambiental: Tráfico de Fauna / Pesca Ilegal',
  desechos_toxicos: 'Ambiental: Vertido de Desechos / Tóxicos',
  // Orden Público, Manifestaciones y Cierres de Vías por Servicios Públicos
  cierre_via_servicios: 'Orden Público: Cierre de Vía por Servicios Públicos',
  manifestacion_pacifica: 'Orden Público: Manifestación / Concentración Pacífica',
  manifestacion_violenta: 'Orden Público: Manifestación Violenta / Alteración',
  cierre_via_gremial: 'Orden Público: Tranca Gremial / Transporte / Productores',
  falla_servicio_critico: 'Servicios Públicos: Falla Crítica (Agua / Luz / Gas / Combustible)',
};

export const ROAD_ACCESS_STATUS_LABELS: Record<RoadAccessStatus, string> = {
  cerrado_total: 'Cierre Total de Vía',
  paso_parcial: 'Paso Parcial (Un Canal)',
  paso_intermitente: 'Paso Intermitente',
  via_libre: 'Vía Despejada / Libre',
};

export const PUBLIC_SERVICE_PRESETS: string[] = [
  'Agua Potable / Acueducto',
  'Energía Eléctrica / CORPOELEC',
  'Gas Doméstico / Cilindros',
  'Combustible / Estación de Servicio',
  'Vialidad / Asfaltado / Puente',
  'Aseo Urbano / Aguas Servidas',
  'Telecomunicaciones / Telefonía',
  'Transporte Público / Gremial',
  'Reclamo Laboral / Productores Agrícolas',
];

export const PUBLIC_ORDER_CAUSE_PRESETS: string[] = [
  'Exigencia de restitución de agua potable por tubería',
  'Protesta por fallas eléctricas prolongadas o transformador dañado',
  'Reclamo por distribución de gas doméstico o combustible',
  'Cierre con cauchos / escombros exigiendo presencia de autoridades',
  'Tranca de transportistas o productores agrícolas en troncal',
  'Concentración comunitaria en mediación con organismos de seguridad',
];

export const TRUJILLO_MAIN_ROADS: string[] = [
  'Troncal 001 — Carretera Panamericana (Eje Sucre–Miranda–Agua Viva)',
  'Troncal 007 — Carretera Trasandina (Valera–Trujillo–Boconó)',
  'Autopista Eje Vial Valera – Pampanito – Trujillo',
  'Vía La Ceiba – Santa Apolonia – Sabana de Mendoza',
  'Corredor Vial Motatán – Jalisco – Acceso Norte Valera',
  'Vía Betijoque – Isnotú – Sabana de Mendoza',
  'Vía Escuque – Valera',
  'Vía Flor de Patria – Monay – Carache',
  'Av. Bolívar / Zona Urbana Valera',
  'Vía La Puerta – Valera / Mendoza Fría',
];

export const TRAFFIC_CAUSE_PRESETS: string[] = [
  'Exceso de velocidad',
  'Falla mecánica / pérdida de frenos',
  'Ingesta alcohólica / conductor bajo efectos del alcohol',
  'Pavimento húmedo / neblina densa',
  'Adelantamiento indebido / invasión de canal',
  'Falla de borde / deterioro de calzada / iluminación nula',
  'Imprudencia peatonal / semoviente en la vía',
  'Fuga del conductor responsable',
];

export const VIOLENT_CAUSE_PRESETS: string[] = [
  'Arma de fuego (en investigación CICPC)',
  'Arma blanca / objeto contundente',
  'Riña / altercado interpersonal',
  'Resistencia al robo / asalto',
  'Ajuste de cuentas / posible vínculo GEDO',
  'Violencia intrafamiliar / de género',
  'Hallazgo de cadáver (causa por determinar)',
];

export const WANTED_CRIME_SUGGESTIONS: string[] = [
  'Homicidio Calificado / Intencional',
  'Femicidio / Violencia Agravada',
  'Lesiones Personales Graves',
  'Homicidio Culposo en Accidente de Tránsito / Fuga',
  'Extorsión y Cobro de Vacuna',
  'Abigeato / Hurto de Ganado',
  'Robo Agravado de Vehículo / Motocicleta',
  'Piratería Lacustre',
  'Tráfico Ilícito / Contrabando',
  'Secuestro / Privación Ilegítima de Libertad',
  'Ambiental: Tala y Deforestación Ilegal (Ley Penal del Ambiente)',
  'Ambiental: Incendio Forestal Provocado',
  'Ambiental: Minería y Extracción Ilegal de Recursos',
  'Ambiental: Contaminación de Aguas / Lago de Maracaibo',
  'Ambiental: Tráfico Ilícito de Fauna Silvestre / Pesca Ilegal',
  'Ambiental: Vertido de Desechos Tóxicos o Peligrosos',
];

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  abierta: 'Abierta',
  en_atencion: 'En Atención',
  cerrada: 'Cerrada',
};

export const PATROL_CONDITION_LABELS: Record<PatrolCondition, string> = {
  sin_novedad: 'Sin Novedad / Despejado',
  control_vial: 'Punto de Control / Seguridad Vial',
  manifestacion_cierre: 'Manifestación / Cierre de Vía Activo',
  actividad_sospechosa: 'Actividad Sospechosa',
  presencia_irregular: 'Presencia Irregular / Alerta',
  via_obstruida: 'Vía Obstruida / Falla de Borde',
  riesgo_alto: 'Riesgo Alto / Refuerzo Sugerido',
};

export const TRAFFIC_FLOW_LABELS: Record<TrafficFlow, string> = {
  nulo: 'Nulo / Desolado',
  bajo: 'Bajo',
  moderado: 'Moderado',
  alto: 'Alto / Intenso',
};

export const LIGHTING_CONDITION_LABELS: Record<LightingCondition, string> = {
  diurno: 'Diurno / Luz Natural',
  buena: 'Buena Iluminación',
  deficiente: 'Iluminación Deficiente',
  nula: 'Oscuridad Total',
};

export const AGENCY_LABELS: Record<FriendlyAgency, string> = {
  PNB: 'PNB — Policía Nacional Bolivariana',
  CICPC: 'CICPC — Policía Científica',
  POLICIA_ESTADAL: 'CPET — Policía Estadal Trujillo',
  POLICIA_MUNICIPAL: 'Policía Municipal',
  CONAS: 'CONAS — Antiextorsión y Secuestro',
  GNB: 'GNB — Destacamento / Comando Rural',
  GUARDACOSTAS: 'Estación de Guardacostas (Lacustre)',
};

export const AGENCY_SHORT_LABELS: Record<FriendlyAgency, string> = {
  PNB: 'PNB',
  CICPC: 'CICPC',
  POLICIA_ESTADAL: 'Policía Estadal',
  POLICIA_MUNICIPAL: 'Policía Municipal',
  CONAS: 'CONAS',
  GNB: 'GNB',
  GUARDACOSTAS: 'Guardacostas',
};

export interface AgencyColorStyle {
  colorLabel: string;
  markerBg: string;
  markerIcon: string;
  dot: string;
  badge: string;
  cardBorder: string;
  popupAccent: string;
  callButton: string;
}

export const AGENCY_STYLES: Record<FriendlyAgency, AgencyColorStyle> = {
  GNB: {
    colorLabel: 'Vinotinto',
    markerBg: 'bg-[#7A142B] border-rose-300/85 text-white',
    markerIcon: 'text-rose-200',
    dot: 'bg-[#881337] border border-rose-300/75',
    badge: 'bg-[#7A142B] text-rose-50 border border-rose-400/70',
    cardBorder: 'border-[#9F1239]/80',
    popupAccent: 'bg-[#7A142B] text-white',
    callButton: 'bg-[#7A142B] hover:bg-[#941A36] text-white',
  },
  PNB: {
    colorLabel: 'Azul Oscuro',
    markerBg: 'bg-[#0F295C] border-blue-400/85 text-white',
    markerIcon: 'text-blue-200',
    dot: 'bg-[#0F295C] border border-blue-400/80',
    badge: 'bg-[#0F295C] text-blue-100 border border-blue-400/70',
    cardBorder: 'border-blue-800/90',
    popupAccent: 'bg-[#0F295C] text-white',
    callButton: 'bg-[#0F295C] hover:bg-[#173A7E] text-white',
  },
  POLICIA_ESTADAL: {
    colorLabel: 'Azul Claro',
    markerBg: 'bg-sky-400 border-white text-slate-950',
    markerIcon: 'text-slate-950',
    dot: 'bg-sky-400 border border-sky-200',
    badge: 'bg-sky-400 text-slate-950 border border-sky-200',
    cardBorder: 'border-sky-400/75',
    popupAccent: 'bg-sky-400 text-slate-950',
    callButton: 'bg-sky-400 hover:bg-sky-300 text-slate-950',
  },
  POLICIA_MUNICIPAL: {
    colorLabel: 'Amarillo',
    markerBg: 'bg-yellow-400 border-yellow-100 text-slate-950',
    markerIcon: 'text-slate-950',
    dot: 'bg-yellow-400 border border-yellow-200',
    badge: 'bg-yellow-400 text-slate-950 border border-yellow-200',
    cardBorder: 'border-yellow-400/75',
    popupAccent: 'bg-yellow-400 text-slate-950',
    callButton: 'bg-yellow-400 hover:bg-yellow-300 text-slate-950',
  },
  CONAS: {
    colorLabel: 'Negro',
    markerBg: 'bg-[#05070A] border-slate-300 text-white',
    markerIcon: 'text-slate-200',
    dot: 'bg-black border border-slate-300',
    badge: 'bg-black text-white border border-slate-400/80',
    cardBorder: 'border-slate-500/80',
    popupAccent: 'bg-black text-white',
    callButton: 'bg-black hover:bg-slate-900 text-white border border-slate-600',
  },
  CICPC: {
    colorLabel: 'Verde',
    markerBg: 'bg-green-700 border-green-300/85 text-white',
    markerIcon: 'text-green-200',
    dot: 'bg-green-600 border border-green-300/80',
    badge: 'bg-green-700 text-white border border-green-400/70',
    cardBorder: 'border-green-600/80',
    popupAccent: 'bg-green-700 text-white',
    callButton: 'bg-green-700 hover:bg-green-600 text-white',
  },
  GUARDACOSTAS: {
    colorLabel: 'Turquesa',
    markerBg: 'bg-teal-700 border-teal-300/85 text-white',
    markerIcon: 'text-teal-200',
    dot: 'bg-teal-500 border border-teal-200/80',
    badge: 'bg-teal-700 text-white border border-teal-400/70',
    cardBorder: 'border-teal-600/80',
    popupAccent: 'bg-teal-700 text-white',
    callButton: 'bg-teal-700 hover:bg-teal-600 text-white',
  },
};

export const VEHICLE_PRESETS: Record<OperationMode, string[]> = {
  terrestre: [
    'Toyota Land Cruiser 4x4 (Patrulla Rural)',
    'Camioneta Toyota Hilux 4x4 Táctica',
    'Unidad Motorizada Doble Propósito (2 Motos)',
    'Vehículo Táctico Blindado VN-4',
    'Camión Transporte de Tropa Beiben',
  ],
  lacustre: [
    'Lancha Patrullera Lacustre Doble Motor 200HP',
    'Embarcación Táctica Interceptora (Peñero)',
    'Bote Semirrígido (RIB) de Patrullaje Costero',
    'Lancha Comando Fluvial / Lacustre',
  ],
};

export const WEAPON_PRESETS = [
  'Fusil de Asalto AK-103 Cal. 7.62x39mm',
  'Pistola PGP Cal. 9mm',
  'Pistola Glock 17 Cal. 9mm',
  'Escopeta Táctica Cal. 12',
  'Subametralladora MP5 Cal. 9mm',
  'Fusil FAL Cal. 7.62x51mm',
];

export const WANTED_DANGER_LABELS: Record<WantedDangerLevel, string> = {
  media: 'Peligrosidad Media',
  alta: 'Peligrosidad Alta',
  extrema: 'Peligrosidad Extrema',
};

export const WANTED_STATUS_LABELS: Record<WantedStatus, string> = {
  solicitado: 'Solicitado Activo',
  capturado_recuperado: 'Capturado / Recuperado',
};

export const VERIFICATION_RESULT_LABELS: Record<VerificationResult, string> = {
  sin_novedad: 'Sin Novedad',
  observacion_tactica: 'Observación Táctica',
  solicitado: 'Solicitado por la Justicia',
  retenido: 'Retenido / A la Orden',
};

export type OfficerAccessStatus = 'pendiente' | 'autorizado' | 'expulsado';

export type OfficerPrivilege =
  | 'consulta'
  | 'operador'
  | 'supervisor'
  | 'administrador';

export interface OfficerProfile {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  unit: string;
  destacamento?: DestacamentoId;
  compania?: string;
  puesto?: string;
  grado?: string;
  cedula?: string;
  telefono?: string;
  cargo?: string;
  perfilCompleto?: boolean;
  accessStatus?: OfficerAccessStatus;
  privilegio?: OfficerPrivilege;
  privilegioActualizadoPor?: string;
  privilegioActualizadoAt?: Timestamp;
  authorizedBy?: string;
  authorizedCodeHash?: string;
  authorizedAt?: Timestamp;
  expulsadoMotivo?: string;
  expulsadoPor?: string;
  expulsadoAt?: Timestamp;
  solicitudNota?: string;
  lastLoginAt?: Timestamp;
  loginCount?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AccessCodeRecord {
  id: string;
  codeHash: string;
  label: string;
  codeHint: string;
  active: boolean;
  maxUses: number;
  usedCount: number;
  createdByUid: string;
  createdByEmail: string;
  lastUsedByUid: string;
  lastUsedByEmail: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type AuditAction =
  | 'sesion_inicio'
  | 'sesion_cierre'
  | 'perfil_registrado'
  | 'crear'
  | 'editar'
  | 'eliminar'
  | 'alerta_sos'
  | 'gps_estado'
  | 'cambio_estado'
  | 'acceso_aprobado'
  | 'acceso_expulsado'
  | 'acceso_rehabilitado'
  | 'acceso_por_codigo'
  | 'codigo_secreto_creado'
  | 'codigo_secreto_revocado'
  | 'cambio_privilegio';

export type AuditEntity =
  | 'sesion'
  | 'perfil'
  | 'commission'
  | 'incident'
  | 'patrolPoint'
  | 'gangZone'
  | 'friendlyForce'
  | 'zoneUnit'
  | 'wantedRecord'
  | 'verificationLog'
  | 'acceso'
  | 'codigo_secreto';

export type AuditSeverity = 'normal' | 'sensible' | 'alerta_mal_uso';

export interface AuditLog {
  id: string;
  ownerId: string;
  actorUid: string;
  actorEmail: string;
  actorNombre: string;
  actorGrado: string;
  actorCedula: string;
  accion: AuditAction;
  entidad: AuditEntity;
  entidadId: string;
  resumen: string;
  severidad: AuditSeverity;
  dispositivo: string;
  createdAt?: Timestamp;
}

export const OFFICER_RANK_OPTIONS: string[] = [
  'G/B',
  'Cnel.',
  'T/Cnel.',
  'May.',
  'Cap.',
  '1er Tte.',
  'Tte.',
  'S/Sup.',
  'S/A',
  'S/M1',
  'S/M2',
  'S/M3',
  'S/1ro',
  'S/2do',
  'Oficial Jefe',
  'Oficial Agregado',
  'Oficial',
  'Personal Civil / Analista',
];

export const ACCESS_STATUS_LABELS: Record<OfficerAccessStatus, string> = {
  pendiente: 'Pendiente de Aprobación',
  autorizado: 'Autorizado',
  expulsado: 'Expulsado / Restringido',
};

export const OFFICER_PRIVILEGE_LABELS: Record<OfficerPrivilege, string> = {
  consulta: 'Solo Consulta (Lectura)',
  operador: 'Usuario Operador',
  supervisor: 'Supervisor Operativo',
  administrador: 'Administrador',
};

export const OFFICER_PRIVILEGE_DESCRIPTIONS: Record<OfficerPrivilege, string> = {
  consulta:
    'Solo lectura del mapa, comisiones, cuadrantes, bandas (GEDO) y fuerzas amigas. No puede crear, editar ni eliminar datos.',
  operador:
    'Modo usuario estándar: registra comisiones, GPS, patrullaje, novedades, SOS, verificaciones y aporta bandas (GEDO) y fuerzas amigas compartidas. No puede eliminar registros ni modificar la estructura o configuración.',
  supervisor:
    'Operación completa más moderación de bandas (GEDO), fuerzas amigas y registro de solicitados. Sin acceso a gestión de usuarios ni privilegios.',
  administrador:
    'Control total de comando: ve cantidad de usuarios, cambia privilegios, aprueba/expulsa accesos, gestiona códigos secretos y audita la bitácora.',
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  sesion_inicio: 'Inicio de Sesión',
  sesion_cierre: 'Cierre de Sesión',
  perfil_registrado: 'Registro / Perfil',
  crear: 'Creación de Registro',
  editar: 'Edición de Datos',
  eliminar: 'Eliminación de Registro',
  alerta_sos: 'Alerta SOS / Apoyo',
  gps_estado: 'GPS en Tiempo Real',
  cambio_estado: 'Cambio de Estado',
  acceso_aprobado: 'Acceso Aprobado',
  acceso_expulsado: 'Usuario Expulsado',
  acceso_rehabilitado: 'Acceso Rehabilitado',
  acceso_por_codigo: 'Ingreso por Código Secreto',
  codigo_secreto_creado: 'Código Secreto Generado',
  codigo_secreto_revocado: 'Código Secreto Revocado',
  cambio_privilegio: 'Cambio de Privilegio',
};

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  sesion: 'Sesión de Acceso',
  perfil: 'Perfil de Usuario',
  commission: 'Comisión',
  incident: 'Novedad / Delito',
  patrolPoint: 'Punto Patrullado',
  gangZone: 'Zona de Amenaza',
  friendlyForce: 'Fuerza Amiga',
  zoneUnit: 'Unidad / Puesto CZ-23',
  wantedRecord: 'Orden de Solicitado',
  verificationLog: 'Verificación',
  acceso: 'Control de Acceso',
  codigo_secreto: 'Código Secreto',
};

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  normal: 'Normal',
  sensible: 'Acción Sensible',
  alerta_mal_uso: 'Alerta / Posible Mal Uso',
};


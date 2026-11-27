import type { OperationMode } from '../types/operations';

export type CuadranteType = 'rural' | 'urbano' | 'vial' | 'lacustre';

export interface CuadrantePaz {
  codigo: string;
  nombre: string;
  tipo: CuadranteType;
  municipio: string;
  sectores: string;
  organismo: string;
  telefonoVen911: string;
  modalidad: OperationMode;
  lat: number;
  lng: number;
  radioKm: number;
}

export const CUADRANTE_TYPE_LABELS: Record<CuadranteType, string> = {
  rural: 'Rural',
  urbano: 'Urbano',
  vial: 'Seguridad Vial',
  lacustre: 'Lacustre',
};

export const CUADRANTE_TYPE_STYLES: Record<
  CuadranteType,
  {
    stroke: string;
    fill: string;
    markerBg: string;
    badge: string;
    text: string;
  }
> = {
  rural: {
    stroke: '#14B8A6',
    fill: '#0D9488',
    markerBg: 'bg-teal-950/90 border-teal-400/80 text-teal-100',
    badge: 'bg-teal-950/90 border-teal-500/60 text-teal-200',
    text: 'text-teal-300',
  },
  urbano: {
    stroke: '#818CF8',
    fill: '#6366F1',
    markerBg: 'bg-indigo-950/90 border-indigo-400/80 text-indigo-100',
    badge: 'bg-indigo-950/90 border-indigo-500/60 text-indigo-200',
    text: 'text-indigo-300',
  },
  vial: {
    stroke: '#38BDF8',
    fill: '#0284C7',
    markerBg: 'bg-sky-950/90 border-sky-400/85 text-sky-100',
    badge: 'bg-sky-950/90 border-sky-500/60 text-sky-200',
    text: 'text-sky-300',
  },
  lacustre: {
    stroke: '#22D3EE',
    fill: '#0891B2',
    markerBg: 'bg-cyan-950/90 border-cyan-300/85 text-cyan-100',
    badge: 'bg-cyan-950/90 border-cyan-500/60 text-cyan-200',
    text: 'text-cyan-300',
  },
};

/**
 * Red operativa de Cuadrantes de Paz del Estado Trujillo (GMCP / VEN-911),
 * incluyendo cuadrantes rurales del eje DCR 23-1 La Ceiba, cuadrantes viales
 * en Troncal 001 / Troncal 007 / Eje Valera–Trujillo y cuadrantes lacustres.
 */
export const TRUJILLO_CUADRANTES_PAZ: CuadrantePaz[] = [
  // Municipio La Ceiba (Jurisdicción directa DCR 23-1)
  {
    codigo: 'CUPAZ-LC-01',
    nombre: 'Cuadrante Rural 01 — Santa Apolonia / Sede DCR 23-1',
    tipo: 'rural',
    municipio: 'La Ceiba',
    sectores: 'Santa Apolonia, Km 12–17, Tres de Febrero, Zona Ganadera El Progreso',
    organismo: 'GNB — DCR 23-1 La Ceiba',
    telefonoVen911: '+58 416-6104231',
    modalidad: 'terrestre',
    lat: 9.4685,
    lng: -71.015,
    radioKm: 7,
  },
  {
    codigo: 'CUPAZ-LC-02',
    nombre: 'Cuadrante Lacustre 01 — Puerto La Ceiba / Costa Sur',
    tipo: 'lacustre',
    municipio: 'La Ceiba',
    sectores: 'Muelle Puerto La Ceiba, Punta de Piedra, Caños y Manglares del Lago',
    organismo: 'GNB DCR 23-1 / Guardacostas',
    telefonoVen911: '+58 416-6104232',
    modalidad: 'lacustre',
    lat: 9.4662,
    lng: -71.0845,
    radioKm: 8,
  },
  {
    codigo: 'CUPAZ-LC-03',
    nombre: 'Cuadrante Lacustre 02 — Moporo / Tomoporo',
    tipo: 'lacustre',
    municipio: 'La Ceiba',
    sectores: 'Muelle Moporo, Tomoporo, Franja Pesquera Norte Lago de Maracaibo',
    organismo: 'GNB DCR 23-1 / Guardacostas',
    telefonoVen911: '+58 416-6104233',
    modalidad: 'lacustre',
    lat: 9.575,
    lng: -71.105,
    radioKm: 9,
  },

  // Eje Panamericano: Sucre, Miranda, Andrés Bello, Bolívar
  {
    codigo: 'CUPAZ-SUC-01',
    nombre: 'Cuadrante 01 — Sabana de Mendoza Centro',
    tipo: 'urbano',
    municipio: 'Sucre',
    sectores: 'Casco Central Sabana de Mendoza, Terminal, Junín, Valmore Rodríguez',
    organismo: 'PNB / CPET Sucre',
    telefonoVen911: '+58 416-6104241',
    modalidad: 'terrestre',
    lat: 9.4375,
    lng: -70.7745,
    radioKm: 5.5,
  },
  {
    codigo: 'CUPAZ-VIAL-01',
    nombre: 'Cuadrante Vial 01 — Troncal 001 Eje Panamericano',
    tipo: 'vial',
    municipio: 'Sucre',
    sectores: 'Carretera Panamericana (Troncal 001): Sabana de Mendoza — Buena Vista — El Cenizo',
    organismo: 'GNB Seguridad Vial / PNB Tránsito',
    telefonoVen911: '+58 416-6104245',
    modalidad: 'terrestre',
    lat: 9.455,
    lng: -70.818,
    radioKm: 8,
  },
  {
    codigo: 'CUPAZ-MIR-01',
    nombre: 'Cuadrante 01 — El Dividive / Miranda',
    tipo: 'rural',
    municipio: 'Miranda',
    sectores: 'El Dividive, El Cenizo, Valerita, Fincas Agropecuarias Miranda',
    organismo: 'GNB DCR 23-1 / CPET Miranda',
    telefonoVen911: '+58 416-6104251',
    modalidad: 'terrestre',
    lat: 9.4795,
    lng: -70.742,
    radioKm: 7,
  },
  {
    codigo: 'CUPAZ-VIAL-02',
    nombre: 'Cuadrante Vial 02 — Agua Santa / Distribuidor Agua Viva',
    tipo: 'vial',
    municipio: 'Miranda',
    sectores: 'Troncal 001 sector Agua Santa, Peaje / Distribuidor Agua Viva, Empalme Lara-Zulia',
    organismo: 'GNB Seguridad Vial / PNB Tránsito',
    telefonoVen911: '+58 416-6104252',
    modalidad: 'terrestre',
    lat: 9.5355,
    lng: -70.665,
    radioKm: 8,
  },
  {
    codigo: 'CUPAZ-AB-01',
    nombre: 'Cuadrante Rural 01 — Santa Isabel / El Araguaney',
    tipo: 'rural',
    municipio: 'Andrés Bello',
    sectores: 'Santa Isabel, El Jagüito, Araguaney, Eje Agrícola Norte',
    organismo: 'GNB DCR 23-1 / CPET',
    telefonoVen911: '+58 416-6104258',
    modalidad: 'terrestre',
    lat: 9.615,
    lng: -70.865,
    radioKm: 8,
  },
  {
    codigo: 'CUPAZ-BOL-01',
    nombre: 'Cuadrante Rural 01 — Sabana Grande / Cheregüé',
    tipo: 'rural',
    municipio: 'Bolívar',
    sectores: 'Sabana Grande, Granados, Cheregüé, Corredor Agrícola Bolívar',
    organismo: 'CPET / GNB Rural',
    telefonoVen911: '+58 416-6104261',
    modalidad: 'terrestre',
    lat: 9.379,
    lng: -70.768,
    radioKm: 6.5,
  },

  // Eje Zona Baja / Rafael Rangel / Escuque / Monte Carmelo
  {
    codigo: 'CUPAZ-RR-01',
    nombre: 'Cuadrante 01 — Betijoque / Isnotú',
    tipo: 'urbano',
    municipio: 'Rafael Rangel',
    sectores: 'Betijoque, Santuario Isnotú, Sara Linda, Los Cedros, José Gregorio Hernández',
    organismo: 'CPET / Policía Municipal Rangel',
    telefonoVen911: '+58 416-6104265',
    modalidad: 'terrestre',
    lat: 9.3761,
    lng: -70.7336,
    radioKm: 5.5,
  },
  {
    codigo: 'CUPAZ-ESC-01',
    nombre: 'Cuadrante 01 — Escuque / Sabana Libre',
    tipo: 'urbano',
    municipio: 'Escuque',
    sectores: 'Casco Central Escuque, Sabana Libre, La Mata, Santa Rita',
    organismo: 'CPET Escuque / PNB',
    telefonoVen911: '+58 416-6104268',
    modalidad: 'terrestre',
    lat: 9.2956,
    lng: -70.6725,
    radioKm: 5,
  },
  {
    codigo: 'CUPAZ-MC-01',
    nombre: 'Cuadrante Rural 01 — Monte Carmelo / Buena Vista',
    tipo: 'rural',
    municipio: 'Monte Carmelo',
    sectores: 'Monte Carmelo, Buena Vista, Santa María del Horcón, Zona Cafetalera',
    organismo: 'GNB Rural / CPET',
    telefonoVen911: '+58 416-6104271',
    modalidad: 'terrestre',
    lat: 9.1885,
    lng: -70.8165,
    radioKm: 7.5,
  },

  // Corredor Motatán — Valera — Carvajal
  {
    codigo: 'CUPAZ-VIAL-03',
    nombre: 'Cuadrante Vial 03 — Corredor Motatán / Curvas Jalisco',
    tipo: 'vial',
    municipio: 'Motatán',
    sectores: 'Troncal Motatán — Jalisco — Acceso Norte Valera, Puente Motatán',
    organismo: 'PNB Tránsito / GNB Seguridad Vial',
    telefonoVen911: '+58 416-6104275',
    modalidad: 'terrestre',
    lat: 9.3928,
    lng: -70.5964,
    radioKm: 6,
  },
  {
    codigo: 'CUPAZ-VAL-01',
    nombre: 'Cuadrante Urbano 01 — Valera Centro / Av. Bolívar',
    tipo: 'urbano',
    municipio: 'Valera',
    sectores: 'Mercedes Díaz, Juan Ignacio Montilla, Av. Bolívar, Plata I–IV, Terminal Valera',
    organismo: 'PNB / Policía Municipal Valera',
    telefonoVen911: '+58 416-6104281',
    modalidad: 'terrestre',
    lat: 9.3178,
    lng: -70.6036,
    radioKm: 4.5,
  },
  {
    codigo: 'CUPAZ-VAL-02',
    nombre: 'Cuadrante Urbano 02 — Valera Sur / La Beatriz / San Luis',
    tipo: 'urbano',
    municipio: 'Valera',
    sectores: 'La Beatriz, San Luis, Morón, Mendoza Fría, Salida hacia La Puerta',
    organismo: 'CPET / PNB Valera',
    telefonoVen911: '+58 416-6104282',
    modalidad: 'terrestre',
    lat: 9.286,
    lng: -70.618,
    radioKm: 5,
  },
  {
    codigo: 'CUPAZ-CARV-01',
    nombre: 'Cuadrante 01 — San Rafael de Carvajal / Aeropuerto',
    tipo: 'urbano',
    municipio: 'San Rafael de Carvajal',
    sectores: 'Carvajal, Campo Alegre, Cubita, Aeropuerto Antonio Nicolás Briceño, La Cejita',
    organismo: 'CPET / PNB Carvajal',
    telefonoVen911: '+58 416-6104285',
    modalidad: 'terrestre',
    lat: 9.3072,
    lng: -70.5861,
    radioKm: 4.5,
  },

  // Eje Vial Valera — Trujillo — Pampanito — Pampán
  {
    codigo: 'CUPAZ-VIAL-04',
    nombre: 'Cuadrante Vial 04 — Eje Vial Valera–Trujillo / Pampanito',
    tipo: 'vial',
    municipio: 'Pampanito',
    sectores: 'Autopista Eje Vial Valera–Trujillo, Redoma Pampanito, Jiménez, La Concepción',
    organismo: 'PNB Tránsito / GNB Seguridad Vial',
    telefonoVen911: '+58 416-6104290',
    modalidad: 'terrestre',
    lat: 9.4108,
    lng: -70.4958,
    radioKm: 6.5,
  },
  {
    codigo: 'CUPAZ-TRU-01',
    nombre: 'Cuadrante Urbano 01 — Trujillo Capital / Chiquinquirá',
    tipo: 'urbano',
    municipio: 'Trujillo',
    sectores: 'Cristóbal Mendoza, Matriz, Chiquinquirá, San Jacinto, Monumento a la Paz',
    organismo: 'CPET / PNB Trujillo Capital',
    telefonoVen911: '+58 416-6104292',
    modalidad: 'terrestre',
    lat: 9.3667,
    lng: -70.4369,
    radioKm: 5.5,
  },
  {
    codigo: 'CUPAZ-PAM-01',
    nombre: 'Cuadrante 01 — Pampán / Flor de Patria / Monay',
    tipo: 'vial',
    municipio: 'Pampán',
    sectores: 'Flor de Patria, Pampán, Santa Ana, Cruce hacia Monay y Troncal 007',
    organismo: 'GNB Seguridad Vial / CPET Pampán',
    telefonoVen911: '+58 416-6104295',
    modalidad: 'terrestre',
    lat: 9.4422,
    lng: -70.4767,
    radioKm: 7,
  },

  // Zona Alta y Eje Boconó / Carache / Candelaria / Urdaneta
  {
    codigo: 'CUPAZ-BOC-01',
    nombre: 'Cuadrante 01 — Boconó Centro / Mosquey',
    tipo: 'urbano',
    municipio: 'Boconó',
    sectores: 'Casco Central Boconó, El Carmen, Mosquey, Tostós, Burbusay',
    organismo: 'GNB / PNB / CPET Boconó',
    telefonoVen911: '+58 416-6104301',
    modalidad: 'terrestre',
    lat: 9.2539,
    lng: -70.2489,
    radioKm: 7.5,
  },
  {
    codigo: 'CUPAZ-VIAL-05',
    nombre: 'Cuadrante Vial 05 — Troncal 007 Boconó–Trujillo (Trasandina)',
    tipo: 'vial',
    municipio: 'Boconó',
    sectores: 'Carretera Trasandina Troncal 007, Sector La Cristalina, Páramo Guaramacal',
    organismo: 'GNB Seguridad Vial / Protección Civil',
    telefonoVen911: '+58 416-6104305',
    modalidad: 'terrestre',
    lat: 9.315,
    lng: -70.335,
    radioKm: 8,
  },
  {
    codigo: 'CUPAZ-CAR-01',
    nombre: 'Cuadrante Rural 01 — Carache / Cuicas',
    tipo: 'rural',
    municipio: 'Carache',
    sectores: 'Carache, La Concepción, Cuicas, Panamericana límite con Lara',
    organismo: 'GNB Rural / CPET Carache',
    telefonoVen911: '+58 416-6104310',
    modalidad: 'terrestre',
    lat: 9.6335,
    lng: -70.2285,
    radioKm: 8,
  },
  {
    codigo: 'CUPAZ-CAN-01',
    nombre: 'Cuadrante Rural 01 — Chejendé / Torococo / Bolivia',
    tipo: 'rural',
    municipio: 'Candelaria',
    sectores: 'Chejendé, Torococo, Minas de Monay, Eje Llanos de Monay',
    organismo: 'GNB / CPET Candelaria',
    telefonoVen911: '+58 416-6104315',
    modalidad: 'terrestre',
    lat: 9.6165,
    lng: -70.351,
    radioKm: 7.5,
  },
  {
    codigo: 'CUPAZ-URD-01',
    nombre: 'Cuadrante Rural 01 — La Quebrada / Jajó / Tuñame',
    tipo: 'rural',
    municipio: 'Urdaneta',
    sectores: 'La Quebrada, Jajó, La Mesa de Esnujaque, Tuñame, Corredor Agrícola Alto',
    organismo: 'GNB Rural / CPET Urdaneta',
    telefonoVen911: '+58 416-6104320',
    modalidad: 'terrestre',
    lat: 9.152,
    lng: -70.585,
    radioKm: 8,
  },
];

export function getCuadranteByCode(codigo?: string | null): CuadrantePaz | undefined {
  if (!codigo) return undefined;
  const clean = codigo.trim().toUpperCase();
  return TRUJILLO_CUADRANTES_PAZ.find((c) => c.codigo === clean);
}

function quickDistKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function findNearestCuadrante(
  lat: number,
  lng: number
): { cuadrante: CuadrantePaz; distanceKm: number } {
  let best = TRUJILLO_CUADRANTES_PAZ[0];
  let bestDist = Infinity;
  for (const q of TRUJILLO_CUADRANTES_PAZ) {
    const d = quickDistKm({ lat, lng }, { lat: q.lat, lng: q.lng });
    if (d < bestDist) {
      bestDist = d;
      best = q;
    }
  }
  return { cuadrante: best, distanceKm: bestDist };
}

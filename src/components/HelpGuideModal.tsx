import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Building2,
  Car,
  ClipboardCheck,
  Compass,
  Flame,
  HelpCircle,
  Lock,
  Map as MapIcon,
  Megaphone,
  Palette,
  Radio,
  Search,
  Shield,
  Smartphone,
  X,
} from 'lucide-react';

export type HelpNavTab =
  | 'mapa'
  | 'unidades'
  | 'comisiones'
  | 'verificacion'
  | 'criminalidad'
  | 'inteligencia';

interface HelpSection {
  id: string;
  title: string;
  shortTitle: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  badgeText?: string;
  navTab?: HelpNavTab;
  navLabel?: string;
  adminNote?: string;
  steps: string[];
  tip?: string;
  keywords: string[];
}

interface HelpGuideModalProps {
  isCommandAdmin: boolean;
  onClose: () => void;
  onNavigateTab: (tab: HelpNavTab) => void;
}

const FRIENDLY_COLOR_LEGEND = [
  { name: 'GNB (Guardia Nacional Bolivariana)', colorLabel: 'Vinotinto', swatch: '#7F1D1D', border: '#DC2626' },
  { name: 'PNB (Policía Nacional Bolivariana)', colorLabel: 'Azul oscuro', swatch: '#1E3A8A', border: '#3B82F6' },
  { name: 'Policía del Estado Trujillo', colorLabel: 'Azul claro', swatch: '#38BDF8', border: '#7DD3FC' },
  { name: 'Policía Municipal', colorLabel: 'Amarillo', swatch: '#FACC15', border: '#FEF08A' },
  { name: 'CONAS', colorLabel: 'Negro', swatch: '#09090B', border: '#71717A' },
  { name: 'CICPC', colorLabel: 'Verde', swatch: '#15803D', border: '#4ADE80' },
  { name: 'Guardacostas', colorLabel: 'Azul marino / Cian', swatch: '#0E7490', border: '#22D3EE' },
];

const MAP_SYMBOL_LEGEND = [
  { label: 'Sede CZGNB-23 y 3 Destacamentos', dot: '#7F1D1D', detail: 'Comando de Zona Nro. 23 (Valera) y sedes D-231, DCR 23-1 y DESUR-23.' },
  { label: 'Compañías y Puestos / PACs GNB', dot: '#DC2626', detail: '10 Compañías y 29 Puestos/PACs distribuidos en los 20 municipios.' },
  { label: 'Comisión Terrestre activa', dot: '#10B981', detail: 'Unidad en patrullaje o puesto por tierra.' },
  { label: 'Comisión Lacustre activa', dot: '#06B6D4', detail: 'Lancha o patrulla desplegada en el Lago de Maracaibo / La Ceiba.' },
  { label: 'Alerta SOS (Apoyo Requerido)', dot: '#EF4444', detail: 'Emergencia crítica pulsante con cálculo de unidades más cercanas.' },
  { label: 'Desvío de Patrullaje', dot: '#F59E0B', detail: 'Comisión fuera del radio asignado (por defecto 5 km del sector o cuadrante).' },
  { label: 'Manifestación / Cierre de Vía', dot: '#D946EF', detail: 'Protesta o tranca por servicios públicos con control de paso vehicular.' },
  { label: 'Seguridad Vial / Accidente', dot: '#FB923C', detail: 'Colisión, volcamiento, arrollamiento, derrumbe o control vial.' },
  { label: 'Homicidio / Delito Grave / Banda', dot: '#B91C1C', detail: 'Novedad violenta o polígono/radio de grupo delictivo.' },
  { label: 'Límites de Estado y 20 Municipios', dot: '#6366F1', detail: 'Delimitación opcional en colores transparentes del Estado Trujillo y sus 20 municipios.' },
  { label: 'Cuadrante de Paz y Puntos Patrullados', dot: '#34D399', detail: 'Cobertura de patrullaje con fotografía y coordenadas GPS selladas.' },
];

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'unidades',
    title: 'Comando de Zona Nro. 23: Destacamentos, Compañías y Puestos',
    shortTitle: 'Unidades CZ-23',
    summary:
      'Despliegue orgánico completo del Estado Trujillo: Sede CZGNB-23 (Santa Cruz, Valera), 3 Destacamentos (D-231, DCR 23-1, DESUR-23), 10 Compañías y 29 Puestos/PACs.',
    icon: Building2,
    accentClass: 'text-red-400 bg-red-950/60 border-red-500/40',
    navTab: 'unidades',
    navLabel: 'Ir a Unidades CZ-23',
    steps: [
      'Abre la pestaña "Unidades CZ-23" para explorar la estructura jerárquica completa: Sede CZGNB-23 → 3 Destacamentos (D-231 Trujillo, DCR 23-1 La Ceiba, DESUR-23 Valera) → Compañías → Puestos y PACs.',
      'Filtra por Destacamento (D-231, DCR 23-1 o DESUR-23) tanto en la pestaña Unidades como en el panel izquierdo del Mapa Operativo para enfocar las comisiones y puestos de esa unidad.',
      'Desde cualquier Compañía o Puesto/PAC puedes llamar por teléfono, ubicar su posición exacta en el mapa, cambiar su estado operativo (Operativo, Reforzado, En Alerta) o pulsar "Desplegar Aquí" para abrir una comisión ya precargada con su Destacamento, Compañía y coordenadas.',
      'Crea nuevas Compañías o Puestos/PACs desde la pestaña "Unidades CZ-23" o tocando el botón "Cía / Puesto" en el mapa; usa "Reubicar" para mover cualquier Compañía o Puesto tocando su nueva posición en el mapa, y "Eliminar" (Administrador / creador Supervisor) para retirar unidades con confirmación segura. Todos los cambios se sincronizan en tiempo real.',
    ],
    tip: 'Activa o desactiva la capa "Unidades GNB" en el Mapa Operativo para ver, reubicar, editar o eliminar Compañías y PACs directamente desde su ficha en el mapa.',
    keywords: ['czgnb', 'comando de zona', '23', 'destacamento', 'd-231', 'dcr 23-1', 'desur', 'desur-23', 'compania', 'puesto', 'pac', 'unidades', 'organica', 'crear', 'reubicar', 'eliminar'],
  },
  {
    id: 'mapa',
    title: 'Mapa Operativo y Capas Tácticas',
    shortTitle: 'Mapa y Capas',
    summary:
      'Visualiza en tiempo real el Estado Trujillo, las unidades del CZGNB-23, comisiones desplegadas, novedades, cuadrantes y puestos aliados.',
    icon: MapIcon,
    accentClass: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    navTab: 'mapa',
    navLabel: 'Ir al Mapa Operativo',
    steps: [
      'Usa el buscador del mapa para localizar municipios, carreteras o caseríos y trazar rutas terrestres o referencias lacustres.',
      'Activa o desactiva la capa "Límites Edo/Mun" para delimitar el Estado Trujillo (borde blanco) y sus 20 municipios con colores transparentes; toca cualquier municipio para ver su capital, Destacamento asignado y conteo operativo.',
      'Usa la barra de Capas para activar o desactivar: Límites Edo/Mun, Comisiones, Unidades GNB (CZ-23), Cuadrantes de Paz, Geocerca, GPS Vivo, Patrullaje, Novedades, Criminalidad, Bandas y Fuerzas Amigas.',
      'Cambia el modo de interacción en el mapa entre Inspeccionar, Registrar Novedad, Marcar Punto Patrullado o Reubicar una comisión haciendo clic directo sobre el terreno.',
      'Usa el botón "Leyenda" en la barra superior del mapa para mostrar u ocultar la simbología cuando la necesites, y en pantallas de escritorio oculta cualquiera de las columnas laterales o pulsa "Ampliar" para ver el mapa a pantalla completa.',
      'En teléfonos móviles, alterna fácilmente entre las pestañas Mapa, Lista y Detalle en la parte superior.',
    ],
    tip: 'Toca cualquier municipio (cuando "Límites Edo/Mun" esté activo) o marcador en el mapa para ver su ficha completa, enfocar el sector o trazar ruta.',
    keywords: ['mapa', 'capas', 'limites', 'municipios', 'estado', 'colores', 'transparente', 'leyenda', 'ampliar', 'ocultar', 'columnas', 'paneles', 'rutas', 'satelite', 'buscar', 'trujillo', 'coordenadas', 'ubicacion'],
  },
  {
    id: 'comisiones',
    title: 'Comisiones (Terrestres y Lacustres), GPS y Desvío',
    shortTitle: 'Comisiones y GPS',
    summary:
      'Despliega y controla múltiples comisiones simultáneas con personal, armamento, seguimiento GPS en vivo y alertas por desvío.',
    icon: Radio,
    accentClass: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
    navTab: 'comisiones',
    navLabel: 'Ir a Comisiones',
    steps: [
      'Pulsa el botón verde "Nueva Comisión" (arriba a la derecha) para registrar modalidad Terrestre o Lacustre, jefe de comisión, efectivos, vehículo o embarcación, seriales de armamento y Cuadrante de Paz asignado.',
      'Abre una comisión para editar sus datos, cambiar su estado (En Ruta, En Puesto, Finalizada) o compartir el parte operativo.',
      'Activa "GPS en Vivo" desde tu teléfono para transmitir tu posición en tiempo real y actualizar automáticamente la ubicación de la comisión.',
      'Alerta Visual de Desvío: el sistema compara la coordenada actual con el sector o Cuadrante de Paz asignado y muestra una alerta visual en el mapa si la patrulla excede el radio permitido (por defecto 5 km, ajustable desde el mapa).',
    ],
    tip: 'Puedes modificar el radio máximo de desvío en kilómetros (por ejemplo 3 km, 5 km o 10 km) directamente desde el control de Radio en el mapa.',
    keywords: ['comision', 'comisiones', 'terrestre', 'lacustre', 'lancha', 'gps', 'vivo', 'desvio', 'radio', '5km', 'armamento'],
  },
  {
    id: 'cuadrantes',
    title: 'Cuadrantes de Paz (Trujillo) y Puntos Patrullados',
    shortTitle: 'Cuadrantes de Paz',
    summary:
      'Controla el patrullaje sobre los 24 Cuadrantes de Paz del Estado Trujillo y registra puntos verificados con fotografía GPS.',
    icon: Compass,
    accentClass: 'text-teal-400 bg-teal-500/15 border-teal-500/30',
    navTab: 'mapa',
    navLabel: 'Ver Cuadrantes en Mapa',
    steps: [
      'Activa la capa "Cuadrantes de Paz" para ver en el mapa los cuadrantes rurales, urbanos, viales y lacustres junto con el contador de cobertura (cubiertos vs. pendientes).',
      'Selecciona cualquier Cuadrante de Paz para consultar su municipio, sectores, teléfono de contacto y botón de llamada rápida al VEN-911.',
      'Usa "Marcar Punto Patrullado" para registrar la hora de paso, Cuadrante, condición del sector (Sin Novedad, Sospechoso, Control Vial, Manifestación/Cierre de Vía o Novedad Detectada), flujo vehicular y visibilidad.',
      'Adjunta o toma una fotografía en el sitio: la app le estampa automáticamente la fecha, hora y coordenadas GPS como evidencia operativa.',
    ],
    tip: 'Al marcar un punto patrullado dentro de un Cuadrante de Paz, este se refleja de inmediato como cubierto en el resumen táctico.',
    keywords: ['cuadrante', 'cuadrantes', 'paz', 'trujillo', 'patrullaje', 'punto patrullado', 'foto', 'fotografia', '911', 'cobertura'],
  },
  {
    id: 'vial',
    title: 'Seguridad Vial y Accidentes de Tránsito',
    shortTitle: 'Seguridad Vial',
    summary:
      'Registra y georreferencia accidentes viales en la Troncal 001 (Panamericana), Troncal 007, Eje Valera–Trujillo y carreteras rurales.',
    icon: Car,
    accentClass: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
    navTab: 'criminalidad',
    navLabel: 'Ir a Seguridad Vial',
    steps: [
      'Registra un hecho desde el botón de nueva novedad en el mapa o en la pestaña Criminalidad eligiendo un tipo vial: Colisión, Volcamiento, Arrollamiento, Accidente de Moto, Obstrucción/Derrumbe o Infracción Grave.',
      'Completa la ficha de seguridad vial: arteria o troncal, estado de la vía, cantidad de vehículos involucrados, placas, lesionados, fallecidos y causa probable.',
      'Filtra por "Seguridad Vial" en la pestaña Criminalidad para revisar el resumen de siniestros y enfocarlos en el mapa.',
    ],
    keywords: ['vial', 'transito', 'accidente', 'choque', 'colision', 'volcamiento', 'arrollamiento', 'moto', 'troncal', 'panamericana', 'carretera'],
  },
  {
    id: 'criminalidad',
    title: 'Homicidios, Criminalidad Rural y Delitos Ambientales',
    shortTitle: 'Delitos y Ambiente',
    summary:
      'Mapa de incidencia delictiva con registro de homicidios, hechos violentos, delitos rurales/lacustres y delitos ambientales.',
    icon: Flame,
    accentClass: 'text-red-400 bg-red-500/15 border-red-500/30',
    navTab: 'criminalidad',
    navLabel: 'Ir a Criminalidad',
    steps: [
      'Registra novedades clasificadas por categoría: Homicidios / Delitos Graves (homicidio, femicidio, lesiones graves, enfrentamiento, secuestro, extorsión), Criminalidad Rural/Lacustre (abigeato, piratería lacustre, hurto de vehículos) y Delitos Ambientales (tala ilegal, incendio forestal, minería ilegal, contaminación hídrica, tráfico de fauna y desechos tóxicos).',
      'Asigna la severidad (Crítica, Alta, Media, Baja) y actualiza el estado del caso (Activa, En Atención o Cerrada) conforme avanza la actuación.',
      'Utiliza los filtros por categoría, severidad o buscador de texto para analizar zonas críticas y presiona "Ubicar en Mapa" para saltar al sitio exacto.',
    ],
    keywords: ['homicidio', 'femicidio', 'delito', 'criminalidad', 'ambiental', 'tala', 'incendio', 'abigeato', 'pirateria', 'secuestro', 'extorsion'],
  },
  {
    id: 'manifestaciones',
    title: 'Alertas por Manifestaciones y Cierres de Vías',
    shortTitle: 'Manifestaciones y Vías',
    summary:
      'Monitorea protestas y cierres de vías por fallas de servicios públicos con alerta superior en tiempo real y control de reapertura.',
    icon: Megaphone,
    accentClass: 'text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/30',
    navTab: 'criminalidad',
    navLabel: 'Ver Alertas Viales',
    steps: [
      'Crea una novedad de tipo Manifestación Pacífica, Manifestación Violenta, Cierre de Vía por Servicios Públicos o Tranca Gremial / Transporte.',
      'Especifica el estado de paso (Cierre Total, Paso Parcial, Intermitente o Vía Despejada), el servicio o motivo reclamo (agua, electricidad, gas, combustible, vialidad, telecomunicaciones) y la cantidad aproximada de personas.',
      'Mientras la alerta esté activa, todos los usuarios verán una barra fucsia en la parte superior con acceso directo para ubicar el cierre en el mapa.',
      'Una vez restablecido el tránsito, pulsa "Vía Despejada" en la barra superior o en la ficha para cerrar la alerta y dejar constancia en auditoría.',
    ],
    tip: 'Las manifestaciones y cierres de vía generan notificación push inmediata a los usuarios conectados.',
    keywords: ['manifestacion', 'protesta', 'cierre', 'via', 'tranca', 'servicios publicos', 'agua', 'luz', 'electricidad', 'gas', 'combustible', 'despejada'],
  },
  {
    id: 'sos',
    title: 'Botón de Apoyo (SOS) y Notificaciones Push',
    shortTitle: 'Apoyo SOS y Alertas',
    summary:
      'Activa emergencias tácticas con cálculo de refuerzos cercanos y recibe notificaciones en tiempo real de cada evento crítico.',
    icon: BellRing,
    accentClass: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
    navTab: 'mapa',
    navLabel: 'Ir al Centro Operativo',
    steps: [
      'Desde la ficha de cualquier comisión, pulsa "Solicitar Apoyo (SOS)" y escribe el motivo: se activará una barra roja de emergencia en todas las sesiones con sonido táctico.',
      'La barra SOS muestra automáticamente las comisiones y puestos de fuerzas amigas más cercanos junto con su distancia en kilómetros para despachar apoyo.',
      'Toca el icono de Campana (parte superior derecha) para habilitar las notificaciones push del navegador/teléfono, activar o silenciar el audio y revisar el historial de alertas recientes.',
      'Haz clic en cualquier alerta del historial o notificación emergente para centrar el mapa en el lugar del evento.',
    ],
    tip: 'En la campana puedes usar "Probar alerta" para verificar que el sonido y las notificaciones funcionan correctamente en tu dispositivo.',
    keywords: ['sos', 'apoyo', 'emergencia', 'notificacion', 'notificaciones', 'push', 'campana', 'sonido', 'alerta', 'refuerzo'],
  },
  {
    id: 'verificacion',
    title: 'Verificación de Personas/Vehículos y Estadísticas',
    shortTitle: 'Verificación y Fechas',
    summary:
      'Consulta ciudadanos y vehículos contra el registro de solicitados y analiza métricas con filtros por rango de fechas.',
    icon: ClipboardCheck,
    accentClass: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
    navTab: 'verificacion',
    navLabel: 'Ir a Verificación',
    steps: [
      'En la pestaña Verificación, introduce la cédula de una persona o la placa/serial de un vehículo para verificar instantáneamente si aparece en el listado de solicitados y guardar el chequeo.',
      'Agrega nuevos ciudadanos o vehículos al registro de Solicitados (o edita/elimina entradas) cuando exista una orden vigente.',
      'En el Panel de Estadísticas, selecciona el período deseado: Hoy, Últimos 7 días, Últimos 30 días o Fecha personalizada (desde / hasta) para filtrar totales, solicitados detectados y el gráfico diario.',
    ],
    keywords: ['verificacion', 'verificar', 'cedula', 'placa', 'vehiculo', 'solicitado', 'solicitados', 'estadisticas', 'fecha', 'rango', '7 dias', '30 dias'],
  },
  {
    id: 'inteligencia',
    title: 'Inteligencia: Zonas de Bandas y Fuerzas Amigas',
    shortTitle: 'Bandas y Aliados',
    summary:
      'Mantiene actualizado el mapa de grupos delictivos y los puestos de organismos aliados diferenciados por color oficial.',
    icon: Shield,
    accentClass: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    navTab: 'inteligencia',
    navLabel: 'Ir a Inteligencia',
    steps: [
      'Registra Zonas de Bandas indicando nombre o alias, municipio, sector, radio de amenaza en metros, peligrosidad, modalidad delictiva y recomendación táctica.',
      'Registra puestos de Fuerzas Amigas (GNB, PNB, Policía del Estado, Policía Municipal, CONAS, CICPC, Guardacostas) con su color institucional automático, teléfono y coordenadas.',
      'Si existe algún error de tipeo en el nombre, sector, teléfono o cualquier dato, pulsa el botón "Editar" en la tarjeta de la banda o fuerza amiga para corregirlo inmediatamente.',
      'Usa los botones rápidos de cada tarjeta para ubicar el puesto en el mapa o llamar directamente al organismo aliado.',
    ],
    tip: 'Revisa la sección "Colores y Símbolos" en esta misma guía para identificar de un vistazo el color de cada fuerza amiga en el mapa.',
    keywords: ['inteligencia', 'bandas', 'grupos', 'fuerzas amigas', 'aliados', 'editar', 'corregir', 'gnb', 'pnb', 'conas', 'cicpc', 'policia', 'colores'],
  },
  {
    id: 'acceso',
    title: 'Control de Acceso, Privilegios y Registro de Usuarios',
    shortTitle: 'Accesos y Privilegios',
    summary:
      'Restringe el ingreso únicamente a personal autorizado y asigna niveles de privilegio diferenciados para proteger la estructura de la app.',
    icon: Lock,
    accentClass: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30',
    steps: [
      'Todo usuario nuevo debe solicitar acceso indicando su grado, nombre, cédula y unidad; no podrá entrar hasta ser aprobado por el Administrador o ingresar un Código Secreto válido.',
      'Al compartir el enlace, los destinatarios ingresan en Modo Usuario (por defecto Operador), sin privilegios para modificar la estructura de la aplicación ni ver el panel de usuarios.',
      'Existen cuatro niveles de privilegio controlados por el Administrador: Solo Consulta (solo lectura), Usuario Operador (operaciones de campo y GPS), Supervisor Operativo (incluye catálogos de bandas, fuerzas amigas y solicitados) y Administrador.',
      'Puedes actualizar tus datos personales (grado, cédula, teléfono y cargo) tocando tu nombre en la parte inferior del panel izquierdo.',
    ],
    adminNote:
      'Como Administrador dispones del botón exclusivo "Usuarios y Privilegios" en la barra superior para ver cuántos usuarios tienes, cambiar el privilegio de cualquier usuario, aprobar o expulsar accesos, generar códigos secretos y auditar la bitácora completa.',
    keywords: ['acceso', 'codigo secreto', 'expulsar', 'bloquear', 'administrador', 'auditoria', 'registro', 'usuarios', 'privilegio', 'privilegios', 'rol', 'permiso'],
  },
  {
    id: 'pwa',
    title: 'Compartir Enlace, Acceso Móvil y Modo Sin Conexión',
    shortTitle: 'Compartir y Móvil',
    summary:
      'Comparte el enlace de acceso en Modo Usuario con otros funcionarios, abre la app en tu celular y consulta información si baja la señal.',
    icon: Smartphone,
    accentClass: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
    steps: [
      'Botón Compartir: pulsa "Compartir" para enviar el enlace de la aplicación por WhatsApp o copiarlo. Quienes ingresen desde el enlace lo harán siempre en Modo Usuario sin poder modificar la estructura de la app.',
      'Acceso desde teléfono: recomienda abrir el enlace directamente en Chrome (Android) o Safari (iPhone), fuera del navegador interno de WhatsApp, para iniciar sesión con Google sin bloqueos.',
      'Modo sin conexión: si pierdes señal en zonas rurales o lacustres, la barra de estado te avisará y podrás seguir consultando los datos cargados hasta recuperar conexión.',
      'Compartir partes: dentro de cualquier comisión o alerta SOS, pulsa Compartir para copiar o enviar el reporte estructurado con coordenadas GPS.',
    ],
    keywords: ['celular', 'telefono', 'movil', 'android', 'iphone', 'offline', 'sin conexion', 'compartir', 'whatsapp', 'enlace', 'modo usuario'],
  },
];

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({
  isCommandAdmin,
  onClose,
  onNavigateTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    return HELP_SECTIONS.filter((section) => {
      if (selectedSectionId !== 'all' && selectedSectionId !== 'colores') {
        if (section.id !== selectedSectionId) return false;
      }
      if (!normalizedQuery) return true;
      const haystack = [
        section.title,
        section.shortTitle,
        section.summary,
        section.tip || '',
        section.adminNote || '',
        ...section.steps,
        ...section.keywords,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, selectedSectionId]);

  const showColorsSection = useMemo(() => {
    if (selectedSectionId !== 'all' && selectedSectionId !== 'colores') {
      return false;
    }
    if (!normalizedQuery) return true;
    const colorHaystack = [
      'colores simbolos leyenda fuerzas amigas mapa marcadores',
      ...FRIENDLY_COLOR_LEGEND.map((c) => `${c.name} ${c.colorLabel}`),
      ...MAP_SYMBOL_LEGEND.map((m) => `${m.label} ${m.detail}`),
    ]
      .join(' ')
      .toLowerCase();
    return colorHaystack.includes(normalizedQuery);
  }, [normalizedQuery, selectedSectionId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-guide-title"
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] bg-[#0F1620] border border-slate-700/90 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 bg-[#121B27] border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="help-guide-title"
                className="font-display text-lg sm:text-xl font-bold text-white leading-tight"
              >
                Ayuda y Guía de Uso — CZGNB-23 Trujillo
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Manual práctico del Comando de Zona Nro. 23 GNB (D-231 · DCR 23-1 · DESUR-23).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar guía de ayuda"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Mobile Topic Picker */}
        <div className="px-4 sm:px-6 py-3 bg-[#101823] border-b border-slate-800/90 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim() && selectedSectionId !== 'all') {
                  setSelectedSectionId('all');
                }
              }}
              placeholder="Buscar función (ej: GPS, SOS, Cuadrantes, Cierre de vía, Colores, Código secreto)..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-[#0B1017] border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="md:hidden">
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              aria-label="Filtrar tema de ayuda"
              className="w-full px-3 py-2 text-xs bg-[#0B1017] border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Todas las funciones ({HELP_SECTIONS.length + 1})</option>
              {HELP_SECTIONS.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.shortTitle}
                </option>
              ))}
              <option value="colores">Colores y Símbolos</option>
            </select>
          </div>
        </div>

        {/* Body: Left Desktop Index + Right Scrollable Content */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-800 bg-[#0C121B] overflow-y-auto p-3 gap-1">
            <button
              type="button"
              onClick={() => setSelectedSectionId('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-semibold transition-colors cursor-pointer ${
                selectedSectionId === 'all'
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/35'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
              }`}
            >
              <span>Ver manual completo</span>
              <span className="font-mono-tabular text-[11px] opacity-80">
                {HELP_SECTIONS.length + 1}
              </span>
            </button>

            <div className="h-px bg-slate-800 my-1.5" />

            {HELP_SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = selectedSectionId === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setSelectedSectionId(section.id);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#172334] text-white border border-slate-600'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                  <span className="truncate">{section.shortTitle}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setSelectedSectionId('colores');
                setSearchQuery('');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer ${
                selectedSectionId === 'colores'
                  ? 'bg-[#172334] text-white border border-slate-600'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Palette className="w-3.5 h-3.5 shrink-0 text-amber-300" />
              <span className="truncate">Colores y Símbolos</span>
            </button>
          </aside>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {filteredSections.length === 0 && !showColorsSection ? (
              <div className="py-14 text-center border border-dashed border-slate-800 rounded-xl bg-[#0C121B]">
                <HelpCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-200">
                  No se encontraron resultados para "{searchQuery}"
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Prueba buscando palabras como GPS, SOS, Cuadrantes, Vial, Bandas o Auditoría.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedSectionId('all');
                  }}
                  className="mt-3 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-md cursor-pointer"
                >
                  Mostrar toda la guía
                </button>
              </div>
            ) : (
              <>
                {filteredSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <section
                      key={section.id}
                      className="rounded-xl bg-[#131C28] border border-slate-800 p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${section.accentClass}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                              {section.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-300 mt-0.5 leading-relaxed">
                              {section.summary}
                            </p>
                          </div>
                        </div>

                        {section.navTab && section.navLabel && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab(section.navTab!)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <span>{section.navLabel}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Cómo usar esta función
                        </div>
                        <ul className="space-y-2">
                          {section.steps.map((step, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed"
                            >
                              <span className="font-mono-tabular w-5 h-5 rounded-md bg-[#0C121B] border border-slate-700 text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {section.tip && (
                        <div className="rounded-lg bg-emerald-950/35 border border-emerald-800/50 px-3 py-2 text-xs text-emerald-200 leading-relaxed">
                          <span className="font-semibold text-emerald-300">Consejo práctico: </span>
                          {section.tip}
                        </div>
                      )}

                      {section.adminNote && isCommandAdmin && (
                        <div className="rounded-lg px-3 py-2 text-xs leading-relaxed border bg-amber-950/40 border-amber-600/40 text-amber-100">
                          <span className="font-semibold text-amber-300 inline-flex items-center gap-1 mr-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Nota de Administrador:
                          </span>
                          {section.adminNote}
                        </div>
                      )}
                    </section>
                  );
                })}

                {showColorsSection && (
                  <section className="rounded-xl bg-[#131C28] border border-slate-800 p-4 sm:p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0">
                        <Palette className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-white">
                          Referencia Rápida de Colores y Símbolos
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                          Identificación visual inmediata de organismos aliados y marcadores en el mapa.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-lg bg-[#0D141E] border border-slate-800 p-3.5 space-y-2.5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Colores de Fuerzas Amigas
                        </div>
                        <div className="space-y-2">
                          {FRIENDLY_COLOR_LEGEND.map((item) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0 border"
                                  style={{
                                    backgroundColor: item.swatch,
                                    borderColor: item.border,
                                  }}
                                />
                                <span className="text-slate-200 truncate">{item.name}</span>
                              </div>
                              <span className="text-slate-400 font-medium shrink-0">
                                {item.colorLabel}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg bg-[#0D141E] border border-slate-800 p-3.5 space-y-2.5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Marcadores del Mapa Operativo
                        </div>
                        <div className="space-y-2">
                          {MAP_SYMBOL_LEGEND.map((item) => (
                            <div key={item.label} className="flex items-start gap-2.5 text-xs">
                              <span
                                className="w-3 h-3 rounded-full shrink-0 mt-1"
                                style={{ backgroundColor: item.dot }}
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-200">{item.label}</div>
                                <div className="text-slate-400 leading-snug">{item.detail}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-[#111924] border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] sm:text-xs text-slate-400">
            Puedes abrir esta guía en cualquier momento pulsando el icono <strong className="text-slate-200">(?)</strong> en la barra superior.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors cursor-pointer shrink-0"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

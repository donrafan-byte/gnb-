import { formatCoords } from './geo';

const MAX_DIMENSION = 920;
const MAX_DATA_URL_LENGTH = 245000;

export interface StampedGeoPhotoResult {
  fotoDataUrl: string;
  fotoCoordenadas: string;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen seleccionada.'));
    };
    img.src = objectUrl;
  });
}

export function buildGeoCoordStamp(lat: number, lng: number): string {
  const now = new Date();
  const dateStr = now.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${lat.toFixed(5)}, ${lng.toFixed(5)} (${formatCoords(lat, lng)}) · ${dateStr}`.slice(0, 140);
}

/**
 * Resizes an uploaded/captured site photo, embeds a high-contrast tactical
 * coordinate & timestamp bar directly onto the bottom of the image, and
 * compresses it safely under the Firestore document budget.
 */
export async function stampAndCompressGeoPhoto(
  file: File,
  opts: {
    lat: number;
    lng: number;
    sector?: string;
    label: string;
  }
): Promise<StampedGeoPhotoResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecciona un archivo de imagen válido (JPG, PNG o WEBP).');
  }

  const img = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height, 1));
  const targetW = Math.max(320, Math.round(img.width * scale));
  const targetH = Math.max(240, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo procesar la fotografía en este navegador.');
  }

  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Draw tactical bottom telemetry bar directly onto image
  const barHeight = Math.max(54, Math.round(targetH * 0.13));
  ctx.fillStyle = 'rgba(7, 13, 20, 0.82)';
  ctx.fillRect(0, targetH - barHeight, targetW, barHeight);

  // Subtle top accent border on the bar
  ctx.fillStyle = '#10B981';
  ctx.fillRect(0, targetH - barHeight, targetW, 2);

  const now = new Date();
  const timestamp = now.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const padX = Math.max(12, Math.round(targetW * 0.02));
  const titleFontSize = Math.max(11, Math.min(16, Math.round(targetW * 0.019)));
  const coordFontSize = Math.max(10, Math.min(14, Math.round(targetW * 0.017)));

  ctx.textBaseline = 'middle';
  ctx.font = `700 ${titleFontSize}px sans-serif`;
  ctx.fillStyle = '#34D399';
  const topLine = `CZGNB-23 TRUJILLO · ${opts.label.toUpperCase()} · ${timestamp}`;
  ctx.fillText(topLine, padX, targetH - barHeight + barHeight * 0.34, targetW - padX * 2);

  ctx.font = `600 ${coordFontSize}px monospace`;
  ctx.fillStyle = '#F8FAFC';
  const sectorSuffix = opts.sector?.trim() ? ` · ${opts.sector.trim().slice(0, 38)}` : '';
  const coordLine = `GPS: ${opts.lat.toFixed(6)}, ${opts.lng.toFixed(6)} (${formatCoords(opts.lat, opts.lng)})${sectorSuffix}`;
  ctx.fillText(coordLine, padX, targetH - barHeight + barHeight * 0.72, targetW - padX * 2);

  const qualities = [0.78, 0.68, 0.58, 0.48, 0.38];
  let fotoDataUrl = '';
  for (const q of qualities) {
    fotoDataUrl = canvas.toDataURL('image/jpeg', q);
    if (fotoDataUrl.length <= MAX_DATA_URL_LENGTH) {
      break;
    }
  }

  if (fotoDataUrl.length > MAX_DATA_URL_LENGTH) {
    // Downscale once more for very high-detail images
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = Math.round(targetW * 0.7);
    smallCanvas.height = Math.round(targetH * 0.7);
    const sCtx = smallCanvas.getContext('2d');
    if (sCtx) {
      sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
      fotoDataUrl = smallCanvas.toDataURL('image/jpeg', 0.55);
    }
  }

  if (fotoDataUrl.length > 258000) {
    throw new Error('La imagen excede el tamaño máximo permitido. Intenta con otra fotografía.');
  }

  return {
    fotoDataUrl,
    fotoCoordenadas: buildGeoCoordStamp(opts.lat, opts.lng),
  };
}

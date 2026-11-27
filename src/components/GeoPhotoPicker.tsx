import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, MapPin, Trash2 } from 'lucide-react';
import { stampAndCompressGeoPhoto } from '../lib/geoPhoto';

interface GeoPhotoPickerProps {
  lat: number;
  lng: number;
  sector?: string;
  label: string;
  fotoDataUrl: string;
  fotoCoordenadas: string;
  onChange: (next: { fotoDataUrl: string; fotoCoordenadas: string }) => void;
}

export const GeoPhotoPicker: React.FC<GeoPhotoPickerProps> = ({
  lat,
  lng,
  sector,
  label,
  fotoDataUrl,
  fotoCoordenadas,
  onChange,
}) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      const safeLat = Number.isFinite(lat) ? lat : 9.4685;
      const safeLng = Number.isFinite(lng) ? lng : -71.0665;
      const stamped = await stampAndCompressGeoPhoto(file, {
        lat: safeLat,
        lng: safeLng,
        sector,
        label,
      });
      onChange(stamped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la foto.');
    } finally {
      setProcessing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-slate-300 font-medium">
          Fotografía Georreferenciada del Sitio (Opcional)
        </label>
        <span className="text-[10px] text-emerald-400 font-mono-tabular">
          Sello GPS automático en imagen
        </span>
      </div>

      {/* Hidden inputs for direct mobile camera & file gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-red-300 bg-red-950/60 border border-red-500/40 rounded px-2.5 py-1.5">
          {error}
        </p>
      )}

      {fotoDataUrl ? (
        <div className="bg-[#0B1117] border border-slate-700 rounded-md overflow-hidden">
          <div className="relative">
            <img
              src={fotoDataUrl}
              alt="Fotografía georreferenciada del sitio"
              className="w-full max-h-56 object-cover bg-black"
            />
            <button
              type="button"
              onClick={() => onChange({ fotoDataUrl: '', fotoCoordenadas: '' })}
              className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-red-900/90 hover:bg-red-800 text-white rounded-md cursor-pointer shadow"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Quitar
            </button>
          </div>
          <div className="px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-slate-300 border-t border-slate-800">
            <span className="inline-flex items-center gap-1.5 font-mono-tabular truncate">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{fotoCoordenadas}</span>
            </span>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="text-sky-400 hover:text-sky-300 font-semibold whitespace-nowrap cursor-pointer shrink-0"
            >
              Repetir
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={processing}
            onClick={() => cameraInputRef.current?.click()}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-100 bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/40 rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{processing ? 'Estampando GPS...' : 'Tomar Foto'}</span>
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={() => galleryInputRef.current?.click()}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-200 bg-[#192332] hover:bg-[#233247] border border-slate-700/80 rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            <ImagePlus className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Adjuntar Imagen</span>
          </button>
        </div>
      )}
    </div>
  );
};

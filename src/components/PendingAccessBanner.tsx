import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  ShieldAlert,
  ShieldBan,
} from 'lucide-react';
import type { OfficerProfile } from '../types/operations';

interface PendingAccessBannerProps {
  pendingOfficers: OfficerProfile[];
  onApprove: (officer: OfficerProfile) => Promise<void>;
  onExpel: (officer: OfficerProfile, motivo: string) => Promise<void>;
  onOpenAccessPanel: () => void;
}

export const PendingAccessBanner: React.FC<PendingAccessBannerProps> = ({
  pendingOfficers,
  onApprove,
  onExpel,
  onOpenAccessPanel,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  if (pendingOfficers.length === 0) return null;

  const handleQuickApprove = async (off: OfficerProfile) => {
    setBusyUid(off.uid);
    try {
      await onApprove(off);
    } finally {
      setBusyUid(null);
    }
  };

  const handleQuickReject = async (off: OfficerProfile) => {
    setBusyUid(off.uid);
    try {
      await onExpel(off, 'Acceso no autorizado — rechazado desde alerta de ingreso');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div
      role="alert"
      className="bg-amber-950/90 border-b border-amber-500/70 text-amber-50 px-3 sm:px-4 py-2 shrink-0 z-20"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
          <span className="text-xs font-bold tracking-wide text-amber-100">
            ALERTA DE ACCESO:{' '}
            {pendingOfficers.length === 1
              ? '1 usuario solicita autorización para ingresar'
              : `${pendingOfficers.length} usuarios solicitan autorización para ingresar`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAccessPanel}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded cursor-pointer"
          >
            <KeyRound className="w-3 h-3" />
            Control de Acceso / Códigos
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-amber-900/70 hover:bg-amber-800/80 text-amber-100 rounded cursor-pointer"
            aria-label={collapsed ? 'Expandir solicitudes' : 'Contraer solicitudes'}
          >
            {collapsed ? (
              <>
                Ver <ChevronDown className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Ocultar <ChevronUp className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {pendingOfficers.map((off) => {
            const isBusy = busyUid === off.uid;
            return (
              <div
                key={off.uid}
                className="flex flex-wrap items-center justify-between gap-2 bg-[#16120B]/90 border border-amber-500/40 rounded-md px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">
                      {off.grado ? `${off.grado} ` : ''}
                      {off.displayName}
                    </span>
                    {off.cedula && (
                      <span className="font-mono-tabular text-[11px] text-amber-200">
                        C.I. {off.cedula}
                      </span>
                    )}
                    <span className="font-mono-tabular text-[11px] text-slate-300">
                      {off.email}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-200/80 truncate">
                    {off.cargo || off.unit}
                    {off.telefono ? ` · Tel: ${off.telefono}` : ''}
                    {off.solicitudNota ? ` · Nota: "${off.solicitudNota}"` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleQuickApprove(off)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aprobar Ingreso
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleQuickReject(off)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded cursor-pointer"
                  >
                    <ShieldBan className="w-3.5 h-3.5" />
                    Expulsar / Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

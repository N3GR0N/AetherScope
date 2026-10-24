"use client";

import { useEffect } from "react";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  targetName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isProcessing?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export default function ConfirmDeleteModal({
  isOpen,
  title,
  description,
  targetName,
  confirmLabel = "CONFIRMAR ELIMINACIÓN",
  cancelLabel = "CANCELAR",
  isProcessing = false,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none font-[family-name:var(--font-proto)]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
    >
      <div className="bg-[#17171C] border border-[#3A3A42] w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera Técnica del Modal */}
        <div className="p-4 bg-[#1A1A1F] border-b border-[#2B2B31] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-xs bg-[#251515] border border-[#5C2B2B] flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
            </div>
            <div>
              <h2 className="text-[#F1F0E1] font-semibold text-xs tracking-[0.16em] uppercase">
                {title}
              </h2>
              <span className="text-[9px] text-[#9A9A92] uppercase tracking-wider block">
                PROTOCOLO DE PURGA DE DATOS
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-6 h-6 border border-[#2B2B31] bg-transparent text-[#9A9A92] hover:text-[#F1F0E1] hover:border-[#3A3A42] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
            title="Cerrar ventana"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-5 space-y-3.5 bg-[#17171C]">
          <p className="text-[11.5px] text-[#9A9A92] leading-relaxed uppercase tracking-wide">
            {description}
          </p>

          {targetName && (
            <div className="p-3 bg-[#101015] border border-[#2B2B31] flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#EF4444] rounded-full shrink-0" />
              <span className="text-xs font-mono text-[#F1F0E1] break-all uppercase truncate">
                {targetName}
              </span>
            </div>
          )}

          <div className="p-2.5 bg-[#251515]/60 border border-[#5C2B2B] text-[10px] text-[#FCA5A5] flex items-start gap-2">
            <Trash2 className="w-3.5 h-3.5 text-[#EF4444] shrink-0 mt-0.5" />
            <span className="leading-tight">
              Esta operación es irreversible. Los registros seleccionados serán eliminados permanentemente del sistema.
            </span>
          </div>
        </div>

        {/* Barra de Acciones */}
        <div className="p-3.5 bg-[#1A1A1F] border-t border-[#2B2B31] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-3.5 py-1.5 border border-[#3A3A42] hover:border-[#506385] bg-transparent text-[#9A9A92] hover:text-[#F1F0E1] text-[10.5px] uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40 font-medium"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-4 py-1.5 bg-[#251515] hover:bg-[#381A1A] text-[#F1F0E1] border border-[#EF4444] hover:border-[#F87171] text-[10.5px] uppercase tracking-[0.14em] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-40"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-[#F1F0E1] animate-spin" />
                <span>PROCESANDO...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

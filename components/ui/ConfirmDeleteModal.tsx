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
  confirmLabel = "Confirmar eliminación",
  cancelLabel = "Cancelar",
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none animate-panel-enter"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
    >
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[20px] w-full max-w-md flex flex-col overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--error)]/15 border border-[var(--error)]/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[var(--error)]" />
            </div>
            <div>
              <h2 className="text-[var(--text)] font-semibold text-sm tracking-tight">
                {title}
              </h2>
              <span className="text-[11px] text-[var(--text-muted)] block">
                Operación de eliminación
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 rounded-full hover:bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3.5 bg-[var(--surface-1)]">
          <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
            {description}
          </p>

          {targetName && (
            <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[var(--error)] rounded-full shrink-0" />
              <span className="text-xs font-mono text-[var(--text)] break-all truncate">
                {targetName}
              </span>
            </div>
          )}

          <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--error)]/30 text-[12px] text-[var(--error)] flex items-start gap-2.5">
            <Trash2 className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Esta operación es irreversible. Los registros seleccionados serán eliminados de la bitácora.
            </span>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="p-4 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-full border border-[var(--border)] hover:bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text)] text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-40"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-4 py-2 rounded-full bg-[var(--error)] hover:opacity-90 text-[var(--text)] text-[12px] font-semibold transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Eliminando...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

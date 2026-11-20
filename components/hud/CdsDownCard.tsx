"use client";

interface CdsDownCardProps {
  lastCheckedTime?: string;
  className?: string;
}

export default function CdsDownCard({
  lastCheckedTime,
  className = "",
}: CdsDownCardProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`solid-card rounded-[20px] p-6 sm:p-8 max-w-md w-full text-center shadow-[0_8px_24px_rgba(0,0,0,0.35)] border border-[var(--border)] bg-[var(--surface-1)] ${className}`}
    >
      <div className="flex items-center justify-center gap-2.5 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--error)] shrink-0 animate-pulse" />
        <h2 className="text-base sm:text-lg font-medium text-[var(--text)]">
          Servicios CDS fuera de línea
        </h2>
      </div>

      <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
        El mapa celeste depende del Centro de Datos de Estrasburgo, que está caído. Se reanudará automáticamente cuando vuelva.
      </p>

      {lastCheckedTime && (
        <div className="pt-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
          <span>Última comprobación:</span>
          <span className="font-mono tabular-nums text-[var(--text)]">{lastCheckedTime}</span>
        </div>
      )}
    </div>
  );
}

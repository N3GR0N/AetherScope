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
      className={`bg-[#101015] border border-[#C9B98F] p-6 max-w-lg w-full text-center font-[family-name:var(--font-proto)] shadow-2xl select-none rounded-none cds-fade ${className}`}
    >
      <div className="flex items-center justify-center gap-2.5 mb-3">
        <span className="w-2 h-2 bg-[#C9B98F] animate-pulse shrink-0" />
        <h2 className="text-sm sm:text-base font-bold tracking-[0.2em] text-[#C9B98F] uppercase">
          SERVICIOS CDS FUERA DE LÍNEA
        </h2>
      </div>

      <p className="text-xs sm:text-sm text-[#F1F0E1] mb-5 leading-relaxed tracking-wide">
        El mapa celeste depende del Centro de Datos de Estrasburgo, que está caído. Se reanudará automáticamente cuando vuelva.
      </p>

      {lastCheckedTime && (
        <div className="pt-3 border-t border-[#3A3A42] text-[10px] uppercase tracking-[0.16em] text-[#9A9A92]">
          Última comprobación:{" "}
          <span className="text-[#C9B98F] font-bold">{lastCheckedTime}</span>
        </div>
      )}
    </div>
  );
}

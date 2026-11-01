"use client";

import { useEffect, useState } from "react";

export interface CdsCheckingCardProps {
  className?: string;
  delayMs?: number;
}

export default function CdsCheckingCard({
  className = "",
  delayMs = 400,
}: CdsCheckingCardProps) {
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`bg-[#101015] border border-[#C9B98F] p-6 max-w-lg w-full text-center font-[family-name:var(--font-proto)] shadow-2xl select-none rounded-none cds-fade ${className}`}
    >
      <div className="flex items-center justify-center gap-2.5 mb-3">
        <span className="w-2 h-2 bg-[#506385] motion-safe:animate-pulse shrink-0" />
        <h2 className="text-sm sm:text-base font-bold tracking-[0.2em] text-[#C9B98F] uppercase">
          ESTABLECIENDO ENLACE CON EL CDS
          <span className="inline-flex ml-1 space-x-0.5 tracking-normal" aria-hidden="true">
            <span className="animate-cds-dot-1 motion-reduce:animate-none">.</span>
            <span className="animate-cds-dot-2 motion-reduce:animate-none">.</span>
            <span className="animate-cds-dot-3 motion-reduce:animate-none">.</span>
          </span>
        </h2>
      </div>

      {/* Barra de escaneo horizontal indeterminada */}
      <div className="w-full h-1.5 bg-[#17171C] border border-[#2B2B31] overflow-hidden relative my-4">
        <div className="cds-scan-bar absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-[#506385] via-[#C9B98F] to-[#506385]" />
      </div>

      <p className="text-xs sm:text-sm text-[#F1F0E1] leading-relaxed tracking-wide">
        Comprobando disponibilidad del Centro de Datos de Estrasburgo
      </p>
    </div>
  );
}

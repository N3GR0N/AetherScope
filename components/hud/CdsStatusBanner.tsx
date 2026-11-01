"use client";

import { useEffect, useState } from "react";

interface CdsStatusResponse {
  simbad: boolean;
  hips: boolean;
  checkedAt: string;
}

export default function CdsStatusBanner() {
  const [status, setStatus] = useState<CdsStatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const res = await fetch("/api/cds-status", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP error");
        const data: CdsStatusResponse = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) {
          setStatus({ simbad: false, hips: false, checkedAt: new Date().toISOString() });
        }
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 120_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Nada visible si todo está OK o aún no ha cargado
  if (!status || (status.simbad && status.hips)) {
    return null;
  }

  const details: string[] = [];
  if (!status.simbad) details.push("SIMBAD TAP");
  if (!status.hips) details.push("HiPS CDS");

  const isBaseMapDown = !status.hips;

  return (
    <aside
      aria-live="polite"
      className="fixed top-16 right-4 sm:right-6 z-40 font-[family-name:var(--font-proto)] select-none pointer-events-auto"
    >
      <div className="bg-[#101015]/95 border border-[#C9B98F]/50 px-3 py-1.5 flex items-center gap-2.5 shadow-lg backdrop-blur-sm">
        <span className="w-1.5 h-1.5 bg-[#C9B98F] animate-pulse shrink-0" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-[0.16em] text-[#C9B98F]">
            {isBaseMapDown ? "MAPA BASE NO DISPONIBLE (CDS)" : "SERVICIOS CDS DEGRADADOS"}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-[#9A9A92] border-l border-[#3A3A42] pl-2 hidden sm:inline">
            MODO FAILOVER ACTIVO ({details.join(" + ")})
          </span>
        </div>
      </div>
    </aside>
  );
}

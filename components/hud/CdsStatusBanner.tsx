"use client";

import { useCdsRecovery } from "@/lib/hooks/useCdsRecovery";
import { useSpace } from "@/context/SpaceContext";

export default function CdsStatusBanner() {
  const { status, isDegraded } = useCdsRecovery();

  let space: ReturnType<typeof useSpace> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    space = useSpace();
  } catch {
    space = null;
  }

  const resolvedBase = space?.resolvedBaseInfo;
  const isBaseMirror = Boolean(resolvedBase?.isMirror && resolvedBase.url);
  const isBaseAllDown = Boolean(
    resolvedBase !== null &&
    resolvedBase !== undefined &&
    !resolvedBase.isAvailable
  );

  // Nada visible si todo está OK y no se usa ningún espejo
  if (!isDegraded && !isBaseMirror && !isBaseAllDown) {
    return null;
  }

  // Determinar rótulos tácticos según estado
  let title = "SERVICIOS CDS DEGRADADOS";
  let subtitle = "MODO FAILOVER ACTIVO";

  if (isBaseAllDown) {
    title = "MAPA BASE NO DISPONIBLE";
    subtitle = "SELECCIONE SURVEY ALTERNATIVO MANUALMENTE";
  } else if (isBaseMirror) {
    const agency = resolvedBase?.mirrorAgency || "ESA";
    title = `MAPA BASE: ESPEJO (${agency})`;
    subtitle = `CONEXIÓN EXTERNA ACTIVA · ${space?.primarySurvey.shortLabel || "SURVEY"}`;
  } else if (status && !status.hips) {
    title = "MAPA BASE NO DISPONIBLE (CDS)";
    subtitle = "PROBANDO ESPEJOS ALTERNATIVOS...";
  } else if (status && !status.simbad) {
    title = "SERVICIOS CDS DEGRADADOS";
    subtitle = "SIMBAD NO DISPONIBLE (CONSULTAS TAP REDIRIGIDAS)";
  }

  return (
    <aside
      aria-live="polite"
      className="fixed top-16 right-4 sm:right-6 z-40 font-[family-name:var(--font-proto)] select-none pointer-events-auto"
    >
      <div className="bg-[#101015]/95 border border-[#C9B98F]/50 px-3 py-1.5 flex items-center gap-2.5 shadow-lg backdrop-blur-sm">
        <span className="w-1.5 h-1.5 bg-[#C9B98F] animate-pulse shrink-0" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-[0.16em] text-[#C9B98F]">
            {title}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-[#9A9A92] border-l border-[#3A3A42] pl-2 hidden sm:inline">
            {subtitle}
          </span>
        </div>
      </div>
    </aside>
  );
}

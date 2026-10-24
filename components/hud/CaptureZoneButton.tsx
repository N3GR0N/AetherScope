"use client";

import { useSpace } from "@/context/SpaceContext";
import {
  formatCoordinates,
  formatFov,
  MAX_ANALYSIS_FOV_THRESHOLD_DEG,
  TARGET_ANALYSIS_ZOOM_FOV_DEG,
} from "@/lib/astronomy/coordinates";
import { matchLocalDossierCapture } from "@/lib/astronomy/crossmatch";
import { ArrowUpRight, Search, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function CaptureZoneButton() {
  const router = useRouter();
  const space = useSpace();
  const { currentRa, currentDec, currentFov, getAladinInstance, setFovPreset } = space;
  const [isScanning, setIsScanning] = useState(false);
  const [, startTransition] = useTransition();

  const isZoomSufficient = currentFov <= MAX_ANALYSIS_FOV_THRESHOLD_DEG;
  const currentFovFormatted = formatFov(currentFov);
  const thresholdFovFormatted = formatFov(MAX_ANALYSIS_FOV_THRESHOLD_DEG);

  // Quick cross-match preview using Layer 1 local footprint classification
  const localMatchResult = isZoomSufficient
    ? matchLocalDossierCapture({
        raDeg: currentRa,
        decDeg: currentDec,
        radiusDeg: currentFov / 2,
      })
    : null;
  const localMatch = localMatchResult?.object ?? null;
  const matchState = localMatchResult?.state ?? 'none';
  const coords = formatCoordinates(currentRa, currentDec);

  const handleCapture = () => {
    if (!isZoomSufficient) return;

    setIsScanning(true);

    let finalRa = currentRa;
    let finalDec = currentDec;
    let finalFov = currentFov;

    const aladin = getAladinInstance();
    if (aladin) {
      try {
        const [liveRa, liveDec] = aladin.getRaDec();
        const liveFovVal = aladin.getFov();
        const liveFov = Array.isArray(liveFovVal) ? liveFovVal[0] : liveFovVal;

        if (typeof liveRa === "number" && !isNaN(liveRa)) finalRa = liveRa;
        if (typeof liveDec === "number" && !isNaN(liveDec)) finalDec = liveDec;
        if (typeof liveFov === "number" && !isNaN(liveFov)) finalFov = liveFov;
      } catch (err) {
        console.warn("[AetherScope] Error extrayendo coordenadas vivas de Aladin:", err);
      }
    }

    // Persist in sessionStorage for immediate state recovery
    try {
      sessionStorage.setItem(
        "aetherscope_active_coords",
        JSON.stringify({ ra: finalRa, dec: finalDec })
      );
      sessionStorage.setItem("aetherscope_active_fov", JSON.stringify(finalFov));
      sessionStorage.setItem("aetherscope_lab_panel_open", JSON.stringify(true));
    } catch (err) {
      console.warn("[AetherScope] Error guardando sesión en CaptureZoneButton:", err);
    }

    startTransition(() => {
      router.push(
        `/analyze?ra=${finalRa.toFixed(5)}&dec=${finalDec.toFixed(5)}&fov=${finalFov.toFixed(4)}`
      );
    });
  };

  const handleAssistiveZoom = () => {
    setFovPreset(TARGET_ANALYSIS_ZOOM_FOV_DEG);
  };

  return (
    <aside
      aria-label="Zona de Análisis Espectral"
      className="fixed bottom-3 left-2.5 right-2.5 sm:left-auto sm:right-5 sm:bottom-5 z-30 pointer-events-auto flex flex-col gap-2 w-auto sm:w-[420px] max-w-[calc(100vw-1.25rem)] font-[family-name:var(--font-proto)] select-none"
    >
      {/* ── CARD 1: CAMPO MUY AMPLIO (Aviso en --accent) ── */}
      {!isZoomSufficient && (
        <div className="bg-[#506385] border border-[#506385] px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center justify-between gap-2 shadow-lg">
          <span className="text-[9.5px] sm:text-[11px] uppercase tracking-[0.05em] sm:tracking-[0.06em] text-[#F1F0E1] leading-tight flex-1">
            CAMPO MUY AMPLIO ({currentFovFormatted.rawText}). ACERCÁ A ≤ {thresholdFovFormatted.rawText} PARA ANALIZAR
          </span>
          <button
            onClick={handleAssistiveZoom}
            className="bg-[#F1F0E1] text-[#101015] px-2 py-1 sm:px-2.5 sm:py-1 text-[9.5px] sm:text-[10px] uppercase font-bold tracking-[0.1em] flex items-center gap-1.5 shrink-0 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            title="Aproximar cámara automáticamente"
          >
            <Search className="w-3 h-3 text-[#101015]" strokeWidth={2.5} />
            <span>APROXIMAR</span>
          </button>
        </div>
      )}

      {/* ── CARD 2: CTA PRINCIPAL DE ANÁLISIS EN --BEIGE ── */}
      <div
        onClick={isZoomSufficient ? handleCapture : handleAssistiveZoom}
        className={`bg-[#B7B6A8] text-[#101015] border border-[#B7B6A8] p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 sm:gap-3 transition-opacity shadow-xl cursor-pointer ${
          isScanning ? "opacity-75 cursor-wait" : "hover:opacity-98"
        }`}
        title={
          isZoomSufficient
            ? "Analizar e investigar sector enfocado en el Laboratorio Astrofísico"
            : "Haz clic para aproximar la cámara automáticamente al sector específico"
        }
      >
        {/* Top telemetry row */}
        <div className="flex items-center justify-between text-[9px] sm:text-[9.5px] uppercase tracking-[0.12em] text-[#101015]/75">
          <span className="font-semibold">ANÁLISIS ESPECTRAL</span>
          <span className="truncate max-w-[170px] sm:max-w-none text-right">
            {isZoomSufficient
              ? matchState === 'inside' && localMatch
                ? `${localMatch.name} · ENFOCADO`
                : matchState === 'edge' && localMatch
                ? `BORDE DE ${localMatch.name}`
                : "SECTOR ENFOCADO"
              : `BLOQUEADO · FOV > ${thresholdFovFormatted.rawText}`}
          </span>
        </div>

        {/* Main CTA Title */}
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[18px] xs:text-[20px] sm:text-[23px] font-bold text-[#101015] uppercase tracking-wide leading-none truncate">
            {isScanning ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-[#101015]" />
                <span>INICIANDO ANÁLISIS...</span>
              </span>
            ) : isZoomSufficient ? (
              localMatch ? `ANALIZAR ${localMatch.name.toUpperCase()}` : "ANALIZAR SECTOR"
            ) : (
              "ACERCAR PARA ANALIZAR"
            )}
          </h2>
        </div>

        {/* Bottom coordinate readout & circular action button */}
        <div className="flex items-center justify-between pt-1 border-t border-[#101015]/15">
          <span className="text-[10px] sm:text-[11px] text-[#101015]/85 tabular-nums font-medium tracking-tight">
            {coords.raHms} · {coords.decDms}
          </span>

          <button
            disabled={isScanning}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#101015] text-[#F1F0E1] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
            title={isZoomSufficient ? "Entrar al laboratorio" : "Aproximar"}
          >
            {isScanning ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-[#F1F0E1]" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F1F0E1]" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

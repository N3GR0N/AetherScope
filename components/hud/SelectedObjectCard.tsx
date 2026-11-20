"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSpace } from "@/context/SpaceContext";
import {
  formatCoordinates,
  formatFov,
  getConstellation,
  MAX_ANALYSIS_FOV_THRESHOLD_DEG,
  TARGET_ANALYSIS_ZOOM_FOV_DEG,
} from "@/lib/astronomy/coordinates";
import { matchLocalDossierCapture } from "@/lib/astronomy/crossmatch";
import { ArrowUpRight, Search, Loader2, Compass, ChevronUp, ChevronDown } from "lucide-react";

export default function SelectedObjectCard() {
  const router = useRouter();
  const space = useSpace();
  const { currentRa, currentDec, currentFov, getAladinInstance, setFovPreset } = space;

  const [isScanning, setIsScanning] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [, startTransition] = useTransition();

  const isZoomSufficient = currentFov <= MAX_ANALYSIS_FOV_THRESHOLD_DEG;
  const currentFovFormatted = formatFov(currentFov);
  const thresholdFovFormatted = formatFov(MAX_ANALYSIS_FOV_THRESHOLD_DEG);

  const coords = formatCoordinates(currentRa, currentDec);
  const constellation = getConstellation(currentRa, currentDec);

  // Quick footprint cross-match preview using Layer 1 local catalogue
  const localMatchResult = isZoomSufficient
    ? matchLocalDossierCapture({
        raDeg: currentRa,
        decDeg: currentDec,
        radiusDeg: currentFov / 2,
      })
    : null;
  const localMatch = localMatchResult?.object ?? null;
  const matchState = localMatchResult?.state ?? "none";

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

    try {
      sessionStorage.setItem(
        "aetherscope_active_coords",
        JSON.stringify({ ra: finalRa, dec: finalDec })
      );
      sessionStorage.setItem("aetherscope_active_fov", JSON.stringify(finalFov));
      sessionStorage.setItem("aetherscope_lab_panel_open", JSON.stringify(true));
    } catch (err) {
      console.warn("[AetherScope] Error guardando sesión en SelectedObjectCard:", err);
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
    <>
      {/* ── Desktop Card (>= 768px) ── */}
      <aside
        aria-label="Panel de Objeto o Sector Seleccionado"
        className="hidden md:block fixed top-20 left-6 z-30 w-[350px] pointer-events-auto select-none animate-panel-enter"
      >
        <div className="glass-panel rounded-[20px] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex flex-col gap-4">
          {/* Eyebrow & Constellation */}
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Compass className="w-3.5 h-3.5 text-[var(--accent)]" />
              {matchState === "inside" && localMatch
                ? "Objetivo enfocado"
                : matchState === "edge" && localMatch
                ? "Borde de objetivo"
                : "Sector de cielo profundo"}
            </span>
            <span className="truncate max-w-[130px] font-mono text-[11px] text-[var(--text-muted)]">
              {constellation}
            </span>
          </div>

          {/* Title & Object Name */}
          <div>
            <h2 className="text-[19px] font-bold text-[var(--text)] tracking-tight leading-snug">
              {localMatch ? localMatch.name : "Sector Celeste"}
            </h2>
            <div className="text-[12px] text-[var(--text-muted)] mt-0.5">
              {localMatch?.objectType
                ? localMatch.objectType.toUpperCase()
                : "Exploración en coordenadas J2000.0"}
            </div>
          </div>

          {/* Real Astrometric Data Fields */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--border)]">
            <div className="p-2.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] block">Ascensión Recta</span>
              <span className="text-[12px] text-[var(--text)] font-mono tabular-nums font-medium">
                {coords.raHms}
              </span>
            </div>

            <div className="p-2.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] block">Declinación</span>
              <span className="text-[12px] text-[var(--text)] font-mono tabular-nums font-medium">
                {coords.decDms}
              </span>
            </div>

            {localMatch?.distanceLy && (
              <div className="p-2.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
                <span className="text-[11px] text-[var(--text-muted)] block">Distancia</span>
                <span className="text-[12px] text-[var(--text)] font-mono tabular-nums font-medium truncate block">
                  {localMatch.distanceLy}
                </span>
              </div>
            )}

            {localMatch?.majorDiameterArcmin && (
              <div className="p-2.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
                <span className="text-[11px] text-[var(--text-muted)] block">Tamaño Angular</span>
                <span className="text-[12px] text-[var(--text)] font-mono tabular-nums font-medium">
                  {localMatch.majorDiameterArcmin.toFixed(1)}&apos; ×{" "}
                  {(localMatch.minorDiameterArcmin ?? localMatch.majorDiameterArcmin).toFixed(1)}&apos;
                </span>
              </div>
            )}

            <div className="p-2.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] col-span-2 flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-muted)]">Campo de Visión (FOV)</span>
              <span className="text-[12px] text-[var(--accent)] font-mono tabular-nums font-medium">
                {currentFovFormatted.rawText}
              </span>
            </div>
          </div>

          {/* Action Button: Analizar Sector or Zoom Notice */}
          <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-2">
            {!isZoomSufficient ? (
              <div className="flex flex-col gap-2">
                <div className="p-2.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] text-[12px] text-[var(--text-muted)] leading-relaxed">
                  Campo amplio ({currentFovFormatted.rawText}). Se requiere aproximar a ≤{" "}
                  <span className="text-[var(--text)] font-mono">{thresholdFovFormatted.rawText}</span> para análisis espectral.
                </div>
                <button
                  type="button"
                  onClick={handleAssistiveZoom}
                  className="w-full min-h-[44px] rounded-full bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-1)] border border-[var(--border-strong)] text-[13px] font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Search className="w-4 h-4 text-[var(--accent)]" />
                  <span>Aproximar cámara automáticamente</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isScanning}
                onClick={handleCapture}
                className="w-full min-h-[44px] rounded-full bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-[13px] flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--on-accent)]" />
                    <span>Iniciando análisis...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {localMatch ? `Analizar ${localMatch.name}` : "Analizar sector"}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-[var(--on-accent)]" strokeWidth={2.5} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Mobile Compact Card / Sheet (< 768px) ── */}
      <aside
        aria-label="Panel móvil de Objeto o Sector"
        className="md:hidden fixed bottom-[126px] left-3 right-3 z-30 pointer-events-auto select-none animate-panel-enter"
      >
        <div className="glass-panel rounded-[20px] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex flex-col gap-2.5">
          {/* Header Row: target name + action button */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMobileExpanded((prev) => !prev)}
              className="flex-1 flex items-center gap-2 text-left min-w-0 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center shrink-0 border border-[var(--border)]">
                <Compass className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-[var(--text)] truncate">
                  {localMatch ? localMatch.name : "Sector Celeste"}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                  {constellation} · {coords.raHms}
                </div>
              </div>
              <div className="text-[var(--text-muted)] p-1">
                {mobileExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </div>
            </button>

            {/* Quick Action */}
            {!isZoomSufficient ? (
              <button
                type="button"
                onClick={handleAssistiveZoom}
                className="px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-medium text-[var(--accent)] flex items-center gap-1 shrink-0 min-h-[36px] cursor-pointer"
              >
                <Search className="w-3 h-3" />
                <span>Zoom</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isScanning}
                onClick={handleCapture}
                className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[12px] font-semibold flex items-center gap-1.5 shrink-0 min-h-[36px] cursor-pointer"
              >
                {isScanning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Analizar</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Expanded Drawer on Mobile */}
          {mobileExpanded && (
            <div className="pt-2 border-t border-[var(--border)] space-y-2 animate-panel-enter max-h-[220px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="p-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">RA</span>
                  <span className="font-mono tabular-nums text-[var(--text)]">{coords.raHms}</span>
                </div>
                <div className="p-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">DEC</span>
                  <span className="font-mono tabular-nums text-[var(--text)]">{coords.decDms}</span>
                </div>
                {localMatch?.distanceLy && (
                  <div className="p-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]">
                    <span className="text-[10px] text-[var(--text-muted)] block">Distancia</span>
                    <span className="font-mono tabular-nums text-[var(--text)] truncate block">
                      {localMatch.distanceLy}
                    </span>
                  </div>
                )}
                {localMatch?.majorDiameterArcmin && (
                  <div className="p-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]">
                    <span className="text-[10px] text-[var(--text-muted)] block">Tamaño Angular</span>
                    <span className="font-mono tabular-nums text-[var(--text)] truncate block">
                      {localMatch.majorDiameterArcmin.toFixed(1)}&apos; ×{" "}
                      {(localMatch.minorDiameterArcmin ?? localMatch.majorDiameterArcmin).toFixed(1)}&apos;
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

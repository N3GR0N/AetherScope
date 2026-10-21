"use client";

import { useSpace } from "@/context/SpaceContext";
import {
  formatCoordinates,
  formatFov,
  MAX_ANALYSIS_FOV_THRESHOLD_DEG,
  TARGET_ANALYSIS_ZOOM_FOV_DEG,
} from "@/lib/astronomy/coordinates";
import { matchLocalDossier } from "@/lib/astronomy/crossmatch";
import { Target, Loader2, ZoomIn, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function CaptureZoneButton() {
  const router = useRouter();
  const space = useSpace();
  const { currentRa, currentDec, currentFov, getAladinInstance, setFovPreset } = space;
  const [isScanning, setIsScanning] = useState(false);
  const [, startTransition] = useTransition();

  // Evaluación de umbral de zoom para especificidad de análisis
  // Cuanto menor es el FOV, más zoom tiene la cámara (más cercano al objeto)
  const isZoomSufficient = currentFov <= MAX_ANALYSIS_FOV_THRESHOLD_DEG;

  // Cálculo de ratio relativo de zoom para feedback al usuario
  // Ejemplo: si el usuario está en 8° y el umbral es 2°, está a 0.25x del zoom requerido.
  const currentFovFormatted = formatFov(currentFov);
  const thresholdFovFormatted = formatFov(MAX_ANALYSIS_FOV_THRESHOLD_DEG);

  // Quick cross-match preview using Layer 1 local cache for instant HUD feedback
  const localMatch = isZoomSufficient ? matchLocalDossier(currentRa, currentDec, 0.4) : null;
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
    } catch (err) {
      console.warn("[AetherScope] Error guardando sesión en CaptureZoneButton:", err);
    }

    // Feedback táctil y transición sub-200ms
    startTransition(() => {
      router.push(
        `/analyze?ra=${finalRa.toFixed(5)}&dec=${finalDec.toFixed(5)}&fov=${finalFov.toFixed(4)}`
      );
    });
  };

  // Zoom-in asistido al hacer clic cuando está fuera de rango
  const handleAssistiveZoom = () => {
    setFovPreset(TARGET_ANALYSIS_ZOOM_FOV_DEG);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
      <div className="flex flex-col items-center gap-2">
        {/* Detected Target Badge if notable object is in local range */}
        {localMatch && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3.5 py-1 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 backdrop-blur-xl flex items-center gap-2 text-[11px] font-sans text-emerald-300 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-semibold text-white/95">{localMatch.name}</span>
            <span className="text-white/40">•</span>
            <span className="text-emerald-400/90 text-[10px] font-mono">{localMatch.objectType}</span>
          </div>
        )}

        {/* Banner informativo si el campo es demasiado amplio (Zoom < umbral) */}
        {!isZoomSufficient && (
          <div
            onClick={handleAssistiveZoom}
            className="animate-in fade-in slide-in-from-bottom-1 duration-200 px-3 py-1 rounded-full bg-[#0a0d14]/90 border border-amber-500/30 backdrop-blur-xl flex items-center gap-2 text-[11px] font-sans text-amber-300/90 shadow-lg cursor-pointer hover:bg-amber-500/10 hover:border-amber-400 transition-all group"
            title="Haz clic para aproximar la cámara automáticamente al sector específico"
          >
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Campo muy amplio ({currentFovFormatted.rawText}). Acercá a ≤ {thresholdFovFormatted.rawText} para analizar
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md group-hover:bg-amber-500/30">
              <ZoomIn className="w-3 h-3" />
              <span>Aproximar</span>
            </span>
          </div>
        )}

        {/* Target Scanner Button (Apple Pro Glass + Squircle) */}
        <button
          onClick={isZoomSufficient ? handleCapture : handleAssistiveZoom}
          disabled={isScanning}
          className={`squircle group flex items-center gap-3 px-5 py-2.5 rounded-full border backdrop-blur-2xl transition-all duration-200 ease-out ${
            isZoomSufficient
              ? "bg-[#0a0d14]/85 hover:bg-[#0a0d14]/98 text-white/95 border-white/10 border-t-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.15)] cursor-pointer active:scale-[0.98]"
              : "bg-white/[0.04] hover:bg-white/[0.07] text-white/40 border-white/10 cursor-pointer border-dashed"
          }`}
          title={
            isZoomSufficient
              ? "Analizar e investigar sector enfocado en el Laboratorio Astrofísico"
              : "Sector demasiado amplio. Haz clic para hacer zoom automático hasta el nivel de análisis."
          }
        >
          {/* Target Scanner Icon */}
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full border transition-transform duration-150 ${
              isZoomSufficient
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400 group-hover:scale-105"
                : "bg-white/5 border-white/15 text-white/40 group-hover:text-amber-400"
            }`}
          >
            {isScanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : isZoomSufficient ? (
              <Target className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <ZoomIn className="w-3.5 h-3.5 text-white/50 group-hover:text-amber-400" />
            )}
          </div>

          {/* Action Label & Coordinates */}
          <div className="flex items-center gap-2.5">
            <span
              className={`text-xs sm:text-sm font-sans tracking-wide font-semibold ${
                isZoomSufficient ? "text-white/95" : "text-white/50 group-hover:text-white/80"
              }`}
            >
              {isZoomSufficient ? "Analizar Sector" : "Acercar para Analizar"}
            </span>
            <span className="hidden sm:inline-block w-px h-3.5 bg-white/15" />
            <span
              className={`hidden sm:inline-block text-[11px] font-mono tabular-nums ${
                isZoomSufficient ? "text-white/50" : "text-white/30"
              }`}
            >
              {coords.raHms} • {coords.decDms}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

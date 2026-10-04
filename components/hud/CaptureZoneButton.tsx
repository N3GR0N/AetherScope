"use client";

import { useSpace } from "@/context/SpaceContext";
import { formatCoordinates } from "@/lib/astronomy/coordinates";
import { matchLocalDossier } from "@/lib/astronomy/crossmatch";
import { Target, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CaptureZoneButton() {
  const router = useRouter();
  const space = useSpace();
  const { currentRa, currentDec, currentFov, getAladinInstance } = space;
  const [isScanning, setIsScanning] = useState(false);

  // Quick cross-match preview using Layer 1 local cache for instant HUD feedback
  const localMatch = matchLocalDossier(currentRa, currentDec, 0.4);
  const coords = formatCoordinates(currentRa, currentDec);

  const handleCapture = () => {
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
    } catch {}

    // Precise redirect to astrophysical laboratory: ra/dec (5 decimals), fov (4 decimals)
    router.push(
      `/analyze?ra=${finalRa.toFixed(5)}&dec=${finalDec.toFixed(5)}&fov=${finalFov.toFixed(4)}`
    );
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

        {/* Target Scanner Button (Apple Pro Glass + Squircle) */}
        <button
          onClick={handleCapture}
          disabled={isScanning}
          className="squircle group flex items-center gap-3 bg-[#0a0d14]/82 hover:bg-[#0a0d14]/95 text-white/95 font-medium px-5 py-2.5 rounded-full border border-white/10 border-t-white/20 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.15)] transition-all duration-150 ease-out cursor-pointer disabled:opacity-75 disabled:cursor-wait active:scale-[0.98]"
          title="Analizar e investigar sector enfocado en el Laboratorio Astrofísico"
        >
          {/* Target Scanner Icon */}
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 group-hover:scale-105 transition-transform duration-150">
            {isScanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <Target className="w-3.5 h-3.5 text-amber-400" />
            )}
          </div>

          {/* Action Label & Coordinates */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs sm:text-sm font-sans tracking-wide text-white/95 font-semibold">
              Analizar Sector
            </span>
            <span className="hidden sm:inline-block w-px h-3.5 bg-white/15" />
            <span className="hidden sm:inline-block text-[11px] font-mono text-white/50 tabular-nums">
              {coords.raHms} • {coords.decDms}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

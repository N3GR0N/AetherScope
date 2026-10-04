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
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-xl flex items-center gap-2 text-[11px] font-mono text-emerald-300 shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">{localMatch.name}</span>
            <span className="text-emerald-400/50">•</span>
            <span className="text-emerald-400/80 text-[10px]">{localMatch.objectType}</span>
          </div>
        )}

        {/* Target Scanner Button (Apple Pro Glass) */}
        <button
          onClick={handleCapture}
          disabled={isScanning}
          className="group flex items-center gap-3 bg-[#080b11]/80 hover:bg-[#080b11]/95 text-white font-medium px-6 py-3 rounded-full border border-white/15 backdrop-blur-2xl shadow-2xl transition-all duration-300 cursor-pointer disabled:opacity-75 disabled:cursor-wait active:scale-95"
          title="Analizar e investigar sector enfocado en el Laboratorio Astrofísico"
        >
          {/* Target Scanner Icon */}
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 group-hover:scale-110 transition-transform">
            {isScanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <Target className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            )}
          </div>

          {/* Action Label & Coordinates */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs sm:text-sm tracking-wide text-white font-semibold">
              🎯 Analizar e Investigar Zona
            </span>
            <span className="hidden sm:inline-block w-px h-3.5 bg-white/20" />
            <span className="hidden sm:inline-block text-[11px] font-mono text-white/50">
              {coords.raHms} • {coords.decDms}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

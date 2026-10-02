"use client";

import { useSpace } from "@/context/SpaceContext";
import { formatCoordinates } from "@/lib/astronomy/coordinates";
import { crossMatchCelestialTarget } from "@/lib/astronomy/database";
import { Target, Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CaptureZoneButton() {
  const router = useRouter();
  const space = useSpace();
  const { currentRa, currentDec, currentFov } = space;
  const [isScanning, setIsScanning] = useState(false);

  // Quick cross-match preview to give instant feedback
  const crossMatch = crossMatchCelestialTarget(currentRa, currentDec);
  const coords = formatCoordinates(currentRa, currentDec);

  const handleCapture = () => {
    setIsScanning(true);

    const finalRa = currentRa;
    const finalDec = currentDec;
    const finalFov = currentFov;

    // Persist in sessionStorage for extra fast recovery
    try {
      sessionStorage.setItem(
        "aetherscope_last_capture",
        JSON.stringify({ ra: finalRa, dec: finalDec, fov: finalFov, timestamp: Date.now() })
      );
    } catch {}

    // Navigate to astrophysical laboratory with coordinates
    setTimeout(() => {
      router.push(
        `/analyze?ra=${finalRa.toFixed(4)}&dec=${finalDec.toFixed(4)}&fov=${finalFov.toFixed(4)}`
      );
    }, 280);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
      <div className="flex flex-col items-center gap-2">
        {/* Detected Target Badge if in range */}
        {crossMatch.matched && crossMatch.target && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-xl flex items-center gap-1.5 text-[11px] font-mono text-emerald-300 shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">{crossMatch.target.name}</span>
            <span className="text-emerald-400/60">•</span>
            <span className="text-emerald-400/80 text-[10px]">{crossMatch.target.nature}</span>
          </div>
        )}

        {/* Tactical Scanner Button (Apple Liquid Glass) */}
        <button
          onClick={handleCapture}
          disabled={isScanning}
          className="group relative flex items-center gap-3.5 px-7 py-3.5 rounded-full bg-[#080b11]/85 hover:bg-white/15 active:scale-98 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/20 hover:border-amber-400/40 text-white font-medium shadow-[0_20px_50px_rgba(0,0,0,0.7)] transition-all duration-300 cursor-pointer disabled:opacity-70 disabled:cursor-wait"
          title="Capturar y analizar el sector celeste enfocado en el laboratorio espectral"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          {/* Scanner Icon */}
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 group-hover:scale-110 transition-transform">
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <Target className="w-4 h-4 text-amber-400 animate-pulse" />
            )}
          </div>

          {/* Label */}
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white group-hover:text-amber-200 transition-colors">
              Analizar e Investigar Zona
            </span>
            <span className="text-[10px] font-mono text-white/50 flex items-center gap-1.5">
              <span>{coords.raHms}</span>
              <span className="text-white/30">•</span>
              <span>{coords.decDms}</span>
            </span>
          </div>

          {/* Trailing Sparkle */}
          <Sparkles className="w-4 h-4 text-amber-400/70 group-hover:text-amber-300 group-hover:rotate-12 transition-all ml-1" />
        </button>
      </div>
    </div>
  );
}

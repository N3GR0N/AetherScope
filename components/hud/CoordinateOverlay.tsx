"use client";

import { useSpace } from "@/context/SpaceContext";
import {
  formatCoordinates,
  formatFov,
  getConstellation,
} from "@/lib/astronomy/coordinates";
import { Compass, Disc, Satellite } from "lucide-react";

interface CoordinateOverlayProps {
  ra?: number;
  dec?: number;
  fov?: number;
}

export default function CoordinateOverlay(props: CoordinateOverlayProps = {}) {
  const space = useSpace();
  const { activeTelescope } = space;

  const ra = props.ra ?? space.currentRa;
  const dec = props.dec ?? space.currentDec;
  const fov = props.fov ?? space.currentFov;
  const coords = formatCoordinates(ra, dec);
  const fovInfo = formatFov(fov);
  const constellation = getConstellation(ra, dec);

  return (
    <aside
      aria-label="Telemetría de Coordenadas Astronómicas y Órbita"
      className="fixed bottom-5 left-5 z-30 w-[240px] max-w-[calc(100vw-2.5rem)] pointer-events-auto"
    >
      <div
        suppressHydrationWarning
        className="squircle bg-[#0a0d14]/82 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/10 border-t-white/20 rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.15)] flex flex-col gap-2"
      >
        
        {/* Top Header Row: Sistema J2000 & Constellation */}
        <div className="flex items-center justify-between text-[10px] tracking-wider text-white/40 border-b border-white/10 pb-1.5">
          <div className="flex items-center gap-1.5 text-white/95 font-medium font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] font-mono tracking-wider text-amber-400/90 font-medium">SISTEMA J2000.0</span>
          </div>
          <div className="flex items-center gap-1 text-white/40 font-sans">
            <Compass className="w-3 h-3 text-white/40" />
            <span className="truncate max-w-[90px] text-[10px] text-white/65">{constellation}</span>
          </div>
        </div>

        {/* Coordinate Rows: RA & Dec (Geist Mono + Tabular Nums) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Right Ascension (RA) */}
          <div className="space-y-0.5">
            <span className="text-[9px] font-sans uppercase tracking-wider text-white/40 block">
              Ascensión Recta
            </span>
            <div className="font-mono text-white/95 font-semibold text-xs tabular-nums">
              {coords.raHms}
            </div>
            <div className="text-[9px] font-mono text-white/40 tabular-nums">
              {coords.raDegrees}
            </div>
          </div>

          {/* Declination (Dec) */}
          <div className="space-y-0.5">
            <span className="text-[9px] font-sans uppercase tracking-wider text-white/40 block">
              Declinación
            </span>
            <div className="font-mono text-white/95 font-semibold text-xs tabular-nums">
              {coords.decDms}
            </div>
            <div className="text-[9px] font-mono text-white/40 tabular-nums">
              {coords.decDegrees}
            </div>
          </div>
        </div>

        {/* FOV and Angular Scale Row */}
        <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] text-white/65">
          <div className="flex items-center gap-1.5 font-sans">
            <Disc className="w-3 h-3 text-white/40" />
            <span>Escala (FOV):</span>
          </div>
          <div className="flex items-center gap-1 font-mono font-semibold text-white/95 tabular-nums">
            <span>{fovInfo.rawText}</span>
            <span className="text-[8px] text-white/40 uppercase">({fovInfo.unit})</span>
          </div>
        </div>

        {/* Active Space Telescope Orbital Status */}
        <div className="pt-1.5 border-t border-white/10 space-y-1 text-[9px]">
          <div className="flex items-center justify-between text-white/65">
            <div className="flex items-center gap-1 font-sans">
              <Satellite className="w-2.5 h-2.5 text-amber-400" />
              <span className="truncate max-w-[130px] font-medium text-white/95">
                {activeTelescope.name}
              </span>
            </div>
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-400/80"
            />
          </div>

          <div className="flex items-center justify-between text-white/40 text-[8.5px] font-mono tabular-nums">
            <span className="truncate max-w-[140px] font-sans text-white/40">{activeTelescope.orbitType}</span>
            <span className="text-white/40">{activeTelescope.altitudeInfo.split(" ")[0]}</span>
          </div>
        </div>

      </div>
    </aside>
  );
}

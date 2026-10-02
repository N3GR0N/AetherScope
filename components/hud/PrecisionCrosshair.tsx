"use client";

import { useSpace } from "@/context/SpaceContext";
import { formatFov } from "@/lib/astronomy/coordinates";

interface PrecisionCrosshairProps {
  visible?: boolean;
  fov?: number;
}

export default function PrecisionCrosshair(props: PrecisionCrosshairProps = {}) {
  const space = useSpace();
  const visible = props.visible ?? space.showCrosshair;
  const fov = props.fov ?? space.currentFov;

  if (!visible) return null;

  const fovInfo = formatFov(fov);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-20 flex items-center justify-center"
    >
      <div className="relative w-64 h-64 flex items-center justify-center">
        
        {/* Outer Circular Reticle Ring */}
        <div className="absolute w-44 h-44 rounded-full border border-white/15 border-dashed" />

        {/* Inner Precision Target Ring */}
        <div className="absolute w-20 h-20 rounded-full border border-sky-400/30 flex items-center justify-center">
          {/* Subtle center aperture dot */}
          <div className="w-1 h-1 rounded-full bg-amber-400/80 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
        </div>

        {/* Horizontal Crosshair lines */}
        <div className="absolute left-0 w-16 h-px bg-gradient-to-r from-transparent via-white/30 to-white/60" />
        <div className="absolute right-0 w-16 h-px bg-gradient-to-l from-transparent via-white/30 to-white/60" />

        {/* Vertical Crosshair lines */}
        <div className="absolute top-0 h-16 w-px bg-gradient-to-b from-transparent via-white/30 to-white/60" />
        <div className="absolute bottom-0 h-16 w-px bg-gradient-to-t from-transparent via-white/30 to-white/60" />

        {/* Diagonal Corner Ticks */}
        <div className="absolute top-8 left-8 w-2 h-2 border-t border-l border-white/30" />
        <div className="absolute top-8 right-8 w-2 h-2 border-t border-r border-white/30" />
        <div className="absolute bottom-8 left-8 w-2 h-2 border-b border-l border-white/30" />
        <div className="absolute bottom-8 right-8 w-2 h-2 border-b border-r border-white/30" />

        {/* Celestial Orientation Markers (N, E) */}
        <span className="absolute -top-6 text-[9px] font-mono font-medium text-white/50 tracking-widest">
          N
        </span>
        <span className="absolute -left-6 text-[9px] font-mono font-medium text-white/50 tracking-widest">
          E
        </span>

        {/* Reticle Angular Scale Readout */}
        <div className="absolute -bottom-8 px-2 py-0.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-md text-[9px] font-mono text-white/60 tracking-wider">
          RETÍCULA Ø {fovInfo.rawText}
        </div>

      </div>
    </div>
  );
}

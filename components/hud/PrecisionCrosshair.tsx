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
      className="fixed inset-0 pointer-events-none z-20 flex items-center justify-center select-none"
    >
      <div className="relative w-64 h-64 flex items-center justify-center">
        
        {/* Outer Circular Reticle Ring */}
        <div className="absolute w-44 h-44 rounded-full border border-white/10" />

        {/* Inner Precision Target Ring */}
        <div className="absolute w-16 h-16 rounded-full border border-white/20 flex items-center justify-center">
          {/* Static amber optical focal collimator dot with subtle glow */}
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
        </div>

        {/* Horizontal Crosshair lines */}
        <div className="absolute left-2 w-14 h-px bg-gradient-to-r from-transparent via-white/20 to-white/50" />
        <div className="absolute right-2 w-14 h-px bg-gradient-to-l from-transparent via-white/20 to-white/50" />

        {/* Vertical Crosshair lines */}
        <div className="absolute top-2 h-14 w-px bg-gradient-to-b from-transparent via-white/20 to-white/50" />
        <div className="absolute bottom-2 h-14 w-px bg-gradient-to-t from-transparent via-white/20 to-white/50" />

        {/* Diagonal Corner Fiducials */}
        <div className="absolute top-8 left-8 w-2 h-2 border-t border-l border-white/25" />
        <div className="absolute top-8 right-8 w-2 h-2 border-t border-r border-white/25" />
        <div className="absolute bottom-8 left-8 w-2 h-2 border-b border-l border-white/25" />
        <div className="absolute bottom-8 right-8 w-2 h-2 border-b border-r border-white/25" />

        {/* Celestial Orientation Markers (N, E) */}
        <span className="absolute -top-6 text-[9px] font-mono text-white/40 tracking-widest">
          N
        </span>
        <span className="absolute -left-6 text-[9px] font-mono text-white/40 tracking-widest">
          E
        </span>

        {/* Reticle Angular Scale Readout */}
        <div
          suppressHydrationWarning
          className="absolute -bottom-8 px-2.5 py-0.5 rounded-full bg-[#0a0d14]/85 border border-white/10 backdrop-blur-md text-[9px] font-mono text-white/60 tracking-wider tabular-nums shadow-sm"
        >
          RETÍCULA Ø {fovInfo.rawText}
        </div>

      </div>
    </div>
  );
}

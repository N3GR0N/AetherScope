"use client";

import { useSpace } from "@/context/SpaceContext";
import { formatFov } from "@/lib/astronomy/coordinates";

interface PrecisionCrosshairProps {
  visible?: boolean;
  fov?: number;
  variant?: "full" | "compact";
  label?: string;
}

export default function PrecisionCrosshair(props: PrecisionCrosshairProps = {}) {
  const space = useSpace();
  const visible = props.visible ?? space.showCrosshair;
  const fov = props.fov ?? space.currentFov;
  const variant = props.variant ?? "full";
  const label = props.label;

  if (!visible) return null;

  const fovInfo = formatFov(fov);

  if (variant === "compact") {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none flex items-center justify-center select-none font-[family-name:var(--font-proto)] z-20"
      >
        <div className="relative w-48 h-48 flex items-center justify-center">
          {/* Outer circle */}
          <div className="absolute w-36 h-36 rounded-full border border-[#F1F0E1]/30" />

          {/* Inner target circle */}
          <div className="absolute w-12 h-12 rounded-full border border-[#F1F0E1]/50 flex items-center justify-center">
            {/* Center square dot */}
            <div className="w-1.5 h-1.5 bg-[#F1F0E1]" />
          </div>

          {/* Cross lines */}
          <div className="absolute left-2 w-10 h-px bg-[#F1F0E1]/40" />
          <div className="absolute right-2 w-10 h-px bg-[#F1F0E1]/40" />
          <div className="absolute top-2 h-10 w-px bg-[#F1F0E1]/40" />
          <div className="absolute bottom-2 h-10 w-px bg-[#F1F0E1]/40" />

          {/* Bottom tag */}
          <div className="absolute -bottom-7 px-3 py-1 bg-[#101015] border border-[#2B2B31] text-[9.5px] uppercase tracking-[0.16em] text-[#F1F0E1]">
            {label || "CENTRO DE CAPTURA"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-20 flex items-center justify-center select-none font-[family-name:var(--font-proto)]"
    >
      <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
        {/* Corner Visor Brackets [ ] */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#F1F0E1]/70" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#F1F0E1]/70" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#F1F0E1]/70" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#F1F0E1]/70" />

        {/* Outer Circular Reticle Ring */}
        <div className="absolute w-56 h-56 rounded-full border border-[#F1F0E1]/35" />

        {/* Inner Precision Target Ring */}
        <div className="absolute w-16 h-16 rounded-full border border-[#F1F0E1]/55 flex items-center justify-center">
          {/* Center Square Dot */}
          <div className="w-1.5 h-1.5 bg-[#F1F0E1]" />
        </div>

        {/* Horizontal Crosshair lines */}
        <div className="absolute left-6 w-14 h-px bg-[#F1F0E1]/45" />
        <div className="absolute right-6 w-14 h-px bg-[#F1F0E1]/45" />

        {/* Vertical Crosshair lines */}
        <div className="absolute top-6 h-14 w-px bg-[#F1F0E1]/45" />
        <div className="absolute bottom-6 h-14 w-px bg-[#F1F0E1]/45" />

        {/* Directional orientation markers */}
        <span className="absolute top-2 text-[10px] font-bold text-[#F1F0E1] tracking-widest">
          N
        </span>
        <span className="absolute left-2 text-[10px] font-bold text-[#F1F0E1] tracking-widest">
          E
        </span>

        {/* Bottom Tag */}
        <div
          suppressHydrationWarning
          className="absolute -bottom-8 px-3 py-1 bg-[#101015] border border-[#2B2B31] text-[10px] uppercase tracking-[0.16em] text-[#F1F0E1] tabular-nums"
        >
          {label || `RETÍCULA Ø ${fovInfo.rawText}`}
        </div>
      </div>
    </div>
  );
}

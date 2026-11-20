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
        className="absolute inset-0 pointer-events-none flex items-center justify-center select-none z-20"
      >
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center">
          {/* Outer circle */}
          <div className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full border border-[var(--accent)]/30" />

          {/* Inner target circle */}
          <div className="absolute w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-[var(--accent)]/60 flex items-center justify-center">
            {/* Center dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          </div>

          {/* Cross lines */}
          <div className="absolute left-2 w-8 sm:w-10 h-px bg-[var(--accent)]/40" />
          <div className="absolute right-2 w-8 sm:w-10 h-px bg-[var(--accent)]/40" />
          <div className="absolute top-2 h-8 sm:h-10 w-px bg-[var(--accent)]/40" />
          <div className="absolute bottom-2 h-8 sm:h-10 w-px bg-[var(--accent)]/40" />

          {/* Bottom tag */}
          <div className="absolute -bottom-7 px-2.5 py-0.5 rounded-[6px] bg-[var(--surface-1)] border border-[var(--border)] text-[10px] font-mono uppercase tracking-wider text-[var(--text)]">
            {label || "Centro de captura"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-20 flex items-center justify-center select-none"
    >
      <div className="relative w-60 h-60 xs:w-72 xs:h-72 sm:w-80 sm:h-80 flex items-center justify-center">
        {/* Corner Visor Brackets [ ] */}
        <div className="absolute top-0 left-0 w-3.5 h-3.5 sm:w-4 sm:h-4 border-t border-l border-[var(--accent)]/60" />
        <div className="absolute top-0 right-0 w-3.5 h-3.5 sm:w-4 sm:h-4 border-t border-r border-[var(--accent)]/60" />
        <div className="absolute bottom-0 left-0 w-3.5 h-3.5 sm:w-4 sm:h-4 border-b border-l border-[var(--accent)]/60" />
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 sm:w-4 sm:h-4 border-b border-r border-[var(--accent)]/60" />

        {/* Outer Circular Reticle Ring */}
        <div className="absolute w-44 h-44 xs:w-56 xs:h-56 rounded-full border border-[var(--accent)]/25" />

        {/* Inner Precision Target Ring */}
        <div className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-[var(--accent)]/60 flex items-center justify-center">
          {/* Center Dot */}
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
        </div>

        {/* Horizontal Crosshair lines */}
        <div className="absolute left-4 sm:left-6 w-10 sm:w-14 h-px bg-[var(--accent)]/40" />
        <div className="absolute right-4 sm:right-6 w-10 sm:w-14 h-px bg-[var(--accent)]/40" />

        {/* Vertical Crosshair lines */}
        <div className="absolute top-4 sm:top-6 h-10 sm:h-14 w-px bg-[var(--accent)]/40" />
        <div className="absolute bottom-4 sm:bottom-6 h-10 sm:h-14 w-px bg-[var(--accent)]/40" />

        {/* Directional orientation markers */}
        <span className="absolute top-2 text-[10px] font-bold text-[var(--accent)] font-mono tracking-widest">
          N
        </span>
        <span className="absolute left-2 text-[10px] font-bold text-[var(--accent)] font-mono tracking-widest">
          E
        </span>

        {/* Bottom Tag */}
        <div
          suppressHydrationWarning
          className="absolute -bottom-8 px-2.5 py-0.5 rounded-[6px] bg-[var(--surface-1)] border border-[var(--border)] text-[11px] font-mono tabular-nums text-[var(--text)]"
        >
          {label || `Retícula Ø ${fovInfo.rawText}`}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useSpace } from "@/context/SpaceContext";
import { ArrowUpRight } from "lucide-react";

interface HeaderBarProps {
  showCrosshair?: boolean;
  onToggleCrosshair?: () => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  inspectorOpen?: boolean;
  onToggleInspector?: () => void;
}

export default function HeaderBar(props: HeaderBarProps = {}) {
  const space = useSpace();

  const showCrosshair = props.showCrosshair ?? space.showCrosshair;
  const onToggleCrosshair = props.onToggleCrosshair ?? space.toggleCrosshair;
  const showGrid = props.showGrid ?? space.showGrid;
  const onToggleGrid = props.onToggleGrid ?? space.toggleGrid;
  const inspectorOpen = props.inspectorOpen ?? space.isCatalogOpen;
  const onToggleInspector = props.onToggleInspector ?? space.toggleCatalog;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-[#17171C] border-b border-[#2B2B31] px-4 md:px-6 flex items-center justify-between z-40 select-none">
      {/* Left Section: 9-dots icon & Typography Branding */}
      <div className="flex items-center gap-3">
        {/* 9-dot grid icon */}
        <div
          aria-hidden="true"
          className="grid grid-cols-3 gap-[3px] w-4 h-4 shrink-0"
        >
          <div className="w-[3px] h-[3px] bg-[#F1F0E1]" />
          <div className="w-[3px] h-[3px] bg-[#F1F0E1]" />
          <div className="w-[3px] h-[3px] bg-[#F1F0E1]" />
          <div className="w-[3px] h-[3px] bg-[#F1F0E1]" />
          <div className="w-[3px] h-[3px] bg-[#F1F0E1]" />
          <div className="w-[3px] h-[3px] bg-[#F1F0E1]" />
          <div className="w-[3px] h-[3px] bg-[#F1F0E1]" />
          <div className="w-[3px] h-[3px] bg-[#F1F0E1]" />
          <div className="w-[3px] h-[3px] bg-[#F1F0E1]" />
        </div>

        <div className="flex flex-col">
          <span className="text-[12px] md:text-[13px] font-semibold text-[#F1F0E1] tracking-[0.24em] leading-tight uppercase font-[family-name:var(--font-proto)]">
            AETHERSCOPE
          </span>
          <span className="text-[9px] text-[#9A9A92] tracking-[0.16em] leading-none uppercase font-[family-name:var(--font-proto)]">
            DEEP SPACE SPECTRAL NAVIGATOR
          </span>
        </div>
      </div>

      {/* Right Section: Tactical Tools Group & Action Button */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Central Precision Crosshair Toggle */}
          <button
            onClick={onToggleCrosshair}
            className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] font-[family-name:var(--font-proto)] transition-colors cursor-pointer border ${
              showCrosshair
                ? "bg-[#506385] text-[#F1F0E1] border-[#506385]"
                : "bg-transparent text-[#F1F0E1] border-[#3A3A42] hover:bg-[#1A1A1F]"
            }`}
            title="Alternar retícula central de inspección"
          >
            RETÍCULA
          </button>

          {/* Coordinate Grid Toggle */}
          <button
            onClick={onToggleGrid}
            className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] font-[family-name:var(--font-proto)] transition-colors cursor-pointer border ${
              showGrid
                ? "bg-[#506385] text-[#F1F0E1] border-[#506385]"
                : "bg-transparent text-[#F1F0E1] border-[#3A3A42] hover:bg-[#1A1A1F]"
            }`}
            title="Alternar rejilla de coordenadas celestes"
          >
            REJILLA
          </button>

          {/* Target Catalog Gallery Toggle */}
          <button
            onClick={onToggleInspector}
            className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] font-[family-name:var(--font-proto)] transition-colors cursor-pointer border ${
              inspectorOpen
                ? "bg-[#506385] text-[#F1F0E1] border-[#506385]"
                : "bg-transparent text-[#F1F0E1] border-[#3A3A42] hover:bg-[#1A1A1F]"
            }`}
            title="Abrir catálogo curado de objetos astronómicos"
          >
            CATÁLOGO
          </button>
        </div>

        {/* Circular Action Button (Fullscreen / Expand) */}
        <button
          onClick={toggleFullscreen}
          className="w-8 h-8 rounded-full bg-[#F1F0E1] text-[#101015] flex items-center justify-center hover:opacity-90 active:scale-95 transition-all cursor-pointer ml-1"
          title="Pantalla completa"
        >
          <ArrowUpRight className="w-4 h-4 text-[#101015]" strokeWidth={2.5} />
        </button>
      </div>
    </header>
  );
}

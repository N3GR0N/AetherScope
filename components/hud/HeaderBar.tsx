"use client";

import { useSpace } from "@/context/SpaceContext";
import {
  Crosshair,
  Grid,
  Compass,
  Maximize2,
  Telescope,
} from "lucide-react";

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
    <header className="fixed top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
      {/* Unified Apple Pro / Liquid Glass Navigation Bar */}
      <div className="squircle w-full bg-[#0a0d14]/82 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/10 border-t-white/20 rounded-2xl px-4 py-2 flex items-center justify-between gap-3 pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.15)]">
        
        {/* Left Section: Product Branding */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Telescope className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-white/95 tracking-wider text-xs font-sans leading-tight">
              AETHERSCOPE
            </span>
            <span className="text-[9px] font-sans text-white/40 leading-none hidden sm:inline">
              Deep Space Spectral Navigator
            </span>
          </div>
        </div>

        {/* Right Section: Tactical Tools (Crosshair, Grid, Catalog, Fullscreen) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Central Precision Crosshair Toggle */}
          <button
            onClick={onToggleCrosshair}
            className={`px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition-all duration-150 ease-out cursor-pointer flex items-center gap-1.5 border active:scale-[0.98] ${
              showCrosshair
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs"
                : "bg-white/5 text-white/65 hover:text-white/95 hover:bg-white/10 border-white/10"
            }`}
            title="Alternar retícula central de inspección"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Retícula</span>
          </button>

          {/* Coordinate Grid Toggle */}
          <button
            onClick={onToggleGrid}
            className={`px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition-all duration-150 ease-out cursor-pointer flex items-center gap-1.5 border active:scale-[0.98] ${
              showGrid
                ? "bg-white/20 text-white/95 border-white/35 shadow-xs"
                : "bg-white/5 text-white/65 hover:text-white/95 hover:bg-white/10 border-white/10"
            }`}
            title="Alternar rejilla de coordenadas celestes"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Rejilla</span>
          </button>

          {/* Target Catalog Gallery Toggle */}
          <button
            onClick={onToggleInspector}
            className={`px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition-all duration-150 ease-out cursor-pointer flex items-center gap-1.5 border active:scale-[0.98] ${
              inspectorOpen
                ? "bg-amber-500 text-black font-semibold border-amber-400 shadow-xs"
                : "bg-amber-500/10 text-amber-300/90 hover:bg-amber-500/20 border-amber-500/30"
            }`}
            title="Abrir catálogo curado de objetos astronómicos"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Catálogo</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-xl bg-white/5 text-white/65 hover:text-white/95 hover:bg-white/10 border border-white/10 transition-all duration-150 ease-out cursor-pointer active:scale-[0.98]"
            title="Pantalla completa"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
}

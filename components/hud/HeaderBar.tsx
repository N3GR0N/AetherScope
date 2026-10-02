"use client";

import { useSpace } from "@/context/SpaceContext";
import {
  Crosshair,
  Grid,
  Compass,
  Maximize2,
  Telescope,
  ChevronDown,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { TELESCOPES } from "@/lib/astronomy/telescopes";

interface HeaderBarProps {
  showCrosshair?: boolean;
  onToggleCrosshair?: () => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  inspectorOpen?: boolean;
  onToggleInspector?: () => void;
  onSelectFovPreset?: (fov: number) => void;
}

export default function HeaderBar(props: HeaderBarProps = {}) {
  const space = useSpace();

  const showCrosshair = props.showCrosshair ?? space.showCrosshair;
  const onToggleCrosshair = props.onToggleCrosshair ?? space.toggleCrosshair;
  const showGrid = props.showGrid ?? space.showGrid;
  const onToggleGrid = props.onToggleGrid ?? space.toggleGrid;
  const inspectorOpen = props.inspectorOpen ?? space.isCatalogOpen;
  const onToggleInspector = props.onToggleInspector ?? space.toggleCatalog;
  const onSelectFovPreset = props.onSelectFovPreset ?? space.setFovPreset;

  const {
    activeTelescopeId,
    setActiveTelescopeId,
  } = space;

  const [telescopeDropdownOpen, setTelescopeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTelescopeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const activeTelescope = TELESCOPES[activeTelescopeId];

  return (
    <header className="fixed top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
      {/* Unified Apple Pro / macOS Sonoma Navigation Bar */}
      <div className="w-full bg-[#080b11]/85 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/10 rounded-2xl px-4 py-2 flex items-center justify-between gap-3 pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        
        {/* Left Section: Branding & Space Telescope Selector */}
        <div className="flex items-center gap-3 min-w-0">
          {/* macOS Traffic Lights */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/60 shadow-xs" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/60 shadow-xs" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/60 shadow-xs" />
          </div>

          <div className="hidden sm:block w-px h-4 bg-white/15 shrink-0" />

          {/* Logo & Product Name */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Telescope className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white tracking-wider text-xs font-sans leading-tight">
                AETHERSCOPE
              </span>
              <span className="text-[9px] font-mono text-white/40 leading-none hidden lg:inline">
                Deep Space Spectral Navigator
              </span>
            </div>
          </div>

          <div className="w-px h-4 bg-white/15 shrink-0" />

          {/* Styled Space Telescope Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setTelescopeDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 transition-all cursor-pointer text-xs font-mono text-white/90"
              title="Seleccionar telescopio espacial activo"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: activeTelescope.trajectoryColor }}
              />
              <span className="font-medium truncate max-w-[140px] sm:max-w-[190px]">
                {activeTelescope.name}
              </span>
              <ChevronDown className="w-3 h-3 text-white/40 ml-0.5" />
            </button>

            {telescopeDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-60 rounded-xl bg-[#080b11]/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_40px_rgba(0,0,0,0.8)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[9px] font-mono uppercase tracking-wider text-white/40 px-2 py-1">
                  Misión Espacial Activa
                </div>

                {(Object.keys(TELESCOPES) as (keyof typeof TELESCOPES)[]).map((key) => {
                  const tel = TELESCOPES[key];
                  const isSelected = activeTelescopeId === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setActiveTelescopeId(key);
                        setTelescopeDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs font-mono flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "bg-white/15 text-white font-semibold border border-white/20"
                          : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: tel.trajectoryColor }}
                        />
                        <span>{tel.name}</span>
                      </div>
                      <span className="text-[10px] text-white/40">
                        {key === "jwst" ? "L2" : "LEO"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Center Section: Exploration Mode Status Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-xl text-xs font-mono text-white/70">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
          <span className="font-medium text-white/90">EXPLORACIÓN LIBRE</span>
          <span className="text-white/30">•</span>
          <span className="text-white/50 text-[11px]">DSS2 Óptico Natural</span>
        </div>

        {/* Right Section: Angular Scale Presets & Tactical Tools */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Angular Scale / FOV Presets */}
          <div className="hidden xl:flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/10 shrink-0">
            <div className="px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1">
              <Telescope className="w-3 h-3 text-white/50" />
              <span>Escala</span>
            </div>

            <button
              onClick={() => onSelectFovPreset(0.12)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-mono text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="Escala de alta resolución para núcleos y lentes gravitacionales (0.12°)"
            >
              0.12° (Profundo)
            </button>
            <button
              onClick={() => onSelectFovPreset(0.25)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-mono text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="Escala óptima para nebulosas de emisión (0.25°)"
            >
              0.25° (Nebulosa)
            </button>
            <button
              onClick={() => onSelectFovPreset(15.0)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-mono text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="Vista panorámica de gran angular (15°)"
            >
              15° (Angular)
            </button>
          </div>

          {/* Central Precision Crosshair Toggle */}
          <button
            onClick={onToggleCrosshair}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-1.5 border ${
              showCrosshair
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-white/10"
            }`}
            title="Alternar retícula central de inspección"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Retícula</span>
          </button>

          {/* Coordinate Grid Toggle */}
          <button
            onClick={onToggleGrid}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-1.5 border ${
              showGrid
                ? "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-xs"
                : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-white/10"
            }`}
            title="Alternar rejilla de coordenadas RA/Dec"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Rejilla</span>
          </button>

          {/* Target Catalog Gallery Toggle */}
          <button
            onClick={onToggleInspector}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-1.5 border ${
              inspectorOpen
                ? "bg-white/20 text-white border-white/30 shadow-xs"
                : "bg-amber-500/10 text-amber-300/90 hover:bg-amber-500/20 border-amber-500/30"
            }`}
            title="Abrir catálogo curado de objetos astronómicos"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Catálogo</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            title="Pantalla completa"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
}

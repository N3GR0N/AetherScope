"use client";

import { useSpace } from "@/context/SpaceContext";
import { COSMIC_TARGETS, type CosmicTarget } from "@/lib/astronomy/targets";
import {
  X,
  Compass,
  Telescope,
  Atom,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const CATEGORY_LABELS: Record<CosmicTarget["category"], { label: string; badge: string }> = {
  nebula: {
    label: "Nebulosa de Emisión",
    badge: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  },
  galaxy: {
    label: "Galaxia Espiral",
    badge: "text-sky-300 border-sky-500/30 bg-sky-500/10",
  },
  "deep-field": {
    label: "Campo Profundo / Lente",
    badge: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  },
  "black-hole": {
    label: "Agujero Negro Supermasivo",
    badge: "text-purple-300 border-purple-500/30 bg-purple-500/10",
  },
};

export default function DossierDrawer() {
  const {
    currentMode,
    selectedTarget,
    isCatalogOpen,
    navigateToTarget,
    returnToFreeFlight,
    setCatalogOpen,
  } = useSpace();

  // If in observatory mode and catalog is closed, hide dossier
  if (currentMode === "observatory" && !isCatalogOpen) {
    return null;
  }

  return (
    <>
      {/* ─── 1. Full Targets Catalog Modal / Gallery Drawer ─── */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300 animate-in fade-in">
          <div className="bg-[#080b11]/90 backdrop-blur-2xl backdrop-saturate-[180%] w-full max-w-4xl max-h-[85vh] rounded-3xl border border-white/12 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Compass className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-base tracking-wide flex items-center gap-2">
                    <span>Catálogo Científico Deep Space Dossier</span>
                    <span className="text-[10px] font-mono font-normal uppercase px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                      {COSMIC_TARGETS.length} Objetos Curados
                    </span>
                  </h2>
                  <p className="text-xs font-mono text-white/50">
                    Selecciona un objeto para navegación cinemática y análisis espectral
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCatalogOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Catalog Grid Cards */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {COSMIC_TARGETS.map((target) => {
                const isSelected = selectedTarget?.id === target.id;
                const cat = CATEGORY_LABELS[target.category];

                return (
                  <div
                    key={target.id}
                    className={`rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "bg-white/15 border-amber-400/50 shadow-md ring-1 ring-amber-400/30"
                        : "bg-black/40 border-white/8 hover:border-white/20 hover:bg-white/5"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${cat.badge}`}>
                          {cat.label}
                        </span>
                        <span className="text-[10px] font-mono text-white/40">
                          {target.constellation}
                        </span>
                      </div>

                      <h3 className="text-white font-semibold text-sm">
                        {target.name}
                      </h3>

                      <p className="text-xs text-white/70 leading-relaxed line-clamp-2">
                        {target.description}
                      </p>

                      {/* Chemical Elements Detected Chips */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {target.spectroscopy.detectedElements.slice(0, 4).map((elem) => (
                          <span
                            key={elem}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/60 border border-white/5"
                          >
                            {elem}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/8 flex items-center justify-between text-xs font-mono text-white/50">
                      <span>{target.distance}</span>
                      <button
                        onClick={() => {
                          navigateToTarget(target);
                          setCatalogOpen(false);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                          isSelected
                            ? "bg-amber-500 text-black font-semibold border-amber-400"
                            : "bg-white/10 hover:bg-white/20 text-white border-white/10"
                        }`}
                      >
                        <Telescope className="w-3.5 h-3.5" />
                        <span>{isSelected ? "Fijado en Visor" : "Fijar y Analizar"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-[11px] font-mono text-white/40">
              <span>ALADIN LITE V3 • MOTOR CINEMÁTICO ORBITAL</span>
              <button
                onClick={() => setCatalogOpen(false)}
                className="text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                Cerrar Galería
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── 2. Deep Space Dossier Lab Card (Inspector Táctico en Modo Dossier) ─── */}
      {currentMode === "dossier" && selectedTarget && !isCatalogOpen && (
        <aside
          aria-label="Laboratorio de Análisis Astrofísico"
          className="fixed top-20 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] bg-[#080b11]/85 backdrop-blur-2xl backdrop-saturate-[180%] rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300"
        >
          {/* Card Header */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-black/30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <span className="text-[9px] font-mono tracking-widest text-amber-400 uppercase font-semibold block">
                  DEEP SPACE DOSSIER LAB
                </span>
                <h3 className="text-white text-xs font-semibold truncate max-w-[200px]">
                  {selectedTarget.name}
                </h3>
              </div>
            </div>

            <button
              onClick={returnToFreeFlight}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-colors cursor-pointer border border-white/10"
              title="Volver a Modo Observatorio 360°"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dossier Content */}
          <div className="p-3.5 space-y-3 max-h-[calc(100vh-240px)] overflow-y-auto">
            
            {/* Category and Constellation Badges */}
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${CATEGORY_LABELS[selectedTarget.category].badge}`}>
                {CATEGORY_LABELS[selectedTarget.category].label}
              </span>
              <span className="text-[11px] font-mono text-white/50">
                {selectedTarget.constellation}
              </span>
            </div>

            {/* Astrophysical Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-black/40 border border-white/8">
                <span className="text-[9px] font-mono text-white/40 uppercase block">
                  Distancia
                </span>
                <span className="font-mono text-white font-medium text-[11px]">
                  {selectedTarget.distance}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/8">
                <span className="text-[9px] font-mono text-white/40 uppercase block">
                  Redshift (z)
                </span>
                <span className="font-mono text-white font-medium text-[11px]">
                  {selectedTarget.redshift || "z = 0.000 (Local)"}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/8 col-span-2">
                <span className="text-[9px] font-mono text-white/40 uppercase block">
                  Sensor / Observatorio Líder
                </span>
                <span className="font-mono text-amber-300 font-medium text-[11px]">
                  {selectedTarget.spectroscopy.primarySensor}
                </span>
              </div>
            </div>

            {/* Scientific Description */}
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider block">
                Dossier Científico
              </span>
              <p className="text-xs text-white/80 leading-relaxed bg-black/30 p-2.5 rounded-xl border border-white/5">
                {selectedTarget.description}
              </p>
            </div>

            {/* Detected Chemical Elements Tags */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider flex items-center gap-1">
                <Atom className="w-3 h-3 text-sky-400" />
                <span>Firmas Espectroscópicas Detectadas</span>
              </span>
              <div className="flex flex-wrap gap-1">
                {selectedTarget.spectroscopy.detectedElements.map((elem) => (
                  <span
                    key={elem}
                    className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-sky-500/10 text-sky-300 border border-sky-500/20"
                  >
                    {elem}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Buttons inside Card */}
            <div className="pt-2 flex flex-col gap-1.5 border-t border-white/10">
              <button
                onClick={() => setCatalogOpen(true)}
                className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-medium border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Explorar Otros Objetos</span>
              </button>

              <button
                onClick={returnToFreeFlight}
                className="w-full py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-mono transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Volver a Observatorio 360°</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

          </div>
        </aside>
      )}
    </>
  );
}

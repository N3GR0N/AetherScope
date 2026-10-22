"use client";

import { useSpace } from "@/context/SpaceContext";
import { COSMIC_TARGETS, type CosmicTarget } from "@/lib/astronomy/targets";
import {
  X,
  Compass,
  Telescope,
  Atom,
  ArrowRight,
} from "lucide-react";

const CATEGORY_LABELS: Record<CosmicTarget["category"], { label: string; badge: string }> = {
  nebula: {
    label: "NEBULOSA DE EMISIÓN",
    badge: "text-[#F1F0E1] border-[#3A3A42] bg-[#17171C]",
  },
  galaxy: {
    label: "GALAXIA ESPIRAL",
    badge: "text-[#F1F0E1] border-[#3A3A42] bg-[#17171C]",
  },
  "deep-field": {
    label: "CAMPO PROFUNDO / LENTE",
    badge: "text-[#F1F0E1] border-[#3A3A42] bg-[#17171C]",
  },
  "black-hole": {
    label: "AGUJERO NEGRO SUPERMASIVO",
    badge: "text-[#F1F0E1] border-[#3A3A42] bg-[#17171C]",
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

  if (currentMode === "observatory" && !isCatalogOpen) {
    return null;
  }

  return (
    <>
      {/* ─── 1. Full Targets Catalog Modal / Gallery Drawer ─── */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none font-[family-name:var(--font-proto)]">
          <div className="bg-[#1A1A1F] border border-[#2B2B31] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 bg-[#17171C] border-b border-[#2B2B31] flex items-center justify-between">
              <div className="flex items-center gap-3">
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
                <div>
                  <h2 className="text-[#F1F0E1] font-semibold text-sm tracking-[0.14em] uppercase flex items-center gap-2">
                    <span>CATÁLOGO CIENTÍFICO DEEP SPACE</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 bg-[#101015] border border-[#2B2B31] text-[#9A9A92]">
                      {COSMIC_TARGETS.length} OBJETOS
                    </span>
                  </h2>
                  <p className="text-[10px] text-[#9A9A92] uppercase tracking-wider">
                    Selecciona un objetivo cósmico para navegación y análisis espectral
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCatalogOpen(false)}
                className="w-8 h-8 bg-transparent hover:bg-[#101015] text-[#9A9A92] hover:text-[#F1F0E1] flex items-center justify-center transition-colors cursor-pointer border border-[#2B2B31]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Catalog Grid Cards */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#101015]">
              {COSMIC_TARGETS.map((target) => {
                const isSelected = selectedTarget?.id === target.id;
                const cat = CATEGORY_LABELS[target.category];

                return (
                  <div
                    key={target.id}
                    className={`p-4 border transition-colors flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "bg-[#506385] border-[#506385] text-[#F1F0E1]"
                        : "bg-[#1A1A1F] border-[#2B2B31] hover:border-[#3A3A42]"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[9.5px] uppercase tracking-wider px-2 py-0.5 border ${cat.badge}`}>
                          {cat.label}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-[#9A9A92]">
                          {target.constellation}
                        </span>
                      </div>

                      <h3 className="text-[#F1F0E1] font-bold text-base uppercase tracking-wide">
                        {target.name}
                      </h3>

                      <p className="text-[11px] text-[#F1F0E1]/75 leading-relaxed line-clamp-2 uppercase">
                        {target.description}
                      </p>

                      {/* Chemical Elements Detected Chips */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {target.spectroscopy.detectedElements.slice(0, 4).map((elem) => (
                          <span
                            key={elem}
                            className="text-[9px] px-1.5 py-0.5 bg-[#101015] text-[#F1F0E1]/80 border border-[#2B2B31]"
                          >
                            {elem}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#2B2B31] flex items-center justify-between text-xs">
                      <span className="text-[11px] text-[#9A9A92] tabular-nums uppercase">
                        {target.distance}
                      </span>
                      <button
                        onClick={() => {
                          navigateToTarget(target);
                          setCatalogOpen(false);
                        }}
                        className={`px-3 py-1.5 text-[10px] uppercase font-bold tracking-[0.1em] transition-colors flex items-center gap-1.5 cursor-pointer border ${
                          isSelected
                            ? "bg-[#F1F0E1] text-[#101015] border-[#F1F0E1]"
                            : "bg-[#506385] text-[#F1F0E1] border-[#506385] hover:opacity-90"
                        }`}
                      >
                        <Telescope className="w-3.5 h-3.5" />
                        <span>{isSelected ? "Fijado en Visor" : "Fijar Objetivo"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#17171C] border-t border-[#2B2B31] flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[#9A9A92]">
              <span>ALADIN LITE V3 • MOTOR CINEMÁTICO ORBITAL</span>
              <button
                onClick={() => setCatalogOpen(false)}
                className="text-[#F1F0E1] hover:underline transition-colors cursor-pointer"
              >
                CERRAR GALERÍA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. Deep Space Dossier Lab Card ─── */}
      {currentMode === "dossier" && selectedTarget && !isCatalogOpen && (
        <aside
          aria-label="Laboratorio de Análisis Astrofísico"
          className="fixed top-20 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] bg-[#1A1A1F] border border-[#2B2B31] flex flex-col overflow-hidden font-[family-name:var(--font-proto)] select-none"
        >
          {/* Card Header */}
          <div className="p-3.5 bg-[#17171C] border-b border-[#2B2B31] flex items-center justify-between">
            <div>
              <span className="text-[9px] tracking-[0.16em] text-[#9A9A92] uppercase font-medium block">
                DOSSIER DE OBJETIVO CÓSMICO
              </span>
              <h3 className="text-[#F1F0E1] text-xs font-bold uppercase tracking-wide truncate max-w-[240px]">
                {selectedTarget.name}
              </h3>
            </div>

            <button
              onClick={returnToFreeFlight}
              className="p-1.5 bg-transparent hover:bg-[#101015] text-[#9A9A92] hover:text-[#F1F0E1] transition-colors cursor-pointer border border-[#2B2B31]"
              title="Volver a Modo Observatorio 360°"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dossier Content */}
          <div className="p-3.5 space-y-3 max-h-[calc(100vh-240px)] overflow-y-auto">
            {/* Category and Constellation Badges */}
            <div className="flex items-center justify-between">
              <span className={`text-[9.5px] uppercase tracking-wider px-2 py-0.5 border ${CATEGORY_LABELS[selectedTarget.category].badge}`}>
                {CATEGORY_LABELS[selectedTarget.category].label}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#9A9A92]">
                {selectedTarget.constellation}
              </span>
            </div>

            {/* Astrophysical Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 border border-[#2B2B31] bg-[#101015]">
                <span className="text-[8.5px] text-[#9A9A92] uppercase tracking-[0.14em] block">
                  Distancia
                </span>
                <span className="text-[#F1F0E1] font-medium text-[11px] tabular-nums uppercase">
                  {selectedTarget.distance}
                </span>
              </div>
              <div className="p-2 border border-[#2B2B31] bg-[#101015]">
                <span className="text-[8.5px] text-[#9A9A92] uppercase tracking-[0.14em] block">
                  Redshift (z)
                </span>
                <span className="text-[#F1F0E1] font-medium text-[11px] tabular-nums">
                  {selectedTarget.redshift || "z = 0.000"}
                </span>
              </div>
              <div className="p-2 border border-[#2B2B31] bg-[#101015] col-span-2">
                <span className="text-[8.5px] text-[#9A9A92] uppercase tracking-[0.14em] block">
                  Sensor / Observatorio Líder
                </span>
                <span className="text-[#F1F0E1] font-medium text-[11px] uppercase">
                  {selectedTarget.spectroscopy.primarySensor}
                </span>
              </div>
            </div>

            {/* Scientific Description */}
            <div className="space-y-1">
              <span className="text-[8.5px] text-[#9A9A92] uppercase tracking-[0.14em] block">
                Dossier Científico
              </span>
              <p className="text-[11px] text-[#F1F0E1]/80 leading-relaxed p-2.5 border border-[#2B2B31] bg-[#101015] uppercase">
                {selectedTarget.description}
              </p>
            </div>

            {/* Detected Chemical Elements Tags */}
            <div className="space-y-1.5">
              <span className="text-[8.5px] text-[#9A9A92] uppercase tracking-[0.14em] flex items-center gap-1">
                <Atom className="w-3 h-3 text-[#9A9A92]" />
                <span>Firmas Espectroscópicas Detectadas</span>
              </span>
              <div className="flex flex-wrap gap-1">
                {selectedTarget.spectroscopy.detectedElements.map((elem) => (
                  <span
                    key={elem}
                    className="px-2 py-0.5 text-[9.5px] bg-[#101015] text-[#F1F0E1] border border-[#2B2B31]"
                  >
                    {elem}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Buttons inside Card */}
            <div className="pt-2 flex flex-col gap-1.5 border-t border-[#2B2B31]">
              <button
                onClick={() => setCatalogOpen(true)}
                className="w-full py-2 px-3 bg-[#506385] text-[#F1F0E1] text-[11px] uppercase tracking-[0.12em] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Explorar Otros Objetos</span>
              </button>

              <button
                onClick={returnToFreeFlight}
                className="w-full py-1.5 px-3 bg-transparent hover:bg-[#101015] text-[#9A9A92] hover:text-[#F1F0E1] text-[10px] uppercase tracking-[0.12em] border border-[#2B2B31] transition-colors flex items-center justify-center gap-1 cursor-pointer"
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

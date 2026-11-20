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
    label: "Nebulosa de emisión",
    badge: "text-[var(--text)] border-[var(--border)] bg-[var(--surface-2)]",
  },
  galaxy: {
    label: "Galaxia espiral",
    badge: "text-[var(--text)] border-[var(--border)] bg-[var(--surface-2)]",
  },
  "deep-field": {
    label: "Campo profundo / Lente",
    badge: "text-[var(--text)] border-[var(--border)] bg-[var(--surface-2)]",
  },
  "black-hole": {
    label: "Agujero negro supermasivo",
    badge: "text-[var(--text)] border-[var(--border)] bg-[var(--surface-2)]",
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs select-none animate-panel-enter">
          <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[20px] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center shrink-0 font-bold">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[var(--text)] font-semibold text-sm sm:text-base tracking-tight flex items-center gap-2">
                    <span>Catálogo Científico Deep Space</span>
                    <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded-full bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-muted)]">
                      {COSMIC_TARGETS.length} objetivos
                    </span>
                  </h2>
                  <p className="hidden xs:block text-[12px] text-[var(--text-muted)] mt-0.5">
                    Selecciona un objetivo cósmico para navegación y análisis espectral
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCatalogOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Catalog Grid Cards */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-[var(--bg)]">
              {COSMIC_TARGETS.map((target) => {
                const isSelected = selectedTarget?.id === target.id;
                const cat = CATEGORY_LABELS[target.category];

                return (
                  <div
                    key={target.id}
                    className={`p-4 rounded-[12px] border transition-colors flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "bg-[var(--surface-2)] border-[var(--accent)] shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
                        : "bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full border ${cat.badge}`}>
                          {cat.label}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {target.constellation}
                        </span>
                      </div>

                      <h3 className="text-[var(--text)] font-semibold text-base tracking-tight">
                        {target.name}
                      </h3>

                      <p className="text-[12px] text-[var(--text-muted)] leading-relaxed line-clamp-2">
                        {target.description}
                      </p>

                      {/* Chemical Elements Detected Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {target.spectroscopy.detectedElements.slice(0, 4).map((elem) => (
                          <span
                            key={elem}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-[6px] bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]"
                          >
                            {elem}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                      <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                        {target.distance}
                      </span>
                      <button
                        onClick={() => {
                          navigateToTarget(target);
                          setCatalogOpen(false);
                        }}
                        className={`px-3 py-1.5 text-[12px] rounded-full font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? "bg-[var(--accent)] text-[var(--on-accent)] font-semibold"
                            : "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)]"
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
            <div className="p-3.5 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span className="truncate">Aladin Lite v3 · Motor Cinemático HiPS</span>
              <button
                onClick={() => setCatalogOpen(false)}
                className="text-[var(--text)] hover:underline transition-colors cursor-pointer shrink-0 font-medium"
              >
                Cerrar galería
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. Deep Space Dossier Lab Card ─── */}
      {currentMode === "dossier" && selectedTarget && !isCatalogOpen && (
        <aside
          aria-label="Laboratorio de Análisis Astrofísico"
          className="fixed top-20 right-6 z-30 w-auto sm:w-[360px] max-w-[calc(100vw-3rem)] solid-card flex flex-col overflow-hidden select-none shadow-[0_8px_24px_rgba(0,0,0,0.35)] animate-panel-enter"
        >
          {/* Card Header */}
          <div className="p-4 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[var(--text-muted)] font-medium block">
                Dossier de Objetivo Cósmico
              </span>
              <h3 className="text-[var(--text)] text-[15px] font-bold tracking-tight truncate max-w-[220px]">
                {selectedTarget.name}
              </h3>
            </div>

            <button
              onClick={returnToFreeFlight}
              className="p-1.5 rounded-full hover:bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
              title="Volver a Modo Observatorio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dossier Content */}
          <div className="p-4 space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto">
            {/* Category and Constellation Badges */}
            <div className="flex items-center justify-between">
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full border ${CATEGORY_LABELS[selectedTarget.category].badge}`}>
                {CATEGORY_LABELS[selectedTarget.category].label}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {selectedTarget.constellation}
              </span>
            </div>

            {/* Astrophysical Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)]">
                <span className="text-[11px] text-[var(--text-muted)] block">
                  Distancia
                </span>
                <span className="text-[var(--text)] font-medium text-[12px] font-mono tabular-nums">
                  {selectedTarget.distance}
                </span>
              </div>
              <div className="p-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)]">
                <span className="text-[11px] text-[var(--text-muted)] block">
                  Redshift (z)
                </span>
                <span className="text-[var(--text)] font-medium text-[12px] font-mono tabular-nums">
                  {selectedTarget.redshift || "z = 0.000"}
                </span>
              </div>
              <div className="p-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] col-span-2">
                <span className="text-[11px] text-[var(--text-muted)] block">
                  Sensor / Observatorio Líder
                </span>
                <span className="text-[var(--text)] font-medium text-[12px]">
                  {selectedTarget.spectroscopy.primarySensor}
                </span>
              </div>
            </div>

            {/* Scientific Description */}
            <div className="space-y-1">
              <span className="text-[11px] text-[var(--text-muted)] block font-medium">
                Dossier Científico
              </span>
              <p className="text-[12px] text-[var(--text-muted)] leading-relaxed p-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)]">
                {selectedTarget.description}
              </p>
            </div>

            {/* Detected Chemical Elements Tags */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 font-medium">
                <Atom className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Firmas Espectroscópicas Detectadas</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedTarget.spectroscopy.detectedElements.map((elem) => (
                  <span
                    key={elem}
                    className="px-2.5 py-0.5 text-[11px] font-mono rounded-[6px] bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]"
                  >
                    {elem}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Buttons inside Card */}
            <div className="pt-2 flex flex-col gap-2 border-t border-[var(--border)]">
              <button
                onClick={() => setCatalogOpen(true)}
                className="w-full py-2 px-3 rounded-full bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-[12px] transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Explorar Otros Objetos</span>
              </button>

              <button
                onClick={returnToFreeFlight}
                className="w-full py-2 px-3 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] text-[12px] border border-[var(--border)] transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Volver a Observatorio Libre</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

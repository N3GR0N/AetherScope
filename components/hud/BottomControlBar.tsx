"use client";

import React, { useState } from "react";
import { useSpace } from "@/context/SpaceContext";
import { formatCoordinates, formatFov } from "@/lib/astronomy/coordinates";
import { SPECTRAL_SURVEYS, type SpectralSurvey } from "@/lib/astronomy/surveys";
import { Plus, Minus, Layers, ChevronUp } from "lucide-react";

export default function BottomControlBar() {
  const space = useSpace();
  const { currentRa, currentDec, currentFov, setFovPreset, primarySurvey, setPrimarySurvey } = space;

  const [surveyMenuOpen, setSurveyMenuOpen] = useState(false);

  const coords = formatCoordinates(currentRa, currentDec);
  const fovInfo = formatFov(currentFov);

  const handleZoomIn = () => {
    setFovPreset(Math.max(0.005, currentFov * 0.7));
  };

  const handleZoomOut = () => {
    setFovPreset(Math.min(180, currentFov * 1.4));
  };

  const handleSelectSurvey = (survey: SpectralSurvey) => {
    setPrimarySurvey(survey);
    setSurveyMenuOpen(false);
  };

  return (
    <div className="fixed bottom-[72px] md:bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto select-none flex flex-col items-center gap-2">
      {/* Survey selection popover */}
      {surveyMenuOpen && (
        <div
          role="menu"
          aria-label="Seleccionar capa espectral del visor"
          className="solid-card p-2 w-[280px] space-y-1 mb-1 animate-panel-enter"
        >
          <div className="text-[11px] font-medium text-[var(--text-muted)] px-3 py-1.5 border-b border-[var(--border)]">
            Capas Espectrales HiPS
          </div>
          <div className="max-h-[220px] overflow-y-auto space-y-0.5">
            {SPECTRAL_SURVEYS.map((survey) => {
              const isSelected = primarySurvey?.id === survey.id;
              return (
                <button
                  key={survey.id}
                  onClick={() => handleSelectSurvey(survey)}
                  className={`w-full text-left px-3 py-2 rounded-[8px] text-[12px] flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[var(--accent)] text-[var(--on-accent)] font-semibold"
                      : "text-[var(--text)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <span className="truncate">{survey.name}</span>
                  <span className="text-[10px] opacity-75 font-mono">{survey.agency.split("/")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Bottom Control Pill */}
      <div className="glass-panel rounded-full px-4 py-2 flex items-center gap-3 sm:gap-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)] min-h-[44px]">
        {/* Zoom Out & In */}
        <div className="flex items-center gap-1 border-r border-[var(--border)] pr-3">
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            title="Alejar campo de visión (-)"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            title="Acercar campo de visión (+)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Survey Selector Pill Button */}
        <button
          onClick={() => setSurveyMenuOpen((prev) => !prev)}
          className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-1)] border border-[var(--border)] text-[12px] text-[var(--text)] transition-colors cursor-pointer"
          title="Cambiar encuesta astronómica / capa espectral"
        >
          <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="max-w-[100px] sm:max-w-[130px] truncate">
            {primarySurvey?.shortLabel || primarySurvey?.name || "DSS2 Óptico"}
          </span>
          <ChevronUp className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${surveyMenuOpen ? "rotate-180" : ""}`} />
        </button>

        <div className="hidden sm:block h-4 w-[1px] bg-[var(--border)]" />

        {/* Live Coordinates Readout */}
        <div className="flex items-center gap-2 font-mono tabular-nums text-[12px] text-[var(--text)]">
          <span className="hidden sm:inline text-[var(--text-muted)]">{coords.raHms}</span>
          <span className="hidden sm:inline text-[var(--border-strong)]">·</span>
          <span className="hidden sm:inline text-[var(--text-muted)]">{coords.decDms}</span>
          <span className="hidden sm:inline text-[var(--border-strong)]">·</span>
          <span className="text-[var(--accent)] font-semibold">FOV {fovInfo.rawText}</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SpaceCanvas from "@/components/space-canvas/SpaceCanvas.client";
import { SpaceProvider } from "@/context/SpaceContext";
import { crossMatchCelestialTarget } from "@/lib/astronomy/database";
import {
  LABORATORY_SPECTRAL_FILTERS,
  runAstrophysicalAnalysis,
  type SpectralFilterOption,
} from "@/lib/astronomy/analysis";
import { formatCoordinates, formatFov, getConstellation } from "@/lib/astronomy/coordinates";
import {
  ArrowLeft,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sparkles,
  Bookmark,
  Radio,
  Atom,
  Thermometer,
} from "lucide-react";

function LaboratoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read query params or fallback to default
  const raParam = parseFloat(searchParams.get("ra") || "274.7001");
  const decParam = parseFloat(searchParams.get("dec") || "-13.8067");
  const fovParam = parseFloat(searchParams.get("fov") || "0.18");

  const [activePrimaryFilter, setActivePrimaryFilter] = useState<SpectralFilterOption>(
    LABORATORY_SPECTRAL_FILTERS[0] // DSS2 Optical base
  );
  const [activeOverlayFilter, setActiveOverlayFilter] = useState<SpectralFilterOption | null>(
    LABORATORY_SPECTRAL_FILTERS[1] // JWST Infrared overlay
  );
  const [blendOpacity, setBlendOpacity] = useState<number>(0.65);
  const [userObservationNote, setUserObservationNote] = useState<string>("");
  const [noteSaved, setNoteSaved] = useState<boolean>(false);

  // Cross-match with official catalog
  const crossMatch = useMemo(
    () => crossMatchCelestialTarget(raParam, decParam),
    [raParam, decParam]
  );

  // Run dynamic chemical/physical analysis
  const activeFilterIds = useMemo(() => {
    const ids = [activePrimaryFilter.id];
    if (activeOverlayFilter && blendOpacity > 0.05) {
      ids.push(activeOverlayFilter.id);
    }
    return ids;
  }, [activePrimaryFilter, activeOverlayFilter, blendOpacity]);

  const analysis = useMemo(
    () => runAstrophysicalAnalysis(activeFilterIds, crossMatch.target, blendOpacity),
    [activeFilterIds, crossMatch.target, blendOpacity]
  );

  const coords = formatCoordinates(raParam, decParam);
  const fovInfo = formatFov(fovParam);
  const constellation = getConstellation(raParam, decParam);

  const handleReturnToExplorer = () => {
    router.push(`/?ra=${raParam.toFixed(4)}&dec=${decParam.toFixed(4)}&fov=${fovParam.toFixed(4)}`);
  };

  const handleSaveObservation = () => {
    if (!userObservationNote.trim()) return;
    try {
      const records = JSON.parse(localStorage.getItem("aetherscope_observations") || "[]");
      records.push({
        ra: raParam,
        dec: decParam,
        fov: fovParam,
        target: crossMatch.target?.name || "Sector Sin Catalogar",
        note: userObservationNote,
        date: new Date().toISOString(),
      });
      localStorage.setItem("aetherscope_observations", JSON.stringify(records));
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
    } catch {}
  };

  // Convert SpectralFilterOption to SpectralSurvey format for SpaceCanvas
  const primarySurveyProp = useMemo(
    () => ({
      id: activePrimaryFilter.id,
      name: activePrimaryFilter.name,
      shortLabel: activePrimaryFilter.shortLabel,
      telescope: "Space Observatory",
      agency: "NASA / ESA / CDS",
      hipsId: `CDS/P/${activePrimaryFilter.id}`,
      hipsUrl: activePrimaryFilter.hipsUrl,
      wavelengthBand: activePrimaryFilter.wavelength,
      spectralRange: activePrimaryFilter.wavelength,
      frequency: "Optical to High Energy",
      accentColor: activePrimaryFilter.colorHex,
      tagColor: "text-white",
      description: activePrimaryFilter.description,
      astrophysicalFocus: "Astrophysical survey",
      keyEmissions: [],
    }),
    [activePrimaryFilter]
  );

  const secondarySurveyProp = useMemo(
    () =>
      activeOverlayFilter
        ? {
            id: activeOverlayFilter.id,
            name: activeOverlayFilter.name,
            shortLabel: activeOverlayFilter.shortLabel,
            telescope: "Space Observatory",
            agency: "NASA / ESA / CDS",
            hipsId: `CDS/P/${activeOverlayFilter.id}`,
            hipsUrl: activeOverlayFilter.hipsUrl,
            wavelengthBand: activeOverlayFilter.wavelength,
            spectralRange: activeOverlayFilter.wavelength,
            frequency: "Optical to High Energy",
            accentColor: activeOverlayFilter.colorHex,
            tagColor: "text-white",
            description: activeOverlayFilter.description,
            astrophysicalFocus: "Astrophysical survey",
            keyEmissions: [],
          }
        : undefined,
    [activeOverlayFilter]
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050811] text-white select-none flex flex-col font-sans">
      {/* 1. Top Unified Apple Pro Header */}
      <header className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-white/10 bg-[#080b11]/90 backdrop-blur-2xl z-40">
        {/* Left: Return Button & Branding */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReturnToExplorer}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-white transition-all cursor-pointer shadow-sm active:scale-95"
            title="Volver al lienzo de exploración libre preservando las coordenadas"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Volver al Explorador</span>
            <span className="sm:hidden">Volver</span>
          </button>

          <div className="w-px h-4 bg-white/15 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Atom className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-xs tracking-wider">LABORATORIO ASTROFÍSICO</span>
              <span className="text-[9px] font-mono text-white/40 leading-none">
                Inspección Espectral y Cross-Match
              </span>
            </div>
          </div>
        </div>

        {/* Center: Captured Coordinates Readout */}
        <div className="hidden md:flex items-center gap-3 px-3.5 py-1 rounded-full bg-black/50 border border-white/10 font-mono text-xs text-white/80">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>RA: {coords.raHms} ({raParam.toFixed(4)}°)</span>
          <span className="text-white/30">•</span>
          <span>Dec: {coords.decDms} ({decParam.toFixed(4)}°)</span>
          <span className="text-white/30">•</span>
          <span className="text-amber-300">FOV: {fovInfo.rawText}</span>
        </div>

        {/* Right: Constellation & Target Badge */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 hidden lg:inline">
            Constelación: <strong className="text-white/90">{constellation}</strong>
          </span>
          {crossMatch.matched ? (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold flex items-center gap-1.5 text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>CATALOGADO</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold flex items-center gap-1.5 text-[11px]">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              <span>NO CATALOGADO</span>
            </span>
          )}
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Left Side: Captured Celestial Field Viewport & Spectral Mixer */}
        <div className="relative flex-1 h-full bg-black flex flex-col overflow-hidden">
          {/* Aladin Lite WebGL Canvas locked on captured area */}
          <div className="absolute inset-0">
            <SpaceCanvas
              containerId="aladin-analyze-div"
              initialRa={raParam}
              initialDec={decParam}
              initialFov={fovParam}
              primarySurvey={primarySurveyProp}
              secondarySurvey={secondarySurveyProp}
              blendOpacity={blendOpacity}
            />
          </div>

          {/* Precision Target Crosshair Reticle (Static visual overlay on captured center) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <div className="absolute w-28 h-28 rounded-full border border-white/20 border-dashed" />
              <div className="absolute w-12 h-12 rounded-full border border-amber-400/40 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,1)]" />
              </div>
              <div className="absolute left-0 w-8 h-px bg-white/40" />
              <div className="absolute right-0 w-8 h-px bg-white/40" />
              <div className="absolute top-0 h-8 w-px bg-white/40" />
              <div className="absolute bottom-0 h-8 w-px bg-white/40" />
              <div className="absolute -bottom-6 px-2 py-0.5 rounded bg-black/70 border border-white/10 text-[9px] font-mono text-white/60">
                CENTRO DE CAPTURA
              </div>
            </div>
          </div>

          {/* Bottom Floating Spectral Filters & Mixing Dock */}
          <div className="absolute bottom-4 left-4 right-4 z-30 pointer-events-none flex justify-center">
            <div className="w-full max-w-4xl bg-[#080b11]/90 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/15 rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] pointer-events-auto flex flex-col gap-2.5">
              
              {/* Filter Dial Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-mono text-white/70">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold text-white">CAPAS ESPECTRALES:</span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                  {LABORATORY_SPECTRAL_FILTERS.map((filter) => {
                    const isPrimary = activePrimaryFilter.id === filter.id;
                    const isOverlay = activeOverlayFilter?.id === filter.id;

                    return (
                      <button
                        key={filter.id}
                        onClick={() => {
                          if (isPrimary) {
                            // If clicking active primary, do nothing
                          } else if (isOverlay) {
                            // Swap: make it primary
                            setActivePrimaryFilter(filter);
                            setActiveOverlayFilter(activePrimaryFilter);
                          } else {
                            // Set as overlay
                            setActiveOverlayFilter(filter);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-2 border ${
                          isPrimary
                            ? "bg-white/20 border-white/40 text-white font-bold shadow-md"
                            : isOverlay
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold"
                            : "bg-black/40 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                        }`}
                        title={`${filter.name} (${filter.wavelength})`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: filter.colorHex }}
                        />
                        <span>{filter.shortLabel}</span>
                        {isPrimary && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-white/20 text-white">
                            BASE
                          </span>
                        )}
                        {isOverlay && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/30 text-amber-200">
                            CAPA
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Spectral Blend Opacity Slider */}
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10 text-xs font-mono">
                <div className="flex items-center gap-2 text-white/70">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  <span>Mezcla Multiespectral ({activeOverlayFilter ? activeOverlayFilter.shortLabel : "Sin capa"}):</span>
                </div>

                <div className="flex items-center gap-3 flex-1 max-w-xs">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={blendOpacity}
                    onChange={(e) => setBlendOpacity(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <span className="font-semibold text-white/95 w-10 text-right tabular-nums">
                    {Math.round(blendOpacity * 100)}%
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Side: Professional Astrophysical Analysis Dashboard Panel */}
        <aside className="w-[420px] max-w-full shrink-0 h-full border-l border-white/10 bg-[#080b11]/95 backdrop-blur-2xl overflow-y-auto p-4 flex flex-col gap-4 z-20">
          
          {/* Card 1: Cross-Match Identification Result */}
          <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[10px] font-mono tracking-wider text-white/50 uppercase">
                Identificación de Objetivo
              </span>
              <span
                className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                  crossMatch.matched
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/15 border-amber-500/30 text-amber-400"
                }`}
              >
                {crossMatch.matched ? "CATÁLOGO REGISTRADO" : "SECTOR EN EXPLORACIÓN"}
              </span>
            </div>

            {crossMatch.matched && crossMatch.target ? (
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-wide">
                      {crossMatch.target.name}
                    </h2>
                    <span className="text-xs font-mono text-amber-400">
                      {crossMatch.target.catalogId}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded">
                    Δθ {crossMatch.angularSeparationDeg.toFixed(3)}°
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[9px] text-white/40 block">Naturaleza:</span>
                    <span className="font-semibold text-white/90 truncate block">
                      {crossMatch.target.nature}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[9px] text-white/40 block">Distancia:</span>
                    <span className="font-semibold text-white/90 truncate block">
                      {crossMatch.target.distanceLy}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-white/70 leading-relaxed font-sans bg-black/30 p-2.5 rounded-xl border border-white/5">
                  {crossMatch.target.description}
                </p>

                <div className="text-[10px] font-mono text-white/50 space-y-1 pt-1">
                  <div>• Masa/Extensión: <span className="text-white/80">{crossMatch.target.astrophysicalDetails.massOrSize}</span></div>
                  <div>• Rango Térmico: <span className="text-white/80">{crossMatch.target.astrophysicalDetails.temperatureRange}</span></div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <h3 className="font-semibold text-amber-200">
                  Sector Profundo No Catalogado en Objetos Emblemáticos
                </h3>
                <p className="text-xs text-white/60 leading-relaxed font-sans">
                  El sector enfocado en la constelación de <strong className="text-white">{constellation}</strong> no
                  coincide con los objetivos primarios preconfigurados. Se procede al escaneo espectrométrico de campo continuo.
                </p>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-300">
                  Modo de descubrimiento activo: Análisis de fondo cosmológico y firmas infrarrojas/rayos X.
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Materials & Chemical Detection Inspector */}
          <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <Atom className="w-3.5 h-3.5" />
                <span>INSPECTOR DE ESPECIES QUÍMICAS</span>
              </div>
              <span className="text-[9px] font-mono text-white/40">
                {analysis.detectedElements.length} especies
              </span>
            </div>

            {/* Elements Concentration Bars */}
            <div className="space-y-2.5">
              {analysis.detectedElements.map((el, i) => (
                <div key={i} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-bold text-white">{el.formula}</span>
                      <span className="text-white/40">({el.name})</span>
                    </div>
                    <span className="font-mono font-semibold text-white/90 tabular-nums">
                      {el.abundancePct}%
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        el.category === "Plasma de Alta Energía"
                          ? "bg-purple-400"
                          : el.category === "Polvo Interestelar"
                          ? "bg-amber-400"
                          : el.category === "Gas Molecular"
                          ? "bg-sky-400"
                          : "bg-emerald-400"
                      }`}
                      style={{ width: `${el.abundancePct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono text-white/40">
                    <span>Banda: {el.detectionBand}</span>
                    <span>Confianza: {el.confidencePct}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Physical Regime Readout */}
            <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-2 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
                <div className="flex items-center gap-1 text-white/40">
                  <Thermometer className="w-3 h-3 text-amber-400" />
                  <span>Régimen Térmico:</span>
                </div>
                <span className="font-semibold text-white/90 text-[11px] block truncate">
                  {analysis.estimatedTemperature}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white/5 border border-white/5 space-y-0.5">
                <div className="flex items-center gap-1 text-white/40">
                  <Radio className="w-3 h-3 text-sky-400" />
                  <span>Campo de Radiación:</span>
                </div>
                <span
                  className={`font-semibold text-[11px] block truncate ${
                    analysis.radiationFieldIntensity === "Extrema"
                      ? "text-purple-400"
                      : analysis.radiationFieldIntensity === "Alta"
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {analysis.radiationFieldIntensity}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Astrophysical Synthesis & Scientific Conclusion */}
          <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5 space-y-2.5 shadow-lg">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 border-b border-white/10 pb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SÍNTESIS ASTROFÍSICA DEL SECTOR</span>
            </div>

            <p className="text-xs text-white/80 leading-relaxed font-sans bg-black/20 p-2.5 rounded-xl border border-white/5">
              {analysis.scientificConclusion}
            </p>

            <div className="text-[10px] font-mono text-white/50">
              • Fenómeno primario: <span className="text-white/80">{analysis.dominantPhenomenon}</span>
            </div>
          </div>

          {/* Card 4: Observation Notes & Journal */}
          <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5 space-y-2.5 shadow-lg mt-auto">
            <div className="flex items-center justify-between text-xs font-semibold text-white/80 border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>BITÁCORA DE INVESTIGACIÓN</span>
              </div>
              {noteSaved && (
                <span className="text-[9px] font-mono text-emerald-400 animate-pulse">
                  ¡OBSERVACIÓN GUARDADA!
                </span>
              )}
            </div>

            <textarea
              value={userObservationNote}
              onChange={(e) => setUserObservationNote(e.target.value)}
              placeholder="Anotar hipótesis, observaciones espectrales o notas de misión sobre este sector..."
              className="w-full h-18 rounded-xl bg-black/60 border border-white/10 p-2 text-xs font-mono text-white placeholder-white/30 focus:outline-hidden focus:border-amber-400/50 resize-none"
            />

            <button
              onClick={handleSaveObservation}
              className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
              <span>Registrar Observación en Memoria</span>
            </button>
          </div>

        </aside>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <SpaceProvider>
      <Suspense
        fallback={
          <div className="w-screen h-screen bg-[#050811] flex flex-col items-center justify-center text-white space-y-4">
            <div className="w-12 h-12 rounded-full border border-amber-400/30 border-t-amber-400 animate-spin" />
            <p className="text-xs font-mono text-white/60">
              Iniciando Laboratorio de Análisis Astrofísico...
            </p>
          </div>
        }
      >
        <LaboratoryContent />
      </Suspense>
    </SpaceProvider>
  );
}

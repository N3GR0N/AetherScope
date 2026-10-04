"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SpaceCanvas from "@/components/space-canvas/SpaceCanvas.client";
import { SpaceProvider } from "@/context/SpaceContext";
import {
  identifyCelestialTarget,
  matchLocalDossier,
  type AstronomicalObjectResult,
} from "@/lib/astronomy/crossmatch";
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
  Loader2,
  Database,
  Globe2,
} from "lucide-react";

function LaboratoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read angular coordinates and field of view with high precision
  const raParam = parseFloat(searchParams.get("ra") || "274.70000");
  const decParam = parseFloat(searchParams.get("dec") || "-13.80600");
  const fovParam = parseFloat(searchParams.get("fov") || "0.1800");

  // Spectral layer states
  const [activePrimaryFilter, setActivePrimaryFilter] = useState<SpectralFilterOption>(
    LABORATORY_SPECTRAL_FILTERS[0] // DSS2 Optical visible base
  );
  const [activeOverlayFilter, setActiveOverlayFilter] = useState<SpectralFilterOption | null>(
    LABORATORY_SPECTRAL_FILTERS[1] // JWST Deep Infrared overlay default
  );
  const [blendOpacity, setBlendOpacity] = useState<number>(0.65);

  const currentCoordKey = `${raParam.toFixed(5)},${decParam.toFixed(5)}`;

  // Target identification state (Hybrid: Local -> CDS TAP -> Unregistered)
  const [targetState, setTargetState] = useState<{
    target: AstronomicalObjectResult | null;
    loading: boolean;
    queryKey: string;
  }>(() => {
    const local = matchLocalDossier(raParam, decParam, 0.4);
    if (local) {
      return {
        target: local,
        loading: false,
        queryKey: currentCoordKey,
      };
    }
    return {
      target: null,
      loading: true,
      queryKey: currentCoordKey,
    };
  });

  // User observation notes
  const [userObservationNote, setUserObservationNote] = useState<string>("");
  const [noteSaved, setNoteSaved] = useState<boolean>(false);

  // Execute hybrid cross-match
  useEffect(() => {
    let cancelled = false;

    const runCrossMatch = async () => {
      try {
        const result = await identifyCelestialTarget(raParam, decParam);
        if (!cancelled) {
          setTargetState({
            target: result,
            loading: false,
            queryKey: currentCoordKey,
          });
        }
      } catch (err) {
        console.warn("[AetherScope] Error en cross-match híbrido:", err);
        if (!cancelled) {
          setTargetState({
            target: {
              source: "unregistered",
              name: "Sector de Cielo Profundo",
              objectType: "Sector de cielo profundo en exploración / estrellas de fondo no catalogadas",
              ra: raParam,
              dec: decParam,
              constellation: getConstellation(raParam, decParam),
              description: "Sector astronómico no registrado de forma singular en bases de datos.",
              spectralFeatures: ["Emisión difusa de continuo"],
            },
            loading: false,
            queryKey: currentCoordKey,
          });
        }
      }
    };

    void runCrossMatch();

    return () => {
      cancelled = true;
    };
  }, [raParam, decParam, currentCoordKey]);

  const isIdentifying = targetState.loading || targetState.queryKey !== currentCoordKey;
  const identifiedTarget = targetState.target;

  // Run dynamic chemical/physical analysis based on active filters & identified target
  const activeFilterIds = useMemo(() => {
    const ids = [activePrimaryFilter.id];
    if (activeOverlayFilter && blendOpacity > 0.05) {
      ids.push(activeOverlayFilter.id);
    }
    return ids;
  }, [activePrimaryFilter, activeOverlayFilter, blendOpacity]);

  const analysis = useMemo(
    () => runAstrophysicalAnalysis(activeFilterIds, identifiedTarget, blendOpacity),
    [activeFilterIds, identifiedTarget, blendOpacity]
  );

  const coords = formatCoordinates(raParam, decParam);
  const fovInfo = formatFov(fovParam);
  const constellation = identifiedTarget?.constellation || getConstellation(raParam, decParam);

  // Return to free explorer preserving exact coordinates
  const handleReturnToExplorer = () => {
    router.push(`/?ra=${raParam.toFixed(5)}&dec=${decParam.toFixed(5)}&fov=${fovParam.toFixed(4)}`);
  };

  const handleSaveObservation = () => {
    if (!userObservationNote.trim()) return;
    try {
      const records = JSON.parse(localStorage.getItem("aetherscope_observations") || "[]");
      records.push({
        ra: raParam,
        dec: decParam,
        fov: fovParam,
        target: identifiedTarget?.name || "Sector Sin Catalogar",
        source: identifiedTarget?.source || "unregistered",
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
      telescope: "Observatorio Espacial",
      agency: "CDS / NASA / ESA",
      hipsId: `CDS/P/${activePrimaryFilter.id}`,
      hipsUrl: activePrimaryFilter.hipsUrl,
      wavelengthBand: activePrimaryFilter.wavelength,
      spectralRange: activePrimaryFilter.wavelength,
      frequency: "Óptico / Alta Energía",
      accentColor: activePrimaryFilter.colorHex,
      tagColor: "text-white",
      description: activePrimaryFilter.description,
      astrophysicalFocus: "Relevamiento astrofísico multiespectral",
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
            telescope: "Observatorio Espacial",
            agency: "CDS / NASA / ESA",
            hipsId: `CDS/P/${activeOverlayFilter.id}`,
            hipsUrl: activeOverlayFilter.hipsUrl,
            wavelengthBand: activeOverlayFilter.wavelength,
            spectralRange: activeOverlayFilter.wavelength,
            frequency: "Infrarrojo / Rayos X",
            accentColor: activeOverlayFilter.colorHex,
            tagColor: "text-white",
            description: activeOverlayFilter.description,
            astrophysicalFocus: "Relevamiento astrofísico multiespectral",
            keyEmissions: [],
          }
        : undefined,
    [activeOverlayFilter]
  );

  const isRegistered =
    identifiedTarget?.source === "local_dossier" || identifiedTarget?.source === "simbad_api";

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white select-none flex flex-col font-sans">
      {/* 1. Top Unified Apple Pro Header */}
      <header className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-white/10 bg-[#0a0d14]/85 backdrop-blur-2xl z-40">
        {/* Left: Return Button & Branding */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReturnToExplorer}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-sans font-medium text-white/95 transition-all duration-150 ease-out cursor-pointer shadow-xs active:scale-[0.98]"
            title="Volver al lienzo de exploración libre preservando las coordenadas"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Volver al Explorador</span>
            <span className="sm:hidden">Volver</span>
          </button>

          <div className="w-px h-4 bg-white/15 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Atom className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-xs tracking-wider text-white/95 font-sans">LABORATORIO ASTROFÍSICO</span>
              <span className="text-[9px] font-sans text-white/40 leading-none">
                Inspección Espectral y Cross-Match
              </span>
            </div>
          </div>
        </div>

        {/* Center: Captured Coordinates Readout */}
        <div className="hidden md:flex items-center gap-3 px-3.5 py-1 rounded-full bg-[#0a0d14]/85 border border-white/10 text-xs text-white/65">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="font-mono tabular-nums text-white/95">RA: {coords.raHms}</span>
          <span className="text-white/20">•</span>
          <span className="font-mono tabular-nums text-white/95">Dec: {coords.decDms}</span>
          <span className="text-white/20">•</span>
          <span className="font-mono tabular-nums text-amber-400 font-medium">FOV: {fovInfo.rawText}</span>
        </div>

        {/* Right: Constellation & Detection Status Badge */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/65 font-sans hidden lg:inline">
            Constelación: <strong className="text-white/95">{constellation}</strong>
          </span>

          {isIdentifying ? (
            <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/65 font-sans font-medium flex items-center gap-1.5 text-[11px]">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>CONSULTANDO CDS...</span>
            </span>
          ) : isRegistered ? (
            <span className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-sans font-semibold flex items-center gap-1.5 text-[11px] shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>REGISTRADO EN SIMBAD/NASA</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-sans font-semibold flex items-center gap-1.5 text-[11px] shadow-xs">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>SECTOR NO CATALOGADO</span>
            </span>
          )}
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Left Side: Captured Celestial Field Viewport & Spectral Mixer */}
        <div className="relative flex-1 h-full bg-black flex flex-col overflow-hidden">
          {/* Aladin Lite WebGL Canvas locked on captured coordinates */}
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

          {/* Precision Crosshair Reticle (Static visual overlay on captured center) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <div className="absolute w-28 h-28 rounded-full border border-white/10" />
              <div className="absolute w-12 h-12 rounded-full border border-white/20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
              </div>
              <div className="absolute left-0 w-8 h-px bg-white/30" />
              <div className="absolute right-0 w-8 h-px bg-white/30" />
              <div className="absolute top-0 h-8 w-px bg-white/30" />
              <div className="absolute bottom-0 h-8 w-px bg-white/30" />
              <div className="absolute -bottom-6 px-2 py-0.5 rounded-full bg-[#0a0d14]/85 border border-white/10 text-[9px] font-mono text-white/50">
                CENTRO DE CAPTURA
              </div>
            </div>
          </div>

          {/* Bottom Floating Spectral Filters & Mixing Dock (Apple Liquid Glass + Squircle) */}
          <div className="absolute bottom-4 left-4 right-4 z-30 pointer-events-none flex justify-center">
            <div className="squircle w-full max-w-4xl bg-[#0a0d14]/85 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/10 border-t-white/20 rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.15)] pointer-events-auto flex flex-col gap-2.5">
              
              {/* Filter Row: 5 Spectral Surveys */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-sans text-white/65">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold text-white/95">CAPAS ESPECTRALES:</span>
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
                            // Already base layer
                          } else if (isOverlay) {
                            // Swap overlay with base
                            setActivePrimaryFilter(filter);
                            setActiveOverlayFilter(activePrimaryFilter);
                          } else {
                            // Set as active overlay
                            setActiveOverlayFilter(filter);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-sans transition-all duration-150 ease-out cursor-pointer flex items-center gap-2 border active:scale-[0.98] ${
                          isPrimary
                            ? "bg-white/20 border-white/40 text-white/95 font-semibold shadow-xs"
                            : isOverlay
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold"
                            : "bg-white/5 border-white/10 text-white/65 hover:text-white/95 hover:bg-white/10"
                        }`}
                        title={`${filter.name} (${filter.wavelength})`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: filter.colorHex }}
                        />
                        <span>{filter.shortLabel}</span>
                        {isPrimary && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-white/20 text-white/95 font-mono">
                            BASE
                          </span>
                        )}
                        {isOverlay && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/30 text-amber-200 font-mono">
                            CAPA
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Spectral Blend Opacity Slider */}
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10 text-xs">
                <div className="flex items-center gap-2 text-white/65 font-sans">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Mezcla Multiespectral ({activeOverlayFilter ? activeOverlayFilter.shortLabel : "Sin capa superpuesta"}):
                  </span>
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
                  <span className="font-mono font-semibold text-white/95 w-10 text-right tabular-nums">
                    {Math.round(blendOpacity * 100)}%
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Side: Professional Astrophysical Analysis Dashboard Panel */}
        <aside className="w-[430px] max-w-full shrink-0 h-full border-l border-white/10 bg-[#0a0d14]/90 backdrop-blur-2xl overflow-y-auto p-4 flex flex-col gap-3.5 z-20">
          
          {/* Card 1: Identification & Cross-Match Dossier (Dominant Visual Anchor) */}
          <div className="squircle rounded-2xl bg-[#0a0d14]/95 border border-white/15 border-t-white/25 p-4 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.15)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[10px] font-sans tracking-wider text-white/40 uppercase flex items-center gap-1.5 font-medium">
                <Database className="w-3 h-3 text-amber-400" />
                <span>Ficha de Identificación</span>
              </span>
              <span
                className={`text-[9px] font-sans font-semibold px-2 py-0.5 rounded-full border ${
                  isRegistered
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/15 border-amber-500/30 text-amber-400"
                }`}
              >
                {identifiedTarget?.source === "local_dossier"
                  ? "DOSSIER LOCAL"
                  : identifiedTarget?.source === "simbad_api"
                  ? "SIMBAD TAP (CDS)"
                  : "CIELO PROFUNDO"}
              </span>
            </div>

            {isIdentifying ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-xs text-white/50 font-sans">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                <span>Interrogando catálogo astronómico...</span>
              </div>
            ) : identifiedTarget ? (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white/95 font-sans tracking-wide">
                      {identifiedTarget.name}
                    </h2>
                    {identifiedTarget.designation && (
                      <span className="text-xs font-mono text-amber-400 font-medium">
                        {identifiedTarget.designation}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                    <Globe2 className="w-3 h-3 text-white/40" />
                    <span>J2000</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl border border-white/10 space-y-0.5">
                    <span className="text-[9px] font-sans text-white/40 block">Clasificación:</span>
                    <span className="font-sans font-semibold text-white/90 truncate block text-[11px]" title={identifiedTarget.objectType}>
                      {identifiedTarget.objectType}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-white/10 space-y-0.5">
                    <span className="text-[9px] font-sans text-white/40 block">Distancia estimada:</span>
                    <span className="font-mono tabular-nums font-semibold text-white/90 truncate block text-[11px]">
                      {identifiedTarget.distanceLy || "Desconocida (fondo cósmico)"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-white/65 leading-relaxed font-sans p-2.5 rounded-xl border border-white/10">
                  {identifiedTarget.description}
                </p>

                {identifiedTarget.spectralFeatures && identifiedTarget.spectralFeatures.length > 0 && (
                  <div className="text-[10px] text-white/60 space-y-1 pt-1">
                    <div className="text-white/40 uppercase tracking-wider text-[9px] font-sans">Firmas observacionales:</div>
                    {identifiedTarget.spectralFeatures.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 font-sans">
                        <span className="text-amber-400">•</span>
                        <span className="text-white/75">{feat}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Card 2: Materials & Chemical Detection Inspector (Subordinated) */}
          <div className="squircle rounded-2xl border border-white/10 p-3.5 space-y-3 bg-[#0a0d14]/60">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white/95 font-sans">
                <Atom className="w-3.5 h-3.5 text-amber-400" />
                <span>INSPECTOR DE COMPOSICIÓN & FENÓMENOS</span>
              </div>
              <span className="text-[9px] font-mono text-white/40 tabular-nums">
                {analysis.detectedElements.length} firmas activas
              </span>
            </div>

            {/* Elements Concentration Bars (Unified Monochromatic + Amber Fill) */}
            <div className="space-y-2.5">
              {analysis.detectedElements.map((el, i) => (
                <div key={i} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-sans">
                      <span className="font-bold text-white/95">{el.formula}</span>
                      <span className="text-white/40">({el.name})</span>
                    </div>
                    <span className="font-mono font-semibold text-white/95 tabular-nums">
                      {el.abundancePct}%
                    </span>
                  </div>

                  {/* Visual Progress Bar - Clean Amber Indicator */}
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-300 ease-out"
                      style={{ width: `${el.abundancePct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono text-white/40 tabular-nums">
                    <span>Banda: {el.detectionBand}</span>
                    <span>Confianza: {el.confidencePct}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Physical Regime Readout */}
            <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded-xl border border-white/10 space-y-0.5">
                <div className="flex items-center gap-1 text-white/40 font-sans">
                  <Thermometer className="w-3 h-3 text-amber-400" />
                  <span>Régimen Térmico:</span>
                </div>
                <span className="font-mono tabular-nums text-white/90 text-[11px] block truncate" title={analysis.estimatedTemperature}>
                  {analysis.estimatedTemperature}
                </span>
              </div>

              <div className="p-2 rounded-xl border border-white/10 space-y-0.5">
                <div className="flex items-center gap-1 text-white/40 font-sans">
                  <Radio className="w-3 h-3 text-white/40" />
                  <span>Campo Radiativo:</span>
                </div>
                <span className="font-sans font-semibold text-[11px] block truncate text-amber-400/90">
                  {analysis.radiationFieldIntensity}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Astrophysical Synthesis (Subordinated) */}
          <div className="squircle rounded-2xl border border-white/10 p-3.5 space-y-2.5 bg-[#0a0d14]/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white/95 font-sans border-b border-white/10 pb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>SÍNTESIS ASTROFÍSICA DEL SECTOR</span>
            </div>

            <p className="text-xs text-white/65 leading-relaxed font-sans p-2.5 rounded-xl border border-white/10">
              {analysis.scientificConclusion}
            </p>

            <div className="text-[10px] font-sans text-white/40">
              • Fenómeno inferido: <span className="text-white/80">{analysis.dominantPhenomenon}</span>
            </div>
          </div>

          {/* Card 4: Observation Notes & Journal */}
          <div className="squircle rounded-2xl border border-white/10 p-3.5 space-y-2.5 bg-[#0a0d14]/60 mt-auto">
            <div className="flex items-center justify-between text-xs font-semibold text-white/80 border-b border-white/10 pb-2 font-sans">
              <div className="flex items-center gap-1.5 text-white/95">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>BITÁCORA DE INVESTIGACIÓN</span>
              </div>
              {noteSaved && (
                <span className="text-[9px] font-sans text-emerald-400 font-semibold">
                  ¡OBSERVACIÓN GUARDADA!
                </span>
              )}
            </div>

            <textarea
              value={userObservationNote}
              onChange={(e) => setUserObservationNote(e.target.value)}
              placeholder="Anotar hipótesis, observaciones espectrales o notas de misión sobre este sector..."
              className="w-full h-18 rounded-xl bg-black/40 border border-white/10 p-2 text-xs font-sans text-white/95 placeholder-white/30 focus:outline-hidden focus:border-amber-400/50 resize-none"
            />

            <button
              onClick={handleSaveObservation}
              className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-sans font-medium text-white/95 transition-all duration-150 ease-out cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
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

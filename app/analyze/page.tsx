"use client";

import { Suspense, useState, useMemo, useEffect, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SpaceCanvas from "@/components/space-canvas/SpaceCanvas.client";
import { SpaceProvider } from "@/context/SpaceContext";
import PrecisionCrosshair from "@/components/hud/PrecisionCrosshair";
import {
  identifyCelestialTarget,
  matchLocalDossier,
  type AstronomicalObjectResult,
} from "@/lib/astronomy/crossmatch";
import {
  LABORATORY_SPECTRAL_FILTERS,
  spectralFilterToSurvey,
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
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronUp,
  Disc,
  CircleDot,
  Orbit,
  Aperture,
  SlidersHorizontal,
} from "lucide-react";

/**
 * Retorna el ícono astronómico y la etiqueta limpia según la clasificación del objeto
 */
function getObjectTypePresentation(typeStr?: string) {
  const t = (typeStr || "").toLowerCase();
  if (t.includes("agujero negro") || t.includes("black hole") || t.includes("sgr a")) {
    return {
      label: "Agujero Negro Supermasivo",
      icon: CircleDot,
      color: "text-amber-400",
      chipBg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    };
  }
  if (t.includes("galaxia") || t.includes("galaxy") || t.includes("espiral") || t.includes("gx")) {
    return {
      label: "Galaxia Espiral",
      icon: Aperture,
      color: "text-cyan-400",
      chipBg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
    };
  }
  if (t.includes("nebulosa") || t.includes("nebula") || t.includes("h ii") || t.includes("remanente")) {
    return {
      label: "Nebulosa / Región H II",
      icon: Sparkles,
      color: "text-rose-400",
      chipBg: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    };
  }
  if (t.includes("cúmulo") || t.includes("cluster") || t.includes("lente")) {
    return {
      label: "Cúmulo / Lente Gravitacional",
      icon: Orbit,
      color: "text-purple-400",
      chipBg: "bg-purple-500/10 border-purple-500/30 text-purple-300",
    };
  }
  if (t.includes("estrella") || t.includes("star") || t.includes("púlsar")) {
    return {
      label: "Estrella / Púlsar",
      icon: Disc,
      color: "text-amber-300",
      chipBg: "bg-amber-400/10 border-amber-400/30 text-amber-200",
    };
  }
  return {
    label: typeStr || "Cuerpo Celeste No Catalogado",
    icon: Atom,
    color: "text-white/70",
    chipBg: "bg-white/5 border-white/10 text-white/70",
  };
}

function LaboratoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read angular coordinates and field of view with high precision
  const rawRa = searchParams.get("ra");
  const rawDec = searchParams.get("dec");
  const rawFov = searchParams.get("fov");

  const raParam = rawRa ? parseFloat(rawRa) : 274.7;
  const decParam = rawDec ? parseFloat(rawDec) : -13.806;
  const fovParam = rawFov ? parseFloat(rawFov) : 0.18;

  // Clave única del objeto/sector observado
  const currentCoordKey = `${raParam.toFixed(5)},${decParam.toFixed(5)}`;

  // Tarea 1: Estado persistente del panel lateral en sessionStorage
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = sessionStorage.getItem("aetherscope_lab_panel_open");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem("aetherscope_lab_panel_open", JSON.stringify(next));
      } catch (err) {
        console.warn("[AetherScope] Error guardando estado de panel:", err);
      }
      return next;
    });
  };

  // Progressive Disclosure: "Ver más detalles" de la ficha general
  const [showFullDossier, setShowFullDossier] = useState(false);

  // Tarea 2: Estado persistente por objeto del detalle químico
  const [showFullChemistry, setShowFullChemistry] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = sessionStorage.getItem(`aetherscope_chem_open_${currentCoordKey}`);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const toggleChemistry = () => {
    setShowFullChemistry((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(`aetherscope_chem_open_${currentCoordKey}`, JSON.stringify(next));
      } catch (err) {
        console.warn("[AetherScope] Error guardando estado de detalle químico:", err);
      }
      return next;
    });
  };

  // Spectral layer states
  const [activePrimaryFilter, setActivePrimaryFilter] = useState<SpectralFilterOption>(
    LABORATORY_SPECTRAL_FILTERS[0] // DSS2 Optical visible base
  );
  const [activeOverlayFilter, setActiveOverlayFilter] = useState<SpectralFilterOption | null>(
    LABORATORY_SPECTRAL_FILTERS[1] // JWST Deep Infrared overlay default
  );
  const [blendOpacity, setBlendOpacity] = useState<number>(0.65);

  // Filter processing feedback states (Tarea 3 de iteración 1)
  const [, startTransition] = useTransition();
  const [processingFilterId, setProcessingFilterId] = useState<string | null>(null);
  const [isProcessingFilter, setIsProcessingFilter] = useState<boolean>(false);
  const [filterSuccessToast, setFilterSuccessToast] = useState<string | null>(null);

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
              objectType: "Sector cósmico no catalogado",
              ra: raParam,
              dec: decParam,
              constellation: getConstellation(raParam, decParam),
              description: "Sector astronómico sin singularidad indexada en bases de datos maestras.",
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
      const rawStored = localStorage.getItem("aetherscope_observations");
      const parsed = rawStored ? JSON.parse(rawStored) : [];
      const records = Array.isArray(parsed) ? parsed : [];

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
    } catch (err) {
      console.warn("[AetherScope] Error guardando bitácora de observación:", err);
    }
  };

  const handleApplyFilter = (filter: SpectralFilterOption) => {
    if (processingFilterId) return;

    const isPrimary = activePrimaryFilter.id === filter.id;
    const isOverlay = activeOverlayFilter?.id === filter.id;

    setProcessingFilterId(filter.id);
    setIsProcessingFilter(true);

    startTransition(() => {
      if (isPrimary) {
        // Already base layer
      } else if (isOverlay) {
        setActivePrimaryFilter(filter);
        setActiveOverlayFilter(activePrimaryFilter);
      } else {
        setActiveOverlayFilter(filter);
      }

      setTimeout(() => {
        setIsProcessingFilter(false);
        setFilterSuccessToast(`Filtro ${filter.shortLabel} sincronizado`);
        setTimeout(() => {
          setProcessingFilterId(null);
        }, 350);
        setTimeout(() => {
          setFilterSuccessToast(null);
        }, 2200);
      }, 240);
    });
  };

  const primarySurveyProp = useMemo(
    () => spectralFilterToSurvey(activePrimaryFilter),
    [activePrimaryFilter]
  );

  const secondarySurveyProp = useMemo(
    () => (activeOverlayFilter ? spectralFilterToSurvey(activeOverlayFilter) : undefined),
    [activeOverlayFilter]
  );

  const isRegistered =
    identifiedTarget?.source === "local_dossier" || identifiedTarget?.source === "simbad_api";

  const targetPresentation = getObjectTypePresentation(identifiedTarget?.objectType);
  const TargetIcon = targetPresentation.icon;

  // Verificación de datos adicionales para el botón "Ver más químico" (Tarea 2)
  // Solo se muestra si hay más de 3 elementos O si hay fenómenos/conclusiones químicas
  const hasAdditionalChemicalData =
    analysis.detectedElements.length > 3 ||
    Boolean(analysis.dominantPhenomenon) ||
    Boolean(analysis.scientificConclusion);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white select-none flex flex-col font-sans">
      {/* 1. Top Unified Apple Pro Header */}
      <header className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-white/10 bg-[#0a0d14]/90 backdrop-blur-2xl z-40">
        {/* Left: Return Button & Branding */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReturnToExplorer}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-sans font-medium text-white/95 transition-all duration-150 ease-out cursor-pointer shadow-xs active:scale-[0.98]"
            title="Volver al lienzo de exploración libre preservando las coordenadas"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Volver</span>
          </button>

          <div className="w-px h-4 bg-white/15 hidden sm:block" />

          {/* Quick Object Identification Badge in Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <TargetIcon className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide text-white drop-shadow-sm truncate max-w-[180px] sm:max-w-[280px]">
                  {isIdentifying ? "Escaneando coordenadas..." : identifiedTarget?.name || "Sector Cósmico"}
                </span>
                {/* Visual Registration Tag */}
                {!isIdentifying && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border shadow-xs ${
                      isRegistered
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    }`}
                  >
                    {isRegistered ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>✓ REGISTRADO</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>○ NO REGISTRADO</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-sans text-white/50 leading-none">
                {targetPresentation.label} • {constellation}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Captured Coordinates Readout */}
        <div className="hidden lg:flex items-center gap-3 px-3.5 py-1 rounded-full bg-[#0a0d14]/85 border border-white/10 text-xs text-white/65">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="font-mono tabular-nums text-white/95">RA: {coords.raHms}</span>
          <span className="text-white/20">•</span>
          <span className="font-mono tabular-nums text-white/95">Dec: {coords.decDms}</span>
          <span className="text-white/20">•</span>
          <span className="font-mono tabular-nums text-amber-400 font-medium">FOV: {fovInfo.rawText}</span>
        </div>

        {/* Right: Toggle Panel & Status */}
        <div className="flex items-center gap-2 text-xs">
          {filterSuccessToast && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-medium font-mono">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{filterSuccessToast}</span>
            </div>
          )}

          {/* Toggle Panel Button (Header) - Totalmente funcional, accesible y animado */}
          <button
            onClick={toggleSidebar}
            aria-expanded={isSidebarOpen}
            aria-controls="laboratory-analysis-panel"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-white/90 hover:text-white transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-amber-400/50"
            title={isSidebarOpen ? "Ocultar panel de análisis" : "Mostrar panel de análisis"}
          >
            {isSidebarOpen ? (
              <>
                <PanelRightClose className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-medium">Ocultar panel</span>
              </>
            ) : (
              <>
                <PanelRightOpen className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-medium">Mostrar panel</span>
              </>
            )}
          </button>
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

          {/* Shimmer / Transition Overlay on Filter Apply */}
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ease-out z-20 flex items-center justify-center ${
              isProcessingFilter ? "opacity-100 bg-black/35 backdrop-blur-[2px]" : "opacity-0"
            }`}
          >
            {isProcessingFilter && (
              <div className="squircle px-4 py-2 rounded-2xl bg-[#0a0d14]/90 border border-amber-500/30 text-amber-300 flex items-center gap-2.5 shadow-2xl animate-in zoom-in-95 duration-150">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span className="text-xs font-mono tracking-wider font-semibold">
                  SINTETIZANDO CAPA ESPECTRAL...
                </span>
              </div>
            )}
          </div>

          {/* Precision Crosshair Reticle */}
          <PrecisionCrosshair visible={true} fov={fovParam} variant="compact" label="CENTRO DE CAPTURA" />

          {/* Botón flotante lateral para reabrir panel cuando está oculto (Tarea 1: Siempre visible si panel está cerrado) */}
          {!isSidebarOpen && (
            <button
              onClick={toggleSidebar}
              aria-label="Mostrar panel de análisis"
              className="absolute top-4 right-4 z-30 squircle flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#0a0d14]/85 hover:bg-[#0a0d14]/95 border border-amber-500/40 text-amber-300 backdrop-blur-xl shadow-2xl cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-amber-400 animate-in fade-in slide-in-from-right-3 duration-200"
              title="Mostrar panel de análisis astrofísico"
            >
              <PanelRightOpen className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-sans font-semibold">Mostrar panel</span>
            </button>
          )}

          {/* Bottom Floating Spectral Filters & Mixing Dock */}
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
                    const isBeingProcessed = processingFilterId === filter.id;

                    return (
                      <button
                        key={filter.id}
                        disabled={isProcessingFilter}
                        onClick={() => handleApplyFilter(filter)}
                        className={`relative px-3 py-1.5 rounded-xl text-xs font-sans transition-all duration-150 ease-out cursor-pointer flex items-center gap-2 border active:scale-[0.98] disabled:cursor-wait ${
                          isBeingProcessed
                            ? "bg-amber-500/30 border-amber-400 text-amber-200 ring-2 ring-amber-400/40"
                            : isPrimary
                            ? "bg-white/20 border-white/40 text-white/95 font-semibold shadow-xs"
                            : isOverlay
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold"
                            : "bg-white/5 border-white/10 text-white/65 hover:text-white/95 hover:bg-white/10"
                        }`}
                        title={`${filter.name} (${filter.wavelength})`}
                      >
                        {isBeingProcessed ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400 shrink-0" />
                        ) : (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: filter.colorHex }}
                          />
                        )}

                        <span>{filter.shortLabel}</span>

                        {isBeingProcessed ? (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/40 text-amber-100 font-mono animate-pulse">
                            APLICANDO...
                          </span>
                        ) : isPrimary ? (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-white/20 text-white/95 font-mono">
                            BASE
                          </span>
                        ) : isOverlay ? (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/30 text-amber-200 font-mono">
                            CAPA
                          </span>
                        ) : null}
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
        {/* Tarea 1: Transición suave de colapso/expansión (≤250ms) con persistencia en sesión */}
        <aside
          id="laboratory-analysis-panel"
          aria-hidden={!isSidebarOpen}
          className={`shrink-0 h-full border-l border-white/10 bg-[#0a0d14]/92 backdrop-blur-2xl overflow-y-auto p-4 flex flex-col gap-3.5 z-20 transition-all duration-200 ease-in-out ${
            isSidebarOpen
              ? "w-[420px] max-w-full opacity-100 translate-x-0"
              : "w-0 p-0 border-l-0 opacity-0 pointer-events-none translate-x-full overflow-hidden"
          }`}
        >
          {/* Botón superior interno para cerrar panel rápidamente */}
          <div className="flex items-center justify-between pb-1 border-b border-white/10">
            <span className="text-[10px] font-mono tracking-wider text-white/40 uppercase">
              PANEL DE TELEMETRÍA
            </span>
            <button
              onClick={toggleSidebar}
              className="text-[11px] font-sans text-white/50 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              title="Ocultar panel"
            >
              <span>Ocultar</span>
              <PanelRightClose className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>

          {/* ── CARD 1: IDENTIFICACIÓN PRINCIPAL (Hero Card con ≤4 campos clave visibles) ── */}
          <div className="squircle rounded-2xl bg-[#0a0d14]/95 border border-white/15 border-t-white/25 p-4 space-y-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.15)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-[10px] font-sans tracking-wider text-white/40 uppercase flex items-center gap-1.5 font-medium">
                <Database className="w-3 h-3 text-amber-400" />
                <span>IDENTIFICACIÓN CELESTE</span>
              </span>

              {/* Badge Explícito: Color + Texto + Ícono */}
              <span
                className={`text-[10px] font-sans font-bold px-2.5 py-1 rounded-full border shadow-sm flex items-center gap-1.5 ${
                  isRegistered
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/20"
                    : "bg-amber-500/20 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/20"
                }`}
              >
                {isRegistered ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>✓ REGISTRADO</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>○ NO REGISTRADO</span>
                  </>
                )}
              </span>
            </div>

            {isIdentifying ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-xs text-white/50 font-sans">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                <span>Identificando objetivo celeste...</span>
              </div>
            ) : identifiedTarget ? (
              <div className="space-y-3">
                {/* Nombre Prominente + Ícono por Tipo */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <TargetIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-white tracking-wide font-sans leading-tight truncate">
                      {identifiedTarget.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold font-sans px-2 py-0.5 rounded-md border ${targetPresentation.chipBg}`}>
                        <TargetIcon className="w-3 h-3 shrink-0" />
                        <span>{targetPresentation.label}</span>
                      </span>
                      {identifiedTarget.designation && (
                        <span className="text-[11px] font-mono text-amber-400/90 truncate">
                          {identifiedTarget.designation}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grid de 3 Campos Clave */}
                <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10 space-y-0.5">
                    <span className="text-[9px] font-sans text-white/40 block">Distancia:</span>
                    <span className="font-mono tabular-nums font-semibold text-white/95 text-[11px] block truncate">
                      {identifiedTarget.distanceLy || "Fondo cósmico"}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10 space-y-0.5">
                    <span className="text-[9px] font-sans text-white/40 block">Constelación:</span>
                    <span className="font-sans font-semibold text-white/95 text-[11px] block truncate">
                      {constellation}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10 space-y-0.5">
                    <span className="text-[9px] font-sans text-white/40 block">Catálogo:</span>
                    <span className="font-mono font-semibold text-amber-300 text-[11px] block truncate">
                      {identifiedTarget.source === "local_dossier" ? "Dossier Local" : identifiedTarget.source === "simbad_api" ? "SIMBAD (CDS)" : "Deep Sky"}
                    </span>
                  </div>
                </div>

                {/* Síntesis Astrofísica Concisa */}
                <p className="text-xs text-white/75 leading-relaxed font-sans p-2.5 rounded-xl bg-white/[0.02] border border-white/10 line-clamp-3">
                  {identifiedTarget.description}
                </p>

                {/* "Ver más detalles" botón colapsable */}
                <button
                  onClick={() => setShowFullDossier((v) => !v)}
                  className="w-full py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-sans font-medium text-amber-300/90 hover:text-amber-300 flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="text-[11px] flex items-center gap-1.5">
                    <Globe2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{showFullDossier ? "Ocultar detalles técnicos J2000" : "Ver más detalles astrométricos"}</span>
                  </span>
                  {showFullDossier ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {/* Panel expandible con datos secundarios J2000 */}
                {showFullDossier && (
                  <div className="space-y-2.5 pt-1 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-xl border border-white/10 space-y-0.5">
                        <span className="text-[9px] text-white/40 font-sans block">Coordenada RA (J2000):</span>
                        <span className="font-mono text-white/90">{coords.raHms} ({coords.raDegrees})</span>
                      </div>
                      <div className="p-2 rounded-xl border border-white/10 space-y-0.5">
                        <span className="text-[9px] text-white/40 font-sans block">Coordenada Dec (J2000):</span>
                        <span className="font-mono text-white/90">{coords.decDms} ({coords.decDegrees})</span>
                      </div>
                    </div>

                    {identifiedTarget.spectralFeatures && identifiedTarget.spectralFeatures.length > 0 && (
                      <div className="p-2.5 rounded-xl border border-white/10 bg-black/20 space-y-1.5">
                        <div className="text-white/40 uppercase tracking-wider text-[9px] font-sans font-semibold">
                          Firmas observacionales catalogadas:
                        </div>
                        {identifiedTarget.spectralFeatures.map((feat, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-[11px] font-sans text-white/80">
                            <span className="text-amber-400">•</span>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* ── CARD 2: INSPECTOR DE COMPOSICIÓN & QUÍMICA (Tarea 2: con "Ver más detalle químico") ── */}
          <div className="squircle rounded-2xl border border-white/10 p-3.5 space-y-3 bg-[#0a0d14]/60">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white/95 font-sans">
                <Atom className="w-3.5 h-3.5 text-amber-400" />
                <span>COMPOSICIÓN Y RÉGIMEN FÍSICO</span>
              </div>
              <span className="text-[9px] font-mono text-amber-300/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {analysis.detectedElements.length} firmas activas
              </span>
            </div>

            {/* Elements Concentration Bars (Primeros 3 elementos principales) */}
            <div className="space-y-2.5">
              {analysis.detectedElements.slice(0, 3).map((el, i) => (
                <div key={i} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-sans">
                      <span className="font-bold text-white/95">{el.formula}</span>
                      <span className="text-white/40 text-[10px]">({el.name})</span>
                    </div>
                    <span className="font-mono font-semibold text-white/95 tabular-nums">
                      {el.abundancePct}%
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-300 ease-out"
                      style={{ width: `${el.abundancePct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Physical Regime Readout (Térmico + Radiativo) */}
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

            {/* Tarea 2: Control "Ver detalle químico" con persistencia y sin inventar campos */}
            {hasAdditionalChemicalData && (
              <div className="pt-1">
                <button
                  onClick={toggleChemistry}
                  className="w-full py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-sans font-medium text-amber-300/90 hover:text-amber-300 flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="text-[11px] flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>{showFullChemistry ? "Ocultar detalle químico" : "Ver detalle químico y espectral"}</span>
                  </span>
                  {showFullChemistry ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {/* Subpanel químico expandido con abundancias, bandas espectrales y confianza */}
                {showFullChemistry && (
                  <div className="space-y-3 pt-3 animate-in fade-in duration-200">
                    {/* Elementos restantes más allá del top 3 */}
                    {analysis.detectedElements.length > 3 && (
                      <div className="space-y-2.5 p-2.5 rounded-xl bg-black/20 border border-white/10">
                        <span className="text-[9px] font-sans uppercase tracking-wider text-white/40 font-semibold block">
                          Firmas adicionales y bandas espectrales:
                        </span>
                        {analysis.detectedElements.slice(3).map((el, i) => (
                          <div key={i} className="space-y-1 text-xs">
                            <div className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 font-sans">
                                <span className="font-semibold text-white/90">{el.formula}</span>
                                <span className="text-white/40 text-[10px]">({el.name})</span>
                              </div>
                              <span className="font-mono text-white/90 tabular-nums">
                                {el.abundancePct}%
                              </span>
                            </div>
                            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-amber-400/80"
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
                    )}

                    {/* Bandas de detección de los primeros 3 para investigación detallada */}
                    <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 space-y-1 text-[10px] font-mono text-white/50">
                      <div className="text-[9px] font-sans uppercase tracking-wider text-white/40 font-semibold">
                        Metadatos de espectro (Sensores activos):
                      </div>
                      {analysis.detectedElements.slice(0, 3).map((el, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[9.5px]">
                          <span className="text-white/70">{el.formula}:</span>
                          <span className="text-amber-300/80">{el.detectionBand} ({el.confidencePct}% conf.)</span>
                        </div>
                      ))}
                    </div>

                    {/* Fenómeno dominante y conclusión física inferida */}
                    {analysis.dominantPhenomenon && (
                      <div className="p-2.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-1">
                        <span className="text-[9px] font-sans uppercase tracking-wider text-white/40 font-semibold block">
                          Fenómeno dominante inferido:
                        </span>
                        <p className="text-[11px] font-sans text-white/75 leading-relaxed">
                          {analysis.dominantPhenomenon}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── CARD 3: BITÁCORA DE INVESTIGACIÓN (Compacta) ── */}
          <div className="squircle rounded-2xl border border-white/10 p-3.5 space-y-2.5 bg-[#0a0d14]/60 mt-auto">
            <div className="flex items-center justify-between text-xs font-semibold text-white/80 border-b border-white/10 pb-2 font-sans">
              <div className="flex items-center gap-1.5 text-white/95">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>BITÁCORA DE MISIÓN</span>
              </div>
              {noteSaved && (
                <span className="text-[9px] font-sans text-emerald-400 font-semibold animate-pulse">
                  ¡GUARDADO!
                </span>
              )}
            </div>

            <textarea
              value={userObservationNote}
              onChange={(e) => setUserObservationNote(e.target.value)}
              placeholder="Anotar hipótesis u observaciones espectrales..."
              className="w-full h-16 rounded-xl bg-black/40 border border-white/10 p-2 text-xs font-sans text-white/95 placeholder-white/30 focus:outline-hidden focus:border-amber-400/50 resize-none"
            />

            <button
              onClick={handleSaveObservation}
              className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-sans font-medium text-white/95 transition-all duration-150 ease-out cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
              <span>Registrar Observación</span>
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

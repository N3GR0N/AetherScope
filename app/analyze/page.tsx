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
  ArrowUpRight,
  Bookmark,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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

  // Estado persistente del panel lateral (con hidratación segura sin mismatch SSR)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Estado persistente por objeto del detalle químico
  const [showFullChemistry, setShowFullChemistry] = useState<boolean>(false);

  // Sincronizar desde sessionStorage una vez montado en el cliente para evitar mismatch de hidratación SSR
  useEffect(() => {
    try {
      const savedPanel = sessionStorage.getItem("aetherscope_lab_panel_open");
      if (savedPanel !== null) {
        setIsSidebarOpen(JSON.parse(savedPanel));
      }
    } catch {}

    try {
      const savedChem = sessionStorage.getItem(`aetherscope_chem_open_${currentCoordKey}`);
      if (savedChem !== null) {
        setShowFullChemistry(JSON.parse(savedChem));
      }
    } catch {}
  }, [currentCoordKey]);

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

  // Progressive Disclosure: "Ver más detalles astrométricos" de la ficha general
  const [showFullDossier, setShowFullDossier] = useState(false);

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

  // Filter processing feedback states
  const [, startTransition] = useTransition();
  const [processingFilterId, setProcessingFilterId] = useState<string | null>(null);
  const [isProcessingFilter, setIsProcessingFilter] = useState<boolean>(false);

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
        setTimeout(() => {
          setProcessingFilterId(null);
        }, 300);
      }, 200);
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

  // Temperature extraction
  const tempNumbers = analysis.estimatedTemperature.match(/\d+[\.,]?\d*/g) || ["3.000", "8.500"];
  const minTemp = tempNumbers[0] || "3.000";
  const maxTemp = tempNumbers[1] || "8.500";

  // Average confidence calculation for circular gauge
  const averageConfidence = Math.round(
    analysis.detectedElements.reduce((acc, el) => acc + el.confidencePct, 0) /
      (analysis.detectedElements.length || 1)
  );

  // Distance extraction
  const rawDist = identifiedTarget?.distanceLy || "7.000 AL";
  const distanceNumber = rawDist.replace(/[^0-9\.\,]/g, "") || "7.000";

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#101015] text-[#F1F0E1] select-none flex flex-col font-[family-name:var(--font-proto)]">
      {/* ─── 1. TOP UNIFIED TECHNICAL HEADER ─── */}
      <header className="h-14 shrink-0 px-4 md:px-6 flex items-center justify-between bg-[#17171C] border-b border-[#2B2B31] z-40 select-none">
        {/* Left Section: 9-dots + Volver + Telemetry strip */}
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

          <button
            onClick={handleReturnToExplorer}
            className="border border-[#3A3A42] bg-transparent text-[#F1F0E1] text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 hover:bg-[#1A1A1F] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Volver al lienzo de exploración libre preservando las coordenadas"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#F1F0E1]" />
            <span>VOLVER</span>
          </button>

          <div className="w-px h-6 bg-[#2B2B31] mx-1 hidden sm:block" />

          {/* Telemetry Strip */}
          <div className="hidden md:flex items-center gap-4 lg:gap-6 text-[10px] tracking-wider uppercase">
            <div>
              <span className="text-[#9A9A92] block text-[8.5px] leading-tight">OBJETO</span>
              <span className="text-[#F1F0E1] font-semibold text-[11px] block truncate max-w-[120px]">
                {isIdentifying ? "..." : identifiedTarget?.name || "M16"}
              </span>
            </div>
            <div>
              <span className="text-[#9A9A92] block text-[8.5px] leading-tight">RA</span>
              <span className="text-[#F1F0E1] font-medium text-[11px] block tabular-nums">
                {coords.raHms}
              </span>
            </div>
            <div>
              <span className="text-[#9A9A92] block text-[8.5px] leading-tight">DEC</span>
              <span className="text-[#F1F0E1] font-medium text-[11px] block tabular-nums">
                {coords.decDms}
              </span>
            </div>
            <div>
              <span className="text-[#9A9A92] block text-[8.5px] leading-tight">FOV</span>
              <span className="text-[#F1F0E1] font-medium text-[11px] block tabular-nums">
                {fovInfo.rawText}
              </span>
            </div>
            <div>
              <span className="text-[#9A9A92] block text-[8.5px] leading-tight">DISTANCIA</span>
              <span className="text-[#F1F0E1] font-semibold text-[11px] block tabular-nums">
                {distanceNumber} AL
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Registration Chip + Toggle Panel Button */}
        <div className="flex items-center gap-2.5">
          {!isIdentifying && (
            <div
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] flex items-center gap-1.5 border ${
                isRegistered
                  ? "bg-[#506385] text-[#F1F0E1] border-[#506385]"
                  : "bg-[#1A1A1F] text-[#9A9A92] border-[#3A3A42]"
              }`}
            >
              <div className="w-1.5 h-1.5 bg-[#F1F0E1]" />
              <span>{isRegistered ? "REGISTRADO" : "NO REGISTRADO"}</span>
            </div>
          )}

          {/* Toggle Panel Button (Header) */}
          <button
            onClick={toggleSidebar}
            aria-expanded={isSidebarOpen}
            aria-controls="laboratory-analysis-panel"
            className="border border-[#3A3A42] bg-transparent text-[#F1F0E1] text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 hover:bg-[#1A1A1F] transition-colors flex items-center gap-2 cursor-pointer"
            title={isSidebarOpen ? "Ocultar panel" : "Mostrar panel"}
          >
            <div className="w-3.5 h-3.5 border border-[#F1F0E1] flex items-center justify-center p-[1px]">
              <div className={`w-1.5 h-2.5 bg-[#F1F0E1] ml-auto ${isSidebarOpen ? "opacity-100" : "opacity-30"}`} />
            </div>
            <span className="hidden sm:inline">
              {isSidebarOpen ? "OCULTAR PANEL" : "MOSTRAR PANEL"}
            </span>
          </button>
        </div>
      </header>

      {/* ─── 2. MAIN WORKSPACE LAYOUT ─── */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Left Side: Captured Celestial Field Viewport & Spectral Mixer */}
        <div className="relative flex-1 h-full bg-[#101015] flex flex-col overflow-hidden">
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

          {/* Reticle */}
          <PrecisionCrosshair visible={true} fov={fovParam} variant="compact" label="CENTRO DE CAPTURA" />

          {/* Bottom Floating Spectral Filters & Mixing Dock */}
          <div className="absolute bottom-4 left-4 right-4 z-30 pointer-events-none flex justify-center">
            <div className="w-full max-w-4xl bg-[#101015]/95 border border-[#2B2B31] p-3 pointer-events-auto flex flex-col gap-2.5 font-[family-name:var(--font-proto)] select-none">
              {/* Filter Row: 5 Spectral Surveys */}
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em]">
                <span className="text-[#F1F0E1] font-semibold">CAPAS ESPECTRALES</span>
                <span className="text-[#9A9A92]">05 CAPAS</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {LABORATORY_SPECTRAL_FILTERS.map((filter) => {
                  const isPrimary = activePrimaryFilter.id === filter.id;
                  const isOverlay = activeOverlayFilter?.id === filter.id;
                  const isBeingProcessed = processingFilterId === filter.id;

                  return (
                    <button
                      key={filter.id}
                      disabled={isProcessingFilter}
                      onClick={() => handleApplyFilter(filter)}
                      className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-medium flex items-center gap-2 border transition-colors cursor-pointer ${
                        isBeingProcessed
                          ? "bg-[#506385]/50 border-[#506385] text-[#F1F0E1]"
                          : isPrimary
                          ? "bg-[#F1F0E1] text-[#101015] border-[#F1F0E1] font-bold"
                          : isOverlay
                          ? "bg-[#506385] text-[#F1F0E1] border-[#506385] font-bold"
                          : "bg-[#17171C] text-[#F1F0E1] border-[#3A3A42] hover:bg-[#1A1A1F]"
                      }`}
                    >
                      <span>{filter.shortLabel}</span>
                      {isPrimary ? (
                        <span className="px-1 py-0.2 bg-[#101015] text-[#F1F0E1] text-[9px] font-bold">
                          BASE
                        </span>
                      ) : isOverlay ? (
                        <span className="px-1 py-0.2 bg-[#F1F0E1] text-[#101015] text-[9px] font-bold">
                          CAPA
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Spectral Blend Opacity Slider */}
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-[#2B2B31]">
                <span className="text-[10px] uppercase tracking-wider text-[#F1F0E1]">
                  MEZCLA MULTIESPECTRAL ({activeOverlayFilter ? activeOverlayFilter.shortLabel : "SIN CAPA"})
                </span>

                <div className="flex items-center gap-3 flex-1 max-w-sm">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={blendOpacity}
                    onChange={(e) => setBlendOpacity(parseFloat(e.target.value))}
                    className="w-full accent-[#F1F0E1] cursor-pointer h-1.5 bg-[#2B2B31]"
                  />
                  <span className="text-[20px] font-bold text-[#F1F0E1] tabular-nums w-12 text-right">
                    {Math.round(blendOpacity * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 3. RIGHT SIDE: ASTROPHYSICAL ANALYSIS DASHBOARD PANEL ─── */}
        <aside
          id="laboratory-analysis-panel"
          aria-hidden={!isSidebarOpen}
          className={`shrink-0 h-full border-l border-[#2B2B31] bg-[#101015] overflow-y-auto p-2.5 z-20 transition-all duration-200 ease-in-out font-[family-name:var(--font-proto)] ${
            isSidebarOpen
              ? "w-[480px] lg:w-[540px] opacity-100 translate-x-0"
              : "w-0 p-0 border-l-0 opacity-0 pointer-events-none translate-x-full overflow-hidden"
          }`}
        >
          <div className="grid grid-cols-2 gap-2 pb-8">
            {/* ── CARD 1: IDENTIFICACIÓN CELESTE (Full Width) ── */}
            <div className="col-span-2 bg-[#1A1A1F] border border-[#2B2B31] p-3.5 sm:p-4 space-y-2">
              <div className="flex items-center justify-between text-[9.5px] uppercase tracking-[0.16em]">
                <span className="text-[#9A9A92]">IDENTIFICACIÓN CELESTE</span>
                <span className="text-[#F1F0E1]/80 truncate max-w-[200px]">
                  {identifiedTarget?.designation || "M16 / NGC 6611"}
                </span>
              </div>

              {isIdentifying ? (
                <div className="py-4 flex items-center gap-2 text-xs text-[#9A9A92]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#F1F0E1]" />
                  <span>IDENTIFICANDO SECTOR...</span>
                </div>
              ) : (
                <>
                  <h2 className="text-[22px] sm:text-[26px] font-bold text-[#F1F0E1] uppercase tracking-wide leading-tight truncate">
                    {identifiedTarget?.name || "SECTOR CÓSMICO"}
                  </h2>

                  <div>
                    <span className="inline-block border border-[#3A3A42] bg-[#101015]/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#F1F0E1]">
                      {identifiedTarget?.objectType?.toUpperCase() || "NEBULOSA / REGIÓN H II"}
                    </span>
                  </div>

                  {/* Astrometric details toggle bar with circular button */}
                  <div className="pt-2 border-t border-[#2B2B31] flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-[#9A9A92]">
                      DETALLES ASTROMÉTRICOS
                    </span>
                    <button
                      onClick={() => setShowFullDossier((v) => !v)}
                      className="w-8 h-8 rounded-full bg-[#F1F0E1] text-[#101015] flex items-center justify-center hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                      title={showFullDossier ? "Ocultar detalles astrométricos" : "Ver detalles astrométricos"}
                    >
                      <ArrowUpRight className="w-4 h-4 text-[#101015]" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Collapsible Astrometric Details */}
                  {showFullDossier && (
                    <div className="space-y-2 pt-2 border-t border-[#2B2B31] text-[10px] uppercase animate-in fade-in duration-150">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 border border-[#2B2B31] bg-[#101015]">
                          <span className="text-[#9A9A92] block text-[8.5px]">RA J2000</span>
                          <span className="text-[#F1F0E1] tabular-nums font-medium">{coords.raHms}</span>
                        </div>
                        <div className="p-2 border border-[#2B2B31] bg-[#101015]">
                          <span className="text-[#9A9A92] block text-[8.5px]">DEC J2000</span>
                          <span className="text-[#F1F0E1] tabular-nums font-medium">{coords.decDms}</span>
                        </div>
                      </div>

                      {identifiedTarget?.spectralFeatures && identifiedTarget.spectralFeatures.length > 0 && (
                        <div className="p-2 border border-[#2B2B31] bg-[#101015] space-y-1">
                          <span className="text-[#9A9A92] block text-[8.5px]">FIRMAS CATALOGADAS</span>
                          {identifiedTarget.spectralFeatures.map((feat, idx) => (
                            <div key={idx} className="text-[#F1F0E1] text-[9.5px]">
                              • {feat.toUpperCase()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── CARD 2: DISTANCIA (Col 1) ── */}
            <div className="bg-[#506385] border border-[#506385] p-3.5 sm:p-4 flex flex-col justify-between min-h-[140px]">
              <span className="text-[9.5px] uppercase tracking-[0.16em] text-[#F1F0E1]/80 block">
                DISTANCIA
              </span>
              <div className="text-[44px] sm:text-[50px] font-bold text-[#F1F0E1] leading-none tabular-nums my-1">
                {distanceNumber}
              </div>
              <div className="text-[9.5px] uppercase tracking-[0.14em] text-[#F1F0E1]/80">
                / AÑOS LUZ
              </div>
            </div>

            {/* ── CARD 3: CONSTELACIÓN (Col 2) ── */}
            <div className="bg-[#1A1A1F] border border-[#2B2B31] p-3.5 sm:p-4 flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[9.5px] uppercase tracking-[0.16em] text-[#9A9A92] block">
                  CONSTELACIÓN
                </span>
                <div className="text-[22px] sm:text-[25px] font-bold uppercase text-[#F1F0E1] leading-tight my-1 truncate">
                  {constellation.split(" ")[0] || "SERPENS"}
                </div>
                <div className="text-[9.5px] uppercase text-[#9A9A92]">
                  ({constellation.includes(" ") ? constellation.toUpperCase() : "SERPIENTE"})
                </div>
              </div>

              <div className="pt-2 border-t border-[#2B2B31] flex items-center justify-between text-[9.5px] uppercase tracking-wider">
                <span className="text-[#9A9A92]">CATÁLOGO</span>
                <span className="text-[#F1F0E1] font-semibold">
                  {identifiedTarget?.source === "local_dossier"
                    ? "DOSSIER LOCAL"
                    : identifiedTarget?.source === "simbad_api"
                    ? "SIMBAD (CDS)"
                    : "DEEP SKY"}
                </span>
              </div>
            </div>

            {/* ── CARD 4: DESCRIPCIÓN CON ARTE GEOMÉTRICO (Full Width) ── */}
            <div className="col-span-2 bg-[#506385] border border-[#506385] p-3.5 sm:p-4 relative overflow-hidden">
              {/* Concentric arcs and radial lines in cream at 55% */}
              <svg
                aria-hidden="true"
                className="absolute top-0 right-0 w-36 h-36 pointer-events-none"
                viewBox="0 0 144 144"
                fill="none"
              >
                <circle cx="144" cy="0" r="130" stroke="#F1F0E1" strokeOpacity="0.30" strokeWidth="1" />
                <circle cx="144" cy="0" r="95" stroke="#F1F0E1" strokeOpacity="0.45" strokeWidth="1" />
                <circle cx="144" cy="0" r="60" stroke="#F1F0E1" strokeOpacity="0.55" strokeWidth="1" />
                <circle cx="144" cy="0" r="25" stroke="#F1F0E1" strokeOpacity="0.45" strokeWidth="1" />
                <line x1="144" y1="0" x2="30" y2="130" stroke="#F1F0E1" strokeOpacity="0.30" strokeWidth="1" />
                <line x1="144" y1="0" x2="70" y2="140" stroke="#F1F0E1" strokeOpacity="0.35" strokeWidth="1" />
                <line x1="144" y1="0" x2="0" y2="90" stroke="#F1F0E1" strokeOpacity="0.30" strokeWidth="1" />
              </svg>

              <span className="text-[9.5px] uppercase tracking-[0.16em] text-[#F1F0E1]/80 mb-2 block">
                DESCRIPCIÓN
              </span>
              <p className="text-[11px] sm:text-[11.5px] uppercase tracking-wide text-[#F1F0E1] leading-relaxed relative z-10 max-w-[92%]">
                {identifiedTarget?.description?.toUpperCase() ||
                  "COLOSALES COLUMNAS DE GAS MOLECULAR FRÍO Y POLVO DE SILICATOS ESCULPIDAS POR VIENTOS ESTELARES Y RADIACIÓN ULTRAVIOLETA EXTREMA PROCEDENTE DE ESTRELLAS MASIVAS JÓVENES."}
              </p>
            </div>

            {/* ── CARD 5: COMPOSICIÓN Y RÉGIMEN FÍSICO (Full Width) ── */}
            <div className="col-span-2 bg-[#1A1A1F] border border-[#2B2B31] p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between text-[9.5px] uppercase tracking-[0.16em]">
                <span className="text-[#9A9A92]">COMPOSICIÓN Y RÉGIMEN FÍSICO</span>
                <span className="text-[#9A9A92]">{analysis.detectedElements.length} FIRMAS ACTIVAS</span>
              </div>

              {/* Top half: Hero metric + 3-bar vertical histogram */}
              <div className="flex items-end justify-between gap-4 pt-1">
                <div>
                  <div className="text-[44px] sm:text-[52px] font-bold text-[#F1F0E1] leading-none tabular-nums">
                    {analysis.detectedElements[0]?.abundancePct || 85}
                    <span className="text-[26px] font-normal">%</span>
                  </div>
                  <div className="text-[9.5px] uppercase tracking-wider text-[#9A9A92] mt-1">
                    {analysis.detectedElements[0]?.formula?.split(" ")[0]?.toUpperCase() || "H-ALFA"} · DOMINANTE
                  </div>
                </div>

                {/* 3 Vertical Bars Histogram */}
                <div className="flex items-end gap-3 h-24 pb-1">
                  {/* Bar 1: Dominant in --accent */}
                  <div className="flex flex-col items-center gap-1 w-10">
                    <span className="text-[9.5px] text-[#F1F0E1] tabular-nums font-bold">
                      {analysis.detectedElements[0]?.abundancePct || 85}%
                    </span>
                    <div
                      className="w-full bg-[#506385] transition-all duration-300"
                      style={{ height: `${(analysis.detectedElements[0]?.abundancePct || 85) * 0.7}px` }}
                    />
                    <span className="text-[8.5px] text-[#9A9A92] uppercase mt-0.5 truncate max-w-full">
                      {analysis.detectedElements[0]?.formula?.split(" ")[0] || "H-ALFA"}
                    </span>
                  </div>

                  {/* Bar 2: in --beige */}
                  <div className="flex flex-col items-center gap-1 w-10">
                    <span className="text-[9.5px] text-[#F1F0E1] tabular-nums font-bold">
                      {analysis.detectedElements[1]?.abundancePct || 76}%
                    </span>
                    <div
                      className="w-full bg-[#B7B6A8] transition-all duration-300"
                      style={{ height: `${(analysis.detectedElements[1]?.abundancePct || 76) * 0.7}px` }}
                    />
                    <span className="text-[8.5px] text-[#9A9A92] uppercase mt-0.5 truncate max-w-full">
                      {analysis.detectedElements[1]?.formula?.split(" ")[0] || "FOTO."}
                    </span>
                  </div>

                  {/* Bar 3: in --beige */}
                  <div className="flex flex-col items-center gap-1 w-10">
                    <span className="text-[9.5px] text-[#F1F0E1] tabular-nums font-bold">
                      {analysis.detectedElements[2]?.abundancePct || 48}%
                    </span>
                    <div
                      className="w-full bg-[#B7B6A8] transition-all duration-300"
                      style={{ height: `${(analysis.detectedElements[2]?.abundancePct || 48) * 0.7}px` }}
                    />
                    <span className="text-[8.5px] text-[#9A9A92] uppercase mt-0.5 truncate max-w-full">
                      {analysis.detectedElements[2]?.formula?.split(" ")[0] || "[O III]"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom half: Element summary rows */}
              <div className="space-y-1.5 pt-2 border-t border-[#2B2B31]">
                {analysis.detectedElements.slice(0, 3).map((el, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1 text-[11px] border-b border-[#2B2B31]/50 last:border-b-0"
                  >
                    <span className="text-[#F1F0E1] font-medium">{el.formula}</span>
                    <span className="text-[#9A9A92] uppercase text-[9.5px]">{el.name.toUpperCase()}</span>
                  </div>
                ))}
              </div>

              {/* Progressive disclosure toggle */}
              {analysis.detectedElements.length > 3 && (
                <div className="pt-1">
                  <button
                    onClick={toggleChemistry}
                    className="w-full py-1.5 px-3 bg-[#101015] border border-[#3A3A42] text-[10px] uppercase text-[#F1F0E1] flex items-center justify-between hover:bg-[#17171C] transition-colors cursor-pointer"
                  >
                    <span>{showFullChemistry ? "OCULTAR DETALLE QUÍMICO" : "VER DETALLE QUÍMICO Y BANDAS"}</span>
                    {showFullChemistry ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showFullChemistry && (
                    <div className="space-y-1.5 pt-2 animate-in fade-in duration-150">
                      {analysis.detectedElements.slice(3).map((el, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-1 text-[10px] uppercase border-b border-[#2B2B31]"
                        >
                          <span className="text-[#F1F0E1]">{el.formula}</span>
                          <span className="text-[#9A9A92]">{el.abundancePct}% · {el.detectionBand.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── CARD 6: RÉGIMEN TÉRMICO (Col 1) ── */}
            <div className="bg-[#1A1A1F] border border-[#2B2B31] p-3.5 sm:p-4 flex flex-col justify-between min-h-[140px]">
              <span className="text-[9.5px] uppercase tracking-[0.16em] text-[#9A9A92] block">
                RÉGIMEN TÉRMICO
              </span>
              <div className="space-y-2.5 my-1">
                <div>
                  <div className="text-[26px] sm:text-[30px] font-bold text-[#F1F0E1] leading-none tabular-nums">
                    {minTemp}
                  </div>
                  <div className="text-[8.5px] uppercase tracking-[0.14em] text-[#9A9A92] mt-0.5">
                    MÍN / K
                  </div>
                </div>
                <div className="pt-2 border-t border-[#2B2B31]">
                  <div className="text-[26px] sm:text-[30px] font-bold text-[#F1F0E1] leading-none tabular-nums">
                    {maxTemp}
                  </div>
                  <div className="text-[8.5px] uppercase tracking-[0.14em] text-[#9A9A92] mt-0.5">
                    MÁX / K
                  </div>
                </div>
              </div>
            </div>

            {/* ── CARD 7: CAMPO RADIATIVO EN --BEIGE (Col 2) ── */}
            <div className="bg-[#B7B6A8] border border-[#B7B6A8] p-3.5 sm:p-4 flex flex-col justify-between min-h-[140px] text-[#101015]">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] uppercase tracking-[0.16em] text-[#101015]/75 font-semibold">
                  CAMPO RADIATIVO
                </span>
                <div className="w-7 h-7 rounded-full bg-[#101015] text-[#F1F0E1] flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-[#F1F0E1]" strokeWidth={2.5} />
                </div>
              </div>

              <div className="text-[22px] sm:text-[25px] font-bold uppercase tracking-tight text-[#101015] leading-none my-2">
                {analysis.radiationFieldIntensity.toUpperCase()}
              </div>

              {/* 5-segment meter */}
              <div className="grid grid-cols-5 gap-1 pt-1">
                {[1, 2, 3, 4, 5].map((seg) => {
                  const activeCount =
                    analysis.radiationFieldIntensity === "Extrema"
                      ? 5
                      : analysis.radiationFieldIntensity === "Alta"
                      ? 4
                      : analysis.radiationFieldIntensity === "Moderada"
                      ? 3
                      : 1;
                  const isFilled = seg <= activeCount;
                  return (
                    <div
                      key={seg}
                      className={`h-2 ${isFilled ? "bg-[#101015]" : "bg-[#101015]/20"}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* ── CARD 8: CONFIANZA PROMEDIO (Col 1) ── */}
            <div className="bg-[#1A1A1F] border border-[#2B2B31] p-3.5 sm:p-4 flex flex-col items-center justify-center min-h-[140px]">
              {/* Circular gauge ring in --accent */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="#2B2B31"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="#506385"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={213.6}
                    strokeDashoffset={213.6 - (213.6 * averageConfidence) / 100}
                    strokeLinecap="butt"
                  />
                </svg>
                <span className="absolute text-[24px] font-bold text-[#F1F0E1] tabular-nums">
                  {averageConfidence}
                </span>
              </div>
              <span className="text-[9px] uppercase tracking-[0.16em] text-[#9A9A92] mt-2">
                CONF. PROMEDIO
              </span>
            </div>

            {/* ── CARD 9: FENÓMENO DOMINANTE INFERIDO (Col 2) ── */}
            <div className="bg-[#1A1A1F] border border-[#2B2B31] p-3.5 sm:p-4 flex flex-col justify-between min-h-[140px]">
              <span className="text-[9px] uppercase tracking-[0.14em] text-[#9A9A92] block leading-tight">
                FENÓMENO DOMINANTE INFERIDO
              </span>
              <p className="text-[11px] uppercase text-[#F1F0E1] leading-relaxed my-auto font-medium">
                {analysis.dominantPhenomenon.toUpperCase()}
              </p>
            </div>

            {/* ── CARD 10: METADATOS DE ESPECTRO (Full Width) ── */}
            <div className="col-span-2 bg-[#1A1A1F] border border-[#2B2B31] p-3.5 sm:p-4 space-y-2.5">
              <div className="flex items-center justify-between text-[9.5px] uppercase tracking-[0.16em]">
                <span className="text-[#9A9A92]">METADATOS DE ESPECTRO</span>
                <span className="text-[#9A9A92]">SENSORES ACTIVOS</span>
              </div>

              <div className="space-y-1.5 pt-1">
                {analysis.detectedElements.slice(0, 3).map((el, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 border-t border-[#2B2B31]"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-[10px] text-[#9A9A92] font-mono">
                        0{idx + 1}
                      </span>
                      <div>
                        <div className="text-[12px] text-[#F1F0E1] font-medium">
                          {el.formula}
                        </div>
                        <div className="text-[9px] uppercase text-[#9A9A92]">
                          {el.detectionBand.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="text-[20px] font-bold text-[#F1F0E1] tabular-nums">
                      {el.confidencePct}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CARD 11: BITÁCORA DE MISIÓN (Full Width) ── */}
            <div className="col-span-2 bg-[#1A1A1F] border border-[#2B2B31] p-3.5 sm:p-4 space-y-2.5">
              <div className="flex items-center justify-between text-[9.5px] uppercase tracking-[0.16em]">
                <span className="text-[#9A9A92]">BITÁCORA DE MISIÓN</span>
                {noteSaved && (
                  <span className="text-[#F1F0E1] font-bold animate-pulse">
                    ¡REGISTRO GUARDADO!
                  </span>
                )}
              </div>

              <textarea
                value={userObservationNote}
                onChange={(e) => setUserObservationNote(e.target.value)}
                placeholder="ANOTAR HIPÓTESIS U OBSERVACIONES ESPECTRALES..."
                className="w-full h-16 bg-[#101015] border border-[#2B2B31] p-2 text-xs uppercase text-[#F1F0E1] placeholder-[#9A9A92]/50 focus:outline-hidden focus:border-[#506385] resize-none"
              />

              <button
                onClick={handleSaveObservation}
                className="w-full py-2 bg-[#506385] text-[#F1F0E1] text-[11px] uppercase tracking-[0.14em] font-semibold transition-colors flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#F1F0E1]" />
                <span>REGISTRAR OBSERVACIÓN</span>
              </button>
            </div>
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
          <div className="w-screen h-screen bg-[#101015] flex flex-col items-center justify-center text-[#F1F0E1] space-y-4 font-[family-name:var(--font-proto)]">
            <div className="w-10 h-10 border-2 border-[#506385] border-t-[#F1F0E1] animate-spin" />
            <p className="text-xs uppercase tracking-[0.16em] text-[#9A9A92]">
              INICIANDO LABORATORIO ASTROFÍSICO...
            </p>
          </div>
        }
      >
        <LaboratoryContent />
      </Suspense>
    </SpaceProvider>
  );
}

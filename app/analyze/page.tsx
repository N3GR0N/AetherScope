"use client";

import { Suspense, useState, useMemo, useEffect, useTransition, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SpaceCanvas from "@/components/space-canvas/SpaceCanvas.client";
import { SpaceProvider } from "@/context/SpaceContext";
import PrecisionCrosshair from "@/components/hud/PrecisionCrosshair";
import {
  identifyCelestialCapture,
  matchLocalDossierCapture,
  clearCrossMatchCache,
  type CaptureMatch,
  type Candidate,
  type MatchedCelestialObject,
} from "@/lib/astronomy/crossmatch";
import { useCdsRecovery } from "@/lib/hooks/useCdsRecovery";
import type { Capture } from "@/lib/astronomy/footprint";
import {
  LABORATORY_SPECTRAL_FILTERS,
  spectralFilterToSurvey,
  runAstrophysicalAnalysis,
  type SpectralFilterOption,
} from "@/lib/astronomy/analysis";
import Link from "next/link";
import { formatCoordinates, formatFov, getConstellation, sanitizeCoordinateParams } from "@/lib/astronomy/coordinates";
import { getNotesRepository, type MissionNote } from "@/lib/notes";
import { useAuth } from "@/components/auth/AuthProvider";
import AuthModal from "@/components/auth/AuthModal";
import CdsDownCard from "@/components/hud/CdsDownCard";
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal";
import { useIsMounted } from "@/lib/hooks/useIsMounted";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  User,
} from "lucide-react";

function LaboratoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read angular coordinates and field of view with high precision
  const rawRa = searchParams.get("ra");
  const rawDec = searchParams.get("dec");
  const rawFov = searchParams.get("fov");

  const { ra: raParam, dec: decParam, fov: fovParam } = sanitizeCoordinateParams(
    rawRa,
    rawDec,
    rawFov
  );

  // Clave única del objeto/sector observado
  const currentCoordKey = `${raParam.toFixed(5)},${decParam.toFixed(5)}`;

  // Captura geométrica actual
  const currentCapture: Capture = useMemo(
    () => ({
      raDeg: raParam,
      decDeg: decParam,
      radiusDeg: fovParam / 2,
    }),
    [raParam, decParam, fovParam]
  );

  // Hook canónico de montaje de cliente para evitar discrepancias de hidratación SSR
  const isMounted = useIsMounted();

  // Estado del panel lateral (abierto por defecto en escritorio)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Estado del detalle químico extendido (cerrado por defecto para progressive disclosure)
  const [showFullChemistry, setShowFullChemistry] = useState<boolean>(false);

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

  // Target identification state mediante motor de Footprint (A3 / A4)
  const [matchState, setMatchState] = useState<{
    match: CaptureMatch | null;
    loading: boolean;
    queryKey: string;
  }>(() => {
    const local = matchLocalDossierCapture({
      raDeg: raParam,
      decDeg: decParam,
      radiusDeg: fovParam / 2,
    });
    if (local.state !== "none") {
      return {
        match: local,
        loading: false,
        queryKey: currentCoordKey,
      };
    }
    return {
      match: null,
      loading: true,
      queryKey: currentCoordKey,
    };
  });

  // Selección manual de candidato desde el cono cuando state es 'none'
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [prevCoordKey, setPrevCoordKey] = useState(currentCoordKey);
  const [crossMatchVersion, setCrossMatchVersion] = useState<number>(0);

  // Al recuperarse el CDS, limpiar caché y relanzar crossmatch automáticamente
  const { cdsState, lastCheckedTime } = useCdsRecovery({
    onRecovered: () => {
      console.info("[AetherScope] CDS recuperado. Relanzando crossmatch en /analyze...");
      clearCrossMatchCache();
      setCrossMatchVersion((v) => v + 1);
    },
  });

  // Resetear candidato manual si cambian las coordenadas (patrón oficial de React sin efecto)
  if (prevCoordKey !== currentCoordKey) {
    setPrevCoordKey(currentCoordKey);
    setSelectedCandidate(null);
  }

  // Ejecutar cross-match híbrido con clasificación por extensión angular
  useEffect(() => {
    let cancelled = false;

    const runCrossMatch = async () => {
      try {
        const result = await identifyCelestialCapture(currentCapture);
        if (!cancelled) {
          setMatchState({
            match: result,
            loading: false,
            queryKey: currentCoordKey,
          });
        }
      } catch (err) {
        console.warn("[AetherScope] Error en cross-match híbrido:", err);
        if (!cancelled) {
          setMatchState({
            match: {
              state: "none",
              separationDeg: Infinity,
              normalizedRadius: Infinity,
              partial: false,
              candidates: [],
              source: "none",
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
  }, [currentCapture, currentCoordKey, crossMatchVersion]);

  const isIdentifying = matchState.loading || matchState.queryKey !== currentCoordKey;
  const currentMatch = matchState.match;

  // Estado activo de correspondencia espacial ('inside' | 'edge' | 'none')
  const activeState = selectedCandidate ? "inside" : (currentMatch?.state ?? "none");
  const isPartial = activeState === "edge" || (currentMatch?.partial ?? false);

  // Objeto resuelto
  const identifiedTarget: MatchedCelestialObject | null = useMemo(() => {
    if (selectedCandidate) {
      return {
        id: selectedCandidate.id,
        name: selectedCandidate.name,
        designation: selectedCandidate.designation,
        objectType: selectedCandidate.objectType,
        ra: selectedCandidate.raDeg,
        dec: selectedCandidate.decDeg,
        distanceLy: selectedCandidate.distanceLy,
        constellation: getConstellation(selectedCandidate.raDeg, selectedCandidate.decDeg),
        description:
          selectedCandidate.description ||
          "Objeto seleccionado manualmente desde los candidatos del cono de búsqueda.",
        spectralFeatures: ["Selección manual de candidato en cono", "Astrometría ICRS"],
        majorDiameterArcmin: selectedCandidate.majorDiameterArcmin,
        minorDiameterArcmin: selectedCandidate.minorDiameterArcmin,
        positionAngleDeg: selectedCandidate.positionAngleDeg,
        sizeSource: selectedCandidate.sizeSource,
        source: selectedCandidate.source === "dossier" ? "local_dossier" : "simbad_api",
      };
    }
    if (currentMatch?.object && (currentMatch.state === "inside" || currentMatch.state === "edge")) {
      return currentMatch.object;
    }
    return null;
  }, [selectedCandidate, currentMatch]);

  // Si state es 'none', NO ejecutar la inferencia atribuida a un objeto (pasa null)
  const targetForAnalysis = activeState === "none" ? null : identifiedTarget;

  // Run dynamic chemical/physical analysis based on active filters & identified target
  const activeFilterIds = useMemo(() => {
    const ids = [activePrimaryFilter.id];
    if (activeOverlayFilter && blendOpacity > 0.05) {
      ids.push(activeOverlayFilter.id);
    }
    return ids;
  }, [activePrimaryFilter, activeOverlayFilter, blendOpacity]);

  const analysis = useMemo(
    () => runAstrophysicalAnalysis(activeFilterIds, targetForAnalysis, blendOpacity),
    [activeFilterIds, targetForAnalysis, blendOpacity]
  );

  const coords = formatCoordinates(raParam, decParam);
  const fovInfo = formatFov(fovParam);
  const constellation = identifiedTarget?.constellation || getConstellation(raParam, decParam);

  // Return to free explorer preserving exact coordinates
  const handleReturnToExplorer = () => {
    router.push(`/?ra=${raParam.toFixed(5)}&dec=${decParam.toFixed(5)}&fov=${fovParam.toFixed(4)}`);
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

  // ─── PARTE B: BITÁCORA DE MISIÓN DESACOPLADA ───
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const isSupabaseBackend = process.env.NEXT_PUBLIC_NOTES_BACKEND === "supabase";
  const notesRepo = useMemo(() => getNotesRepository(), []);
  const [missionNotes, setMissionNotes] = useState<MissionNote[]>([]);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const [newNoteBody, setNewNoteBody] = useState<string>("");
  const [noteSaved, setNoteSaved] = useState<boolean>(false);
  const [noteSaving, setNoteSaving] = useState<boolean>(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  // Carga reactiva de notas para la captura actual
  useEffect(() => {
    let active = true;
    if (!currentMatch) return;

    notesRepo
      .listForCapture(currentCapture, currentMatch)
      .then((list) => {
        if (active) {
          setMissionNotes(list);
        }
      })
      .catch((err: unknown) => {
        console.warn("[AetherScope] Error cargando notas de bitácora:", err);
      });

    // Sincronización entre pestañas en tiempo real mediante evento "storage"
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "aetherscope:notes:v1") {
        setNotesRefreshKey((k) => k + 1);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [notesRepo, currentCapture, currentMatch, notesRefreshKey, user]);

  const handleSaveNote = async () => {
    if (!newNoteBody.trim() || noteSaving) return;
    setNotesError(null);

    if (isSupabaseBackend && !user) {
      setNotesError("DEBES INICIAR SESIÓN CON TU CUENTA DE OPERADOR PARA GUARDAR NOTAS EN LA BASE DE DATOS.");
      setAuthModalOpen(true);
      return;
    }

    setNoteSaving(true);
    try {
      await notesRepo.create({
        objectId: identifiedTarget?.id || null,
        objectName:
          identifiedTarget?.name || (activeState === "none" ? "Sector de Cielo Profundo" : null),
        raDeg: raParam,
        decDeg: decParam,
        radiusDeg: fovParam / 2,
        body: newNoteBody,
      });

      setNewNoteBody("");
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2500);
      setNotesRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error guardando observación";
      setNotesError(message);
    } finally {
      setNoteSaving(false);
    }
  };

  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: "note" | "all";
    title: string;
    description: string;
    targetName?: string;
    noteId?: string;
    isProcessing?: boolean;
  }>({
    isOpen: false,
    type: "note",
    title: "",
    description: "",
  });

  const requestDeleteNote = (note: MissionNote) => {
    const snippet = note.body.length > 55 ? `${note.body.slice(0, 55)}...` : note.body;
    setDeleteModalState({
      isOpen: true,
      type: "note",
      title: "ELIMINAR OBSERVACIÓN INDIVIDUAL",
      description: "¿Deseas eliminar permanentemente esta observación de tu bitácora?",
      targetName: `"${snippet}"`,
      noteId: note.id,
      isProcessing: false,
    });
  };

  const requestDeleteAllCaptureNotes = () => {
    if (!missionNotes.length) return;
    const name = currentMatch?.object?.name || "este sector astronómico";
    setDeleteModalState({
      isOpen: true,
      type: "all",
      title: "PURGAR OBSERVACIONES DEL SECTOR",
      description: `¿Confirmas la eliminación definitiva de las ${missionNotes.length} observaciones registradas en ${name}?`,
      targetName: name,
      isProcessing: false,
    });
  };

  const handleConfirmDelete = async () => {
    setDeleteModalState((s) => ({ ...s, isProcessing: true }));
    try {
      if (deleteModalState.type === "note" && deleteModalState.noteId) {
        await notesRepo.remove(deleteModalState.noteId);
      } else if (deleteModalState.type === "all" && missionNotes.length) {
        await notesRepo.removeMany(missionNotes.map((n) => n.id));
      }
      setNotesRefreshKey((k) => k + 1);
      setDeleteModalState((s) => ({ ...s, isOpen: false, isProcessing: false }));
    } catch (err: unknown) {
      console.warn("[AetherScope] Error eliminando notas:", err);
      setDeleteModalState((s) => ({ ...s, isProcessing: false }));
    }
  };

  const handleExportNotes = async () => {
    try {
      const json = await notesRepo.exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aetherscope-bitacora-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("[AetherScope] Error exportando bitácora:", err);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotesError(null);

    try {
      const text = await file.text();
      const result = await notesRepo.importAll(text);
      setNotesRefreshKey((k) => k + 1);
      alert(`Importación completada: ${result.importedCount} notas importadas, ${result.skippedCount} omitidas/existentes.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error importando notas";
      setNotesError(message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Temperature extraction
  const tempNumbers = analysis.estimatedTemperature.match(/\d+[\.,]?\d*/g) || ["3.000", "8.500"];
  const minTemp = tempNumbers[0] || "3.000";
  const maxTemp = tempNumbers[1] || "8.500";

  // Average confidence calculation for circular gauge
  const averageConfidence = Math.round(
    analysis.detectedElements.reduce((acc, el) => acc + el.confidencePct, 0) /
      (analysis.detectedElements.length || 1)
  );

  // Formateo y extracción científica de distancia
  const distanceInfo = useMemo(() => {
    // 1. Campo sin objeto identificado (fondo cósmico verdadero)
    if (!identifiedTarget) {
      return {
        value: "FONDO",
        unit: "/ CÓSMICO PROFUNDO",
        isKnown: false,
        isUnreliable: false,
        fullText: "FONDO CÓSMICO",
      };
    }

    // 2. Objeto identificado pero sin medición de paralaje o distancia en CDS
    if (!identifiedTarget.distanceLy) {
      return {
        value: "NO CALCULABLE",
        unit: "/ MEDICIÓN NO ACOTADA",
        isKnown: false,
        isUnreliable: true,
        fullText: "NO CALCULABLE DE FORMA FIABLE",
      };
    }

    // 3. Objeto con distancia conocida o calculada por paralaje trigonométrico
    const raw = identifiedTarget.distanceLy;
    const isMillions = raw.toLowerCase().includes("millon") || raw.toLowerCase().includes("millón");
    const numMatch = raw.match(/[\d]+([.,][\d]+)?/);
    const num = numMatch ? numMatch[0] : "";

    if (!num) {
      return {
        value: "NO CALCULABLE",
        unit: "/ MEDICIÓN NO ACOTADA",
        isKnown: false,
        isUnreliable: true,
        fullText: raw || "NO CALCULABLE DE FORMA FIABLE",
      };
    }

    return {
      value: num,
      unit: isMillions ? "/ MILLONES A.L." : "/ AÑOS LUZ",
      isKnown: true,
      isUnreliable: false,
      fullText: raw,
    };
  }, [identifiedTarget]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)] select-none flex flex-col font-[family-name:var(--font-sans)]">
      {/* ─── 1. TOP UNIFIED TECHNICAL HEADER ─── */}
      <header className="h-16 shrink-0 px-4 md:px-6 flex items-center justify-between bg-[var(--surface-1)] border-b border-[var(--border)] z-40 select-none">
        {/* Left Section: Volver + Telemetry strip */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleReturnToExplorer}
            className="rounded-full bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-1)] border border-[var(--border)] text-[12px] font-medium px-4 py-1.5 min-h-[40px] transition-colors flex items-center gap-2 cursor-pointer shrink-0"
            title="Volver al lienzo de exploración libre preservando las coordenadas"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Volver al mapa</span>
          </button>

          <div className="w-px h-6 bg-[var(--border)] mx-1 hidden md:block" />

          {/* Telemetry Strip */}
          <div className="hidden md:flex items-center gap-5 lg:gap-6 text-[12px] text-[var(--text-muted)]">
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block leading-tight">OBJETO</span>
              <span className="text-[var(--text)] font-semibold text-[13px] block truncate max-w-[150px]">
                {isIdentifying
                  ? "..."
                  : identifiedTarget?.name || (activeState === "unavailable" ? "Sector no resuelto" : activeState === "none" ? "Campo no catalogado" : "Sector")}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block leading-tight">RA</span>
              <span className="text-[var(--text)] font-mono tabular-nums text-[12px] block">
                {coords.raHms}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block leading-tight">DEC</span>
              <span className="text-[var(--text)] font-mono tabular-nums text-[12px] block">
                {coords.decDms}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block leading-tight">FOV</span>
              <span className="text-[var(--text)] font-mono tabular-nums text-[12px] block">
                {fovInfo.rawText}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block leading-tight">DISTANCIA</span>
              <span className="text-[var(--text)] font-mono tabular-nums text-[12px] block truncate max-w-[140px] lg:max-w-[170px]" title={distanceInfo.fullText}>
                {distanceInfo.fullText}
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Registration / Edge Chip + Toggle Panel Button */}
        <div className="flex items-center gap-2.5">
          {!isIdentifying && (
            <div
              className={`hidden sm:flex px-3 py-1 text-[11px] font-medium rounded-full items-center gap-2 border shrink-0 min-h-[36px] ${
                activeState === "inside"
                  ? "bg-[var(--surface-2)] text-[var(--accent)] border-[var(--accent)]"
                  : activeState === "edge"
                  ? "bg-[var(--surface-2)] text-[var(--accent)] border-[var(--accent)]"
                  : "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${activeState === "none" ? "bg-[var(--text-muted)]" : "bg-[var(--accent)]"}`} />
              <span className="truncate max-w-[130px] lg:max-w-none">
                {activeState === "inside"
                  ? "Objetivo registrado"
                  : activeState === "edge"
                  ? `Borde de ${identifiedTarget?.name || "objeto"}`
                  : "Campo no catalogado"}
              </span>
            </div>
          )}

          {/* Toggle Panel Button (Header) - Control único */}
          <button
            onClick={toggleSidebar}
            aria-expanded={isSidebarOpen}
            aria-controls="laboratory-analysis-panel"
            className="rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text)] text-[12px] font-medium px-4 py-1.5 min-h-[40px] transition-colors flex items-center gap-2 cursor-pointer shrink-0"
            title={isSidebarOpen ? "Ocultar panel" : "Mostrar panel"}
          >
            <span>{isSidebarOpen ? "Ocultar panel" : "Mostrar panel"}</span>
          </button>

          {/* Profile Navigation Button (if authenticated and mounted) */}
          {isMounted && user ? (
            <Link
              href="/profile"
              className="rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text)] text-[12px] font-medium px-3.5 py-1.5 min-h-[40px] transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Ir a Mi Perfil y Bitácora Personal"
            >
              <User className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="hidden lg:inline">Mi perfil</span>
            </Link>
          ) : null}

          {/* Operator Auth Status / Access Button */}
          <button
            onClick={() => setAuthModalOpen(true)}
            className="rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text)] text-[12px] font-medium px-3.5 py-1.5 min-h-[40px] transition-colors cursor-pointer flex items-center gap-2 shrink-0"
            title={isMounted && user ? `Operador: ${user.email} (Haz clic para gestionar sesión)` : "Iniciar sesión o registrarse"}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isMounted && user ? "bg-[var(--ok)]" : "bg-[var(--text-muted)]"
              }`}
            />
            <span className="truncate max-w-[80px] sm:max-w-[120px]">
              {isMounted && user ? user.email.split("@")[0] : "Acceso"}
            </span>
          </button>
        </div>
      </header>

      {/* ─── 2. MAIN WORKSPACE LAYOUT ─── */}
      <div className="relative flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        {/* Left Side: Captured Celestial Field Viewport & Spectral Mixer */}
        <div className={`relative w-full shrink-0 md:flex-1 md:h-full bg-[#101015] flex flex-col ${cdsState === "down" ? "items-center justify-center p-4 min-h-[260px]" : ""}`}>
          {cdsState === "down" ? (
            <CdsDownCard lastCheckedTime={lastCheckedTime} />
          ) : (
            <>
              {/* Aladin Lite WebGL Canvas locked on captured coordinates */}
              <div className="relative w-full h-[260px] md:h-full md:absolute md:inset-0 overflow-hidden">
                <SpaceCanvas
                  containerId="aladin-analyze-div"
                  initialRa={raParam}
                  initialDec={decParam}
                  initialFov={fovParam}
                  primarySurvey={primarySurveyProp}
                  secondarySurvey={secondarySurveyProp}
                  blendOpacity={blendOpacity}
                />
                {/* Reticle */}
                <PrecisionCrosshair visible={true} fov={fovParam} variant="compact" label="CENTRO DE CAPTURA" />
              </div>

              {/* Spectral Filters & Mixing Dock: Docked under canvas on mobile, floating on desktop */}
              <div className="w-full z-30 p-3 bg-[var(--surface-1)] border-b border-[var(--border)] md:bg-transparent md:border-b-0 md:p-0 md:absolute md:bottom-6 md:left-6 md:right-6 md:pointer-events-none md:flex md:justify-center">
                <div className="w-full max-w-4xl glass-panel md:glass-panel rounded-[20px] p-3.5 sm:p-4 pointer-events-auto flex flex-col gap-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)] select-none">
                  {/* Filter Row: 5 Spectral Surveys */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium">
                    <span className="text-[var(--text)] font-semibold">Capas Espectrales</span>
                    <span className="font-mono text-[11px]">05 capas disponibles</span>
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
                          className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-2 transition-all cursor-pointer min-h-[36px] ${
                            isBeingProcessed
                              ? "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] opacity-60"
                              : isPrimary
                              ? "bg-[var(--accent)] text-[var(--on-accent)] font-semibold"
                              : isOverlay
                              ? "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--accent)] font-semibold"
                              : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]"
                          }`}
                        >
                          <span>{filter.shortLabel}</span>
                          {isPrimary ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-[var(--on-accent)] text-[var(--accent)] text-[9px] font-bold">
                              BASE
                            </span>
                          ) : isOverlay ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[9px] font-bold">
                              CAPA
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {/* Spectral Blend Opacity Slider */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 pt-2.5 border-t border-[var(--border)]">
                    <span className="text-[12px] text-[var(--text)] font-medium">
                      Mezcla Multiespectral ({activeOverlayFilter ? activeOverlayFilter.shortLabel : "Sin capa"})
                    </span>

                    <div className="flex items-center gap-3 w-full sm:flex-1 sm:max-w-sm">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.02"
                        value={blendOpacity}
                        onChange={(e) => setBlendOpacity(parseFloat(e.target.value))}
                        className="w-full accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--surface-2)] rounded-full"
                      />
                      <span className="text-[15px] font-bold text-[var(--accent)] font-mono tabular-nums w-12 text-right">
                        {Math.round(blendOpacity * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ─── 3. RIGHT SIDE: ASTROPHYSICAL ANALYSIS DASHBOARD PANEL ─── */}
        <aside
          id="laboratory-analysis-panel"
          aria-hidden={!isSidebarOpen}
          className={`w-full p-3.5 sm:p-5 md:w-[480px] lg:w-[540px] md:h-full md:overflow-y-auto md:border-l md:border-[var(--border)] md:shrink-0 font-[family-name:var(--font-sans)] transition-all duration-200 ease-in-out ${
            isSidebarOpen ? "block" : "hidden"
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-10">
            {/* ── CARD 1: IDENTIFICACIÓN CELESTE (Full Width) ── */}
            <div className="col-span-1 sm:col-span-2 solid-card p-5 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-muted)]">
                <span>Identificación Celeste</span>
                <span className="font-mono text-[11px] truncate max-w-[200px]">
                  {identifiedTarget?.designation || (activeState === "unavailable" ? "CDS / SIMBAD OFF" : activeState === "none" ? "ICRS FIELD" : "SECTOR")}
                </span>
              </div>

              {isIdentifying ? (
                <div className="py-4 flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                  <span>Clasificando extensión angular...</span>
                </div>
              ) : (
                <>
                  <h2 className="text-[22px] sm:text-[24px] font-bold text-[var(--text)] tracking-tight leading-snug truncate">
                    {activeState === "unavailable"
                      ? "SIMBAD no disponible"
                      : activeState === "none"
                      ? "Campo sin objeto catalogado"
                      : identifiedTarget?.name || "Sector cósmico"}
                  </h2>

                  {currentMatch?.simbadUnavailable && (
                    <div className="p-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse shrink-0" />
                      <span>SIMBAD no disponible: mostrando catálogo local</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {activeState === "edge" && identifiedTarget ? (
                      <span className="inline-block rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--accent)]">
                        Borde de {identifiedTarget.name} · Parcial
                      </span>
                    ) : activeState === "inside" && identifiedTarget ? (
                      <span className="inline-block rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--text)]">
                        {identifiedTarget.objectType}
                      </span>
                    ) : (
                      <span className="inline-block rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                        Sin objeto en huella angular
                      </span>
                    )}

                    {identifiedTarget?.sizeSource && (
                      <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)]">
                        Tamaño: {identifiedTarget.sizeSource}
                      </span>
                    )}
                  </div>

                  {/* Detalle para 'none': Selección manual de candidatos en el cono */}
                  {activeState === "none" && currentMatch?.candidates && currentMatch.candidates.length > 0 && (
                    <div className="pt-2 border-t border-[var(--border)] space-y-2">
                      <span className="text-[11px] font-medium text-[var(--text-muted)] block">
                        Candidatos cercanos en el cono (hasta 5) — Seleccionar:
                      </span>
                      <div className="space-y-1.5">
                        {currentMatch.candidates.slice(0, 5).map((cand) => (
                          <button
                            key={cand.id || cand.name}
                            onClick={() => setSelectedCandidate(cand)}
                            className="w-full p-2.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-left flex items-center justify-between text-[12px] transition-colors cursor-pointer"
                          >
                            <div>
                              <span className="text-[var(--text)] font-medium block">{cand.name}</span>
                              <span className="text-[var(--text-muted)] text-[10px] block">{cand.objectType}</span>
                            </div>
                            <span className="text-[var(--text-muted)] text-[11px] tabular-nums font-mono">
                              {(cand.separationDeg * 60).toFixed(1)}&apos;
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reset si se seleccionó manualmente */}
                  {selectedCandidate && (
                    <button
                      onClick={() => setSelectedCandidate(null)}
                      className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer pt-1 block"
                    >
                      Restablecer a detección automática
                    </button>
                  )}

                  {/* Astrometric details toggle bar with pill button */}
                  <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">
                      Detalles astrométricos
                    </span>
                    <button
                      onClick={() => setShowFullDossier((v) => !v)}
                      className="w-8 h-8 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center transition-colors cursor-pointer"
                      title={showFullDossier ? "Ocultar detalles astrométricos" : "Ver detalles astrométricos"}
                    >
                      <ArrowUpRight className="w-4 h-4 text-[var(--accent)]" strokeWidth={2.2} />
                    </button>
                  </div>

                  {/* Collapsible Astrometric Details */}
                  {showFullDossier && (
                    <div className="space-y-2 pt-2 border-t border-[var(--border)] text-[11px] animate-panel-enter">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)]">
                          <span className="text-[var(--text-muted)] block text-[10px]">RA J2000</span>
                          <span className="text-[var(--text)] font-mono tabular-nums font-medium">{coords.raHms}</span>
                        </div>
                        <div className="p-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)]">
                          <span className="text-[var(--text-muted)] block text-[10px]">DEC J2000</span>
                          <span className="text-[var(--text)] font-mono tabular-nums font-medium">{coords.decDms}</span>
                        </div>
                      </div>

                      {identifiedTarget?.majorDiameterArcmin && (
                        <div className="p-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] space-y-0.5">
                          <span className="text-[var(--text-muted)] block text-[10px]">Dimensiones angulares (diámetros)</span>
                          <div className="text-[var(--text)] text-[11px] font-mono tabular-nums font-medium">
                            {identifiedTarget.majorDiameterArcmin.toFixed(1)}&apos; ×{" "}
                            {(identifiedTarget.minorDiameterArcmin ?? identifiedTarget.majorDiameterArcmin).toFixed(1)}&apos;
                            {identifiedTarget.positionAngleDeg ? ` (PA ${identifiedTarget.positionAngleDeg}°)` : ""}
                          </div>
                        </div>
                      )}

                      {identifiedTarget?.spectralFeatures && identifiedTarget.spectralFeatures.length > 0 && (
                        <div className="p-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] space-y-1">
                          <span className="text-[var(--text-muted)] block text-[10px]">Firmas catalogadas</span>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {identifiedTarget.spectralFeatures.map((feat, idx) => (
                              <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded-[6px] bg-[var(--surface-1)] text-[var(--text)] border border-[var(--border)]">
                                {feat}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── CARD 2: DISTANCIA (Col 1) ── */}
            <div className="solid-card p-5 flex flex-col justify-between min-h-[140px]">
              <span className="text-[11px] font-medium text-[var(--text-muted)] block">
                Distancia
              </span>

              {distanceInfo.isUnreliable ? (
                <div className="my-auto py-1">
                  <div className="text-[14px] font-semibold text-[var(--text)] leading-snug">
                    No calculable de forma fiable
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-1">
                    Sin paralaje suficiente en CDS / Gaia para determinar distancia con precisión.
                  </p>
                </div>
              ) : (
                <div className="my-auto">
                  <div
                    className={`${
                      distanceInfo.isKnown
                        ? "text-[36px] sm:text-[42px]"
                        : "text-[28px] sm:text-[34px]"
                    } font-bold text-[var(--text)] font-mono leading-none tabular-nums my-1`}
                  >
                    {distanceInfo.value}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">
                    {distanceInfo.unit}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Paralaje estelar</span>
                <span className="text-[var(--text)] font-medium">
                  {distanceInfo.isKnown ? "Verificado" : distanceInfo.isUnreliable ? "No acotado" : "Fondo"}
                </span>
              </div>
            </div>

            {/* ── CARD 3: CONSTELACIÓN (Col 2) ── */}
            <div className="solid-card p-5 flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[11px] font-medium text-[var(--text-muted)] block">
                  Constelación
                </span>
                <div className="text-[20px] sm:text-[22px] font-bold text-[var(--text)] leading-tight my-1 truncate">
                  {constellation.replace(/\s*\([^)]*\)/, "") || "Campo"}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] truncate">
                  {constellation.includes("(") ? constellation.slice(constellation.indexOf("(")) : `Sector ${constellation}`}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Catálogo</span>
                <span className="text-[var(--text)] font-medium">
                  {identifiedTarget?.source === "local_dossier"
                    ? "Dossier Local"
                    : identifiedTarget?.source === "simbad_api"
                    ? "SIMBAD (CDS)"
                    : "Campo Abierto"}
                </span>
              </div>
            </div>

            {/* ── CARD 4: DESCRIPCIÓN (Full Width - Clean Solid Card, No Concentric Glyphs) ── */}
            <div className="col-span-1 sm:col-span-2 solid-card p-5">
              <span className="text-[11px] font-medium text-[var(--text-muted)] mb-2 block">
                Descripción
              </span>
              <p className="text-[12px] sm:text-[13px] text-[var(--text)] leading-relaxed">
                {identifiedTarget?.description ||
                  "Sector de cielo profundo sin singularidad catalogada dentro de su extensión angular. El campo corresponde a radiación difusa y estrellas de campo no resueltas."}
              </p>
            </div>

            {/* ── CARD 5: COMPOSICIÓN Y RÉGIMEN FÍSICO (Full Width) ── */}
            <div className="col-span-1 sm:col-span-2 solid-card p-5 space-y-3.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-muted)]">
                <span>
                  {activeState === "none"
                    ? "Composición y régimen físico (campo difuso)"
                    : "Composición y régimen físico"}
                </span>
                <span className="font-mono">{analysis.detectedElements.length} firmas activas</span>
              </div>

              {/* Indicador de análisis parcial si es 'edge' */}
              {isPartial && (
                <div className="px-3 py-1.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] text-[11px] text-[var(--accent)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  <span>Análisis parcial · Periferia de huella angular</span>
                </div>
              )}

              {/* Top half: Hero metric + 3-bar vertical histogram */}
              <div className="flex items-end justify-between gap-4 pt-1">
                <div>
                  <div className="text-[44px] sm:text-[50px] font-bold text-[var(--text)] font-mono leading-none tabular-nums">
                    {analysis.detectedElements[0]?.abundancePct || 85}
                    <span className="text-[24px] font-normal text-[var(--text-muted)]">%</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-1.5">
                    {analysis.detectedElements[0]?.formula?.split(" ")[0] || "H-Alfa"} · Dominante
                  </div>
                </div>

                {/* 3 Vertical Bars Histogram */}
                <div className="flex items-end gap-3 h-24 pb-1">
                  {/* Bar 1: Dominant in --accent */}
                  <div className="flex flex-col items-center gap-1.5 w-11">
                    <span className="text-[11px] text-[var(--accent)] tabular-nums font-mono font-bold">
                      {analysis.detectedElements[0]?.abundancePct || 85}%
                    </span>
                    <div
                      className="w-full bg-[var(--accent)] rounded-t-[4px] transition-all duration-300"
                      style={{ height: `${(analysis.detectedElements[0]?.abundancePct || 85) * 0.7}px` }}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 truncate max-w-full">
                      {analysis.detectedElements[0]?.formula?.split(" ")[0] || "Hα"}
                    </span>
                  </div>

                  {/* Bar 2: in --surface-2 */}
                  <div className="flex flex-col items-center gap-1.5 w-11">
                    <span className="text-[11px] text-[var(--text)] tabular-nums font-mono font-medium">
                      {analysis.detectedElements[1]?.abundancePct || 76}%
                    </span>
                    <div
                      className="w-full bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-t-[4px] transition-all duration-300"
                      style={{ height: `${(analysis.detectedElements[1]?.abundancePct || 76) * 0.7}px` }}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 truncate max-w-full">
                      {analysis.detectedElements[1]?.formula?.split(" ")[0] || "Foto."}
                    </span>
                  </div>

                  {/* Bar 3: in --surface-2 */}
                  <div className="flex flex-col items-center gap-1.5 w-11">
                    <span className="text-[11px] text-[var(--text)] tabular-nums font-mono font-medium">
                      {analysis.detectedElements[2]?.abundancePct || 48}%
                    </span>
                    <div
                      className="w-full bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-t-[4px] transition-all duration-300"
                      style={{ height: `${(analysis.detectedElements[2]?.abundancePct || 48) * 0.7}px` }}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 truncate max-w-full">
                      {analysis.detectedElements[2]?.formula?.split(" ")[0] || "[O III]"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom half: Element summary rows */}
              <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
                {analysis.detectedElements.slice(0, 3).map((el, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1 text-[12px] border-b border-[var(--border)]/50 last:border-b-0"
                  >
                    <span className="text-[var(--text)] font-medium font-mono">{el.formula}</span>
                    <span className="text-[var(--text-muted)] text-[11px]">{el.name}</span>
                  </div>
                ))}
              </div>

              {/* Progressive disclosure toggle */}
              {analysis.detectedElements.length > 3 && (
                <div className="pt-1">
                  <button
                    onClick={toggleChemistry}
                    className="w-full py-2 px-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] text-[11px] text-[var(--text)] flex items-center justify-between hover:bg-[var(--surface-1)] transition-colors cursor-pointer"
                  >
                    <span>{showFullChemistry ? "Ocultar detalle químico" : "Ver detalle químico y bandas"}</span>
                    {showFullChemistry ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                  </button>

                  {showFullChemistry && (
                    <div className="space-y-1.5 pt-2 animate-panel-enter">
                      {analysis.detectedElements.slice(3).map((el, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-1 text-[11px] border-b border-[var(--border)]"
                        >
                          <span className="text-[var(--text)] font-mono">{el.formula}</span>
                          <span className="text-[var(--text-muted)] font-mono">{el.abundancePct}% · {el.detectionBand}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── CARD 6: RÉGIMEN TÉRMICO (Col 1) ── */}
            <div className="solid-card p-5 flex flex-col justify-between min-h-[140px]">
              <span className="text-[11px] font-medium text-[var(--text-muted)] block">
                Régimen Térmico
              </span>
              <div className="space-y-3 my-1">
                <div>
                  <div className="text-[24px] sm:text-[28px] font-bold text-[var(--text)] font-mono leading-none tabular-nums">
                    {minTemp} K
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                    Temperatura mínima
                  </div>
                </div>
                <div className="pt-2 border-t border-[var(--border)]">
                  <div className="text-[24px] sm:text-[28px] font-bold text-[var(--text)] font-mono leading-none tabular-nums">
                    {maxTemp} K
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                    Temperatura máxima
                  </div>
                </div>
              </div>
            </div>

            {/* ── CARD 7: CAMPO RADIATIVO (Col 2) ── */}
            <div className="solid-card p-5 flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  Campo Radiativo
                </span>
                <div className="w-7 h-7 rounded-full bg-[var(--surface-2)] text-[var(--accent)] flex items-center justify-center">
                  <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.2} />
                </div>
              </div>

              <div className="text-[20px] sm:text-[22px] font-bold text-[var(--text)] tracking-tight leading-none my-2">
                {analysis.radiationFieldIntensity}
              </div>

              {/* 5-segment meter */}
              <div className="grid grid-cols-5 gap-1.5 pt-1">
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
                      className={`h-2 rounded-[2px] transition-colors ${isFilled ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]"}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* ── CARD 8: CONFIANZA PROMEDIO (Col 1) ── */}
            <div className="solid-card p-5 flex flex-col items-center justify-center min-h-[140px]">
              {/* Circular gauge ring in --accent */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="var(--surface-2)"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="var(--accent)"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={213.6}
                    strokeDashoffset={213.6 - (213.6 * averageConfidence) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-[22px] font-bold text-[var(--text)] font-mono tabular-nums">
                  {averageConfidence}%
                </span>
              </div>
              <span className="text-[11px] font-medium text-[var(--text-muted)] mt-2">
                Confianza promedio
              </span>
            </div>

            {/* ── CARD 9: FENÓMENO DOMINANTE INFERIDO (Col 2) ── */}
            <div className="solid-card p-5 flex flex-col justify-between min-h-[140px]">
              <span className="text-[11px] font-medium text-[var(--text-muted)] block leading-tight">
                Fenómeno Dominante
              </span>
              <p className="text-[12px] sm:text-[13px] text-[var(--text)] leading-relaxed my-auto font-medium">
                {analysis.dominantPhenomenon}
              </p>
            </div>

            {/* ── CARD 10: METADATOS DE ESPECTRO (Full Width) ── */}
            <div className="col-span-1 sm:col-span-2 solid-card p-5 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-muted)]">
                <span>Metadatos de Espectro</span>
                <span className="font-mono">Sensores Activos</span>
              </div>

              <div className="space-y-1.5 pt-1">
                {analysis.detectedElements.slice(0, 3).map((el, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-t border-[var(--border)]"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">
                        0{idx + 1}
                      </span>
                      <div>
                        <div className="text-[13px] text-[var(--text)] font-medium font-mono">
                          {el.formula}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {el.detectionBand}
                        </div>
                      </div>
                    </div>

                    <div className="text-[18px] font-bold text-[var(--accent)] font-mono tabular-nums">
                      {el.confidencePct}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CARD 11: BITÁCORA DE MISIÓN (Full Width) ── */}
            <div className="col-span-1 sm:col-span-2 solid-card p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[var(--text)]">
                    Bitácora de Misión
                  </span>
                  {noteSaved && (
                    <span className="text-[var(--accent)] font-semibold text-[11px] animate-pulse">
                      ¡Registro guardado!
                    </span>
                  )}
                </div>

                {/* Botones de Exportar e Importar JSON */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={handleExportNotes}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-1)] text-[11px] font-medium px-3 py-1 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Exportar todas las notas en formato JSON"
                  >
                    <Download className="w-3 h-3 text-[var(--text-muted)]" />
                    <span>Exportar</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-1)] text-[11px] font-medium px-3 py-1 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Importar notas desde un archivo JSON"
                  >
                    <Upload className="w-3 h-3 text-[var(--text-muted)]" />
                    <span>Importar</span>
                  </button>

                  {missionNotes.length > 0 && (
                    <button
                      onClick={requestDeleteAllCaptureNotes}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--error)] text-[var(--text-muted)] hover:text-[var(--error)] text-[11px] font-medium px-3 py-1 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Eliminar todas las notas registradas en este sector"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Vaciar</span>
                    </button>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportFile}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Línea de estado requerida: MODO LOCAL */}
              <div className="text-[11px] text-[var(--text-muted)] border-b border-[var(--border)] pb-2 font-medium">
                Modo local · Las notas viven solo en este navegador
              </div>

              {/* Mensaje de error de almacenamiento / cuota si ocurre */}
              {notesError && (
                <div className="p-2.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--error)] text-[var(--error)] text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{notesError}</span>
                </div>
              )}

              {/* Lista de notas para esta captura actual */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {missionNotes.length === 0 ? (
                  <div className="text-[12px] text-[var(--text-muted)] py-3 text-center">
                    No hay observaciones registradas para este sector.
                  </div>
                ) : (
                  missionNotes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
                          <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          {note.objectName && (
                            <>
                              <span>•</span>
                              <span className="text-[var(--text)] font-medium truncate">{note.objectName}</span>
                            </>
                          )}
                        </div>
                        <p className="text-[12px] text-[var(--text)] leading-relaxed break-words">
                          {note.body}
                        </p>
                      </div>

                      <button
                        onClick={() => requestDeleteNote(note)}
                        className="w-7 h-7 rounded-full bg-[var(--surface-1)] border border-[var(--border)] hover:border-[var(--error)] text-[var(--text-muted)] hover:text-[var(--error)] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                        title="Eliminar observación"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Formulario de registro de nota */}
              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <textarea
                  value={newNoteBody}
                  onChange={(e) => setNewNoteBody(e.target.value)}
                  disabled={noteSaving}
                  placeholder="Anotar hipótesis u observaciones espectrales..."
                  className="w-full h-18 bg-[var(--surface-2)] border border-[var(--border)] rounded-[12px] p-3 text-[12px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)] resize-none disabled:opacity-50"
                />

                <button
                  onClick={handleSaveNote}
                  disabled={noteSaving || !newNoteBody.trim()}
                  className="w-full py-2.5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-[12px] transition-opacity flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {noteSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando en bitácora...</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Registrar observación</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Operator Authentication Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Technical Protocol Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        title={deleteModalState.title}
        description={deleteModalState.description}
        targetName={deleteModalState.targetName}
        isProcessing={deleteModalState.isProcessing}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModalState((s) => ({ ...s, isOpen: false }))}
      />
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <SpaceProvider>
      <Suspense
        fallback={
          <div className="w-screen h-screen bg-[var(--bg)] flex flex-col items-center justify-center text-[var(--text)] space-y-4">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
            <p className="text-[13px] text-[var(--text-muted)] font-medium">
              Iniciando laboratorio astrofísico...
            </p>
          </div>
        }
      >
        <LaboratoryContent />
      </Suspense>
    </SpaceProvider>
  );
}

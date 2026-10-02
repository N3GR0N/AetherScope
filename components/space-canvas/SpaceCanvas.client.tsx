"use client";

import { useEffect, useRef, useState } from "react";
import type { SpectralSurvey } from "@/lib/astronomy/surveys";
import { sexagesimalToDecimal, type CosmicTarget } from "@/lib/astronomy/targets";
import { useSpace } from "@/context/SpaceContext";
import { Loader2, Sparkles, WifiOff } from "lucide-react";

interface SpaceCanvasProps {
  containerId?: string;
  initialRa?: number;
  initialDec?: number;
  initialFov?: number;
  primarySurvey?: SpectralSurvey;
  secondarySurvey?: SpectralSurvey;
  blendOpacity?: number;
  activeTarget?: CosmicTarget;
  showGrid?: boolean;
  onCoordinatesChange?: (ra: number, dec: number) => void;
  onFovChange?: (fov: number) => void;
  onAladinReady?: (aladin: AladinInstance) => void;
}

// Aladin Lite instance typing interface
export interface AladinInstance {
  setImageSurvey: (survey: string | object) => void;
  createImageSurvey: (
    id: string,
    name: string,
    rootUrl: string,
    cooFrame?: string,
    maxOrder?: number,
    options?: object
  ) => object;
  setOverlayImageLayer: (layer: object | string) => void;
  getOverlayImageLayer: () => { setAlpha: (alpha: number) => void; survey?: { id?: string } } | null;
  getBaseImageLayer: () => object | null;
  animateToRaDec: (ra: number, dec: number, durationSec: number) => void;
  gotoRaDec: (ra: number, dec: number) => void;
  setFov: (fovDeg: number) => void;
  getRaDec: () => [number, number];
  getFov: () => [number, number] | number;
  showCooGrid: (show: boolean) => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    A?: {
      init: Promise<void>;
      aladin: (containerId: string, options: object) => AladinInstance;
    };
  }
}

export default function SpaceCanvas(props: SpaceCanvasProps = {}) {
  const space = useSpace();
  const containerId = props.containerId || "aladin-lite-div";
  const primarySurvey = props.primarySurvey ?? space.primarySurvey;
  const secondarySurvey = props.secondarySurvey ?? space.secondarySurvey;
  const blendOpacity = props.blendOpacity ?? space.blendOpacity;
  const activeTarget = props.activeTarget ?? space.selectedTarget;
  const showGrid = props.showGrid ?? space.showGrid;
  const onCoordinatesChange = props.onCoordinatesChange ?? space.updateCoordinates;
  const onFovChange = props.onFovChange ?? space.updateFov;
  const registerAladinInstance = space.registerAladinInstance;
  const onAladinReady = props.onAladinReady;

  const aladinInstanceRef = useRef<AladinInstance | null>(null);
  const [loadingState, setLoadingState] = useState<"loading" | "ready" | "fallback">("loading");
  const [statusMessage, setStatusMessage] = useState("Iniciando lienzo WebGL2...");
  const [retryCount, setRetryCount] = useState(0);
  const currentTargetIdRef = useRef<string>(activeTarget.id);

  // Stable callback refs so listeners don't require re-subscribing or re-initializing
  const onCoordsRef = useRef(onCoordinatesChange);
  const onFovRef = useRef(onFovChange);
  const registerRef = useRef(registerAladinInstance);
  const onReadyRef = useRef(onAladinReady);

  useEffect(() => {
    onCoordsRef.current = onCoordinatesChange;
    onFovRef.current = onFovChange;
    registerRef.current = registerAladinInstance;
    onReadyRef.current = onAladinReady;
  });

  // Intercept unhandled HiPS rejections to avoid Turbopack / Next.js red overlay
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reasonStr = String(event?.reason?.message || event?.reason || "");
      if (
        reasonStr.includes("HiPS") ||
        reasonStr.includes("CDS ID") ||
        reasonStr.includes("aladin") ||
        reasonStr.includes("mirrors") ||
        reasonStr.includes("does not refer to a found")
      ) {
        console.warn("[AetherScope] Notificación HiPS gestionada:", reasonStr);
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  // Strict Client-Only Mount: load Aladin Lite and initialize canvas ONCE
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const initAladin = async () => {
      try {
        // 1. Ensure external script is loaded
        if (!window.A) {
          setStatusMessage("Cargando motor astronómico CDS Aladin Lite...");
          await new Promise<void>((resolve, reject) => {
            const existingScript = document.querySelector('script[src*="aladin.js"]');
            if (existingScript && window.A) {
              return resolve();
            }

            const script = document.createElement("script");
            script.src = "https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js";
            script.async = true;
            script.charset = "utf-8";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("No se pudo cargar el script de Aladin Lite"));
            document.head.appendChild(script);
          });
        }

        if (cancelled) return;
        if (!window.A) {
          throw new Error("window.A no está definido tras la carga del script");
        }

        setStatusMessage("Compilando shaders astronómicos...");
        await window.A.init;

        if (cancelled) return;

        // 2. Ensure container element exists
        const container = document.getElementById(containerId);
        if (!container) {
          console.warn(`[AetherScope] Contenedor #${containerId} no encontrado en DOM.`);
          return;
        }

        container.innerHTML = "";

        setStatusMessage("Montando lienzo celeste en espacio profundo...");

        // 3. Determine starting coordinates: props > current context coordinates > default target
        const startRa = props.initialRa ?? space.currentRa;
        const startDec = props.initialDec ?? space.currentDec;
        const startFov = props.initialFov ?? space.currentFov ?? 0.25;
        const baseSurveyUrl = primarySurvey.hipsUrl || "https://alasky.cds.unistra.fr/DSS/DSSColor";

        const aladin = window.A.aladin(`#${containerId}`, {
          survey: baseSurveyUrl,
          fov: startFov,
          target: `${startRa} ${startDec}`,
          showReticle: false,
          showZoomControl: false,
          showFullscreenControl: false,
          showLayersControl: false,
          showGotoControl: false,
          showFrame: false,
          showCooGrid: showGrid,
          showProjectionControl: false,
          showSimbadPointerControl: false,
          showCooGridControl: false,
          showCooLocation: false,
          showLocation: false,
          showFov: false,
          showStatusBar: false,
          showShareControl: false,
          showSettingsControl: false,
        });

        if (cancelled) return;
        aladinInstanceRef.current = aladin;
        registerRef.current(aladin);
        if (onReadyRef.current) {
          onReadyRef.current(aladin);
        }

        // 4. Initial overlay setup if specified
        if (blendOpacity > 0.02 && secondarySurvey.hipsUrl) {
          setTimeout(() => {
            try {
              aladin.setOverlayImageLayer(secondarySurvey.hipsUrl);
              const overlay = aladin.getOverlayImageLayer();
              if (overlay && typeof overlay.setAlpha === "function") {
                overlay.setAlpha(blendOpacity);
              }
            } catch (err) {
              console.warn("[AetherScope] Error montando overlay inicial:", err);
            }
          }, 200);
        }

        // 5. Connect telemetry event listeners
        aladin.on("positionChanged", (coords) => {
          if (Array.isArray(coords)) {
            onCoordsRef.current(coords[0], coords[1]);
          } else if (coords && typeof coords === "object" && "ra" in coords && "dec" in coords) {
            const c = coords as { ra: number; dec: number };
            onCoordsRef.current(c.ra, c.dec);
          } else {
            const [ra, dec] = aladin.getRaDec();
            onCoordsRef.current(ra, dec);
          }
        });

        aladin.on("zoomChanged", (newFov) => {
          if (typeof newFov === "number") {
            onFovRef.current(newFov);
          } else if (Array.isArray(newFov)) {
            onFovRef.current(newFov[0]);
          } else {
            const f = aladin.getFov();
            onFovRef.current(Array.isArray(f) ? f[0] : f);
          }
        });

        // 6. Initial telemetry dispatch
        try {
          const [initRa, initDec] = aladin.getRaDec();
          onCoordsRef.current(initRa, initDec);
          const initF = aladin.getFov();
          onFovRef.current(Array.isArray(initF) ? initF[0] : initF);
        } catch {}

        setLoadingState("ready");
      } catch (err) {
        console.warn("[AetherScope] Advertencia durante inicio WebGL:", err);
        if (!cancelled) {
          setLoadingState("fallback");
        }
      }
    };

    const timer = setTimeout(() => {
      void initAladin();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      registerRef.current(null);
      aladinInstanceRef.current = null;
    };
  }, [retryCount, containerId]);

  // Synchronize primary survey changes dynamically and apply color LUT
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || loadingState !== "ready") return;

    try {
      // Use direct HTTPS URL to avoid MOC query and mirror testing
      aladin.setImageSurvey(primarySurvey.hipsUrl || primarySurvey.hipsId);

      // Apply false-color composite LUT for single-band infrared surveys
      setTimeout(() => {
        try {
          const layer = aladin.getBaseImageLayer() as {
            setColormap?: (cmap: string | null, opts?: object) => void;
          } | null;
          if (layer && typeof layer.setColormap === "function") {
            if (primarySurvey.id === "nasa-composite" || primarySurvey.id === "jwst") {
              layer.setColormap("magma", { stretch: "asinh" });
            } else {
              layer.setColormap("native");
            }
          }
        } catch (err) {
          console.warn("[AetherScope] Error aplicando colormap LUT:", err);
        }
      }, 80);
    } catch (err1) {
      console.warn(`[AetherScope] Error cambiando capa base a ${primarySurvey.name}:`, err1);
      try {
        aladin.setImageSurvey("https://alasky.cds.unistra.fr/DSS/DSSColor");
      } catch {}
    }
  }, [primarySurvey, loadingState]);

  // Synchronize secondary overlay layer and blend opacity
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || loadingState !== "ready") return;

    try {
      if (blendOpacity > 0.02) {
        const overlayUrl = secondarySurvey.hipsUrl || secondarySurvey.hipsId;
        try {
          aladin.setOverlayImageLayer(overlayUrl);
        } catch {
          try {
            const layerObj = aladin.createImageSurvey(
              secondarySurvey.hipsId,
              secondarySurvey.name,
              secondarySurvey.hipsUrl,
              "equatorial",
              9
            );
            aladin.setOverlayImageLayer(layerObj);
          } catch (e) {
            console.warn(`[AetherScope] Falló capa superpuesta ${secondarySurvey.name}:`, e);
          }
        }

        const overlay = aladin.getOverlayImageLayer();
        if (overlay && typeof overlay.setAlpha === "function") {
          overlay.setAlpha(blendOpacity);
        }
      } else {
        const overlay = aladin.getOverlayImageLayer();
        if (overlay && typeof overlay.setAlpha === "function") {
          overlay.setAlpha(0);
        }
      }
    } catch (e) {
      console.warn("[AetherScope] Error al sincronizar superposición:", e);
    }
  }, [secondarySurvey, blendOpacity, loadingState]);

  // Handle cinematic target transitions
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || loadingState !== "ready") return;

    if (currentTargetIdRef.current !== activeTarget.id) {
      currentTargetIdRef.current = activeTarget.id;
      try {
        const { raDeg, decDeg } = sexagesimalToDecimal(activeTarget.ra, activeTarget.dec);
        aladin.animateToRaDec(raDeg, decDeg, 1.4);
        aladin.setFov(activeTarget.fov);
      } catch (e) {
        console.warn("[AetherScope] Falló animación de objetivo:", e);
      }
    }
  }, [activeTarget, loadingState]);

  // Handle celestial coordinate grid toggle
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || loadingState !== "ready") return;

    try {
      aladin.showCooGrid(showGrid);
    } catch (e) {
      console.warn("[AetherScope] Error alternando rejilla:", e);
    }
  }, [showGrid, loadingState]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Aladin Lite WebGL Canvas Mount Container */}
      <div
        id={containerId}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Atmospheric Loading Indicator */}
      {loadingState === "loading" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="relative flex items-center justify-center mb-6">
            <div className="w-20 h-20 rounded-full border border-sky-400/20 animate-ping absolute" />
            <div className="w-16 h-16 rounded-full border border-amber-400/30 flex items-center justify-center bg-black/60 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
              <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-white/90 font-medium tracking-wide text-sm">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>AETHERSCOPE ENGINE V3</span>
            </div>
            <p className="text-xs text-white/50 font-mono tracking-wider">{statusMessage}</p>
          </div>
        </div>
      )}

      {/* Fallback View if WebGL fails / Offline Mode */}
      {loadingState === "fallback" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-b from-[#050811] via-[#090d1a] to-[#030408] p-8 text-center">
          <div className="max-w-md p-6 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center text-amber-400">
              <WifiOff className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-white font-medium text-base">Modo Telemetría Espectral</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                El enlace con los servidores de Estrasburgo demoró en responder. Mostrando telemetría y
                coordenadas calculadas en memoria local.
              </p>
            </div>
            <button
              onClick={() => {
                setLoadingState("loading");
                setRetryCount((c) => c + 1);
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white font-medium border border-white/10 transition-all cursor-pointer"
            >
              Reintentar Conexión HiPS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

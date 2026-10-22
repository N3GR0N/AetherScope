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
  showCooGrid: () => void;
  hideCooGrid?: () => void;
  setCooGrid: (options: { enabled: boolean; color?: string; opacity?: number; thickness?: number }) => void;
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
  // Contexto opcional/degradable
  let spaceContext: ReturnType<typeof useSpace> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    spaceContext = useSpace();
  } catch {
    spaceContext = null;
  }

  const containerId = props.containerId || "aladin-lite-div";
  const primarySurvey = props.primarySurvey ?? spaceContext?.primarySurvey ?? {
    id: "dss2",
    name: "Luz Visible (DSS2 Óptico)",
    shortLabel: "DSS2 Óptico",
    telescope: "Digitized Sky Survey",
    agency: "CDS",
    hipsId: "CDS/P/DSS2/color",
    hipsUrl: "https://alasky.cds.unistra.fr/DSS/DSSColor",
    wavelengthBand: "Óptico",
    spectralRange: "400 - 750 nm",
    frequency: "Visible",
    accentColor: "#38bdf8",
    tagColor: "text-white",
    description: "Capa base óptica DSS2",
    astrophysicalFocus: "Continuo visible",
    keyEmissions: [],
  };
  const secondarySurvey = props.secondarySurvey ?? spaceContext?.secondarySurvey;
  const blendOpacity = props.blendOpacity ?? spaceContext?.blendOpacity ?? 0;
  const activeTarget = props.activeTarget ?? spaceContext?.selectedTarget;
  const showGrid = props.showGrid ?? spaceContext?.showGrid ?? false;
  const onCoordinatesChange = props.onCoordinatesChange ?? spaceContext?.updateCoordinates;
  const onFovChange = props.onFovChange ?? spaceContext?.updateFov;
  const registerAladinInstance = spaceContext?.registerAladinInstance;
  const onAladinReady = props.onAladinReady;

  const aladinInstanceRef = useRef<AladinInstance | null>(null);
  const [loadingState, setLoadingState] = useState<"loading" | "ready" | "fallback">("loading");
  const [statusMessage, setStatusMessage] = useState("Iniciando lienzo WebGL2...");
  const [retryCount, setRetryCount] = useState(0);
  const currentTargetIdRef = useRef<string | undefined>(activeTarget?.id);

  // Stable callback refs
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

  // Intercept unhandled HiPS rejections & errors to avoid Turbopack / Next.js red overlay
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isHipsError = (msg: string) =>
      msg.includes("HiPS") ||
      msg.includes("CDS ID") ||
      msg.includes("aladin") ||
      msg.includes("mirrors") ||
      msg.includes("not found at url") ||
      msg.includes("does not refer to a found");

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reasonStr = String(event?.reason?.message || event?.reason || "");
      if (isHipsError(reasonStr)) {
        console.warn("[AetherScope] Notificación HiPS gestionada:", reasonStr);
        event.preventDefault();
      }
    };

    const handleGlobalError = (event: ErrorEvent) => {
      const msg = String(event?.message || "");
      if (isHipsError(msg)) {
        console.warn("[AetherScope] Notificación de error HiPS interceptada:", msg);
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleGlobalError);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleGlobalError);
    };
  }, []);

  // Strict Client-Only Mount: load Aladin Lite v3 from official CDN
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const initAladin = async () => {
      try {
        if (!window.A) {
          setStatusMessage("Cargando motor astronómico CDS Aladin Lite...");
          await new Promise<void>((resolve, reject) => {
            const existingScript = document.querySelector('script[src*="aladin.js"]');
            if (existingScript && window.A) {
              return resolve();
            }

            const script = document.createElement("script");
            script.src = "https://aladin.cds.unistra.fr/AladinLite/api/v3/3.9.2-beta/aladin.js";
            script.crossOrigin = "anonymous";
            script.async = true;
            script.charset = "utf-8";
            script.onload = () => resolve();
            script.onerror = () => {
              // Fallback to latest CDN if beta version pin changes
              const fallbackScript = document.createElement("script");
              fallbackScript.src = "https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js";
              fallbackScript.crossOrigin = "anonymous";
              fallbackScript.async = true;
              fallbackScript.onload = () => resolve();
              fallbackScript.onerror = () => reject(new Error("No se pudo cargar el script de Aladin Lite"));
              document.head.appendChild(fallbackScript);
            };
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

        const container = document.getElementById(containerId);
        if (!container) {
          console.warn(`[AetherScope] Contenedor #${containerId} no encontrado en DOM.`);
          return;
        }

        container.innerHTML = "";
        setStatusMessage("Montando lienzo celeste en espacio profundo...");

        const startRa = props.initialRa ?? spaceContext?.currentRa ?? 274.7;
        const startDec = props.initialDec ?? spaceContext?.currentDec ?? -13.8;
        const startFov = props.initialFov ?? spaceContext?.currentFov ?? 0.25;
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
          gridColor: "#ffffff",
          gridOpacity: 0.15,
          gridOptions: {
            enabled: showGrid,
            color: "#ffffff",
            opacity: 0.15,
            showLabels: true,
            thickness: 1,
            labelSize: 11,
          },
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
        if (registerRef.current) {
          registerRef.current(aladin);
        }
        if (onReadyRef.current) {
          onReadyRef.current(aladin);
        }

        // Overlay inicial si existe
        if (blendOpacity > 0.02 && secondarySurvey?.hipsUrl) {
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

        // Event listeners de telemetría
        aladin.on("positionChanged", (coords) => {
          if (Array.isArray(coords)) {
            onCoordsRef.current?.(coords[0], coords[1]);
          } else if (coords && typeof coords === "object" && "ra" in coords && "dec" in coords) {
            const c = coords as { ra: number; dec: number };
            onCoordsRef.current?.(c.ra, c.dec);
          } else {
            const [ra, dec] = aladin.getRaDec();
            onCoordsRef.current?.(ra, dec);
          }
        });

        aladin.on("zoomChanged", (newFov) => {
          if (typeof newFov === "number") {
            onFovRef.current?.(newFov);
          } else if (Array.isArray(newFov)) {
            onFovRef.current?.(newFov[0]);
          } else {
            const f = aladin.getFov();
            onFovRef.current?.(Array.isArray(f) ? f[0] : f);
          }
        });

        // Telemetría inicial
        try {
          const [initRa, initDec] = aladin.getRaDec();
          onCoordsRef.current?.(initRa, initDec);
          const initF = aladin.getFov();
          onFovRef.current?.(Array.isArray(initF) ? initF[0] : initF);
        } catch (err) {
          console.warn("[AetherScope] Error leyendo telemetría inicial de Aladin:", err);
        }

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
      if (registerRef.current) {
        registerRef.current(null);
      }
      aladinInstanceRef.current = null;
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [retryCount, containerId]);

  // Synchronize primary survey changes dynamically
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || loadingState !== "ready") return;

    try {
      aladin.setImageSurvey(primarySurvey.hipsUrl || primarySurvey.hipsId);

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
      } catch (fallbackErr) {
        console.warn("[AetherScope] Error aplicando fallback a DSSColor:", fallbackErr);
      }
    }
  }, [primarySurvey, loadingState]);

  // Synchronize secondary overlay layer and blend opacity
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || loadingState !== "ready") return;

    try {
      if (blendOpacity > 0.02 && secondarySurvey?.hipsUrl) {
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
    if (!aladin || loadingState !== "ready" || !activeTarget) return;

    if (currentTargetIdRef.current !== activeTarget.id) {
      currentTargetIdRef.current = activeTarget.id;
      try {
        const { raDeg, decDeg } = sexagesimalToDecimal(activeTarget.ra, activeTarget.dec);
        aladin.animateToRaDec(raDeg, decDeg, 0.5);
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
      if (showGrid) {
        aladin.setCooGrid({
          enabled: true,
          color: "#ffffff",
          opacity: 0.15,
          thickness: 1,
        });
      } else {
        aladin.setCooGrid({ enabled: false });
        if (typeof aladin.hideCooGrid === "function") {
          aladin.hideCooGrid();
        }
      }
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
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#101015]/90 font-[family-name:var(--font-proto)] select-none">
          <div className="relative flex items-center justify-center mb-6">
            <div className="w-16 h-16 border-2 border-[#506385] border-t-[#F1F0E1] animate-spin flex items-center justify-center bg-[#17171C]">
              <Loader2 className="w-6 h-6 text-[#F1F0E1] animate-spin" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-[#F1F0E1] font-semibold tracking-[0.2em] uppercase text-xs">
              <span>AETHERSCOPE ENGINE V3</span>
            </div>
            <p className="text-[10px] text-[#9A9A92] uppercase tracking-wider">{statusMessage}</p>
          </div>
        </div>
      )}

      {/* Fallback View if WebGL fails / Offline Mode */}
      {loadingState === "fallback" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#101015] p-8 text-center font-[family-name:var(--font-proto)] select-none">
          <div className="max-w-md p-6 bg-[#1A1A1F] border border-[#2B2B31] space-y-4">
            <div className="w-10 h-10 bg-[#17171C] border border-[#2B2B31] mx-auto flex items-center justify-center text-[#F1F0E1]">
              <WifiOff className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[#F1F0E1] font-bold text-sm uppercase tracking-wide">MODO TELEMETRÍA ESPECTRAL</h3>
              <p className="text-[11px] text-[#9A9A92] leading-relaxed uppercase">
                El enlace con los servidores de Estrasburgo demoró en responder. Mostrando telemetría y
                coordenadas calculadas en memoria local.
              </p>
            </div>
            <button
              onClick={() => {
                setLoadingState("loading");
                setRetryCount((c) => c + 1);
              }}
              className="px-4 py-2 bg-[#506385] text-[#F1F0E1] text-[11px] uppercase tracking-wider font-semibold transition-colors hover:opacity-90 cursor-pointer"
            >
              REINTENTAR CONEXIÓN HIPS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

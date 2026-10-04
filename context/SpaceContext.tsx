"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import {
  DEFAULT_TARGET,
  type CosmicTarget,
  sexagesimalToDecimal,
} from "@/lib/astronomy/targets";
import {
  DEFAULT_PRIMARY_SURVEY,
  DEFAULT_OVERLAY_SURVEY,
  NASA_COMPOSITE_SURVEY,
  type SpectralSurvey,
} from "@/lib/astronomy/surveys";
import {
  TELESCOPES,
  type SpaceTelescope,
} from "@/lib/astronomy/telescopes";

export type ApplicationMode = "observatory" | "dossier";

// Minimal interface for Aladin engine interaction
export interface AladinEngineBridge {
  animateToRaDec: (ra: number, dec: number, durationSec: number) => void;
  gotoRaDec: (ra: number, dec: number) => void;
  setFov: (fovDeg: number) => void;
  getRaDec: () => [number, number];
  getFov: () => [number, number] | number;
  setImageSurvey: (survey: string | object) => void;
  showCooGrid?: () => void;
  hideCooGrid?: () => void;
  setCooGrid?: (options: { enabled: boolean; color?: string; opacity?: number; thickness?: number }) => void;
}

interface SpaceContextValue {
  // Navigation & Mode
  currentMode: ApplicationMode;
  selectedTarget: CosmicTarget;
  isCatalogOpen: boolean;
  setMode: (mode: ApplicationMode) => void;
  navigateToTarget: (target: CosmicTarget) => void;
  returnToFreeFlight: () => void;
  toggleCatalog: () => void;
  setCatalogOpen: (open: boolean) => void;

  // Active Space Telescope
  activeTelescopeId: "jwst" | "hubble";
  activeTelescope: SpaceTelescope;
  setActiveTelescopeId: (id: "jwst" | "hubble") => void;

  // Live Coordinates & Zoom Telemetry
  currentRa: number;
  currentDec: number;
  currentFov: number;
  updateCoordinates: (ra: number, dec: number) => void;
  updateFov: (fov: number) => void;
  setFovPreset: (fov: number) => void;
  syncOrbitalOrientation: (deltaRaDeg: number, deltaDecDeg: number) => void;

  // Spectral Survey Controls
  primarySurvey: SpectralSurvey;
  secondarySurvey: SpectralSurvey;
  blendOpacity: number;
  isNasaComposite: boolean;
  setPrimarySurvey: (survey: SpectralSurvey) => void;
  setSecondarySurvey: (survey: SpectralSurvey) => void;
  setBlendOpacity: (opacity: number) => void;
  toggleNasaComposite: () => void;

  // HUD Overlay Controls
  showCrosshair: boolean;
  showGrid: boolean;
  toggleCrosshair: () => void;
  toggleGrid: () => void;

  // Engine Bridge
  registerAladinInstance: (instance: AladinEngineBridge | null) => void;
  getAladinInstance: () => AladinEngineBridge | null;
}

interface SpaceProviderProps {
  children: React.ReactNode;
  initialRa?: number;
  initialDec?: number;
  initialFov?: number;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

export function SpaceProvider({
  children,
  initialRa,
  initialDec,
  initialFov,
}: SpaceProviderProps) {
  const [currentMode, setCurrentMode] = useState<ApplicationMode>("observatory");
  const [selectedTarget, setSelectedTarget] = useState<CosmicTarget>(DEFAULT_TARGET);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);

  const [activeTelescopeId, setActiveTelescopeIdState] = useState<"jwst" | "hubble">("jwst");
  const activeTelescope = TELESCOPES[activeTelescopeId];

  // Initial decimal coordinates: explicit props > sessionStorage cache > default target
  const defaultDecimal = sexagesimalToDecimal(DEFAULT_TARGET.ra, DEFAULT_TARGET.dec);

  const [currentRa, setCurrentRa] = useState<number>(() => {
    if (initialRa !== undefined && !isNaN(initialRa)) return initialRa;
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("aetherscope_active_coords");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.ra === "number" && !isNaN(parsed.ra)) return parsed.ra;
        }
      } catch {}
    }
    return defaultDecimal.raDeg;
  });

  const [currentDec, setCurrentDec] = useState<number>(() => {
    if (initialDec !== undefined && !isNaN(initialDec)) return initialDec;
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("aetherscope_active_coords");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.dec === "number" && !isNaN(parsed.dec)) return parsed.dec;
        }
      } catch {}
    }
    return defaultDecimal.decDeg;
  });

  const [currentFov, setCurrentFov] = useState<number>(() => {
    if (initialFov !== undefined && !isNaN(initialFov)) return initialFov;
    if (typeof window !== "undefined") {
      try {
        const savedFov = sessionStorage.getItem("aetherscope_active_fov");
        if (savedFov) {
          const parsedFov = JSON.parse(savedFov);
          if (typeof parsedFov === "number" && !isNaN(parsedFov)) return parsedFov;
        }
      } catch {}
    }
    return DEFAULT_TARGET.fov;
  });

  // Optical base permanent survey: DSS2 Color baseline with 0 overlay
  const [primarySurvey, setPrimarySurveyState] = useState<SpectralSurvey>(DEFAULT_PRIMARY_SURVEY);
  const [secondarySurvey, setSecondarySurvey] = useState<SpectralSurvey>(DEFAULT_OVERLAY_SURVEY);
  const [blendOpacity, setBlendOpacity] = useState<number>(0.0);
  const [isNasaComposite, setIsNasaComposite] = useState<boolean>(false);

  // HUD Toggles
  const [showCrosshair, setShowCrosshair] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);

  // Engine ref
  const aladinRef = useRef<AladinEngineBridge | null>(null);

  const registerAladinInstance = useCallback((instance: AladinEngineBridge | null) => {
    aladinRef.current = instance;
  }, []);

  const getAladinInstance = useCallback(() => {
    return aladinRef.current;
  }, []);

  const updateCoordinates = useCallback((ra: number, dec: number) => {
    setCurrentRa(ra);
    setCurrentDec(dec);
    try {
      sessionStorage.setItem("aetherscope_active_coords", JSON.stringify({ ra, dec }));
    } catch {}
  }, []);

  const updateFov = useCallback((fov: number) => {
    setCurrentFov(fov);
    try {
      sessionStorage.setItem("aetherscope_active_fov", JSON.stringify(fov));
    } catch {}
  }, []);

  const setMode = useCallback((mode: ApplicationMode) => {
    setCurrentMode(mode);
    if (mode === "observatory") {
      setIsCatalogOpen(false);
    }
  }, []);

  const returnToFreeFlight = useCallback(() => {
    setCurrentMode("observatory");
    setIsCatalogOpen(false);
  }, []);

  const setActiveTelescopeId = useCallback((id: "jwst" | "hubble") => {
    setActiveTelescopeIdState(id);
    const tel = TELESCOPES[id];
    const parts = tel.targetInitial.split(" ");
    const raStr = `${parts[0]} ${parts[1]} ${parts[2]}`;
    const decStr = `${parts[3]} ${parts[4]} ${parts[5]}`;
    const { raDeg, decDeg } = sexagesimalToDecimal(raStr, decStr);

    setCurrentRa(raDeg);
    setCurrentDec(decDeg);
    setCurrentFov(tel.fovInitial);

    if (aladinRef.current) {
      try {
        aladinRef.current.animateToRaDec(raDeg, decDeg, 1.4);
        aladinRef.current.setFov(tel.fovInitial);
      } catch {}
    }
  }, []);

  const navigateToTarget = useCallback((target: CosmicTarget) => {
    setSelectedTarget(target);
    setCurrentMode("dossier");

    const { raDeg, decDeg } = sexagesimalToDecimal(target.ra, target.dec);
    setCurrentRa(raDeg);
    setCurrentDec(decDeg);
    setCurrentFov(target.fov);

    if (aladinRef.current) {
      try {
        aladinRef.current.animateToRaDec(raDeg, decDeg, 1.4);
        aladinRef.current.setFov(target.fov);
      } catch (err) {
        console.warn("[SpaceContext] Error en animación de cámara:", err);
      }
    }
  }, []);

  const setFovPreset = useCallback((fov: number) => {
    setCurrentFov(fov);
    if (aladinRef.current) {
      try {
        aladinRef.current.setFov(fov);
      } catch (e) {
        console.warn("[SpaceContext] Error al fijar FOV:", e);
      }
    }
  }, []);

  const syncOrbitalOrientation = useCallback((deltaRaDeg: number, deltaDecDeg: number) => {
    if (aladinRef.current) {
      try {
        const [curRa, curDec] = aladinRef.current.getRaDec();
        let newRa = (curRa + deltaRaDeg) % 360;
        if (newRa < 0) newRa += 360;
        const newDec = Math.max(-89.9, Math.min(89.9, curDec + deltaDecDeg));
        aladinRef.current.gotoRaDec(newRa, newDec);
        setCurrentRa(newRa);
        setCurrentDec(newDec);
      } catch {}
    }
  }, []);

  const toggleCatalog = useCallback(() => {
    setIsCatalogOpen((prev) => !prev);
  }, []);

  const setCatalogOpen = useCallback((open: boolean) => {
    setIsCatalogOpen(open);
  }, []);

  const toggleNasaComposite = useCallback(() => {
    setIsNasaComposite((prev) => {
      const next = !prev;
      if (next) {
        setPrimarySurveyState(NASA_COMPOSITE_SURVEY);
        setBlendOpacity(0.7);
      } else {
        setPrimarySurveyState(DEFAULT_PRIMARY_SURVEY);
        setBlendOpacity(0.0);
      }
      return next;
    });
  }, []);

  const setPrimarySurvey = useCallback((survey: SpectralSurvey) => {
    setPrimarySurveyState(survey);
  }, []);

  const toggleCrosshair = useCallback(() => {
    setShowCrosshair((v) => !v);
  }, []);

  const toggleGrid = useCallback(() => {
    setShowGrid((v) => {
      const next = !v;
      if (aladinRef.current) {
        try {
          if (typeof aladinRef.current.setCooGrid === "function") {
            aladinRef.current.setCooGrid({
              enabled: next,
              color: "#ffffff",
              opacity: 0.15,
              thickness: 1,
            });
          } else if (!next && typeof aladinRef.current.hideCooGrid === "function") {
            aladinRef.current.hideCooGrid();
          } else if (next && typeof aladinRef.current.showCooGrid === "function") {
            aladinRef.current.showCooGrid();
          }
        } catch {}
      }
      return next;
    });
  }, []);

  const value: SpaceContextValue = {
    currentMode,
    selectedTarget,
    isCatalogOpen,
    setMode,
    navigateToTarget,
    returnToFreeFlight,
    toggleCatalog,
    setCatalogOpen,
    activeTelescopeId,
    activeTelescope,
    setActiveTelescopeId,
    currentRa,
    currentDec,
    currentFov,
    updateCoordinates,
    updateFov,
    setFovPreset,
    syncOrbitalOrientation,
    primarySurvey,
    secondarySurvey,
    blendOpacity,
    isNasaComposite,
    setPrimarySurvey,
    setSecondarySurvey,
    setBlendOpacity,
    toggleNasaComposite,
    showCrosshair,
    showGrid,
    toggleCrosshair,
    toggleGrid,
    registerAladinInstance,
    getAladinInstance,
  };

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error("useSpace must be used within a SpaceProvider");
  }
  return context;
}

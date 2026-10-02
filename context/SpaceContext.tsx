"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import {
  COSMIC_TARGETS,
  DEFAULT_TARGET,
  type CosmicTarget,
  sexagesimalToDecimal,
} from "@/lib/astronomy/targets";
import {
  DEFAULT_PRIMARY_SURVEY,
  DEFAULT_OVERLAY_SURVEY,
  NASA_COMPOSITE_SURVEY,
  SPECTRAL_SURVEYS,
  JWST_NIRCAM_OVERLAY_URL,
  type SpectralSurvey,
} from "@/lib/astronomy/surveys";
import {
  TELESCOPES,
  type SpaceTelescope,
} from "@/lib/astronomy/telescopes";

export type ApplicationMode = "observatory" | "dossier";
export type CameraPerspective = "third-person" | "first-person";

// Minimal interface for Aladin engine interaction
export interface AladinEngineBridge {
  animateToRaDec: (ra: number, dec: number, durationSec: number) => void;
  gotoRaDec: (ra: number, dec: number) => void;
  setFov: (fovDeg: number) => void;
  getRaDec: () => [number, number];
  getFov: () => [number, number] | number;
  setImageSurvey: (survey: string | object) => void;
  showCooGrid: (show: boolean) => void;
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

  // Dual Camera Perspective (3ª Persona Órbita 360° vs 1ª Persona Sensor POV)
  cameraPerspective: CameraPerspective;
  setCameraPerspective: (perspective: CameraPerspective) => void;
  toggleCameraPerspective: () => void;

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
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  // Modes: "observatory" (360° free flight) | "dossier" (curated laboratory inspection)
  const [currentMode, setCurrentMode] = useState<ApplicationMode>("observatory");
  const [selectedTarget, setSelectedTarget] = useState<CosmicTarget>(DEFAULT_TARGET);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);

  // Dual Camera Perspective: "third-person" (Orbital Lock) | "first-person" (Sensor POV)
  const [cameraPerspective, setCameraPerspectiveState] = useState<CameraPerspective>("third-person");

  // Active Telescope: "jwst" | "hubble"
  const [activeTelescopeId, setActiveTelescopeIdState] = useState<"jwst" | "hubble">("jwst");
  const activeTelescope = TELESCOPES[activeTelescopeId];

  // Initial decimal coordinates calculated from default target
  const initialCoords = sexagesimalToDecimal(DEFAULT_TARGET.ra, DEFAULT_TARGET.dec);
  const [currentRa, setCurrentRa] = useState<number>(initialCoords.raDeg);
  const [currentDec, setCurrentDec] = useState<number>(initialCoords.decDeg);
  const [currentFov, setCurrentFov] = useState<number>(DEFAULT_TARGET.fov);

  // Surveys state: NASA Composite preset default with 70% overlay
  const [primarySurvey, setPrimarySurveyState] = useState<SpectralSurvey>(DEFAULT_PRIMARY_SURVEY);
  const [secondarySurvey, setSecondarySurvey] = useState<SpectralSurvey>({
    ...DEFAULT_OVERLAY_SURVEY,
    hipsUrl: JWST_NIRCAM_OVERLAY_URL,
  });
  const [blendOpacity, setBlendOpacity] = useState<number>(0.7); // 70% default for NASA Composite
  const [isNasaComposite, setIsNasaComposite] = useState<boolean>(true);

  // HUD Toggles
  const [showCrosshair, setShowCrosshair] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);

  // Engine ref
  const aladinRef = useRef<AladinEngineBridge | null>(null);

  const registerAladinInstance = useCallback((instance: AladinEngineBridge | null) => {
    aladinRef.current = instance;
  }, []);

  const updateCoordinates = useCallback((ra: number, dec: number) => {
    setCurrentRa(ra);
    setCurrentDec(dec);
  }, []);

  const updateFov = useCallback((fov: number) => {
    setCurrentFov(fov);
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

  const setCameraPerspective = useCallback((perspective: CameraPerspective) => {
    setCameraPerspectiveState(perspective);
  }, []);

  const toggleCameraPerspective = useCallback(() => {
    setCameraPerspectiveState((prev) => (prev === "third-person" ? "first-person" : "third-person"));
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

    if (id === "jwst") {
      setIsNasaComposite(true);
      setPrimarySurveyState(NASA_COMPOSITE_SURVEY);
      setSecondarySurvey((prev) => ({
        ...prev,
        hipsUrl: JWST_NIRCAM_OVERLAY_URL,
      }));
      setBlendOpacity(0.7);
    } else {
      // Hubble: Optical base, pure spectral
      setIsNasaComposite(false);
      setBlendOpacity(0.0);
      const optical = SPECTRAL_SURVEYS.find((s) => s.id === "optical") || DEFAULT_PRIMARY_SURVEY;
      setPrimarySurveyState(optical);
    }
  }, []);

  const navigateToTarget = useCallback((target: CosmicTarget) => {
    setSelectedTarget(target);
    setCurrentMode("dossier");

    const { raDeg, decDeg } = sexagesimalToDecimal(target.ra, target.dec);
    setCurrentRa(raDeg);
    setCurrentDec(decDeg);
    setCurrentFov(target.fov);

    // Smooth camera glide
    if (aladinRef.current) {
      try {
        aladinRef.current.animateToRaDec(raDeg, decDeg, 1.4);
        aladinRef.current.setFov(target.fov);
      } catch (err) {
        console.warn("[SpaceContext] Error en animación de cámara:", err);
      }
    }

    // Auto-tune primary survey if specified
    if (target.primarySurveyId) {
      if (target.primarySurveyId === "nasa-composite") {
        setIsNasaComposite(true);
        setPrimarySurveyState(NASA_COMPOSITE_SURVEY);
        setBlendOpacity(0.7);
      } else {
        const found = SPECTRAL_SURVEYS.find((s) => s.id === target.primarySurveyId);
        if (found) {
          setIsNasaComposite(false);
          setPrimarySurveyState(found);
          setBlendOpacity(0.0);
        }
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
        setSecondarySurvey((s) => ({ ...s, hipsUrl: JWST_NIRCAM_OVERLAY_URL }));
        setBlendOpacity(0.7);
        const pillars = COSMIC_TARGETS.find((t) => t.id === "pillars") || DEFAULT_TARGET;
        navigateToTarget(pillars);
      } else {
        setBlendOpacity(0.0);
      }
      return next;
    });
  }, [navigateToTarget]);

  const setPrimarySurvey = useCallback((survey: SpectralSurvey) => {
    const isComp = survey.id === "nasa-composite";
    setIsNasaComposite(isComp);
    setPrimarySurveyState(survey);
    // If user selects a manual survey, hide overlay (pure spectral analysis)
    if (!isComp) {
      setBlendOpacity(0.0);
    } else {
      setBlendOpacity(0.7);
    }
  }, []);

  const toggleCrosshair = useCallback(() => {
    setShowCrosshair((v) => !v);
  }, []);

  const toggleGrid = useCallback(() => {
    setShowGrid((v) => {
      const next = !v;
      if (aladinRef.current) {
        try {
          aladinRef.current.showCooGrid(next);
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
    cameraPerspective,
    setCameraPerspective,
    toggleCameraPerspective,
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

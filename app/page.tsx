"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { sanitizeCoordinateParams } from "@/lib/astronomy/coordinates";
import { SpaceProvider, useSpace } from "@/context/SpaceContext";
import SpaceCanvas from "@/components/space-canvas/SpaceCanvas";
import HeaderBar from "@/components/hud/HeaderBar";
import PrecisionCrosshair from "@/components/hud/PrecisionCrosshair";
import CoordinateOverlay from "@/components/hud/CoordinateOverlay";
import CaptureZoneButton from "@/components/hud/CaptureZoneButton";
import DossierDrawer from "@/components/dossier/DossierDrawer";
import CdsDownCard from "@/components/hud/CdsDownCard";
import CdsCheckingCard from "@/components/hud/CdsCheckingCard";
import { useCdsRecovery } from "@/lib/hooks/useCdsRecovery";

function AetherScopeMainViewport({
  initialRa,
  initialDec,
  initialFov,
}: {
  initialRa?: number;
  initialDec?: number;
  initialFov?: number;
}) {
  const space = useSpace();
  const { cdsState, lastCheckedTime } = useCdsRecovery();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#101015] select-none">
      {/* 1. HeaderBar: siempre visible */}
      <HeaderBar />

      {/* 2. Área Central: según estado del CDS (down, ok, checking) */}
      {cdsState === "down" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#101015]">
          <CdsDownCard lastCheckedTime={lastCheckedTime} />
        </div>
      ) : cdsState === "ok" ? (
        <>
          {/* Visor montado únicamente cuando CDS está operativo */}
          <SpaceCanvas
            initialRa={initialRa ?? space.currentRa}
            initialDec={initialDec ?? space.currentDec}
            initialFov={initialFov ?? space.currentFov}
          />
          {/* HUD táctico: solo visible con mapa activo */}
          <PrecisionCrosshair />
          <CoordinateOverlay />
          <CaptureZoneButton />
        </>
      ) : (
        /* Estado 'checking': pantalla de carga táctica sin montar visor (aparece tras delay para evitar parpadeo) */
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#101015]">
          <CdsCheckingCard />
        </div>
      )}

      {/* 3. Scientific Astronomical Dossier & Target Selector */}
      <DossierDrawer />
    </main>
  );
}

function AetherScopeMainContent() {
  const searchParams = useSearchParams();
  const raParam = searchParams.get("ra");
  const decParam = searchParams.get("dec");
  const fovParam = searchParams.get("fov");

  const hasParams = Boolean(raParam || decParam || fovParam);
  const sanitized = hasParams ? sanitizeCoordinateParams(raParam, decParam, fovParam) : null;

  const initialRa = sanitized ? sanitized.ra : undefined;
  const initialDec = sanitized ? sanitized.dec : undefined;
  const initialFov = sanitized ? sanitized.fov : undefined;

  return (
    <SpaceProvider
      initialRa={initialRa}
      initialDec={initialDec}
      initialFov={initialFov}
    >
      <AetherScopeMainViewport
        initialRa={initialRa}
        initialDec={initialDec}
        initialFov={initialFov}
      />
    </SpaceProvider>
  );
}

export default function AetherScopePage() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen bg-[#101015] flex flex-col items-center justify-center text-[#F1F0E1] space-y-4 font-[family-name:var(--font-proto)]">
          <div className="w-8 h-8 border-2 border-[#506385] border-t-[#F1F0E1] rounded-full animate-spin" />
          <p className="text-xs uppercase tracking-[0.2em] text-[#9A9A92]">
            CALIBRANDO INSTRUMENTAL ESPACIAL...
          </p>
        </div>
      }
    >
      <AetherScopeMainContent />
    </Suspense>
  );
}

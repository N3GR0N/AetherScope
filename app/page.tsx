"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { sanitizeCoordinateParams } from "@/lib/astronomy/coordinates";
import { SpaceProvider } from "@/context/SpaceContext";
import SpaceCanvas from "@/components/space-canvas/SpaceCanvas";
import HeaderBar from "@/components/hud/HeaderBar";
import PrecisionCrosshair from "@/components/hud/PrecisionCrosshair";
import CoordinateOverlay from "@/components/hud/CoordinateOverlay";
import CaptureZoneButton from "@/components/hud/CaptureZoneButton";
import DossierDrawer from "@/components/dossier/DossierDrawer";

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
      <main className="relative w-screen h-screen overflow-hidden bg-[#101015] select-none">
        {/* 1. Infinite Deep Space Optical Canvas (Permanent DSS2 Color Clean Baseline) */}
        <SpaceCanvas
          initialRa={initialRa}
          initialDec={initialDec}
          initialFov={initialFov}
        />

        {/* 2. Precision Inspection Reticle HUD */}
        <PrecisionCrosshair />

        {/* 3. Top Unified Navigation Bar */}
        <HeaderBar />

        {/* 4. Real-time Celestial Coordinates Card (Bottom-Left) */}
        <CoordinateOverlay />

        {/* 5. Tactical Target Scanner & Capture Zone Button (Bottom-Center) */}
        <CaptureZoneButton />

        {/* 6. Scientific Astronomical Dossier & Target Selector (Modal / Drawer) */}
        <DossierDrawer />
      </main>
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

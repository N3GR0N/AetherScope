"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
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

  const parsedRa = raParam ? parseFloat(raParam) : undefined;
  const parsedDec = decParam ? parseFloat(decParam) : undefined;
  const parsedFov = fovParam ? parseFloat(fovParam) : undefined;

  const initialRa = parsedRa !== undefined && !isNaN(parsedRa) ? parsedRa : undefined;
  const initialDec = parsedDec !== undefined && !isNaN(parsedDec) ? parsedDec : undefined;
  const initialFov = parsedFov !== undefined && !isNaN(parsedFov) ? parsedFov : undefined;

  return (
    <SpaceProvider
      initialRa={initialRa}
      initialDec={initialDec}
      initialFov={initialFov}
    >
      <main className="relative w-screen h-screen overflow-hidden bg-black select-none">
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

        {/* 6. Deep Space Dossier Catalog Drawer */}
        <DossierDrawer />
      </main>
    </SpaceProvider>
  );
}

export default function AetherScopePage() {
  return (
    <Suspense fallback={<div className="w-screen h-screen bg-black" />}>
      <AetherScopeMainContent />
    </Suspense>
  );
}

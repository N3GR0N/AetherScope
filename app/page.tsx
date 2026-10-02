"use client";

import { SpaceProvider } from "@/context/SpaceContext";
import SpaceCanvas from "@/components/space-canvas/SpaceCanvas";
import HeaderBar from "@/components/hud/HeaderBar";
import PrecisionCrosshair from "@/components/hud/PrecisionCrosshair";
import CoordinateOverlay from "@/components/hud/CoordinateOverlay";
import CaptureZoneButton from "@/components/hud/CaptureZoneButton";
import DossierDrawer from "@/components/dossier/DossierDrawer";

export default function AetherScopePage() {
  return (
    <SpaceProvider>
      <main className="relative w-screen h-screen overflow-hidden bg-black select-none">
        {/* 1. Infinite Deep Space Optical Canvas (DSS2 Color Clean Baseline) */}
        <SpaceCanvas />

        {/* 2. Precision Inspection Reticle HUD */}
        <PrecisionCrosshair />

        {/* 3. Top Unified macOS Pro / Sonoma Navigation Bar */}
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

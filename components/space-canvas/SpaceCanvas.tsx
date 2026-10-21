"use client";

import dynamic from "next/dynamic";
import type { SpectralSurvey } from "@/lib/astronomy/surveys";
import type { CosmicTarget } from "@/lib/astronomy/targets";

const DynamicSpaceCanvas = dynamic(
  () => import("./SpaceCanvas.client"),
  { ssr: false }
);

interface SpaceCanvasWrapperProps {
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
}

export default function SpaceCanvas(props: SpaceCanvasWrapperProps = {}) {
  return <DynamicSpaceCanvas {...props} />;
}

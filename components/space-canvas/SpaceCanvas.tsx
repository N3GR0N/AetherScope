"use client";

import dynamic from "next/dynamic";
import type { SpectralSurvey } from "@/lib/astronomy/surveys";
import type { CelestialTarget } from "@/lib/astronomy/targets";

const DynamicSpaceCanvas = dynamic(
  () => import("./SpaceCanvas.client"),
  { ssr: false }
);

interface SpaceCanvasWrapperProps {
  primarySurvey?: SpectralSurvey;
  secondarySurvey?: SpectralSurvey;
  blendOpacity?: number;
  activeTarget?: CelestialTarget;
  showGrid?: boolean;
  onCoordinatesChange?: (ra: number, dec: number) => void;
  onFovChange?: (fov: number) => void;
}

export default function SpaceCanvas(props: SpaceCanvasWrapperProps = {}) {
  return <DynamicSpaceCanvas {...props} />;
}

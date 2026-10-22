"use client";

import { useSpace } from "@/context/SpaceContext";
import {
  formatCoordinates,
  formatFov,
  getConstellation,
} from "@/lib/astronomy/coordinates";

interface CoordinateOverlayProps {
  ra?: number;
  dec?: number;
  fov?: number;
}

export default function CoordinateOverlay(props: CoordinateOverlayProps = {}) {
  const space = useSpace();
  const { activeTelescope } = space;

  const ra = props.ra ?? space.currentRa;
  const dec = props.dec ?? space.currentDec;
  const fov = props.fov ?? space.currentFov;
  const coords = formatCoordinates(ra, dec);
  const fovInfo = formatFov(fov);
  const constellation = getConstellation(ra, dec);

  // Extract clean numerical fov for hero readout
  const fovNumber = fovInfo.value;
  const fovUnit = fovInfo.unit.toUpperCase();

  return (
    <aside
      aria-label="Telemetría de Coordenadas Astronómicas y Órbita"
      className="fixed bottom-5 left-5 z-30 w-[320px] sm:w-[350px] max-w-[calc(100vw-2.5rem)] pointer-events-auto flex flex-col gap-2 font-[family-name:var(--font-proto)] select-none"
    >
      {/* ── CARD 1: SISTEMA J2000.0 Y COORDENADAS ── */}
      <div className="bg-[#1A1A1F] border border-[#2B2B31] p-3.5 flex flex-col gap-2.5">
        {/* Top Header: System & Constellation */}
        <div className="flex items-center justify-between text-[10px] tracking-[0.16em] uppercase">
          <span className="text-[#F1F0E1] font-semibold">SISTEMA J2000.0</span>
          <span className="text-[#9A9A92] truncate max-w-[150px]">
            {constellation}
          </span>
        </div>

        {/* 2-column Coordinates Grid */}
        <div className="grid grid-cols-2 gap-3 pt-0.5">
          {/* RA */}
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase tracking-[0.14em] text-[#9A9A92] block">
              Ascensión Recta
            </span>
            <div className="text-[13px] text-[#F1F0E1] font-medium tabular-nums">
              {coords.raHms}
            </div>
            <div className="text-[10px] text-[#9A9A92] tabular-nums">
              {coords.raDegrees}
            </div>
          </div>

          {/* Dec */}
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase tracking-[0.14em] text-[#9A9A92] block">
              Declinación
            </span>
            <div className="text-[13px] text-[#F1F0E1] font-medium tabular-nums">
              {coords.decDms}
            </div>
            <div className="text-[10px] text-[#9A9A92] tabular-nums">
              {coords.decDegrees}
            </div>
          </div>
        </div>
      </div>

      {/* ── CARD 2 & 3: ESCALA FOV & ESTADO ORBITAL ── */}
      <div className="grid grid-cols-2 gap-2">
        {/* Escala (FOV) Card in --accent */}
        <div className="bg-[#506385] border border-[#506385] p-3.5 flex flex-col justify-between min-h-[90px]">
          <span className="text-[9px] uppercase tracking-[0.16em] text-[#F1F0E1]/80 block">
            ESCALA (FOV)
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-[34px] font-bold text-[#F1F0E1] leading-none tabular-nums">
              {fovNumber}
            </span>
            <span className="text-[10px] text-[#F1F0E1]/80 uppercase tracking-wider font-medium">
              / {fovUnit}
            </span>
          </div>
        </div>

        {/* Space Telescope Orbital Status */}
        <div className="bg-[#1A1A1F] border border-[#2B2B31] p-3.5 flex flex-col justify-between min-h-[90px]">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.14em] text-[#F1F0E1] font-semibold truncate max-w-[110px]">
              {activeTelescope.name}
            </span>
            <div className="w-1.5 h-1.5 bg-[#F1F0E1] shrink-0" />
          </div>

          <div className="space-y-0.5 my-1">
            <div className="text-[8.5px] text-[#9A9A92] uppercase leading-tight line-clamp-1">
              {activeTelescope.orbitType}
            </div>
          </div>

          <div className="text-[12px] text-[#F1F0E1] font-medium tabular-nums truncate">
            {activeTelescope.altitudeInfo.split(" ")[0]} <span className="text-[9px] text-[#9A9A92]">KM</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

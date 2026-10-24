/**
 * AetherScope - Procedural Celestial Avatar Generator
 * Genera avatares astronómicos vectoriales únicos (constelaciones, anillos orbitales y retículas)
 * manteniendo estrictamente la paleta de diseño:
 * - Celeste espacial: #506385
 * - Cremita: #F1F0E1
 * - Grises técnicos: #9A9A92, #2B2B31, #17171C, #101015
 */

import React from "react";

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createPrng(seedNumber: number) {
  let state = seedNumber;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRandomSeed(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "OP-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface CelestialAvatarProps {
  seed: string;
  size?: number;
  className?: string;
}

export function CelestialAvatar({ seed, size = 96, className = "" }: CelestialAvatarProps) {
  const hash = hashString(seed || "aetherscope-default");
  const rand = createPrng(hash);

  // 1. Número de vértices de la constelación (4 a 7 estrellas)
  const nodeCount = 4 + Math.floor(rand() * 4);
  const nodes: { x: number; y: number; r: number; isMajor: boolean }[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const angle = (i * (2 * Math.PI)) / nodeCount + (rand() - 0.5) * 0.7;
    const distance = 16 + rand() * 26; // Rango radial [16, 42]
    const x = 60 + Math.cos(angle) * distance;
    const y = 60 + Math.sin(angle) * distance;
    const isMajor = i === 0 || rand() > 0.65;
    nodes.push({ x, y, r: isMajor ? 2.8 : 1.8, isMajor });
  }

  // 2. Líneas de constelación entre nodos sucesivos
  const constellationLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    constellationLines.push({
      x1: nodes[i].x,
      y1: nodes[i].y,
      x2: nodes[i + 1].x,
      y2: nodes[i + 1].y,
    });
  }
  // Enlace de cierre aleatorio
  if (rand() > 0.4 && nodes.length > 2) {
    constellationLines.push({
      x1: nodes[nodes.length - 1].x,
      y1: nodes[nodes.length - 1].y,
      x2: nodes[0].x,
      y2: nodes[0].y,
    });
  }

  // 3. Parámetros de órbita elíptica
  const orbitRotation = Math.floor(rand() * 180);
  const orbitRx = 38 + rand() * 8;
  const orbitRy = 14 + rand() * 8;

  // 4. Parámetros de núcleo central
  const coreRadius = 3.5 + rand() * 1.5;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        {/* Gradiente celestial */}
        <radialGradient id={`glow-${hash}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#506385" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#17171C" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#101015" stopOpacity="1" />
        </radialGradient>
      </defs>

      {/* Fondo circular */}
      <circle cx="60" cy="60" r="58" fill={`url(#glow-${hash})`} stroke="#2B2B31" strokeWidth="1.5" />

      {/* Retícula circular exterior y cruz de puntería */}
      <circle cx="60" cy="60" r="50" stroke="#3A3A42" strokeWidth="0.75" strokeDasharray="3 3" />
      <circle cx="60" cy="60" r="48" stroke="#506385" strokeWidth="0.5" opacity="0.4" />

      {/* Ticks en cuadrantes */}
      <line x1="60" y1="4" x2="60" y2="10" stroke="#F1F0E1" strokeWidth="1.5" />
      <line x1="60" y1="110" x2="60" y2="116" stroke="#F1F0E1" strokeWidth="1.5" />
      <line x1="4" y1="60" x2="10" y2="60" stroke="#F1F0E1" strokeWidth="1.5" />
      <line x1="110" y1="60" x2="116" y2="60" stroke="#F1F0E1" strokeWidth="1.5" />

      {/* Órbita elíptica inclinada */}
      <ellipse
        cx="60"
        cy="60"
        rx={orbitRx}
        ry={orbitRy}
        transform={`rotate(${orbitRotation} 60 60)`}
        stroke="#506385"
        strokeWidth="1.2"
        strokeDasharray="2 3"
        opacity="0.8"
      />

      {/* Segmentos de líneas de la constelación */}
      {constellationLines.map((line, idx) => (
        <line
          key={`cl-${idx}`}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#506385"
          strokeWidth="1"
          opacity="0.65"
        />
      ))}

      {/* Vértices de estrellas de la constelación */}
      {nodes.map((node, idx) => (
        <g key={`cn-${idx}`}>
          {node.isMajor && (
            <circle cx={node.x} cy={node.y} r={node.r * 2} fill="#506385" opacity="0.3" />
          )}
          <circle cx={node.x} cy={node.y} r={node.r} fill="#F1F0E1" />
        </g>
      ))}

      {/* Halo del núcleo central */}
      <circle cx="60" cy="60" r={coreRadius * 3} fill="#506385" opacity="0.25" />
      <circle cx="60" cy="60" r={coreRadius * 1.8} stroke="#506385" strokeWidth="0.8" opacity="0.8" />

      {/* Estrella central púlsar */}
      <circle cx="60" cy="60" r={coreRadius} fill="#F1F0E1" />
      <circle cx="60" cy="60" r="1.5" fill="#101015" />

      {/* Código de firma de operador en la base */}
      <text
        x="60"
        y="102"
        textAnchor="middle"
        fill="#9A9A92"
        fontSize="6.5"
        fontFamily="var(--font-proto), monospace"
        letterSpacing="0.16em"
      >
        {seed.toUpperCase().slice(0, 8)}
      </text>
    </svg>
  );
}

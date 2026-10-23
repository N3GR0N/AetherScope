/**
 * AetherScope - Celestial Object Footprint & Tangent Plane Classification Engine
 * Proyección plana gnomónica/tangente y cálculo elíptico de extensión angular.
 */

import { calculateAngularSeparation } from './coordinates';

export interface Capture {
  raDeg: number;
  decDeg: number;
  radiusDeg: number; // Radio angular de la captura (FOV / 2)
}

export type CaptureMatchState = 'inside' | 'edge' | 'none';

/**
 * Radio máximo de coincidencia angular para fuentes puntuales (estrellas, núcleos compactos) en minutos de arco.
 * Heurística ajustable; no proviene de la literatura astrofísica.
 */
export const POINT_SOURCE_MATCH_RADIUS_ARCMIN = 2.0;

/**
 * Tabla única de fallbacks de tamaño angular estimado por categoría o tipo de objeto,
 * utilizada cuando el objeto no posee diámetros verificables en SIMBAD o NED.
 * Son DIÁMETROS completos en minutos de arco (arcmin), no semiejes.
 */
export const DEFAULT_OBJECT_TYPE_FOOTPRINTS: Record<
  string,
  { majorArcmin: number; minorArcmin: number }
> = {
  // Guarderías estelares y nebulosas difusas
  nebula: { majorArcmin: 30, minorArcmin: 20 },
  'h ii': { majorArcmin: 30, minorArcmin: 20 },
  // Galaxias típicas
  galaxy: { majorArcmin: 10, minorArcmin: 5 },
  // Cúmulos de galaxias y lentes gravitacionales
  'deep-field': { majorArcmin: 8, minorArcmin: 8 },
  cluster: { majorArcmin: 8, minorArcmin: 8 },
  // Remanentes de supernova
  'supernova-remnant': { majorArcmin: 8, minorArcmin: 6 },
  snr: { majorArcmin: 8, minorArcmin: 6 },
  // Fuentes compactas y estelares (tratadas como fuentes puntuales)
  'black-hole': { majorArcmin: 0, minorArcmin: 0 },
  star: { majorArcmin: 0, minorArcmin: 0 },
  // Fallback genérico
  default: { majorArcmin: 10, minorArcmin: 10 },
};

export interface FootprintTarget {
  raDeg: number;
  decDeg: number;
  /**
   * DIÁMETROS angulares completos en minutos de arco (arcmin), NO semiejes.
   * positionAngleDeg: Ángulo de posición del semieje mayor en grados (0-180), medido de Norte hacia Este.
   * sizeSource: Origen de los datos ('simbad' | 'ned' | 'estimate').
   */
  majorDiameterArcmin?: number;
  minorDiameterArcmin?: number;
  positionAngleDeg?: number;
  sizeSource?: 'simbad' | 'ned' | 'estimate';
  objectType?: string;
  nature?: string;
  category?: string;
}

export interface CaptureClassification {
  state: CaptureMatchState;
  separationDeg: number;
  normalizedRadius: number; // rho = sqrt((x/a)^2 + (y/b)^2)
  angularAreaArcmin2: number; // pi * a * b
  effectiveMajorDiameterArcmin: number;
  effectiveMinorDiameterArcmin: number;
  effectivePositionAngleDeg: number;
  sizeSource: 'simbad' | 'ned' | 'estimate';
  isPointSource: boolean;
}

/**
 * Resuelve el tamaño angular efectivo de un objeto utilizando sus datos verificados
 * o recurriendo a la tabla centralizada de fallbacks si no están definidos.
 */
export function resolveEffectiveFootprint(obj: FootprintTarget): {
  majorDiameterArcmin: number;
  minorDiameterArcmin: number;
  positionAngleDeg: number;
  sizeSource: 'simbad' | 'ned' | 'estimate';
  isPointSource: boolean;
} {
  if (typeof obj.majorDiameterArcmin === 'number' && obj.majorDiameterArcmin > 0) {
    const major = obj.majorDiameterArcmin;
    const minor = typeof obj.minorDiameterArcmin === 'number' && obj.minorDiameterArcmin > 0
      ? obj.minorDiameterArcmin
      : major;
    const pa = typeof obj.positionAngleDeg === 'number' ? obj.positionAngleDeg : 0;
    return {
      majorDiameterArcmin: major,
      minorDiameterArcmin: minor,
      positionAngleDeg: pa,
      sizeSource: obj.sizeSource ?? 'estimate',
      isPointSource: false,
    };
  }

  // Búsqueda en la tabla de fallback por tipo / naturaleza / categoría
  const typeKey = (obj.category || obj.nature || obj.objectType || '').toLowerCase();
  let match = DEFAULT_OBJECT_TYPE_FOOTPRINTS.default;

  for (const [key, size] of Object.entries(DEFAULT_OBJECT_TYPE_FOOTPRINTS)) {
    if (key !== 'default' && typeKey.includes(key)) {
      match = size;
      break;
    }
  }

  const isPoint = match.majorArcmin <= 0;

  return {
    majorDiameterArcmin: match.majorArcmin,
    minorDiameterArcmin: match.minorArcmin,
    positionAngleDeg: 0,
    sizeSource: 'estimate',
    isPointSource: isPoint,
  };
}

/**
 * Proyecta un punto celeste (raDeg, decDeg) al plano tangente gnomónico centrado en (centerRaDeg, centerDecDeg).
 * Retorna las coordenadas estándar (xi, eta) en minutos de arco:
 * xi: hacia el Este (+).
 * eta: hacia el Norte (+).
 * Maneja correctamente el wrap de RA en 0/360 y declinaciones altas.
 */
export function projectToTangentPlane(
  raDeg: number,
  decDeg: number,
  centerRaDeg: number,
  centerDecDeg: number
): { xiArcmin: number; etaArcmin: number; valid: boolean } {
  const DEG_TO_RAD = Math.PI / 180;
  const RAD_TO_ARCMIN = (180 * 60) / Math.PI;

  const alpha0 = centerRaDeg * DEG_TO_RAD;
  const delta0 = centerDecDeg * DEG_TO_RAD;
  const alpha = raDeg * DEG_TO_RAD;
  const delta = decDeg * DEG_TO_RAD;

  // Normalizar diferencia de RA a [-pi, pi] para manejar el wrap 0 / 360
  let dAlpha = (alpha - alpha0) % (2 * Math.PI);
  if (dAlpha > Math.PI) dAlpha -= 2 * Math.PI;
  if (dAlpha < -Math.PI) dAlpha += 2 * Math.PI;

  const cosDelta = Math.cos(delta);
  const sinDelta = Math.sin(delta);
  const cosDelta0 = Math.cos(delta0);
  const sinDelta0 = Math.sin(delta0);
  const cosDAlpha = Math.cos(dAlpha);
  const sinDAlpha = Math.sin(dAlpha);

  // Coseno de la separación angular entre el centro y el punto
  const cosDist = sinDelta0 * sinDelta + cosDelta0 * cosDelta * cosDAlpha;
  if (cosDist <= 0) {
    // El punto se ubica en el hemisferio opuesto (> 90 grados)
    return { xiArcmin: Infinity, etaArcmin: Infinity, valid: false };
  }

  // Fórmulas estándar de proyección gnomónica:
  const xiRad = (cosDelta * sinDAlpha) / cosDist;
  const etaRad = (cosDelta0 * sinDelta - sinDelta0 * cosDelta * cosDAlpha) / cosDist;

  return {
    xiArcmin: xiRad * RAD_TO_ARCMIN,
    etaArcmin: etaRad * RAD_TO_ARCMIN,
    valid: true,
  };
}

/**
 * Clasifica la relación espacial entre una captura astronómica y un objeto celeste.
 * - 'inside': el centro de la captura se ubica dentro de la huella elíptica del objeto (rho <= 1).
 * - 'edge': el centro no está dentro, pero el campo de captura solapa la huella elíptica (rho_inflado <= 1).
 * - 'none': fuera de la huella y del radio de captura.
 */
export function classifyCapture(
  capture: Capture,
  obj: FootprintTarget
): CaptureClassification {
  const separationDeg = calculateAngularSeparation(
    capture.raDeg,
    capture.decDeg,
    obj.raDeg,
    obj.decDeg
  );

  const footprint = resolveEffectiveFootprint(obj);

  // 1. Caso: Fuente puntual (sin extensión o con diámetro cero)
  if (footprint.isPointSource || footprint.majorDiameterArcmin <= 0) {
    const sepArcmin = separationDeg * 60;
    const captureRadiusArcmin = capture.radiusDeg * 60;

    let state: CaptureMatchState = 'none';
    let normalized = sepArcmin / POINT_SOURCE_MATCH_RADIUS_ARCMIN;

    if (sepArcmin <= POINT_SOURCE_MATCH_RADIUS_ARCMIN) {
      state = 'inside';
      normalized = sepArcmin / POINT_SOURCE_MATCH_RADIUS_ARCMIN;
    } else if (sepArcmin <= POINT_SOURCE_MATCH_RADIUS_ARCMIN + captureRadiusArcmin) {
      state = 'edge';
      normalized = sepArcmin / (POINT_SOURCE_MATCH_RADIUS_ARCMIN + captureRadiusArcmin);
    }

    return {
      state,
      separationDeg,
      normalizedRadius: normalized,
      angularAreaArcmin2: 0,
      effectiveMajorDiameterArcmin: 0,
      effectiveMinorDiameterArcmin: 0,
      effectivePositionAngleDeg: 0,
      sizeSource: footprint.sizeSource,
      isPointSource: true,
    };
  }

  // 2. Caso: Objeto extendido (huella elíptica o circular)
  const proj = projectToTangentPlane(
    capture.raDeg,
    capture.decDeg,
    obj.raDeg,
    obj.decDeg
  );

  if (!proj.valid) {
    return {
      state: 'none',
      separationDeg,
      normalizedRadius: Infinity,
      angularAreaArcmin2: Math.PI * (footprint.majorDiameterArcmin / 2) * (footprint.minorDiameterArcmin / 2),
      effectiveMajorDiameterArcmin: footprint.majorDiameterArcmin,
      effectiveMinorDiameterArcmin: footprint.minorDiameterArcmin,
      effectivePositionAngleDeg: footprint.positionAngleDeg,
      sizeSource: footprint.sizeSource,
      isPointSource: false,
    };
  }

  const { xiArcmin, etaArcmin } = proj;

  // Semiejes del objeto en minutos de arco:
  const a = footprint.majorDiameterArcmin / 2;
  const b = footprint.minorDiameterArcmin / 2;
  const r = capture.radiusDeg * 60; // Radio de captura en arcmin

  // Rotación por el Ángulo de Posición (PA medido de Norte hacia Este):
  // Si no hay ángulo de posición o es 0, theta = 0 (semieje mayor a lo largo de Norte eta).
  const thetaRad = footprint.positionAngleDeg * (Math.PI / 180);
  const sinTheta = Math.sin(thetaRad);
  const cosTheta = Math.cos(thetaRad);

  // Coordenadas rotadas a los ejes principales de la elipse:
  // x: a lo largo del semieje mayor (PA theta)
  // y: perpendicular a lo largo del semieje menor
  const x = xiArcmin * sinTheta + etaArcmin * cosTheta;
  const y = xiArcmin * cosTheta - etaArcmin * sinTheta;

  // Radio elíptico normalizado: rho = sqrt((x/a)^2 + (y/b)^2)
  const termA = x / a;
  const termB = y / b;
  const rho = Math.sqrt(termA * termA + termB * termB);

  const angularAreaArcmin2 = Math.PI * a * b;

  if (rho <= 1.0) {
    return {
      state: 'inside',
      separationDeg,
      normalizedRadius: rho,
      angularAreaArcmin2,
      effectiveMajorDiameterArcmin: footprint.majorDiameterArcmin,
      effectiveMinorDiameterArcmin: footprint.minorDiameterArcmin,
      effectivePositionAngleDeg: footprint.positionAngleDeg,
      sizeSource: footprint.sizeSource,
      isPointSource: false,
    };
  }

  // Verificación de borde con elipse inflada por el radio de captura:
  // sqrt((x / (a + r))^2 + (y / (b + r))^2) <= 1
  const termAInflated = x / (a + r);
  const termBInflated = y / (b + r);
  const rhoInflated = Math.sqrt(termAInflated * termAInflated + termBInflated * termBInflated);

  if (rhoInflated <= 1.0) {
    return {
      state: 'edge',
      separationDeg,
      normalizedRadius: rho,
      angularAreaArcmin2,
      effectiveMajorDiameterArcmin: footprint.majorDiameterArcmin,
      effectiveMinorDiameterArcmin: footprint.minorDiameterArcmin,
      effectivePositionAngleDeg: footprint.positionAngleDeg,
      sizeSource: footprint.sizeSource,
      isPointSource: false,
    };
  }

  return {
    state: 'none',
    separationDeg,
    normalizedRadius: rho,
    angularAreaArcmin2,
    effectiveMajorDiameterArcmin: footprint.majorDiameterArcmin,
    effectiveMinorDiameterArcmin: footprint.minorDiameterArcmin,
    effectivePositionAngleDeg: footprint.positionAngleDeg,
    sizeSource: footprint.sizeSource,
    isPointSource: false,
  };
}

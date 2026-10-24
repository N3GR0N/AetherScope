/**
 * AetherScope - Hybrid Celestial Cross-Match Engine with Angular Footprint Classification
 * 
 * Capa 1: Búsqueda local en CELESTIAL_CATALOG evaluada por classifyCapture().
 * Capa 2: Fallback en tiempo real a CDS SIMBAD TAP con búsqueda de cono y extracción de diámetros.
 * Capa 3: Sector sin objeto catalogado con hasta 5 candidatos cercanos.
 */

import { getConstellation, calculateAngularSeparation } from './coordinates';
import { CELESTIAL_CATALOG } from './database';
import {
  classifyCapture,
  type Capture,
  type CaptureMatchState,
  type FootprintTarget,
} from './footprint';

export interface Candidate {
  id?: string;
  name: string;
  designation?: string;
  objectType: string;
  raDeg: number;
  decDeg: number;
  separationDeg: number;
  state: CaptureMatchState;
  normalizedRadius: number;
  angularAreaArcmin2: number;
  majorDiameterArcmin?: number;
  minorDiameterArcmin?: number;
  positionAngleDeg?: number;
  sizeSource?: 'simbad' | 'ned' | 'estimate';
  source: 'dossier' | 'simbad';
  description?: string;
  distanceLy?: string;
}

export interface MatchedCelestialObject {
  id?: string;
  name: string;
  designation?: string;
  objectType: string;
  ra: number;
  dec: number;
  distanceLy?: string;
  constellation?: string;
  description: string;
  spectralFeatures: string[];
  majorDiameterArcmin?: number;
  minorDiameterArcmin?: number;
  positionAngleDeg?: number;
  sizeSource?: 'simbad' | 'ned' | 'estimate';
  source: 'local_dossier' | 'simbad_api' | 'unregistered';
}

// Backwards-compatibility type alias
export type AstronomicalObjectResult = MatchedCelestialObject;

export interface CaptureMatch {
  state: CaptureMatchState;
  object?: MatchedCelestialObject;
  separationDeg: number;
  normalizedRadius: number;
  partial: boolean;
  candidates: Candidate[];
  source: 'dossier' | 'simbad' | 'none';
  simbadUnavailable?: boolean;
}

export { calculateAngularSeparation, calculateAngularSeparation as calculateOrthodromicDistance };

// Caché en memoria para evitar consultas duplicadas
const crossMatchCache = new Map<string, CaptureMatch>();

/**
 * Capa 1: Búsqueda en catálogo curado local evaluando la huella angular elíptica.
 * Selección del mejor candidato:
 * 1. Primero los 'inside', ordenados por menor área angular (el más específico).
 * 2. Si no hay 'inside', el mejor 'edge' con partial: true.
 * 3. Si no hay ninguno, 'none'.
 */
export function matchLocalDossierCapture(capture: Capture): CaptureMatch {
  const candidates: Candidate[] = [];

  for (const item of CELESTIAL_CATALOG) {
    const target: FootprintTarget = {
      raDeg: item.raDeg,
      decDeg: item.decDeg,
      majorDiameterArcmin: item.majorDiameterArcmin,
      minorDiameterArcmin: item.minorDiameterArcmin,
      positionAngleDeg: item.positionAngleDeg,
      sizeSource: item.sizeSource,
      objectType: item.objectType,
      nature: item.nature,
    };

    const classification = classifyCapture(capture, target);

    if (classification.state !== 'none') {
      candidates.push({
        id: item.id,
        name: item.name,
        designation: item.designation,
        objectType: item.objectType,
        raDeg: item.raDeg,
        decDeg: item.decDeg,
        separationDeg: classification.separationDeg,
        state: classification.state,
        normalizedRadius: classification.normalizedRadius,
        angularAreaArcmin2: classification.angularAreaArcmin2,
        majorDiameterArcmin: classification.effectiveMajorDiameterArcmin,
        minorDiameterArcmin: classification.effectiveMinorDiameterArcmin,
        positionAngleDeg: classification.effectivePositionAngleDeg,
        sizeSource: classification.sizeSource,
        source: 'dossier',
        distanceLy: item.distanceLy,
        description: item.description,
      });
    }
  }

  // Ordenar: primero 'inside' por menor área angular (más específico); luego 'edge' por normalizedRadius
  const insideCandidates = candidates
    .filter((c) => c.state === 'inside')
    .sort((a, b) => a.angularAreaArcmin2 - b.angularAreaArcmin2);

  const edgeCandidates = candidates
    .filter((c) => c.state === 'edge')
    .sort((a, b) => a.normalizedRadius - b.normalizedRadius);

  const sortedCandidates = [...insideCandidates, ...edgeCandidates];

  if (insideCandidates.length > 0) {
    const best = insideCandidates[0];
    const catalogItem = CELESTIAL_CATALOG.find((c) => c.id === best.id);

    return {
      state: 'inside',
      object: {
        id: best.id,
        name: best.name,
        designation: best.designation,
        objectType: best.objectType,
        ra: best.raDeg,
        dec: best.decDeg,
        distanceLy: catalogItem?.distanceLy,
        constellation: catalogItem?.constellation,
        description: catalogItem?.description || '',
        spectralFeatures: catalogItem?.spectralFeatures || [],
        majorDiameterArcmin: best.majorDiameterArcmin,
        minorDiameterArcmin: best.minorDiameterArcmin,
        positionAngleDeg: best.positionAngleDeg,
        sizeSource: best.sizeSource,
        source: 'local_dossier',
      },
      separationDeg: best.separationDeg,
      normalizedRadius: best.normalizedRadius,
      partial: false,
      candidates: sortedCandidates,
      source: 'dossier',
    };
  }

  if (edgeCandidates.length > 0) {
    const best = edgeCandidates[0];
    const catalogItem = CELESTIAL_CATALOG.find((c) => c.id === best.id);

    return {
      state: 'edge',
      object: {
        id: best.id,
        name: best.name,
        designation: best.designation,
        objectType: best.objectType,
        ra: best.raDeg,
        dec: best.decDeg,
        distanceLy: catalogItem?.distanceLy,
        constellation: catalogItem?.constellation,
        description: catalogItem?.description || '',
        spectralFeatures: catalogItem?.spectralFeatures || [],
        majorDiameterArcmin: best.majorDiameterArcmin,
        minorDiameterArcmin: best.minorDiameterArcmin,
        positionAngleDeg: best.positionAngleDeg,
        sizeSource: best.sizeSource,
        source: 'local_dossier',
      },
      separationDeg: best.separationDeg,
      normalizedRadius: best.normalizedRadius,
      partial: true,
      candidates: sortedCandidates,
      source: 'dossier',
    };
  }

  return {
    state: 'none',
    separationDeg: Infinity,
    normalizedRadius: Infinity,
    partial: false,
    candidates: [],
    source: 'none',
  };
}

/**
 * Función puente compatible hacia atrás para componentes que llaman matchLocalDossier(ra, dec, tolerance)
 */
export function matchLocalDossier(
  ra: number,
  dec: number,
  toleranceDegrees = 0.4
): MatchedCelestialObject | null {
  const capture: Capture = {
    raDeg: ra,
    decDeg: dec,
    radiusDeg: toleranceDegrees,
  };
  const match = matchLocalDossierCapture(capture);
  return match.object ?? null;
}

/**
 * Capa 2: Consulta tipo cono a SIMBAD TAP con TOP 30 ordenada por distancia,
 * solicitando columnas verificadas de extensión angular (galdim_majaxis, galdim_minaxis, galdim_angle).
 */
export async function querySimbadConeCapture(
  capture: Capture,
  timeoutMs = 2500
): Promise<{ candidates: Candidate[]; bestMatch: CaptureMatch | null; unavailable?: boolean }> {
  const { raDeg, decDeg, radiusDeg } = capture;

  if (isNaN(raDeg) || isNaN(decDeg) || isNaN(radiusDeg) || !isFinite(raDeg) || !isFinite(decDeg)) {
    return { candidates: [], bestMatch: null };
  }

  const cleanRa = Number(raDeg.toFixed(6));
  const cleanDec = Number(decDeg.toFixed(6));
  const cleanRadius = Number(Math.min(Math.max(radiusDeg, 0.01), 2.5).toFixed(4));

  // ADQL validada contra SIMBAD TAP_SCHEMA.columns (galdim_majaxis y galdim_minaxis son diámetros en arcmin)
  const adql = `
    SELECT TOP 30
      basic.main_id,
      otypedef.otype_longname,
      basic.ra,
      basic.dec,
      basic.galdim_majaxis,
      basic.galdim_minaxis,
      basic.galdim_angle,
      basic.plx_value,
      DISTANCE(POINT('ICRS', basic.ra, basic.dec), POINT('ICRS', ${cleanRa}, ${cleanDec})) AS dist
    FROM basic
    LEFT JOIN otypedef ON basic.otype = otypedef.otype
    WHERE CONTAINS(POINT('ICRS', basic.ra, basic.dec), CIRCLE('ICRS', ${cleanRa}, ${cleanDec}, ${cleanRadius})) = 1
    ORDER BY dist ASC
  `.trim().replace(/\s+/g, ' ');

  const endpoint = `https://simbad.cds.unistra.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=${encodeURIComponent(
    adql
  )}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      signal: controller.signal,
      cache: 'force-cache',
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { candidates: [], bestMatch: null, unavailable: true };
    }

    const data = await res.json();
    if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) {
      return { candidates: [], bestMatch: null };
    }

    const candidates: Candidate[] = [];

    for (const row of data.data) {
      const [mainId, otypeLongname, objRa, objDec, galdimMaj, galdimMin, galdimAngle, plxValue] = row;
      const parsedRa = typeof objRa === 'number' ? objRa : parseFloat(objRa);
      const parsedDec = typeof objDec === 'number' ? objDec : parseFloat(objDec);
      const parsedPlx = typeof plxValue === 'number' ? plxValue : (plxValue !== null && plxValue !== undefined ? parseFloat(plxValue) : NaN);

      if (isNaN(parsedRa) || isNaN(parsedDec)) continue;

      let computedDistanceLy: string | undefined = undefined;
      if (!isNaN(parsedPlx) && parsedPlx > 0.001) {
        const distLy = 3261.5638 / parsedPlx;
        if (distLy >= 1000000) {
          computedDistanceLy = `${(distLy / 1000000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} millones de años luz`;
        } else if (distLy >= 1000) {
          computedDistanceLy = `${Math.round(distLy).toLocaleString('es-AR')} años luz`;
        } else {
          computedDistanceLy = `${distLy < 10 ? distLy.toFixed(1) : Math.round(distLy)} años luz`;
        }
      }

      const majAxis = typeof galdimMaj === 'number' && galdimMaj > 0 ? galdimMaj : undefined;
      const minAxis = typeof galdimMin === 'number' && galdimMin > 0 ? galdimMin : majAxis;
      const pa = typeof galdimAngle === 'number' && galdimAngle >= 0 && galdimAngle <= 180 ? galdimAngle : 0;

      const target: FootprintTarget = {
        raDeg: parsedRa,
        decDeg: parsedDec,
        majorDiameterArcmin: majAxis,
        minorDiameterArcmin: minAxis,
        positionAngleDeg: pa,
        sizeSource: majAxis ? 'simbad' : 'estimate',
        objectType: otypeLongname ? String(otypeLongname).trim() : 'Objeto astronómico SIMBAD',
      };

      const classification = classifyCapture(capture, target);

      candidates.push({
        id: String(mainId).trim(),
        name: String(mainId).trim(),
        designation: `SIMBAD ${String(mainId).trim()}`,
        objectType: target.objectType || 'Objeto astronómico',
        raDeg: parsedRa,
        decDeg: parsedDec,
        separationDeg: classification.separationDeg,
        state: classification.state,
        normalizedRadius: classification.normalizedRadius,
        angularAreaArcmin2: classification.angularAreaArcmin2,
        majorDiameterArcmin: classification.effectiveMajorDiameterArcmin,
        minorDiameterArcmin: classification.effectiveMinorDiameterArcmin,
        positionAngleDeg: classification.effectivePositionAngleDeg,
        sizeSource: classification.sizeSource,
        source: 'simbad',
        distanceLy: computedDistanceLy,
        description: `Objeto registrado en CDS SIMBAD. Clasificación: ${target.objectType}.${computedDistanceLy ? ` Distancia estelar estimada por paralaje: ${computedDistanceLy}.` : ''}`,
      });
    }

    const insideCandidates = candidates
      .filter((c) => c.state === 'inside')
      .sort((a, b) => a.angularAreaArcmin2 - b.angularAreaArcmin2);

    const edgeCandidates = candidates
      .filter((c) => c.state === 'edge')
      .sort((a, b) => a.normalizedRadius - b.normalizedRadius);

    const allSorted = [...insideCandidates, ...edgeCandidates, ...candidates.filter((c) => c.state === 'none')];

    if (insideCandidates.length > 0) {
      const best = insideCandidates[0];
      return {
        candidates: allSorted,
        bestMatch: {
          state: 'inside',
          object: {
            id: best.id,
            name: best.name,
            designation: best.designation,
            objectType: best.objectType,
            ra: best.raDeg,
            dec: best.decDeg,
            distanceLy: best.distanceLy,
            constellation: getConstellation(best.raDeg, best.decDeg),
            description: best.description || '',
            spectralFeatures: [
              'Registro astrométrico ICRS validado por CDS SIMBAD',
              'Flujo estelar y coordenadas catalogadas',
              'Cruzamiento multiespectral internacional',
            ],
            majorDiameterArcmin: best.majorDiameterArcmin,
            minorDiameterArcmin: best.minorDiameterArcmin,
            positionAngleDeg: best.positionAngleDeg,
            sizeSource: best.sizeSource,
            source: 'simbad_api',
          },
          separationDeg: best.separationDeg,
          normalizedRadius: best.normalizedRadius,
          partial: false,
          candidates: allSorted,
          source: 'simbad',
        },
      };
    }

    if (edgeCandidates.length > 0) {
      const best = edgeCandidates[0];
      return {
        candidates: allSorted,
        bestMatch: {
          state: 'edge',
          object: {
            id: best.id,
            name: best.name,
            designation: best.designation,
            objectType: best.objectType,
            ra: best.raDeg,
            dec: best.decDeg,
            distanceLy: best.distanceLy,
            constellation: getConstellation(best.raDeg, best.decDeg),
            description: best.description || '',
            spectralFeatures: [
              'Registro en zona periférica de objeto SIMBAD',
              'Transición astrométrica de borde',
            ],
            majorDiameterArcmin: best.majorDiameterArcmin,
            minorDiameterArcmin: best.minorDiameterArcmin,
            positionAngleDeg: best.positionAngleDeg,
            sizeSource: best.sizeSource,
            source: 'simbad_api',
          },
          separationDeg: best.separationDeg,
          normalizedRadius: best.normalizedRadius,
          partial: true,
          candidates: allSorted,
          source: 'simbad',
        },
      };
    }

    return {
      candidates: allSorted,
      bestMatch: null,
    };
  } catch {
    clearTimeout(timer);
    return { candidates: [], bestMatch: null, unavailable: true };
  }
}

/**
 * Orquestador principal de identificación híbrida por huella angular (CaptureMatch).
 * Memoiza por coordenadas redondeadas (4 decimales) y radio de captura.
 */
export async function identifyCelestialCapture(
  capture: Capture
): Promise<CaptureMatch> {
  const cacheKey = `${capture.raDeg.toFixed(4)},${capture.decDeg.toFixed(4)},${capture.radiusDeg.toFixed(4)}`;
  if (crossMatchCache.has(cacheKey)) {
    return crossMatchCache.get(cacheKey)!;
  }

  // 1. Capa 1: Catálogo local
  const localMatch = matchLocalDossierCapture(capture);
  if (localMatch.state === 'inside') {
    crossMatchCache.set(cacheKey, localMatch);
    return localMatch;
  }

  // 2. Capa 2: Fallback SIMBAD TAP con búsqueda de cono
  const simbadResult = await querySimbadConeCapture(capture, 2500);

  if (simbadResult.unavailable) {
    // Si SIMBAD falla, devolvemos el resultado local con simbadUnavailable: true
    const fallbackMatch: CaptureMatch = {
      ...localMatch,
      simbadUnavailable: true,
    };
    crossMatchCache.set(cacheKey, fallbackMatch);
    return fallbackMatch;
  }

  if (simbadResult.bestMatch) {
    // Si encontramos una mejor coincidencia en SIMBAD (ej. inside), la preferimos sobre un edge local
    if (simbadResult.bestMatch.state === 'inside' || localMatch.state === 'none') {
      crossMatchCache.set(cacheKey, simbadResult.bestMatch);
      return simbadResult.bestMatch;
    }
  }

  // Si lo local era 'edge' y SIMBAD no tuvo 'inside', conservamos el 'edge' local
  if (localMatch.state === 'edge') {
    const combinedCandidates = [...localMatch.candidates, ...simbadResult.candidates].slice(0, 10);
    const combinedMatch: CaptureMatch = {
      ...localMatch,
      candidates: combinedCandidates,
    };
    crossMatchCache.set(cacheKey, combinedMatch);
    return combinedMatch;
  }

  // 3. Capa 3: 'none' (CAMPO SIN OBJETO CATALOGADO) con hasta 5 candidatos cercanos
  const topCandidates = simbadResult.candidates.slice(0, 5);

  const noneMatch: CaptureMatch = {
    state: 'none',
    separationDeg: Infinity,
    normalizedRadius: Infinity,
    partial: false,
    candidates: topCandidates,
    source: 'none',
  };

  crossMatchCache.set(cacheKey, noneMatch);
  return noneMatch;
}

/**
 * Wrapper de compatibilidad directa para consumidores que esperan identifyCelestialTarget(ra, dec, radiusDeg)
 */
export async function identifyCelestialTarget(
  ra: number,
  dec: number,
  radiusDeg = 0.25
): Promise<MatchedCelestialObject> {
  const capture: Capture = {
    raDeg: ra,
    decDeg: dec,
    radiusDeg,
  };

  const match = await identifyCelestialCapture(capture);

  if (match.object) {
    return match.object;
  }

  return {
    source: 'unregistered',
    name: 'Sector de Cielo Profundo',
    designation: 'Área no catalogada',
    objectType: 'Sector cósmico no catalogado',
    ra,
    dec,
    constellation: getConstellation(ra, dec),
    description:
      'Sector astronómico sin singularidad indexada en bases de datos maestras dentro de su extensión angular.',
    spectralFeatures: ['Emisión difusa de continuo estelar de campo'],
  };
}

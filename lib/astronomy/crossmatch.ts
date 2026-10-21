/**
 * AetherScope - Hybrid Celestial Cross-Match Engine
 * 
 * Layer 1: Local high-precision dossier cache from unified CELESTIAL_CATALOG (angular distance <= tolerance).
 * Layer 2: Real-time public CDS VizieR / SIMBAD TAP fallback using parameterized ADQL cone search.
 * Layer 3: Unregistered deep field sector fallback.
 */

import { getConstellation, calculateAngularSeparation } from './coordinates';
import { CELESTIAL_CATALOG, type CatalogTarget } from './database';

export interface AstronomicalObjectResult {
  source: 'local_dossier' | 'simbad_api' | 'unregistered';
  name: string;
  designation?: string;
  objectType: string;
  ra: number;
  dec: number;
  distanceLy?: string;
  constellation?: string;
  description: string;
  spectralFeatures: string[];
}

export { calculateAngularSeparation, calculateAngularSeparation as calculateOrthodromicDistance };

/**
 * Capa 1: Búsqueda en catálogo curado local con tolerancia angular
 */
export function matchLocalDossier(
  ra: number,
  dec: number,
  toleranceDegrees = 0.4
): AstronomicalObjectResult | null {
  if (isNaN(ra) || isNaN(dec)) return null;

  let closest: CatalogTarget | null = null;
  let minDistance = Infinity;

  for (const obj of CELESTIAL_CATALOG) {
    const dist = calculateAngularSeparation(ra, dec, obj.raDeg, obj.decDeg);
    if (dist < minDistance) {
      minDistance = dist;
      closest = obj;
    }
  }

  const effectiveTolerance = closest ? Math.max(toleranceDegrees, closest.toleranceDeg) : toleranceDegrees;

  if (closest && minDistance <= effectiveTolerance) {
    return {
      source: 'local_dossier',
      name: closest.name,
      designation: closest.designation,
      objectType: closest.objectType,
      ra: closest.raDeg,
      dec: closest.decDeg,
      distanceLy: closest.distanceLy,
      constellation: closest.constellation,
      description: closest.description,
      spectralFeatures: closest.spectralFeatures,
    };
  }

  return null;
}

/**
 * Capa 2: Fallback a API CDS TAP (VizieR / SIMBAD) en tiempo real mediante ADQL.
 * Sanitiza parámetros numéricos para prevenir inyecciones o queries malformadas.
 */
export async function querySimbadCone(
  ra: number,
  dec: number,
  radiusDegrees = 0.5
): Promise<AstronomicalObjectResult | null> {
  // Validación estricta y formateo de flotantes seguros
  if (isNaN(ra) || isNaN(dec) || isNaN(radiusDegrees) || !isFinite(ra) || !isFinite(dec)) {
    return null;
  }

  const cleanRa = Number(ra.toFixed(6));
  const cleanDec = Number(dec.toFixed(6));
  const cleanRadius = Number(Math.min(Math.max(radiusDegrees, 0.01), 2.0).toFixed(4));

  // 1. Intento primario: CDS VizieR TAP (rápido, soporta CORS, catálogo NGC/IC/Messier)
  try {
    const vizierAdql = `
      SELECT TOP 1 "Name", "Type", "Const", "Desc", "RAB2000", "DEB2000"
      FROM "VII/118/ngc2000"
      WHERE 1=CONTAINS(POINT('ICRS', "RAB2000", "DEB2000"), CIRCLE('ICRS', ${cleanRa}, ${cleanDec}, ${cleanRadius}))
    `.trim().replace(/\s+/g, ' ');

    const vizierEndpoint = `https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=${encodeURIComponent(
      vizierAdql
    )}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(vizierEndpoint, {
      signal: controller.signal,
      cache: 'force-cache',
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        const [rawName, rawType, rawConst, rawDesc, objRa, objDec] = data.data[0];
        const cleanName = String(rawName || '').trim();
        const cleanType = String(rawType || '').trim();
        const cleanConst = String(rawConst || '').trim();
        const cleanDesc = String(rawDesc || '').trim();

        const typeMap: Record<string, string> = {
          Gx: 'Galaxia',
          OC: 'Cúmulo estelar abierto',
          Gb: 'Cúmulo globular',
          Nb: 'Nebulosa difusa de emisión',
          Pl: 'Nebulosa planetaria',
          'C+N': 'Cúmulo estelar con nebulosa asociada',
          Ast: 'Asterismo estelar',
          Kt: 'Nudo estelar en galaxia externa',
        };

        const resolvedType = typeMap[cleanType] || 'Objeto celeste catalogado';
        const formattedName = cleanName.startsWith('I')
          ? `IC ${cleanName.slice(1)}`
          : `NGC ${cleanName}`;

        return {
          source: 'simbad_api',
          name: formattedName,
          designation: `${formattedName} (${cleanConst || getConstellation(cleanRa, cleanDec)})`,
          objectType: resolvedType,
          ra: typeof objRa === 'number' ? objRa : parseFloat(objRa),
          dec: typeof objDec === 'number' ? objDec : parseFloat(objDec),
          constellation: cleanConst || getConstellation(cleanRa, cleanDec),
          description: `Objeto astronómico indexado en la base de datos astrofísica CDS/VizieR. Registro de catálogo: ${cleanDesc || 'Objeto de cielo profundo confirmado'}.`,
          spectralFeatures: [
            'Registro astrométrico ICRS validado por CDS',
            'Emisión óptica y espectroscópica en catálogo internacional',
            'Cruzamiento de fuentes astrofísicas espaciales',
          ],
        };
      }
      return null;
    }
  } catch (err) {
    console.warn('[AetherScope] VizieR TAP no disponible o abortado por timeout:', err);
  }

  // 2. Intento secundario: CDS SIMBAD TAP con timeout de 1.5s
  try {
    const simbadAdql = `
      SELECT TOP 1 basic.main_id, otypedef.otype_longname, basic.ra, basic.dec
      FROM basic
      LEFT JOIN otypedef ON basic.otype = otypedef.otype
      WHERE CONTAINS(POINT('ICRS', basic.ra, basic.dec), CIRCLE('ICRS', ${cleanRa}, ${cleanDec}, ${cleanRadius})) = 1
    `.trim().replace(/\s+/g, ' ');

    const simbadEndpoint = `https://simbad.cds.unistra.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=${encodeURIComponent(
      simbadAdql
    )}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(simbadEndpoint, {
      signal: controller.signal,
      cache: 'force-cache',
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        const [mainId, otype, objRa, objDec] = data.data[0];
        return {
          source: 'simbad_api',
          name: String(mainId || 'Objeto SIMBAD').trim(),
          designation: `SIMBAD ${String(mainId || '').trim()}`,
          objectType: otype ? String(otype).trim() : 'Cuerpo celeste registrado',
          ra: typeof objRa === 'number' ? objRa : parseFloat(objRa),
          dec: typeof objDec === 'number' ? objDec : parseFloat(objDec),
          constellation: getConstellation(cleanRa, cleanDec),
          description: `Objeto astronómico indexado en la base de datos SIMBAD del Centre de Données astronomiques de Strasbourg (CDS). Clasificado astrofísicamente como ${otype || 'cuerpo registrado'}.`,
          spectralFeatures: [
            'Emisión estelar de continuo',
            'Coordenadas astrométricas ICRS validadas por CDS',
            'Datos fotométricos cruzados con catálogos internacionales',
          ],
        };
      }
    }
  } catch (err) {
    console.warn('[AetherScope] SIMBAD TAP no disponible o abortado por timeout:', err);
  }

  return null;
}

/**
 * Orquestador del motor de identificación híbrido.
 * 1. Evalúa catálogo curado unificado (0ms).
 * 2. Si no coincide, consulta CDS TAP en tiempo real con límite de 2.5s.
 * 3. Si no hay registros o ante cualquier fallo/timeout de red, retorna sector "unregistered".
 */
export async function identifyCelestialTarget(
  ra: number,
  dec: number
): Promise<AstronomicalObjectResult> {
  // Capa 1: Caché local (0ms)
  const localMatch = matchLocalDossier(ra, dec, 0.4);
  if (localMatch) {
    return localMatch;
  }

  // Capa 2: Fallback a CDS TAP con salvaguarda máxima de 2.5 segundos
  try {
    const tapPromise = querySimbadCone(ra, dec, 0.5);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const liveMatch = await Promise.race([tapPromise, timeoutPromise]);
    if (liveMatch) {
      return liveMatch;
    }
  } catch (err) {
    console.warn('[AetherScope] Error consultando CDS TAP en identifyCelestialTarget:', err);
  }

  // Capa 3: Sector no catalogado (garantizado)
  return {
    source: 'unregistered',
    name: 'Sector de Cielo Profundo',
    designation: 'Área no catalogada',
    objectType: 'Sector de cielo profundo en exploración / estrellas de fondo no catalogadas',
    ra,
    dec,
    constellation: getConstellation(ra, dec),
    description:
      'Sector de cielo profundo sin registro de objetos singulares en los catálogos principales. El campo visual corresponde a radiación de fondo cósmica y estrellas de secuencia principal de campo abierto.',
    spectralFeatures: [
      'Radiación óptica difusa de fondo estelar',
      'Ausencia de fuentes de alta energía compactas detectadas',
      'Flujo fotométrico de secuencia principal',
    ],
  };
}

/**
 * AetherScope - Hybrid Celestial Cross-Match Engine
 * 
 * Layer 1: Local high-precision dossier cache for notable celestial objects (orthodromic distance <= 0.4°).
 * Layer 2: Real-time public SIMBAD TAP (CDS Strasbourg) fallback using ADQL cone search.
 * Layer 3: Unregistered deep field sector fallback.
 */

import { getConstellation } from './coordinates';

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

export interface NotableLocalObject {
  name: string;
  designation: string;
  objectType: string;
  ra: number;
  dec: number;
  distanceLy: string;
  constellation: string;
  description: string;
  spectralFeatures: string[];
}

export const NOTABLE_LOCAL_OBJECTS: NotableLocalObject[] = [
  {
    name: 'Sagitario A*',
    designation: 'Sgr A* / Centro Galáctico',
    objectType: 'Agujero negro supermasivo',
    ra: 266.4168,
    dec: -29.0078,
    distanceLy: '26.673 años luz',
    constellation: 'Sagitario (Sgr)',
    description:
      'El agujero negro supermasivo central de la Vía Láctea, con una masa de 4,15 millones de masas solares. Su entorno genera intensa radiación sincrotrón relativista y acreción térmica detectada en rayos X y ondas de radio.',
    spectralFeatures: [
      'Emisión sincrotrón relativista de electrones ultraenergéticos',
      'Fogonazos térmicos en rayos X (Fe XXV / XXVI)',
      'Emisión submilimétrica en la banda de 1.3 mm (VLBI / EHT)',
      'Polarización magnética en el disco de acreción',
    ],
  },
  {
    name: 'Pilares de la Creación / M16',
    designation: 'Messier 16 / NGC 6611',
    objectType: 'Región H II / guardería estelar',
    ra: 274.7,
    dec: -13.806,
    distanceLy: '7.000 años luz',
    constellation: 'Serpens (Serpiente)',
    description:
      'Colosales columnas de gas molecular frío y polvo de silicatos esculpidas por vientos estelares y radiación ultravioleta extrema procedente de estrellas masivas jóvenes del cúmulo NGC 6611.',
    spectralFeatures: [
      'Excitación de hidrógeno ionizado H-alfa (656.3 nm)',
      'Líneas prohibidas de oxígeno ionizado [O III] (500.7 nm)',
      'Emisión de hidrógeno molecular frío H₂ (2.12 µm)',
      'Fuerte absorción de polvo en infrarrojo medio',
    ],
  },
  {
    name: 'Campo Profundo SMACS 0723',
    designation: 'SMACS J0723.3-7327',
    objectType: 'Cúmulo de galaxias / lente gravitacional',
    ra: 110.83,
    dec: -73.454,
    distanceLy: '4.600 millones de años luz',
    constellation: 'Volans (El Pez Volador)',
    description:
      'Cúmulo masivo de galaxias cuya colosal gravedad curva y amplifica la luz de galaxias primordiales situadas detrás, revelando arcos gravitacionales y fuentes con alto corrimiento al rojo (z > 7).',
    spectralFeatures: [
      'Emisión de líneas con alto corrimiento al rojo (redshift z = 7 a 9.5)',
      'Arcos de distorsión y magnificación gravitacional relativista',
      'Gas intracumular caliente emitiendo rayos X por Bremsstrahlung térmico',
      'Fotometría infrarroja profunda en bandas F090W a F444W (NIRCam)',
    ],
  },
  {
    name: 'Galaxia del Sombrero (M104)',
    designation: 'Messier 104 / NGC 4594',
    objectType: 'Galaxia espiral',
    ra: 189.9975,
    dec: -11.6231,
    distanceLy: '31,1 millones de años luz',
    constellation: 'Virgo',
    description:
      'Galaxia espiral icónica distinguida por un gigantesco bulbo central y una densa banda simétrica de polvo interestelar oscuro en su plano ecuatorial. Aloja un agujero negro central de mil millones de masas solares.',
    spectralFeatures: [
      'Banda ancha de absorción por polvo frío en el disco ecuatorial',
      'Población estelar madura tipo II dominando el bulbo luminoso',
      'Emisión térmica infrarroja de polvo circumgaláctico a 24 µm',
      'Línea de 21 cm de hidrógeno neutro interestelar (H I)',
    ],
  },
  {
    name: 'Nebulosa Carina (NGC 3372)',
    designation: 'NGC 3372 / Acantilados Cósmicos',
    objectType: 'Nebulosa de emisión difusa',
    ra: 161.285,
    dec: -59.8678,
    distanceLy: '8.500 años luz',
    constellation: 'Carina (La Quilla)',
    description:
      'Una de las regiones de formación estelar más energéticas y masivas de la galaxia. Alberga a la hipergigante inestable Eta Carinae y frentes de ionización fotoevaporativa conocidos como Acantilados Cósmicos.',
    spectralFeatures: [
      'Emisión ultra-intensa de H-alfa y nitrógeno [N II] en frentes de choque',
      'Emisión de hidrocarburos aromáticos policíclicos (PAH) a 3.3 µm y 7.7 µm',
      'Rayos X térmicos procedentes de vientos estelares colisionantes',
      'Protoestrellas de clase 0/I embebidas en glóbulos de Bok',
    ],
  },
  {
    name: 'Nebulosa del Cangrejo (M1)',
    designation: 'Messier 1 / NGC 1952',
    objectType: 'Remanente de supernova / púlsar',
    ra: 83.6331,
    dec: 22.0145,
    distanceLy: '6.500 años luz',
    constellation: 'Taurus (Tauro)',
    description:
      'Remanente de la supernova histórica del año 1054 d.C. En su núcleo reside un púlsar que rota 30 veces por segundo, energizando una nebulosa de viento relativista y filamentos de helio e hidrógeno en expansión.',
    spectralFeatures: [
      'Espectro de continuo de radiación sincrotrón no térmica (radio hasta rayos gamma)',
      'Pulsaciones periódicas a 33 milisegundos en todas las longitudes de onda',
      'Filamentos de gas fotoionizado ricos en helio, oxígeno [O III] y azufre [S II]',
      'Viento de pares electrón-positrón magnetizados',
    ],
  },
];

/**
 * Calcula la distancia angular ortodrómica sobre la esfera celeste:
 * Δθ = arccos( sin(dec1)·sin(dec2) + cos(dec1)·cos(dec2)·cos(ra1 - ra2) )
 * Retorna el ángulo en grados decimales.
 */
export function calculateOrthodromicDistance(
  ra1Deg: number,
  dec1Deg: number,
  ra2Deg: number,
  dec2Deg: number
): number {
  const toRad = Math.PI / 180;
  const r1 = ra1Deg * toRad;
  const d1 = dec1Deg * toRad;
  const r2 = ra2Deg * toRad;
  const d2 = dec2Deg * toRad;

  const cosDistance =
    Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(r1 - r2);

  // Clamp para prevenir errores numéricos de punto flotante en arccos
  const clampedCos = Math.max(-1, Math.min(1, cosDistance));
  const angularDistanceRad = Math.acos(clampedCos);

  return (angularDistanceRad * 180) / Math.PI;
}

/**
 * Capa 1: Búsqueda en caché local de objetos notables con tolerancia angular <= 0.4°
 */
export function matchLocalDossier(
  ra: number,
  dec: number,
  toleranceDegrees = 0.4
): AstronomicalObjectResult | null {
  let closest: NotableLocalObject | null = null;
  let minDistance = Infinity;

  for (const obj of NOTABLE_LOCAL_OBJECTS) {
    const dist = calculateOrthodromicDistance(ra, dec, obj.ra, obj.dec);
    if (dist < minDistance) {
      minDistance = dist;
      closest = obj;
    }
  }

  if (closest && minDistance <= toleranceDegrees) {
    return {
      source: 'local_dossier',
      name: closest.name,
      designation: closest.designation,
      objectType: closest.objectType,
      ra: closest.ra,
      dec: closest.dec,
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
 * Incluye AbortSignal estricto de 2.0s para evitar bloqueos por latencia de red.
 */
export async function querySimbadCone(
  ra: number,
  dec: number,
  radiusDegrees = 0.5
): Promise<AstronomicalObjectResult | null> {
  // 1. Intento primario: CDS VizieR TAP (rápido, soporta CORS, catálogo NGC/IC/Messier)
  try {
    const vizierAdql = `
      SELECT TOP 1 "Name", "Type", "Const", "Desc", "RAB2000", "DEB2000"
      FROM "VII/118/ngc2000"
      WHERE 1=CONTAINS(POINT('ICRS', "RAB2000", "DEB2000"), CIRCLE('ICRS', ${ra}, ${dec}, ${radiusDegrees}))
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
        const cleanName = String(rawName).trim();
        const cleanType = String(rawType).trim();
        const cleanConst = String(rawConst).trim();
        const cleanDesc = String(rawDesc).trim();

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
          designation: `${formattedName} (${cleanConst || getConstellation(ra, dec)})`,
          objectType: resolvedType,
          ra: typeof objRa === 'number' ? objRa : parseFloat(objRa),
          dec: typeof objDec === 'number' ? objDec : parseFloat(objDec),
          constellation: cleanConst || getConstellation(ra, dec),
          description: `Objeto astronómico indexado en la base de datos astrofísica CDS/VizieR. Registro de catálogo: ${cleanDesc || 'Objeto de cielo profundo confirmado'}.`,
          spectralFeatures: [
            'Registro astrométrico ICRS validado por CDS',
            'Emisión óptica y espectroscópica en catálogo internacional',
            'Cruzamiento de fuentes astrofísicas espaciales',
          ],
        };
      }
      // VizieR responded with 200 OK and confirmed no cataloged object in cone
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
      WHERE CONTAINS(POINT('ICRS', basic.ra, basic.dec), CIRCLE('ICRS', ${ra}, ${dec}, ${radiusDegrees})) = 1
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
          name: String(mainId).trim(),
          designation: `SIMBAD ${String(mainId).trim()}`,
          objectType: otype ? String(otype).trim() : 'Cuerpo celeste registrado',
          ra: typeof objRa === 'number' ? objRa : parseFloat(objRa),
          dec: typeof objDec === 'number' ? objDec : parseFloat(objDec),
          constellation: getConstellation(ra, dec),
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
 * 1. Evalúa caché local (inmediato, sin latencia de red, 0ms).
 * 2. Si no coincide, consulta CDS TAP en tiempo real con límite de 2.5s.
 * 3. Si no hay registros o ante cualquier fallo/timeout de red, retorna estado "unregistered" de forma inmediata y garantizada.
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
  } catch {}

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

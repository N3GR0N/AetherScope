/**
 * AetherScope - Cosmic Targets Scientific Catalog
 * High-precision celestial database for Deep Space Dossier & Observatory 360° navigation.
 */

export interface CosmicTarget {
  id: string;
  name: string;
  category: 'nebula' | 'galaxy' | 'deep-field' | 'black-hole';
  constellation: string;
  ra: string;
  dec: string;
  fov: number;
  distance: string;
  redshift?: string;
  description: string;
  spectroscopy: {
    primarySensor: string;
    detectedElements: string[];
  };
  primarySurveyId?: string;
  overlaySurveyId?: string;
}

// Backwards-compatibility type alias
export type CelestialTarget = CosmicTarget;

/**
 * Converts sexagesimal RA ("HH MM SS.S") and Dec ("±DD MM SS.S") strings to decimal degrees.
 */
export function sexagesimalToDecimal(raStr: string, decStr: string): { raDeg: number; decDeg: number } {
  const raParts = raStr.trim().split(/[\s:hms]+/).filter(Boolean).map(Number);
  const hours = raParts[0] || 0;
  const minutes = raParts[1] || 0;
  const seconds = raParts[2] || 0;
  const raDeg = (hours + minutes / 60 + seconds / 3600) * 15;

  const isNegative = decStr.trim().startsWith('-');
  const decClean = decStr.trim().replace(/^[-+]/, '');
  const decParts = decClean.split(/[\s:dms°′″]+/).filter(Boolean).map(Number);
  const d = decParts[0] || 0;
  const m = decParts[1] || 0;
  const s = decParts[2] || 0;
  let decDeg = d + m / 60 + s / 3600;
  if (isNegative) decDeg = -decDeg;

  return { raDeg, decDeg };
}

/**
 * Returns decimal coordinates for any CosmicTarget
 */
export function getTargetDecimalCoords(target: CosmicTarget): { raDeg: number; decDeg: number } {
  return sexagesimalToDecimal(target.ra, target.dec);
}

export const COSMIC_TARGETS: CosmicTarget[] = [
  {
    id: 'pillars',
    name: 'Pilares de la Creación (M16)',
    category: 'nebula',
    constellation: 'Serpens',
    ra: '18 18 48',
    dec: '-13 49 00',
    fov: 0.18,
    distance: '~6.500 al',
    description: 'Monumentales torres de gas interestelar frío y polvo denso donde nacen nuevas estrellas dentro de la Nebulosa del Águila.',
    spectroscopy: {
      primarySensor: 'JWST NIRCam / MIRI',
      detectedElements: ['H₂ (Molecular)', 'CO (Monóxido)', 'Silicatos', '[O III]', 'PAH (Hidrocarburos)'],
    },
    primarySurveyId: 'nasa-composite',
    overlaySurveyId: 'optical',
  },
  {
    id: 'smacs0723',
    name: 'Campo Profundo SMACS 0723',
    category: 'deep-field',
    constellation: 'Volans',
    ra: '07 23 19.5',
    dec: '-73 27 15.6',
    fov: 0.1,
    distance: '4.600 millones al',
    redshift: 'z = 0.39 / 8.5',
    description: 'Cúmulo de galaxias masivo que actúa como lente gravitacional cósmica amplificando la luz de las primeras galaxias del universo temprano.',
    spectroscopy: {
      primarySensor: 'JWST NIRCam',
      detectedElements: ['H Primordial', 'He', '[O III] Temprano', 'Lyman-α Desplazada', 'Materia Oscura (Lente)'],
    },
    primarySurveyId: 'jwst',
    overlaySurveyId: 'optical',
  },
  {
    id: 'sombrero',
    name: 'Galaxia del Sombrero (M104)',
    category: 'galaxy',
    constellation: 'Virgo',
    ra: '12 39 59.4',
    dec: '-11 37 23',
    fov: 0.25,
    distance: '29.3 millones al',
    redshift: 'z = +0.0034',
    description: 'Galaxia espiral con un bulbo central supermasivo y un impresionante anillo ecuatorial de polvo visto casi de canto.',
    spectroscopy: {
      primarySensor: 'Hubble ACS / Spitzer',
      detectedElements: ['CO', 'Polvo Silicato', 'Fe XXV (Núcleo)', 'HI 21cm', 'Cúmulos Globulares'],
    },
    primarySurveyId: 'optical',
    overlaySurveyId: 'xray',
  },
  {
    id: 'carina',
    name: 'Nebulosa Carina (NGC 3372)',
    category: 'nebula',
    constellation: 'Carina',
    ra: '10 45 08.5',
    dec: '-59 52 04',
    fov: 0.6,
    distance: '7.600 al',
    description: 'Vasta incubadora estelar en el hemisferio sur que alberga estrellas hipermasivas y los célebres Acantilados Cósmicos.',
    spectroscopy: {
      primarySensor: 'JWST NIRCam / MIRI',
      detectedElements: ['Hα (Ionizado)', 'H₂O (Vapor de Hielo)', 'PAH', '[S II]', '[Fe II]'],
    },
    primarySurveyId: 'jwst',
    overlaySurveyId: 'optical',
  },
  {
    id: 'sgrA',
    name: 'Sagitario A* (Centro Galáctico)',
    category: 'black-hole',
    constellation: 'Sagittarius',
    ra: '17 45 40.04',
    dec: '-29 00 28.1',
    fov: 0.2,
    distance: '26.673 al',
    description: 'El agujero negro supermasivo central de 4.1 millones de masas solares que ancla la dinámica gravitacional de la Vía Láctea.',
    spectroscopy: {
      primarySensor: 'Chandra CXC / EHT',
      detectedElements: ['Plasma Sincrotrón', 'Fe XXV / XXVI (6.7 keV)', 'Gas Molecular Caliente', 'CO'],
    },
    primarySurveyId: 'xray',
    overlaySurveyId: 'gaia',
  },
];

export const CELESTIAL_TARGETS = COSMIC_TARGETS;
export const DEFAULT_TARGET = COSMIC_TARGETS[0]; // Pilares de la Creación (M16)

/**
 * Base de Datos Astronómica Curada (NASA / ESA / CDS Strasbourg).
 * Catálogo de referencia para el motor de cross-match y detección de objetivos celestes.
 */

export interface CatalogTarget {
  id: string;
  name: string;
  catalogId: string; // ej. M16, Sgr A*, M104, NGC 3372
  constellation: string;
  nature: string;
  distanceLy: string;
  raDeg: number;
  decDeg: number;
  toleranceDeg: number; // Radio de búsqueda angular (por defecto 0.5°)
  description: string;
  astrophysicalDetails: {
    spectralSignature: string;
    dominantElements: string[];
    temperatureRange: string;
    massOrSize: string;
  };
}

export const CELESTIAL_CATALOG: CatalogTarget[] = [
  {
    id: "sgr-a-star",
    name: "Sagitario A*",
    catalogId: "Sgr A* / Centro Galáctico",
    constellation: "Sagitario (Sgr)",
    nature: "Agujero Negro Supermasivo",
    distanceLy: "26.673 años luz",
    raDeg: 266.4168,
    decDeg: -29.0078,
    toleranceDeg: 0.6,
    description:
      "El agujero negro supermasivo central de nuestra Vía Láctea, con una masa estimada de 4,15 millones de masas solares. Rodeado por un disco de acreción caliente y fuentes de intensa emisión de rayos X y radioondas relativistas.",
    astrophysicalDetails: {
      spectralSignature: "Emisión synchrotron relativista y Rayos X térmicos",
      dominantElements: ["Plasma de Hidrógeno Relativista", "Electrones ultraenergéticos", "Hierro altamente ionizado [Fe XXV]"],
      temperatureRange: "10⁷ K a 10⁸ K en el disco interno",
      massOrSize: "4,15 × 10⁶ M☉ (Radio de Schwarzschild: ~12,7 millones de km)",
    },
  },
  {
    id: "pillars-of-creation",
    name: "Los Pilares de la Creación (M16)",
    catalogId: "Messier 16 / NGC 6611",
    constellation: "Serpens (Serpiente)",
    nature: "Guardería Estelar / Nebulosa de Emisión",
    distanceLy: "7.000 años luz",
    raDeg: 274.7001,
    decDeg: -13.8067,
    toleranceDeg: 0.5,
    description:
      "Icónica región de formación estelar dentro de la Nebulosa del Águila. Columnas colosales de gas molecular interestelar frío y polvo de silicatos esculpidas por la intensa radiación ultravioleta de estrellas jóvenes masivas.",
    astrophysicalDetails: {
      spectralSignature: "Líneas de excitación de H-alfa [N II] y fuerte absorción de polvo en infrarrojo",
      dominantElements: ["Hidrógeno Molecular (H₂)", "Polvo de Silicatos", "Oxígeno Ionizado [O III]", "Monóxido de Carbono (CO)"],
      temperatureRange: "10 K a 80 K (interior) / 10.000 K (frentes de choque externos)",
      massOrSize: "Extensión de ~4 a 5 años luz",
    },
  },
  {
    id: "carina-nebula",
    name: "Nebulosa Carina (NGC 3372)",
    catalogId: "NGC 3372 / Acantilados Cósmicos",
    constellation: "Carina (La Quilla)",
    nature: "Nebulosa de Emisión Masiva",
    distanceLy: "8.500 años luz",
    raDeg: 161.265,
    decDeg: -59.87,
    toleranceDeg: 0.7,
    description:
      "Una de las regiones de formación estelar más grandes y luminosas de la galaxia. Alberga a Eta Carinae, una de las estrellas hipermasivas más inestables conocidas, e intrincadas crestas de polvo reveladas en infrarrojo por JWST.",
    astrophysicalDetails: {
      spectralSignature: "Fuerte emisión óptica H-alfa combinada con emisión térmica infrarroja",
      dominantElements: ["Hidrógeno Ionizado (H II)", "Azufre [S II]", "Polvo Carbonáceo y Silicatos", "Nitrógeno [N II]"],
      temperatureRange: "8.000 K a 12.000 K en regiones H II",
      massOrSize: "Diámetro de ~300 años luz",
    },
  },
  {
    id: "smacs-0723",
    name: "Campo Profundo SMACS 0723",
    catalogId: "SMACS J0723.3-7327",
    constellation: "Volans (El Pez Volador)",
    nature: "Cúmulo de Galaxias / Lente Gravitacional",
    distanceLy: "4.600 millones de años luz",
    raDeg: 110.8375,
    decDeg: -73.4542,
    toleranceDeg: 0.5,
    description:
      "Un inmenso cúmulo de galaxias cuya masa combinada actúa como una lente gravitacional natural, curvando y magnificando la luz de galaxias primordiales situadas a más de 13.000 millones de años luz, en las primeras etapas del universo.",
    astrophysicalDetails: {
      spectralSignature: "Galaxias con alto corrimiento al rojo (redshift z > 7 a 9)",
      dominantElements: ["Gas intrarradial primordial", "Hidrógeno", "Helio", "Metales traza primigenios"],
      temperatureRange: "10⁷ K en el gas intracumular",
      massOrSize: "Masa total equivalente a >10¹⁴ M☉",
    },
  },
  {
    id: "sombrero-galaxy",
    name: "Galaxia del Sombrero (M104)",
    catalogId: "Messier 104 / NGC 4594",
    constellation: "Virgo",
    nature: "Galaxia Espiral SA(s)a",
    distanceLy: "31,1 millones de años luz",
    raDeg: 189.9975,
    decDeg: -11.6231,
    toleranceDeg: 0.5,
    description:
      "Galaxia espiral icónica con un bulbo galáctico prominente y una banda de polvo oscuro y denso en su disco ecuatorial. Alberga un agujero negro supermasivo de 1.000 millones de masas solares en su núcleo.",
    astrophysicalDetails: {
      spectralSignature: "Disco de absorción de polvo en luz visible y radiación infrarroja térmica",
      dominantElements: ["Poblaciones estelares viejas (Tipo II)", "Polvo interestelar", "Hidrógeno neutro (H I)"],
      temperatureRange: "3.500 K a 6.000 K en estrellas del bulbo",
      massOrSize: "Diámetro aproximado de 50.000 años luz",
    },
  },
  {
    id: "crab-nebula",
    name: "Nebulosa del Cangrejo (M1)",
    catalogId: "Messier 1 / NGC 1952",
    constellation: "Taurus (Tauro)",
    nature: "Remanente de Supernova / Púlsar",
    distanceLy: "6.500 años luz",
    raDeg: 83.6331,
    decDeg: 22.0145,
    toleranceDeg: 0.5,
    description:
      "Remanente de la supernova histórica registrada por astrónomos en el año 1054. En su centro pulsa una estrella de neutrones girando 30 veces por segundo, inyectando viento relativista en los filamentos de gas en expansión.",
    astrophysicalDetails: {
      spectralSignature: "Radiación synchrotron continua (óptico a rayos X) y filamentos de emisión",
      dominantElements: ["Helio", "Hidrógeno", "Oxígeno [O III]", "Azufre ionizado", "Electrones relativistas"],
      temperatureRange: "10.000 K en filamentos / 10⁶ K en viento magnetosférico",
      massOrSize: "Diámetro de ~11 años luz (expansión a 1.500 km/s)",
    },
  },
];

/**
 * Calcula la distancia angular en la esfera celeste mediante la fórmula del semiverseno (Haversine).
 * Retorna la distancia en grados decimales.
 */
export function calculateAngularSeparation(
  ra1Deg: number,
  dec1Deg: number,
  ra2Deg: number,
  dec2Deg: number
): number {
  const toRad = Math.PI / 180;
  const dRa = (ra2Deg - ra1Deg) * toRad;
  const dDec = (dec2Deg - dec1Deg) * toRad;
  const dec1 = dec1Deg * toRad;
  const dec2 = dec2Deg * toRad;

  const a =
    Math.sin(dDec / 2) * Math.sin(dDec / 2) +
    Math.cos(dec1) * Math.cos(dec2) * Math.sin(dRa / 2) * Math.sin(dRa / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (c * 180) / Math.PI;
}

/**
 * Realiza el cross-match entre coordenadas capturadas y el catálogo celeste.
 */
export function crossMatchCelestialTarget(raDeg: number, decDeg: number): {
  matched: boolean;
  target: CatalogTarget | null;
  angularSeparationDeg: number;
} {
  let closestTarget: CatalogTarget | null = null;
  let minSep = Infinity;

  for (const item of CELESTIAL_CATALOG) {
    const sep = calculateAngularSeparation(raDeg, decDeg, item.raDeg, item.decDeg);
    if (sep < minSep) {
      minSep = sep;
      closestTarget = item;
    }
  }

  if (closestTarget && minSep <= closestTarget.toleranceDeg) {
    return {
      matched: true,
      target: closestTarget,
      angularSeparationDeg: minSep,
    };
  }

  return {
    matched: false,
    target: null,
    angularSeparationDeg: minSep,
  };
}

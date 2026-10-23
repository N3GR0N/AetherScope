/**
 * Base de Datos Astronómica Curada (NASA / ESA / CDS Strasbourg).
 * Catálogo unificado de referencia para el motor de cross-match, dossier y laboratorio astrofísico.
 */

import { calculateAngularSeparation } from "./coordinates";

export interface CatalogTarget {
  id: string;
  name: string;
  designation: string; // ej. Messier 16 / NGC 6611
  catalogId: string;
  constellation: string;
  nature: string;
  objectType: string;
  distanceLy: string;
  raDeg: number;
  decDeg: number;
  toleranceDeg: number; // Radio de búsqueda angular (por defecto 0.4° - 0.6°)
  /**
   * DIÁMETROS angulares completos en minutos de arco (arcmin), NO semiejes.
   * positionAngleDeg: Ángulo de posición del semieje mayor en grados (0-180), de Norte hacia Este.
   * sizeSource: Origen de los datos astrométricos de tamaño.
   */
  majorDiameterArcmin?: number;
  minorDiameterArcmin?: number;
  positionAngleDeg?: number;
  sizeSource?: 'simbad' | 'ned' | 'estimate';
  description: string;
  spectralFeatures: string[];
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
    designation: "Sgr A* / Centro Galáctico",
    catalogId: "Sgr A* / Centro Galáctico",
    constellation: "Sagitario (Sgr)",
    nature: "Agujero Negro Supermasivo",
    objectType: "Agujero negro supermasivo",
    distanceLy: "26.673 años luz",
    raDeg: 266.4168,
    decDeg: -29.0078,
    toleranceDeg: 0.5,
    description:
      "El agujero negro supermasivo central de nuestra Vía Láctea, con una masa de 4,15 millones de masas solares. Su entorno genera intensa radiación sincrotrón relativista y acreción térmica detectada en rayos X y ondas de radio.",
    spectralFeatures: [
      "Emisión sincrotrón relativista de electrones ultraenergéticos",
      "Fogonazos térmicos en rayos X (Fe XXV / XXVI)",
      "Emisión submilimétrica en la banda de 1.3 mm (VLBI / EHT)",
      "Polarización magnética en el disco de acreción",
    ],
    astrophysicalDetails: {
      spectralSignature: "Emisión synchrotron relativista y Rayos X térmicos",
      dominantElements: ["Plasma de Hidrógeno Relativista", "Electrones ultraenergéticos", "Hierro altamente ionizado [Fe XXV]"],
      temperatureRange: "10⁷ K a 10⁸ K en el disco interno",
      massOrSize: "4,15 × 10⁶ M☉ (Radio de Schwarzschild: ~12,7 millones de km)",
    },
  },
  {
    id: "pillars-of-creation",
    name: "Pilares de la Creación / M16",
    designation: "Messier 16 / NGC 6611",
    catalogId: "Messier 16 / NGC 6611",
    constellation: "Serpens (Serpiente)",
    nature: "Guardería Estelar / Nebulosa de Emisión",
    objectType: "Región H II / guardería estelar",
    distanceLy: "7.000 años luz",
    raDeg: 274.7,
    decDeg: -13.806,
    toleranceDeg: 0.45,
    majorDiameterArcmin: 80.0,
    minorDiameterArcmin: 80.0,
    positionAngleDeg: 0,
    sizeSource: 'simbad',
    description:
      "Colosales columnas de gas molecular frío y polvo de silicatos esculpidas por vientos estelares y radiación ultravioleta extrema procedente de estrellas masivas jóvenes del cúmulo NGC 6611.",
    spectralFeatures: [
      "Excitación de hidrógeno ionizado H-alfa (656.3 nm)",
      "Líneas prohibidas de oxígeno ionizado [O III] (500.7 nm)",
      "Emisión de hidrógeno molecular frío H₂ (2.12 µm)",
      "Fuerte absorción de polvo en infrarrojo medio",
    ],
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
    designation: "NGC 3372 / Acantilados Cósmicos",
    catalogId: "NGC 3372 / Acantilados Cósmicos",
    constellation: "Carina (La Quilla)",
    nature: "Nebulosa de Emisión Masiva",
    objectType: "Nebulosa de emisión difusa",
    distanceLy: "8.500 años luz",
    raDeg: 161.285,
    decDeg: -59.8678,
    toleranceDeg: 0.5,
    description:
      "Una de las regiones de formación estelar más energéticas y masivas de la galaxia. Alberga a la hipergigante inestable Eta Carinae y frentes de ionización fotoevaporativa conocidos como Acantilados Cósmicos.",
    spectralFeatures: [
      "Emisión ultra-intensa de H-alfa y nitrógeno [N II] en frentes de choque",
      "Emisión de hidrocarburos aromáticos policíclicos (PAH) a 3.3 µm y 7.7 µm",
      "Rayos X térmicos procedentes de vientos estelares colisionantes",
      "Protoestrellas de clase 0/I embebidas en glóbulos de Bok",
    ],
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
    designation: "SMACS J0723.3-7327",
    catalogId: "SMACS J0723.3-7327",
    constellation: "Volans (El Pez Volador)",
    nature: "Cúmulo de Galaxias / Lente Gravitacional",
    objectType: "Cúmulo de galaxias / lente gravitacional",
    distanceLy: "4.600 millones de años luz",
    raDeg: 110.83,
    decDeg: -73.454,
    toleranceDeg: 0.45,
    description:
      "Cúmulo masivo de galaxias cuya colosal gravedad curva y amplifica la luz de galaxias primordiales situadas detrás, revelando arcos gravitacionales y fuentes con alto corrimiento al rojo (z > 7).",
    spectralFeatures: [
      "Emisión de líneas con alto corrimiento al rojo (redshift z = 7 a 9.5)",
      "Arcos de distorsión y magnificación gravitacional relativista",
      "Gas intracumular caliente emitiendo rayos X por Bremsstrahlung térmico",
      "Fotometría infrarroja profunda en bandas F090W a F444W (NIRCam)",
    ],
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
    designation: "Messier 104 / NGC 4594",
    catalogId: "Messier 104 / NGC 4594",
    constellation: "Virgo",
    nature: "Galaxia Espiral SA(s)a",
    objectType: "Galaxia espiral",
    distanceLy: "31,1 millones de años luz",
    raDeg: 189.9975,
    decDeg: -11.6231,
    toleranceDeg: 0.45,
    majorDiameterArcmin: 8.51,
    minorDiameterArcmin: 5.01,
    positionAngleDeg: 90,
    sizeSource: 'simbad',
    description:
      "Galaxia espiral icónica distinguida por un gigantesco bulbo central y una densa banda simétrica de polvo interestelar oscuro en su plano ecuatorial. Aloja un agujero negro central de mil millones de masas solares.",
    spectralFeatures: [
      "Banda ancha de absorción por polvo frío en el disco ecuatorial",
      "Población estelar madura tipo II dominando el bulbo luminoso",
      "Emisión térmica infrarroja de polvo circumgaláctico a 24 µm",
      "Línea de 21 cm de hidrógeno neutro interestelar (H I)",
    ],
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
    designation: "Messier 1 / NGC 1952",
    catalogId: "Messier 1 / NGC 1952",
    constellation: "Taurus (Tauro)",
    nature: "Remanente de Supernova / Púlsar",
    objectType: "Remanente de supernova / púlsar",
    distanceLy: "6.500 años luz",
    raDeg: 83.6331,
    decDeg: 22.0145,
    toleranceDeg: 0.45,
    majorDiameterArcmin: 7.0,
    minorDiameterArcmin: 5.0,
    sizeSource: 'simbad',
    description:
      "Remanente de la supernova histórica del año 1054 d.C. En su núcleo reside un púlsar que rota 30 veces por segundo, energizando una nebulosa de viento relativista y filamentos de helio e hidrógeno en expansión.",
    spectralFeatures: [
      "Espectro de continuo de radiación sincrotrón no térmica (radio hasta rayos gamma)",
      "Pulsaciones periódicas a 33 milisegundos en todas las longitudes de onda",
      "Filamentos de gas fotoionizado ricos en helio, oxígeno [O III] y azufre [S II]",
      "Viento de pares electrón-positrón magnetizados",
    ],
    astrophysicalDetails: {
      spectralSignature: "Radiación synchrotron continua (óptico a rayos X) y filamentos de emisión",
      dominantElements: ["Helio", "Hidrógeno", "Oxígeno [O III]", "Azufre ionizado", "Electrones relativistas"],
      temperatureRange: "10.000 K en filamentos / 10⁶ K en viento magnetosférico",
      massOrSize: "Diámetro de ~11 años luz (expansión a 1.500 km/s)",
    },
  },
];

/**
 * Realiza el cross-match entre coordenadas y el catálogo curado local.
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

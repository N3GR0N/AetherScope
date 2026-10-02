import type { CatalogTarget } from "./database";

export interface SpectralFilterOption {
  id: string;
  name: string;
  shortLabel: string;
  band: "optical" | "infrared" | "xray" | "stellar";
  wavelength: string;
  colorHex: string;
  hipsUrl: string;
  description: string;
}

export const LABORATORY_SPECTRAL_FILTERS: SpectralFilterOption[] = [
  {
    id: "dss2",
    name: "Óptico (Luz Visible - DSS2)",
    shortLabel: "ÓPTICO",
    band: "optical",
    wavelength: "400 - 750 nm",
    colorHex: "#38bdf8",
    hipsUrl: "https://alasky.cds.unistra.fr/DSS/DSSColor",
    description: "Fotometría en el espectro visible capturada por telescopios terrestres Schmidt.",
  },
  {
    id: "jwst",
    name: "Infrarrojo Profundo (JWST / NIRCam)",
    shortLabel: "JWST INFRA",
    band: "infrared",
    wavelength: "0.6 - 5.0 µm",
    colorHex: "#f59e0b",
    hipsUrl: "https://alasky.cds.unistra.fr/HST-hips/color", // Direct high-stability NASA composite fallback
    description: "Penetra el polvo cósmico opaco y revela protoestrellas y galaxias primordiales.",
  },
  {
    id: "allwise",
    name: "Infrarrojo Térmico (AllWISE)",
    shortLabel: "TÉRMICO WISE",
    band: "infrared",
    wavelength: "3.4 - 22 µm",
    colorHex: "#f97316",
    hipsUrl: "https://alasky.cds.unistra.fr/AllWISE/color",
    description: "Mapeo criogénico espacial sensible al polvo interestelar caliente y estrellas frías.",
  },
  {
    id: "chandra",
    name: "Rayos X de Alta Energía (Chandra)",
    shortLabel: "RAYOS X",
    band: "xray",
    wavelength: "0.1 - 10 keV",
    colorHex: "#a855f7",
    hipsUrl: "https://alasky.cds.unistra.fr/Chandra/color",
    description: "Detecta fenómenos de alta energía: plasmas a millones de grados y acreción relativista.",
  },
  {
    id: "gaia",
    name: "Densidad Estelar (Gaia DR3)",
    shortLabel: "GAIA DR3",
    band: "stellar",
    wavelength: "Astrometría Óptica",
    colorHex: "#10b981",
    hipsUrl: "https://alasky.cds.unistra.fr/Gaia/DR3/color",
    description: "Censo astrométrico de más de mil millones de estrellas de la Vía Láctea.",
  },
];

export interface DetectedChemicalElement {
  formula: string;
  name: string;
  category: "Gas Molecular" | "Polvo Interestelar" | "Gas Ionizado" | "Plasma de Alta Energía" | "Estelar";
  abundancePct: number;
  confidencePct: number;
  detectionBand: string;
  status: "detectado" | "trazas" | "dominante";
}

export interface AstrophysicalAnalysisResult {
  activeFilters: string[];
  matchedTarget: CatalogTarget | null;
  detectedElements: DetectedChemicalElement[];
  dominantPhenomenon: string;
  scientificConclusion: string;
  estimatedTemperature: string;
  radiationFieldIntensity: "Baja" | "Moderada" | "Alta" | "Extrema";
}

/**
 * Ejecuta el algoritmo de detección e inferencia química y física según los filtros espectrales
 * activados y el objetivo astronómico identificado en la zona.
 */
export function runAstrophysicalAnalysis(
  activeFilterIds: string[],
  matchedTarget: CatalogTarget | null,
  blendOpacity: number
): AstrophysicalAnalysisResult {
  const elements: DetectedChemicalElement[] = [];

  // Multi-spectral overlay blend factor modulates observational confidence
  const blendWeight = Math.min(1.0, 0.9 + Math.max(0, blendOpacity) * 0.1);

  const hasOptical = activeFilterIds.includes("dss2");
  const hasJWST = activeFilterIds.includes("jwst");
  const hasThermal = activeFilterIds.includes("allwise");
  const hasXray = activeFilterIds.includes("chandra");
  const hasGaia = activeFilterIds.includes("gaia");

  const hasInfrared = hasJWST || hasThermal;

  // 1. Detección por Rayos X (Chandra)
  if (hasXray) {
    const isHighEnergyObject = matchedTarget?.id === "sgr-a-star" || matchedTarget?.id === "crab-nebula";
    elements.push({
      formula: "Plasma Térmico",
      name: "Gas a Millones de Grados (10⁶ - 10⁷ K)",
      category: "Plasma de Alta Energía",
      abundancePct: isHighEnergyObject ? 88 : 54,
      confidencePct: 94,
      detectionBand: "Rayos X (0.1 - 10 keV)",
      status: isHighEnergyObject ? "dominante" : "detectado",
    });

    elements.push({
      formula: "e⁻ Relativistas",
      name: "Discos de Acreción Relativistas / Sincrotrón",
      category: "Plasma de Alta Energía",
      abundancePct: isHighEnergyObject ? 76 : 42,
      confidencePct: 89,
      detectionBand: "Rayos X (Chandra)",
      status: isHighEnergyObject ? "dominante" : "detectado",
    });

    elements.push({
      formula: "Fe XXV / XXVI",
      name: "Hierro Altamente Ionizado",
      category: "Gas Ionizado",
      abundancePct: 35,
      confidencePct: 82,
      detectionBand: "Rayos X (K-Shell)",
      status: "trazas",
    });
  }

  // 2. Detección por Infrarrojo (JWST & AllWISE)
  if (hasInfrared) {
    const isDustyNursery =
      matchedTarget?.id === "pillars-of-creation" ||
      matchedTarget?.id === "carina-nebula" ||
      matchedTarget?.id === "sombrero-galaxy";

    elements.push({
      formula: "Mg₂SiO₄ / Fe₂SiO₄",
      name: "Polvo de Silicatos Interestelar",
      category: "Polvo Interestelar",
      abundancePct: isDustyNursery ? 85 : 62,
      confidencePct: 96,
      detectionBand: "Infrarrojo Medio (NIRCam/WISE)",
      status: isDustyNursery ? "dominante" : "detectado",
    });

    elements.push({
      formula: "H₂ Molecular",
      name: "Nubes Moleculares de Hidrógeno",
      category: "Gas Molecular",
      abundancePct: isDustyNursery ? 92 : 68,
      confidencePct: 91,
      detectionBand: "Infrarrojo Cercano",
      status: "dominante",
    });

    elements.push({
      formula: "CO",
      name: "Monóxido de Carbono Gaseoso",
      category: "Gas Molecular",
      abundancePct: isDustyNursery ? 48 : 28,
      confidencePct: 86,
      detectionBand: "Infrarrojo Térmico (4.6 µm)",
      status: "detectado",
    });

    elements.push({
      formula: "H₂O (Hielo/Vapor)",
      name: "Vapor de Agua en Discos",
      category: "Gas Molecular",
      abundancePct: isDustyNursery ? 36 : 18,
      confidencePct: 78,
      detectionBand: "Infrarrojo Térmico (6.0 µm)",
      status: "trazas",
    });
  }

  // 3. Detección por Luz Visible Óptica (DSS2)
  if (hasOptical) {
    elements.push({
      formula: "H-alfa (656.3 nm)",
      name: "Hidrógeno Ionizado (H II)",
      category: "Gas Ionizado",
      abundancePct: 78,
      confidencePct: 98,
      detectionBand: "Óptico Rojo",
      status: "dominante",
    });

    elements.push({
      formula: "[O III] (500.7 nm)",
      name: "Oxígeno Doblemente Ionizado",
      category: "Gas Ionizado",
      abundancePct: 52,
      confidencePct: 94,
      detectionBand: "Óptico Verde-Azul",
      status: "detectado",
    });

    elements.push({
      formula: "Población Estelar",
      name: "Estrellas de Secuencia Principal",
      category: "Estelar",
      abundancePct: 70,
      confidencePct: 95,
      detectionBand: "Fotometría Óptica Visible",
      status: "dominante",
    });
  }

  // 4. Densidad Estelar (Gaia DR3)
  if (hasGaia) {
    elements.push({
      formula: "Paralaje Gaia",
      name: "Densidad de Campo Estelar",
      category: "Estelar",
      abundancePct: 84,
      confidencePct: 99,
      detectionBand: "Astrometría Gaia DR3",
      status: "dominante",
    });
  }

  // Si no se activó ningún filtro (fallback)
  if (elements.length === 0) {
    elements.push({
      formula: "H I Neutro",
      name: "Hidrógeno Neutro de Fondo",
      category: "Gas Molecular",
      abundancePct: 40,
      confidencePct: 70,
      detectionBand: "Banda Base",
      status: "detectado",
    });
  }

  // Inferencia del fenómeno dominante y conclusión científica
  let dominantPhenomenon = "Emisión continua estelar difusa de campo profundo";
  let estimatedTemperature = "10 K a 10.000 K";
  let radiationFieldIntensity: AstrophysicalAnalysisResult["radiationFieldIntensity"] = "Moderada";

  if (hasXray) {
    radiationFieldIntensity = "Extrema";
    estimatedTemperature = "10⁶ K a 10⁷ K (Régimen de Coronas y Acreción Relativista)";
    dominantPhenomenon = "Plasma térmico de alta energía e interacciones magnetohidrodinámicas extremas";
  } else if (hasInfrared && hasOptical) {
    radiationFieldIntensity = "Alta";
    estimatedTemperature = "20 K (núcleos fríos) a 8.500 K (envolturas H II)";
    dominantPhenomenon = "Formación estelar activa con desocultamiento de gas molecular por fotólisis";
  } else if (hasInfrared) {
    radiationFieldIntensity = "Moderada";
    estimatedTemperature = "15 K a 300 K (Régimen Térmico Frío)";
    dominantPhenomenon = "Opacidad por granos de polvo interestelar y absorción en líneas moleculares";
  } else {
    radiationFieldIntensity = "Moderada";
    estimatedTemperature = "3.000 K a 9.000 K";
    dominantPhenomenon = "Dispersión Rayleigh y fotones térmicos de secuencia principal";
  }

  // Conclusión contextual
  let scientificConclusion = "";
  if (matchedTarget) {
    scientificConclusion = `Coincidencia positiva con ${matchedTarget.name} (${matchedTarget.nature}) a ${matchedTarget.distanceLy}. `;
    if (hasXray) {
      scientificConclusion +=
        "La firma espectral de Rayos X de Chandra confirma procesos de aceleración de partículas y la presencia de plasma térmico sobrecalentado.";
    } else if (hasInfrared) {
      scientificConclusion +=
        "El canal infrarrojo penetra las estructuras de polvo de silicatos, revelando firmas de gas molecular y formación de nuevos sistemas estelares.";
    } else {
      scientificConclusion +=
        "La morfología en luz óptica de DSS2 define claramente las estructuras de gas ionizado y frentes de emisión H-alfa.";
    }
  } else {
    scientificConclusion =
      "Sector astronómico profundo no registrado en el catálogo de objetos emblemáticos. ";
    if (hasXray) {
      scientificConclusion +=
        "Detección inusual de emisión energética en Rayos X; podría corresponder a un núcleo galáctico activo (AGN) de fondo o un remanente compacto no catalogado.";
    } else if (hasInfrared) {
      scientificConclusion +=
        "La correlación de polvo de silicatos y emisión infrarroja térmica sugiere un sector denso del medio interestelar (ISM) propicio para condensación gravitatoria.";
    } else {
      scientificConclusion +=
        "Fotometría de luz visible estándar correspondiente a un campo estelar galáctico con absorción media del medio interestelar.";
    }
  }

  return {
    activeFilters: activeFilterIds,
    matchedTarget,
    detectedElements: elements
      .map((el) => ({
        ...el,
        confidencePct: Math.min(99, Math.round(el.confidencePct * blendWeight)),
      }))
      .sort((a, b) => b.abundancePct - a.abundancePct),
    dominantPhenomenon,
    scientificConclusion,
    estimatedTemperature,
    radiationFieldIntensity,
  };
}

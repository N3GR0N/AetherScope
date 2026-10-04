import type { CatalogTarget } from "./database";
import type { AstronomicalObjectResult } from "./crossmatch";

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
    name: "Luz Visible (DSS2 Óptico)",
    shortLabel: "ÓPTICO DSS2",
    band: "optical",
    wavelength: "400 - 750 nm",
    colorHex: "#38bdf8",
    hipsUrl: "https://alasky.cds.unistra.fr/DSS/DSSColor",
    description: "Fotometría de continuo en el espectro visible capturada por telescopios terrestres Schmidt.",
  },
  {
    id: "jwst",
    name: "Infrarrojo Profundo (JWST NIRCam)",
    shortLabel: "JWST NIRCAM",
    band: "infrared",
    wavelength: "0.6 - 5.0 µm",
    colorHex: "#f59e0b",
    hipsUrl: "https://skies.esac.esa.int/JWST/NIRCam_Imaging/",
    description: "Penetra el polvo cósmico opaco y revela protoestrellas, discos circumestelares y galaxias primordiales.",
  },
  {
    id: "allwise",
    name: "Infrarrojo Térmico (AllWISE)",
    shortLabel: "ALLWISE TÉRMICO",
    band: "infrared",
    wavelength: "3.4 - 22 µm (W1-W4)",
    colorHex: "#f97316",
    hipsUrl: "https://alasky.cds.unistra.fr/AllWISE/RGB-W4-W2-W1",
    description: "Mapeo pancósmico térmico sensible a polvo interestelar caliente, enanas marrones y núcleos activos.",
  },
  {
    id: "chandra",
    name: "Rayos X de Alta Energía (Chandra)",
    shortLabel: "CHANDRA RAYOS X",
    band: "xray",
    wavelength: "0.1 - 10 keV (0.12 - 12 nm)",
    colorHex: "#a855f7",
    hipsUrl: "https://cdaftp.cfa.harvard.edu/cxc-hips",
    description: "Detecta fenómenos de alta energía: plasmas a millones de grados, acreción relativista y remanentes.",
  },
  {
    id: "gaia",
    name: "Densidad Estelar (Gaia DR3)",
    shortLabel: "GAIA DR3",
    band: "stellar",
    wavelength: "Astrometría Óptica Banda G",
    colorHex: "#10b981",
    hipsUrl: "https://alasky.cds.unistra.fr/ancillary/GaiaDR3/color-Rp-G-Bp-flux-map",
    description: "Cartografía astrométrica y cinemática de precisión de más de 1.800 millones de estrellas.",
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
  matchedTarget: AstronomicalObjectResult | CatalogTarget | null;
  detectedElements: DetectedChemicalElement[];
  dominantPhenomenon: string;
  scientificConclusion: string;
  estimatedTemperature: string;
  radiationFieldIntensity: "Baja" | "Moderada" | "Alta" | "Extrema";
}

/**
 * Algoritmo de inferencia espectral y detección química/física según los filtros activos
 * y las características del objeto astronómico identificado.
 *
 * Mapeo físico:
 * - Rayos X: gas a alta temperatura (>10⁶ K), acreción gravitacional, fuente compacta.
 * - Infrarrojo: polvo de silicatos, monóxido de carbono (CO), nubes moleculares (H₂).
 * - Óptico / Gaia: fotosferas estelares, población de secuencia principal.
 */
export function runAstrophysicalAnalysis(
  activeFilterIds: string[],
  matchedTarget: AstronomicalObjectResult | CatalogTarget | null,
  blendOpacity: number
): AstrophysicalAnalysisResult {
  const elements: DetectedChemicalElement[] = [];

  const blendWeight = Math.min(1.0, 0.9 + Math.max(0, blendOpacity) * 0.1);

  const hasOptical = activeFilterIds.includes("dss2");
  const hasJWST = activeFilterIds.includes("jwst");
  const hasThermal = activeFilterIds.includes("allwise");
  const hasXray = activeFilterIds.includes("chandra");
  const hasGaia = activeFilterIds.includes("gaia");
  const hasInfrared = hasJWST || hasThermal;

  const targetName = matchedTarget ? matchedTarget.name.toLowerCase() : "";
  const isHighEnergyObject =
    targetName.includes("sagitario") ||
    targetName.includes("sgr a") ||
    targetName.includes("cangrejo") ||
    targetName.includes("crab") ||
    targetName.includes("púlsar") ||
    targetName.includes("agujero negro");

  const isDustyNursery =
    targetName.includes("pilares") ||
    targetName.includes("m16") ||
    targetName.includes("carina") ||
    targetName.includes("sombrero") ||
    targetName.includes("nebulosa");

  // 1. Rayos X de Alta Energía (Chandra)
  if (hasXray) {
    elements.push({
      formula: "Plasma Térmico",
      name: "Gas a Alta Temperatura (>10⁶ K)",
      category: "Plasma de Alta Energía",
      abundancePct: isHighEnergyObject ? 90 : 58,
      confidencePct: 95,
      detectionBand: "Rayos X de Alta Energía (0.1 - 10 keV)",
      status: isHighEnergyObject ? "dominante" : "detectado",
    });

    elements.push({
      formula: "Acreción Gravitacional",
      name: "Acreción Gravitacional / Fuente Compacta",
      category: "Plasma de Alta Energía",
      abundancePct: isHighEnergyObject ? 82 : 44,
      confidencePct: 91,
      detectionBand: "Rayos X (Chandra CXC)",
      status: isHighEnergyObject ? "dominante" : "detectado",
    });

    elements.push({
      formula: "Fe XXV / XXVI",
      name: "Hierro Altamente Ionizado",
      category: "Gas Ionizado",
      abundancePct: isHighEnergyObject ? 45 : 28,
      confidencePct: 84,
      detectionBand: "Rayos X (K-Shell 6.7 keV)",
      status: "trazas",
    });
  }

  // 2. Infrarrojo Profundo & Térmico (JWST & AllWISE)
  if (hasInfrared) {
    elements.push({
      formula: "Mg₂SiO₄ / Fe₂SiO₄",
      name: "Polvo de Silicatos Interestelar",
      category: "Polvo Interestelar",
      abundancePct: isDustyNursery ? 88 : 64,
      confidencePct: 96,
      detectionBand: "Infrarrojo Profundo (JWST NIRCam)",
      status: isDustyNursery ? "dominante" : "detectado",
    });

    elements.push({
      formula: "H₂ Molecular",
      name: "Nubes Moleculares (H₂)",
      category: "Gas Molecular",
      abundancePct: isDustyNursery ? 94 : 70,
      confidencePct: 93,
      detectionBand: "Infrarrojo Cercano (2.12 µm)",
      status: "dominante",
    });

    elements.push({
      formula: "CO",
      name: "Monóxido de Carbono (CO)",
      category: "Gas Molecular",
      abundancePct: isDustyNursery ? 52 : 32,
      confidencePct: 88,
      detectionBand: "Infrarrojo Térmico (AllWISE W2)",
      status: "detectado",
    });

    elements.push({
      formula: "PAH Aromáticos",
      name: "Hidrocarburos Aromáticos Policíclicos",
      category: "Polvo Interestelar",
      abundancePct: isDustyNursery ? 42 : 22,
      confidencePct: 82,
      detectionBand: "Infrarrojo Medio (3.3 - 7.7 µm)",
      status: "trazas",
    });
  }

  // 3. Luz Visible Óptica (DSS2)
  if (hasOptical) {
    elements.push({
      formula: "Fotosferas Estelares",
      name: "Fotosferas Estelares (Secuencia Principal)",
      category: "Estelar",
      abundancePct: 76,
      confidencePct: 97,
      detectionBand: "Luz Visible (DSS2 Óptico)",
      status: "dominante",
    });

    elements.push({
      formula: "H-alfa (656.3 nm)",
      name: "Hidrógeno Ionizado H II (Gas Luminoso)",
      category: "Gas Ionizado",
      abundancePct: isDustyNursery ? 85 : 55,
      confidencePct: 96,
      detectionBand: "Óptico Rojo (Balmer Alpha)",
      status: isDustyNursery ? "dominante" : "detectado",
    });

    elements.push({
      formula: "[O III] (500.7 nm)",
      name: "Oxígeno Doblemente Ionizado",
      category: "Gas Ionizado",
      abundancePct: 48,
      confidencePct: 92,
      detectionBand: "Óptico Verde-Cian",
      status: "detectado",
    });
  }

  // 4. Densidad Estelar (Gaia DR3)
  if (hasGaia) {
    elements.push({
      formula: "Población Estelar Gaia",
      name: "Población de Secuencia Principal / Astrometría",
      category: "Estelar",
      abundancePct: 86,
      confidencePct: 99,
      detectionBand: "Astrometría Óptica Gaia DR3",
      status: "dominante",
    });
  }

  if (elements.length === 0) {
    elements.push({
      formula: "H I Neutro",
      name: "Hidrógeno Neutro de Fondo (Línea de 21 cm)",
      category: "Gas Molecular",
      abundancePct: 40,
      confidencePct: 70,
      detectionBand: "Banda Base Óptica",
      status: "detectado",
    });
  }

  // Inferencia física y de temperatura
  let dominantPhenomenon = "Emisión continua estelar difusa de campo profundo";
  let estimatedTemperature = "10 K a 10.000 K";
  let radiationFieldIntensity: AstrophysicalAnalysisResult["radiationFieldIntensity"] = "Moderada";

  if (hasXray) {
    radiationFieldIntensity = "Extrema";
    estimatedTemperature = ">10⁶ K (Gas caliente, acreción y choque relativista)";
    dominantPhenomenon =
      "Gas a alta temperatura (>10⁶ K), acreción gravitacional extrema y presencia de fuentes compactas.";
  } else if (hasInfrared && hasOptical) {
    radiationFieldIntensity = "Alta";
    estimatedTemperature = "20 K (núcleos fríos) a 9.000 K (envolturas ionizadas)";
    dominantPhenomenon =
      "Interacción mixta: polvo de silicatos y nubes moleculares (H₂, CO) contrastadas con fotosferas estelares visibles.";
  } else if (hasInfrared) {
    radiationFieldIntensity = "Moderada";
    estimatedTemperature = "15 K a 350 K (Régimen térmico frío / infrarrojo)";
    dominantPhenomenon =
      "Nubes moleculares frías de H₂, emisión de monóxido de carbono (CO) y opacidad por polvo de silicatos.";
  } else if (hasGaia || hasOptical) {
    radiationFieldIntensity = "Moderada";
    estimatedTemperature = "3.000 K a 8.500 K (Fotosferas estelares)";
    dominantPhenomenon =
      "Fotosferas estelares activas y población dominante de estrellas de secuencia principal.";
  }

  // Síntesis astrofísica contextual
  let scientificConclusion = "";
  if (matchedTarget && "source" in matchedTarget && matchedTarget.source === "local_dossier") {
    scientificConclusion = `Coincidencia positiva en dossier local con ${matchedTarget.name} (${matchedTarget.objectType})${
      matchedTarget.distanceLy ? ` a ${matchedTarget.distanceLy}` : ""
    }. `;
    if (hasXray) {
      scientificConclusion +=
        "El canal de Rayos X de Chandra corrobora gas sobrecalentado (>10⁶ K) y fuentes de acreción gravitacional compactas en la región.";
    } else if (hasInfrared) {
      scientificConclusion +=
        "La visión infrarroja (JWST / AllWISE) desvela nubes moleculares de H₂, monóxido de carbono (CO) y granos de silicatos interestelares.";
    } else {
      scientificConclusion +=
        "La morfología óptica de DSS2 define con nitidez las fotosferas de secuencia principal y la emisión ionizada.";
    }
  } else if (matchedTarget && "source" in matchedTarget && matchedTarget.source === "simbad_api") {
    scientificConclusion = `Identificación validada vía SIMBAD TAP (CDS Estrasburgo): ${matchedTarget.name} (${matchedTarget.objectType}). `;
    if (hasXray) {
      scientificConclusion +=
        "La sobreposición de Rayos X permite evaluar acreción gravitacional y gas térmico ultraenergético.";
    } else if (hasInfrared) {
      scientificConclusion +=
        "El espectro infrarrojo penetra el velo óptico, identificando componentes moleculares y polvo térmico circundante.";
    } else {
      scientificConclusion +=
        "El flujo en luz visible confirma la posición astrométrica ICRS y la emisión de continuo estelar.";
    }
  } else if (matchedTarget && !("source" in matchedTarget)) {
    scientificConclusion = `Coincidencia positiva en catálogo de referencia con ${matchedTarget.name} (${matchedTarget.nature}) a ${matchedTarget.distanceLy}. `;
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
      "Sector de cielo profundo en exploración / estrellas de fondo no catalogadas de manera singular. ";
    if (hasXray) {
      scientificConclusion +=
        "Detección inusual en Rayos X; podría asociarse a emisión coronal o núcleos activos de fondo difuso.";
    } else if (hasInfrared) {
      scientificConclusion +=
        "Detección de polvo de silicatos y emisión térmica del medio interestelar difuso.";
    } else {
      scientificConclusion +=
        "Fotometría estándar dominada por fotosferas estelares de secuencia principal y campo óptico abierto.";
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

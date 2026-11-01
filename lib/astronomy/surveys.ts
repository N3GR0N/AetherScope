/**
 * AetherScope - Spectral Survey Definitions
 * HiPS surveys cataloged from CDS, ESA, NASA, STScI & Harvard CXC.
 * Direct official HTTPS endpoints are used to prevent mirror resolution and mixed-content failures.
 */

export interface SpectralSurvey {
  id: string;
  name: string;
  shortLabel: string;
  telescope: string;
  agency: string;
  hipsId: string;
  hipsUrl: string;
  mirrors?: string[];
  wavelengthBand: string;
  spectralRange: string;
  frequency: string;
  accentColor: string;
  tagColor: string;
  description: string;
  astrophysicalFocus: string;
  keyEmissions: string[];
}

export const UNIVERSAL_BASE_SURVEY_URL = 'https://alasky.cds.unistra.fr/DSS/DSSColor';
export const UNIVERSAL_BASE_SURVEY_ID = 'CDS/P/DSS2/color';
export const HST_COLOR_SURVEY_URL = 'https://alasky.cds.unistra.fr/HST-hips/color';
export const JWST_NIRCAM_OVERLAY_URL = 'https://skies.esac.esa.int/JWST/NIRCam_Imaging/';
export const NON_CDS_FALLBACK_SURVEY_URL = 'https://skies.esac.esa.int/DSSColor';

interface SurveyHealthCacheEntry {
  available: boolean;
  checkedAt: number;
}

const SURVEY_HEALTH_CACHE_TTL_MS = 60_000;
const surveyHealthCache = new Map<string, SurveyHealthCacheEntry>();

export function clearSurveyHealthCache(): void {
  surveyHealthCache.clear();
}

export function isCdsHost(urlOrHost: string): boolean {
  if (!urlOrHost) return false;
  try {
    const raw = urlOrHost.startsWith('http') ? new URL(urlOrHost).hostname : urlOrHost;
    const host = raw.toLowerCase();
    return (
      host.endsWith('unistra.fr') ||
      host.endsWith('u-strasbg.fr') ||
      host.includes('alasky')
    );
  } catch {
    return false;
  }
}

export function getMirrorAgency(url: string): string {
  if (!url) return 'DESCONOCIDO';
  if (url.includes('esac.esa.int') || url.includes('esa.int')) return 'ESA';
  if (url.includes('casda.csiro.au') || url.includes('csiro.au')) return 'CSIRO';
  if (url.includes('cfa.harvard.edu')) return 'HARVARD';
  if (url.includes('caltech.edu') || url.includes('ipac.caltech.edu')) return 'IPAC';
  if (url.includes('unistra.fr') || url.includes('u-strasbg.fr')) return 'CDS';
  return 'ESPEJO';
}

export interface ResolvedSurveyInfo {
  url: string | null;
  isMirror: boolean;
  mirrorAgency?: string;
  isAvailable: boolean;
}

export async function checkSurveyHealth(
  survey: { hipsUrl: string } | string,
  timeoutMs: number = 4000
): Promise<boolean> {
  const hipsUrl = typeof survey === 'string' ? survey : survey.hipsUrl;
  if (!hipsUrl) return false;

  const baseUrl = hipsUrl.replace(/\/+$/, '');
  const propertiesUrl = `${baseUrl}/properties`;

  const cached = surveyHealthCache.get(propertiesUrl);
  if (cached && Date.now() - cached.checkedAt < SURVEY_HEALTH_CACHE_TTL_MS) {
    return cached.available;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(propertiesUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'text/plain, */*' },
    });
    const isAvailable = res.ok;
    surveyHealthCache.set(propertiesUrl, { available: isAvailable, checkedAt: Date.now() });
    return isAvailable;
  } catch {
    surveyHealthCache.set(propertiesUrl, { available: false, checkedAt: Date.now() });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resuelve la primera URL sana para un survey dado:
 * 1. Prueba primero la URL principal (`hipsUrl`).
 * 2. Si falla, prueba secuencialmente los espejos verificados (`mirrors`).
 * 3. Si todos fallan o no hay ninguno sano, retorna `{ url: null, isMirror: false, isAvailable: false }`.
 */
export async function resolveSurveyUrl(
  survey: { hipsUrl: string; mirrors?: string[] } | string,
  timeoutMs: number = 4000
): Promise<ResolvedSurveyInfo> {
  const primaryUrl = typeof survey === 'string' ? survey : survey.hipsUrl;
  const mirrors = typeof survey === 'string' ? [] : (survey.mirrors ?? []);

  // 1. Probar la URL principal
  if (primaryUrl) {
    const primaryOk = await checkSurveyHealth(primaryUrl, timeoutMs);
    if (primaryOk) {
      return {
        url: primaryUrl,
        isMirror: false,
        isAvailable: true,
      };
    }
  }

  // 2. Probar espejos en orden
  for (const mirrorUrl of mirrors) {
    const mirrorOk = await checkSurveyHealth(mirrorUrl, timeoutMs);
    if (mirrorOk) {
      return {
        url: mirrorUrl,
        isMirror: true,
        mirrorAgency: getMirrorAgency(mirrorUrl),
        isAvailable: true,
      };
    }
  }

  // 3. Ningún endpoint respondió
  return {
    url: null,
    isMirror: false,
    isAvailable: false,
  };
}

export async function findFirstAvailableNonCdsSurvey(
  surveys: SpectralSurvey[] = SPECTRAL_SURVEYS
): Promise<SpectralSurvey | null> {
  const priorityIds = ['jwst', 'xray'];
  const sorted = [...surveys].sort((a, b) => {
    const aPri = priorityIds.indexOf(a.id);
    const bPri = priorityIds.indexOf(b.id);
    if (aPri !== -1 && bPri !== -1) return aPri - bPri;
    if (aPri !== -1) return -1;
    if (bPri !== -1) return 1;
    return 0;
  });

  for (const s of sorted) {
    if (!isCdsHost(s.hipsUrl)) {
      const ok = await checkSurveyHealth(s);
      if (ok) return s;
    }
  }
  return null;
}

export const HST_COLOR_SURVEY: SpectralSurvey = {
  id: 'hst-color',
  name: 'Hubble Óptico Compuesto',
  shortLabel: 'Hubble Óptico',
  telescope: 'Hubble Space Telescope',
  agency: 'NASA / ESA / STScI',
  hipsId: 'CDS/P/HST/color',
  hipsUrl: HST_COLOR_SURVEY_URL,
  mirrors: [],
  wavelengthBand: 'Óptico Compuesto (ACS/WFC3)',
  spectralRange: '390 nm – 850 nm',
  frequency: '350 THz – 770 THz',
  accentColor: '#38BDF8',
  tagColor: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  description: 'Datos fotométricos de alta resolución angular de las cámaras ACS y WFC3 del telescopio espacial Hubble.',
  astrophysicalFocus: 'Gas de emisión ionizado, polvo oscuro y fotosferas estelares resueltas.',
  keyEmissions: ['Hα (656.3 nm)', '[O III] (500.7 nm)', '[S II] (671.6 nm)'],
};

export const NASA_COMPOSITE_SURVEY: SpectralSurvey = {
  id: 'nasa-composite',
  name: 'NASA Composite (Hubble Óptico + JWST NIRCam)',
  shortLabel: 'Vista NASA',
  telescope: 'Hubble & James Webb',
  agency: 'NASA / ESA / CSA / STScI',
  hipsId: 'ESAVO/P/JWST/NIRCam_Imaging',
  hipsUrl: JWST_NIRCAM_OVERLAY_URL,
  mirrors: [],
  wavelengthBand: 'Compuesto Multiespectral Difusión Pública',
  spectralRange: '0.4 µm – 4.4 µm (Hubble Óptico + JWST NIRCam)',
  frequency: '68 THz – 750 THz',
  accentColor: '#506385',
  tagColor: 'text-[#F1F0E1] border-[#3A3A42] bg-[#17171C]',
  description: 'Fusión oficial de difusión pública de la NASA combinando el gas de emisión en color óptico de Hubble con la penetración estelar nítida en el infrarrojo de JWST.',
  astrophysicalFocus: 'Pilares de fotoevaporación, protoestrellas embebidas y chorros bipolares.',
  keyEmissions: ['Hubble ACS/WFC3', 'JWST NIRCam F090W/F187N', 'F200W', 'F444W'],
};

export const SPECTRAL_SURVEYS: SpectralSurvey[] = [
  {
    id: 'optical',
    name: 'Hubble & DSS2 Óptico',
    shortLabel: 'DSS2 Óptico',
    telescope: 'Hubble / Digitized Sky Survey 2',
    agency: 'STScI / ESA / Caltech',
    hipsId: 'CDS/P/DSS2/color',
    hipsUrl: 'https://alasky.cds.unistra.fr/DSS/DSSColor',
    mirrors: [
      'https://skies.esac.esa.int/DSSColor',
      'https://casda.csiro.au/hips/DSS2/color',
    ],
    wavelengthBand: 'Espectro Visible (Luz Óptica)',
    spectralRange: '380 nm – 750 nm',
    frequency: '400 THz – 790 THz',
    accentColor: '#38BDF8', // Cyan Ice
    tagColor: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    description: 'La visión humana proyectada al cosmos: fotosferas estelares y gas ionizado resplandeciente.',
    astrophysicalFocus: 'Estructuras de brazos espirales, nebulosas de reflexión y cúmulos abiertos.',
    keyEmissions: ['Hα (656.3 nm)', '[O III] (500.7 nm)', '[N II] (658.4 nm)'],
  },
  {
    id: 'gaia',
    name: 'Gaia DR3 Astrometría',
    shortLabel: 'Gaia DR3',
    telescope: 'Gaia Space Telescope',
    agency: 'ESA (European Space Agency)',
    hipsId: 'CDS/P/GAIA/DR3/color',
    hipsUrl: 'https://alasky.cds.unistra.fr/ancillary/GaiaDR3/color-Rp-G-Bp-flux-map',
    mirrors: [
      'https://skies.esac.esa.int/Gaia/dr3/RGB',
    ],
    wavelengthBand: 'Flujo Fotométrico G / Densidad Estelar',
    spectralRange: '330 nm – 1050 nm (Banda G)',
    frequency: '285 THz – 909 THz',
    accentColor: '#34D399', // Emerald Precision
    tagColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    description: 'Cartografía cinemática de 1.800 millones de estrellas con precisión micro-arcosegundo.',
    astrophysicalFocus: 'Movimientos propios galácticos, dispersión estelar y brazos de marea.',
    keyEmissions: ['Flujo G Integrado', 'BP / RP Cromática', 'Paralaje Trigonométrico'],
  },
  {
    id: 'jwst',
    name: 'JWST NIRCam / MIRI',
    shortLabel: 'JWST Infra',
    telescope: 'James Webb Space Telescope',
    agency: 'ESA / NASA / CSA',
    hipsId: 'ESAVO/P/JWST/NIRCam_Imaging',
    hipsUrl: JWST_NIRCAM_OVERLAY_URL,
    mirrors: [],
    wavelengthBand: 'Infrarrojo Cercano / Medio',
    spectralRange: '0.6 µm – 28.0 µm',
    frequency: '10.7 THz – 500 THz',
    accentColor: '#506385',
    tagColor: 'text-[#F1F0E1] border-[#3A3A42] bg-[#17171C]',
    description: 'Penetración de nubes moleculares densas y revelación de galaxias del universo primitivo.',
    astrophysicalFocus: 'Polvo circunestelar cálido, protoestrellas embebidas y emisión PAH.',
    keyEmissions: ['PAH (3.3µm, 7.7µm)', 'H₂ Puro (2.12µm)', 'CO Vapores'],
  },
  {
    id: '2mass',
    name: '2MASS Infrarrojo Cercano',
    shortLabel: '2MASS NIR',
    telescope: 'Two Micron All Sky Survey',
    agency: 'NASA / IPAC / Caltech',
    hipsId: 'CDS/P/2MASS/color',
    hipsUrl: 'https://alaskybis.cds.unistra.fr/2MASS/Color',
    mirrors: [
      'https://skies.esac.esa.int/2MASSColor',
      'https://casda.csiro.au/hips/2MASS/Color',
    ],
    wavelengthBand: 'Infrarrojo Cercano (J, H, Ks)',
    spectralRange: '1.2 µm – 2.2 µm',
    frequency: '136 THz – 240 THz',
    accentColor: '#F97316', // Orange Infrared
    tagColor: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    description: 'Transparencia a través del polvo galáctico para cartografiar el plano de la Vía Láctea.',
    astrophysicalFocus: 'Enanas rojas, gigantes rojas y núcleos estelares ocultos tras el polvo.',
    keyEmissions: ['J (1.25 µm)', 'H (1.65 µm)', 'Ks (2.17 µm)'],
  },
  {
    id: 'wise',
    name: 'AllWISE Térmico IR',
    shortLabel: 'AllWISE Mid-IR',
    telescope: 'Wide-field Infrared Survey Explorer',
    agency: 'NASA / JPL',
    hipsId: 'CDS/P/allWISE/color',
    hipsUrl: 'https://alasky.cds.unistra.fr/AllWISE/RGB-W4-W2-W1',
    mirrors: [
      'https://skies.esac.esa.int/AllWISEColor',
    ],
    wavelengthBand: 'Infrarrojo Térmico Profundo',
    spectralRange: '3.4 µm – 22.0 µm (W1–W4)',
    frequency: '13.6 THz – 88 THz',
    accentColor: '#FB7185', // Rose Thermal
    tagColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    description: 'Detección de polvo interestelar frío a escala pancósmica y proto-sistemas estelares.',
    astrophysicalFocus: 'Enanas marrones ultrafrías, discos protoplanetarios y filamentos galácticos.',
    keyEmissions: ['W1 (3.4 µm Estelar)', 'W2 (4.6 µm CO)', 'W3/W4 (12/22 µm Polvo caliente)'],
  },
  {
    id: 'xray',
    name: 'Chandra / CXC Rayos X',
    shortLabel: 'Chandra X-Ray',
    telescope: 'Chandra X-ray Observatory',
    agency: 'NASA / Smithsonian (CXC)',
    hipsId: 'cxc.harvard.edu/P/cda/hips/allsky/rgb',
    hipsUrl: 'https://cdaftp.cfa.harvard.edu/cxc-hips',
    mirrors: [],
    wavelengthBand: 'Rayos X de Alta Energía',
    spectralRange: '0.1 keV – 10.0 keV (0.12 – 12 nm)',
    frequency: '2.4 × 10¹⁶ – 2.4 × 10¹⁸ Hz',
    accentColor: '#C084FC', // Cosmic Violet
    tagColor: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    description: 'Regiones de colapso gravitatorio extremo, radiación de sincrotrón y discos de acreción.',
    astrophysicalFocus: 'Agujeros negros supermasivos, púlsares relativistas y remanentes de supernova.',
    keyEmissions: ['Fe XXV / XXVI (6.7 keV)', 'O VII / VIII (0.6 keV)', 'Bremsstrahlung térmico'],
  },
];

export const DEFAULT_PRIMARY_SURVEY = SPECTRAL_SURVEYS[0]; // DSS2 Color
export const DEFAULT_OVERLAY_SURVEY = NASA_COMPOSITE_SURVEY;

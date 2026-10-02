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

export const HST_COLOR_SURVEY: SpectralSurvey = {
  id: 'hst-color',
  name: 'Hubble Óptico Compuesto',
  shortLabel: 'Hubble Óptico',
  telescope: 'Hubble Space Telescope',
  agency: 'NASA / ESA / STScI',
  hipsId: 'CDS/P/HST/color',
  hipsUrl: HST_COLOR_SURVEY_URL,
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
  hipsId: 'CDS/P/HST/color',
  hipsUrl: HST_COLOR_SURVEY_URL,
  wavelengthBand: 'Compuesto Multiespectral Difusión Pública',
  spectralRange: '0.4 µm – 4.4 µm (Hubble Óptico + JWST NIRCam)',
  frequency: '68 THz – 750 THz',
  accentColor: '#F59E0B', // Golden Amber
  tagColor: 'text-amber-300 border-amber-500/40 bg-amber-500/15',
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
    agency: 'NASA / ESA / CSA',
    hipsId: 'CDS/P/JWST/Carina-Nebula/NIRCam',
    hipsUrl: 'https://alasky.cds.unistra.fr/JWST/CDS_P_JWST_Carina-Nebula_NIRCam',
    wavelengthBand: 'Infrarrojo Cercano / Medio',
    spectralRange: '0.6 µm – 28.0 µm',
    frequency: '10.7 THz – 500 THz',
    accentColor: '#F59E0B', // Beryllium-Gold
    tagColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
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

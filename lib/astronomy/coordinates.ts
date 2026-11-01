/**
 * AetherScope - Astronomical Coordinate Utilities & Zoom Threshold Config
 * Precision conversions for J2000 Equatorial Coordinates and Celestial FOV
 */

export interface EquatorialCoordinates {
  ra: number;  // Right Ascension in decimal degrees [0, 360)
  dec: number; // Declination in decimal degrees [-90, +90]
}

export interface FormattedCoordinates {
  raHms: string;       // e.g. "07h 23m 19.50s"
  decDms: string;      // e.g. "-73° 27′ 15.6″"
  raDegrees: string;   // e.g. "110.8312°"
  decDegrees: string;  // e.g. "-73.4543°"
  epoch: string;       // "J2000"
}

// ─────────────────────────────────────────────────────────────────────────────
// UMBRAL DE CAPTURA & RESOLUCIÓN ANGULAR PARA "ANALIZAR SECTOR"
// ─────────────────────────────────────────────────────────────────────────────
/**
 * UMBRAL DE CAMPO DE VISIÓN MÁXIMO (FOV) PERMITIDO PARA ANÁLISIS ESPECTRAL
 *
 * Justificación astrofísica y de producto:
 * 1. Con un FOV > 2.0° (~4 veces el diámetro de la Luna Llena), el sector captura
 *    decenas de miles de estrellas de campo no resueltas de la Vía Láctea, diluyendo
 *    la firma espectroscópica en un continuo estelar difuso sin singularidad científica.
 * 2. Un FOV ≤ 2.0° (120 arcmin) enfoca frentes de ionización, cúmulos estelares singulares,
 *    galaxias individuales o remanentes de supernova con suficiente densidad de datos HiPS
 *    para permitir el cross-match preciso (tolerancia típica CDS de 0.4° a 0.5°).
 * 3. En términos de escala, 2.0° representa un "zoom" mínimo efectivo en Aladin Lite
 *    donde el usuario ha focalizado intencionalmente un cuadrante celeste de interés.
 *
 * Configuración: Ajustar este valor numérico en grados decimales:
 * - Para capturas más abiertas: aumentar a 3.0° o 4.0°.
 * - Para análisis ultraespecíficos / núcleo de objetos: reducir a 0.8° o 0.5°.
 */
export const MAX_ANALYSIS_FOV_THRESHOLD_DEG = 2.0;

/**
 * FOV objetivo recomendado al que se aproxima la cámara en el zoom-in guiado
 */
export const TARGET_ANALYSIS_ZOOM_FOV_DEG = 0.85;

/**
 * Converts Right Ascension from decimal degrees to sexagesimal hours, minutes, seconds.
 * 360 degrees = 24 hours (1 hour = 15 degrees)
 */
export function raToSexagesimal(raDeg: number): string {
  const normalized = ((raDeg % 360) + 360) % 360;
  const totalHours = normalized / 15;
  const hours = Math.floor(totalHours);
  const totalMinutes = (totalHours - hours) * 60;
  const minutes = Math.floor(totalMinutes);
  const seconds = (totalMinutes - minutes) * 60;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toFixed(2).padStart(5, '0');

  return `${hStr}h ${mStr}m ${sStr}s`;
}

/**
 * Converts Declination from decimal degrees to sexagesimal degrees, arcminutes, arcseconds.
 */
export function decToSexagesimal(decDeg: number): string {
  const clamped = Math.max(-90, Math.min(90, decDeg));
  const sign = clamped < 0 ? '-' : '+';
  const abs = Math.abs(clamped);
  const degrees = Math.floor(abs);
  const totalMinutes = (abs - degrees) * 60;
  const minutes = Math.floor(totalMinutes);
  const seconds = (totalMinutes - minutes) * 60;

  const dStr = degrees.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toFixed(1).padStart(4, '0');

  return `${sign}${dStr}° ${mStr}′ ${sStr}″`;
}

/**
 * Formats full coordinate bundle for HUD and Inspector
 */
export function formatCoordinates(raDeg: number, decDeg: number): FormattedCoordinates {
  return {
    raHms: raToSexagesimal(raDeg),
    decDms: decToSexagesimal(decDeg),
    raDegrees: `${raDeg >= 0 ? '+' : ''}${raDeg.toFixed(4)}°`,
    decDegrees: `${decDeg >= 0 ? '+' : ''}${decDeg.toFixed(4)}°`,
    epoch: 'J2000',
  };
}

/**
 * Converts an angular field of view (FOV) in degrees to human-readable astronomical units
 * (degrees, arcminutes, or arcseconds)
 */
export function formatFov(fovDeg: number): { value: string; unit: string; rawText: string } {
  if (fovDeg >= 1.0) {
    const val = fovDeg >= 10 ? fovDeg.toFixed(1) : fovDeg.toFixed(2);
    return { value: val, unit: 'deg', rawText: `${val}°` };
  }
  const arcminutes = fovDeg * 60;
  if (arcminutes >= 1.0) {
    const val = arcminutes >= 10 ? arcminutes.toFixed(1) : arcminutes.toFixed(2);
    return { value: val, unit: 'arcmin', rawText: `${val}′` };
  }
  const arcseconds = arcminutes * 60;
  const val = arcseconds.toFixed(1);
  return { value: val, unit: 'arcsec', rawText: `${val}″` };
}

/**
 * Calcula la distancia angular en la esfera celeste mediante la fórmula de Haversine.
 * Retorna la distancia en grados decimales. Numéricamente estable para separaciones pequeñas.
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

  const safeA = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA));
  return (c * 180) / Math.PI;
}

// Alias de retrocompatibilidad
export const calculateOrthodromicDistance = calculateAngularSeparation;

export function sanitizeCoordinateParams(
  rawRa: string | null | undefined,
  rawDec: string | null | undefined,
  rawFov: string | null | undefined,
  defaults = { ra: 274.7, dec: -13.806, fov: 0.18 }
): { ra: number; dec: number; fov: number } {
  let ra = rawRa !== null && rawRa !== undefined ? parseFloat(rawRa) : defaults.ra;
  let dec = rawDec !== null && rawDec !== undefined ? parseFloat(rawDec) : defaults.dec;
  let fov = rawFov !== null && rawFov !== undefined ? parseFloat(rawFov) : defaults.fov;

  if (!Number.isFinite(ra)) ra = defaults.ra;
  if (!Number.isFinite(dec)) dec = defaults.dec;
  if (!Number.isFinite(fov)) fov = defaults.fov;

  ra = ((ra % 360) + 360) % 360;
  dec = Math.max(-90, Math.min(90, dec));
  fov = Math.max(0.001, Math.min(180, fov));

  return { ra, dec, fov };
}

interface ConstellationRegion {
  name: string;
  raMin: number;
  raMax: number;
  decMin: number;
  decMax: number;
}

const CONSTELLATION_REGIONS: ConstellationRegion[] = [
  // 1. Constelaciones pequeñas y específicas prioritarias
  { name: 'Crux', raMin: 178, raMax: 194, decMin: -65, decMax: -55 },
  { name: 'Scutum', raMin: 275, raMax: 288, decMin: -16, decMax: -3 },
  { name: 'Sagitta', raMin: 286, raMax: 305, decMin: 16, decMax: 22 },
  { name: 'Equuleus', raMin: 313, raMax: 322, decMin: 2, decMax: 13 },
  { name: 'Corona Australis', raMin: 268, raMax: 290, decMin: -46, decMax: -36 },
  { name: 'Corona Borealis', raMin: 228, raMax: 247, decMin: 25, decMax: 40 },
  { name: 'Triangulum', raMin: 22, raMax: 44, decMin: 25, decMax: 38 },
  { name: 'Triangulum Australe', raMin: 223, raMax: 258, decMin: -71, decMax: -60 },
  { name: 'Circinus', raMin: 219, raMax: 233, decMin: -70, decMax: -54 },
  { name: 'Musca', raMin: 169, raMax: 209, decMin: -76, decMax: -64 },
  { name: 'Volans', raMin: 99, raMax: 138, decMin: -76, decMax: -64 },
  { name: 'Reticulum', raMin: 49, raMax: 70, decMin: -67, decMax: -52 },
  { name: 'Caelum', raMin: 64, raMax: 77, decMin: -49, decMax: -27 },
  { name: 'Chamaeleon', raMin: 110, raMax: 206, decMin: -83, decMax: -75 },
  { name: 'Apus', raMin: 207, raMax: 278, decMin: -83, decMax: -67 },
  { name: 'Mensa', raMin: 48, raMax: 115, decMin: -86, decMax: -70 },
  { name: 'Delphinus', raMin: 303, raMax: 317, decMin: 2, decMax: 21 },
  { name: 'Canis Minor', raMin: 106, raMax: 123, decMin: 0, decMax: 14 },
  { name: 'Coma Berenices', raMin: 178, raMax: 204, decMin: 13, decMax: 34 },
  { name: 'Corvus', raMin: 178, raMax: 194, decMin: -26, decMax: -11 },
  { name: 'Crater', raMin: 162, raMax: 179, decMin: -26, decMax: -6 },
  { name: 'Lyra', raMin: 273, raMax: 293, decMin: 25, decMax: 48 },
  { name: 'Vulpecula', raMin: 283, raMax: 323, decMin: 19, decMax: 30 },
  { name: 'Serpens Cauda', raMin: 259, raMax: 280, decMin: -17, decMax: 7 },
  { name: 'Serpens Caput', raMin: 226, raMax: 246, decMin: -4, decMax: 26 },

  // 2. Constelaciones curadas del catálogo y principales del firmamento
  { name: 'Carina', raMin: 91, raMax: 170, decMin: -75, decMax: -50 },
  { name: 'Vela', raMin: 123, raMax: 167, decMin: -58, decMax: -37 },
  { name: 'Puppis', raMin: 91, raMax: 126, decMin: -52, decMax: -11 },
  { name: 'Sagittarius', raMin: 264, raMax: 308, decMin: -46, decMax: -11 },
  { name: 'Scorpius', raMin: 237, raMax: 269, decMin: -46, decMax: -8 },
  { name: 'Ophiuchus', raMin: 240, raMax: 274, decMin: -31, decMax: 15 },
  { name: 'Aquila', raMin: 280, raMax: 310, decMin: -12, decMax: 19 },
  { name: 'Cygnus', raMin: 286, raMax: 330, decMin: 27, decMax: 62 },
  { name: 'Orion', raMin: 70, raMax: 96, decMin: -11, decMax: 23 },
  { name: 'Taurus', raMin: 51, raMax: 90, decMin: -2, decMax: 32 },
  { name: 'Gemini', raMin: 90, raMax: 122, decMin: 9, decMax: 36 },
  { name: 'Canis Major', raMin: 93, raMax: 113, decMin: -34, decMax: -11 },
  { name: 'Virgo', raMin: 174, raMax: 228, decMin: -23, decMax: 15 },
  { name: 'Leo', raMin: 139, raMax: 180, decMin: -7, decMax: 33 },
  { name: 'Ursa Major', raMin: 121, raMax: 218, decMin: 28, decMax: 74 },
  { name: 'Cassiopeia', raMin: 343, raMax: 360, decMin: 46, decMax: 78 },
  { name: 'Cassiopeia', raMin: 0, raMax: 56, decMin: 46, decMax: 78 },
  { name: 'Andromeda', raMin: 343, raMax: 360, decMin: 21, decMax: 54 },
  { name: 'Andromeda', raMin: 0, raMax: 40, decMin: 21, decMax: 54 },
  { name: 'Pegasus', raMin: 316, raMax: 360, decMin: 2, decMax: 37 },
  { name: 'Pegasus', raMin: 0, raMax: 4, decMin: 2, decMax: 37 },
  { name: 'Pisces', raMin: 343, raMax: 360, decMin: -7, decMax: 34 },
  { name: 'Pisces', raMin: 0, raMax: 32, decMin: -7, decMax: 34 },
  { name: 'Cetus', raMin: 358, raMax: 360, decMin: -25, decMax: 11 },
  { name: 'Cetus', raMin: 0, raMax: 52, decMin: -25, decMax: 11 },
  { name: 'Aquarius', raMin: 309, raMax: 359, decMin: -26, decMax: 4 },
  { name: 'Capricornus', raMin: 301, raMax: 329, decMin: -28, decMax: -8 },
  { name: 'Aries', raMin: 27, raMax: 53, decMin: 10, decMax: 32 },
  { name: 'Auriga', raMin: 69, raMax: 113, decMin: 28, decMax: 57 },
  { name: 'Boötes', raMin: 204, raMax: 238, decMin: 7, decMax: 55 },
  { name: 'Hercules', raMin: 237, raMax: 284, decMin: 3, decMax: 52 },
  { name: 'Centaurus', raMin: 166, raMax: 225, decMin: -65, decMax: -30 },
  { name: 'Lupus', raMin: 214, raMax: 242, decMin: -56, decMax: -29 },
  { name: 'Libra', raMin: 216, raMax: 241, decMin: -30, decMax: 0 },
  { name: 'Hydra', raMin: 123, raMax: 227, decMin: -36, decMax: 7 },
  { name: 'Eridanus', raMin: 21, raMax: 77, decMin: -58, decMax: 0 },
  { name: 'Piscis Austrinus', raMin: 322, raMax: 347, decMin: -37, decMax: -24 },
  { name: 'Grus', raMin: 321, raMax: 352, decMin: -57, decMax: -36 },
  { name: 'Phoenix', raMin: 351, raMax: 360, decMin: -58, decMax: -39 },
  { name: 'Phoenix', raMin: 0, raMax: 37, decMin: -58, decMax: -39 },
  { name: 'Tucana', raMin: 331, raMax: 360, decMin: -76, decMax: -56 },
  { name: 'Tucana', raMin: 0, raMax: 22, decMin: -76, decMax: -56 },
  { name: 'Pavo', raMin: 265, raMax: 323, decMin: -75, decMax: -56 },
  { name: 'Indus', raMin: 307, raMax: 352, decMin: -75, decMax: -45 },
  { name: 'Dorado', raMin: 58, raMax: 100, decMin: -71, decMax: -48 },
  { name: 'Columba', raMin: 76, raMax: 101, decMin: -44, decMax: -27 },
  { name: 'Lepus', raMin: 72, raMax: 94, decMin: -28, decMax: -10 },
  { name: 'Monoceros', raMin: 88, raMax: 124, decMin: -12, decMax: 12 },
  { name: 'Cancer', raMin: 118, raMax: 142, decMin: 6, decMax: 34 },
  { name: 'Lynx', raMin: 94, raMax: 146, decMin: 32, decMax: 62 },
  { name: 'Perseus', raMin: 22, raMax: 73, decMin: 30, decMax: 60 },
  { name: 'Camelopardalis', raMin: 49, raMax: 216, decMin: 52, decMax: 86 },
  { name: 'Draco', raMin: 141, raMax: 315, decMin: 47, decMax: 86 },
  { name: 'Cepheus', raMin: 300, raMax: 360, decMin: 53, decMax: 89 },
  { name: 'Cepheus', raMin: 0, raMax: 128, decMin: 53, decMax: 89 },
  { name: 'Ursa Minor', raMin: 0, raMax: 360, decMin: 65, decMax: 90 },
  { name: 'Octans', raMin: 0, raMax: 360, decMin: -90, decMax: -74 },
];

/**
 * Determina la constelación oficial de la IAU correspondiente a las coordenadas ecuatoriales J2000.
 */
export function getConstellation(raDeg: number, decDeg: number): string {
  const normRa = ((raDeg % 360) + 360) % 360;
  const clampedDec = Math.max(-90, Math.min(90, decDeg));

  for (const reg of CONSTELLATION_REGIONS) {
    if (
      normRa >= reg.raMin &&
      normRa <= reg.raMax &&
      clampedDec >= reg.decMin &&
      clampedDec <= reg.decMax
    ) {
      return reg.name;
    }
  }

  return 'Deep Celestial Sphere';
}

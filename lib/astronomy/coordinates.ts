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

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (c * 180) / Math.PI;
}

// Alias de retrocompatibilidad
export const calculateOrthodromicDistance = calculateAngularSeparation;

/**
 * Estimates the constellation for a given RA and Dec (approximate celestial bounding regions)
 */
export function getConstellation(raDeg: number, decDeg: number): string {
  if (raDeg >= 155 && raDeg <= 165 && decDeg <= -55 && decDeg >= -65) return 'Carina';
  if (raDeg >= 105 && raDeg <= 115 && decDeg <= -70 && decDeg >= -78) return 'Volans';
  if (raDeg >= 270 && raDeg <= 280 && decDeg <= -10 && decDeg >= -18) return 'Serpens Cauda';
  if (raDeg >= 185 && raDeg <= 195 && decDeg <= -8 && decDeg >= -15) return 'Virgo';
  if (raDeg >= 260 && raDeg <= 275 && decDeg <= -25 && decDeg >= -33) return 'Sagittarius';
  if (raDeg >= 148 && raDeg <= 155 && decDeg <= -38 && decDeg >= -45) return 'Vela';
  if (raDeg >= 335 && raDeg <= 345 && decDeg >= 30 && decDeg <= 40) return 'Pegasus';
  if (raDeg >= 80 && raDeg <= 88 && decDeg >= 20 && decDeg <= 25) return 'Taurus';
  if (raDeg >= 80 && raDeg <= 90 && decDeg >= -10 && decDeg <= 10) return 'Orion';
  if (raDeg >= 5 && raDeg <= 15 && decDeg >= 38 && decDeg <= 45) return 'Andromeda';
  if (raDeg >= 180 && raDeg <= 200 && decDeg >= 40 && decDeg <= 60) return 'Ursa Major';
  return 'Deep Celestial Sphere';
}

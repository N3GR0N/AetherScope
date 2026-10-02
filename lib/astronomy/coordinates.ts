/**
 * AetherScope - Astronomical Coordinate Utilities
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

/**
 * Converts Right Ascension from decimal degrees to sexagesimal hours, minutes, seconds.
 * 360 degrees = 24 hours (1 hour = 15 degrees)
 */
export function raToSexagesimal(raDeg: number): string {
  // Normalize to [0, 360)
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
  // Clamp to [-90, 90]
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
 * Estimates the constellation for a given RA and Dec (approximate celestial bounding regions)
 */
export function getConstellation(raDeg: number, decDeg: number): string {
  // Approximate boundaries for key deep space targets
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

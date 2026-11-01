import { describe, it, expect } from 'vitest';
import { getConstellation, formatCoordinates } from '../lib/astronomy/coordinates';

describe('AetherScope Constellation & Coordinate System', () => {
  it('resuelve correctamente la constelación para el sector de Scutum (reportado en GAIA DR3 4197479784720947968)', () => {
    // RA 19h 06m 55.90s (~286.73°), DEC -13° 36' 09.0" (~-13.60°)
    const constell = getConstellation(286.7329, -13.6025);
    expect(constell).toBe('Scutum');
  });

  it('resuelve constelaciones de catálogo local de referencia', () => {
    // Carina (Carina Nebula: RA 161.26°, DEC -59.88°)
    expect(getConstellation(161.26, -59.88)).toBe('Carina');

    // Volans (SMACS 0723: RA 110.83°, DEC -73.45°)
    expect(getConstellation(110.83, -73.45)).toBe('Volans');

    // Sagittarius (Sgr A*: RA 266.42°, DEC -29.01°)
    expect(getConstellation(266.42, -29.01)).toBe('Sagittarius');

    // Serpens Cauda (M16 Pillars: RA 274.7°, DEC -13.8°)
    expect(getConstellation(274.7, -13.8)).toBe('Serpens Cauda');

    // Orion (Betelgeuse / M42: RA 83.82°, DEC -5.39°)
    expect(getConstellation(83.82, -5.39)).toBe('Orion');

    // Andromeda (M31: RA 10.68°, DEC 41.27°)
    expect(getConstellation(10.68, 41.27)).toBe('Andromeda');
  });

  it('formatea coordenadas con precisión sexagesimal J2000', () => {
    const coords = formatCoordinates(286.7329, -13.6025);
    expect(coords.raHms).toContain('19h 06m');
    expect(coords.decDms).toContain('-13° 36′');
    expect(coords.epoch).toBe('J2000');
  });
});

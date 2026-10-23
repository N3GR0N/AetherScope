import { describe, it, expect } from 'vitest';
import {
  classifyCapture,
  POINT_SOURCE_MATCH_RADIUS_ARCMIN,
  type Capture,
  type FootprintTarget,
} from '../lib/astronomy/footprint';
import { calculateAngularSeparation } from '../lib/astronomy/coordinates';

describe('Motor de Footprint y Clasificación de Capturas (A2 / A5)', () => {
  // Fixture sintético explícito: 240 arcmin x 60 arcmin, Ángulo de Posición 35°
  const SYNTHETIC_FIXTURE_ELLIPTIC_GALAXY_240X60_PA35: FootprintTarget = {
    raDeg: 180.0,
    decDeg: 0.0,
    majorDiameterArcmin: 240.0, // Semieje a = 120 arcmin
    minorDiameterArcmin: 60.0,  // Semieje b = 30 arcmin
    positionAngleDeg: 35.0,
    sizeSource: 'estimate',
    objectType: 'Sintético - Galaxia Elíptica Extensa',
  };

  // 1. Centro dentro
  it('1. clasifica como "inside" cuando la captura se ubica exactamente en el centro del objeto', () => {
    const capture: Capture = {
      raDeg: 180.0,
      decDeg: 0.0,
      radiusDeg: 0.1, // radio de captura pequeño
    };

    const result = classifyCapture(capture, SYNTHETIC_FIXTURE_ELLIPTIC_GALAXY_240X60_PA35);

    expect(result.state).toBe('inside');
    expect(result.normalizedRadius).toBeCloseTo(0, 5);
    expect(result.separationDeg).toBeCloseTo(0, 5);
  });

  // 2. Punto sobre el eje mayor: dentro y fuera de la elipse
  it('2. clasifica correctamente sobre el eje mayor (dentro rho <= 1, fuera rho > 1)', () => {
    // A lo largo de PA = 35°: dxi = d * sin(35°), deta = d * cos(35°)
    const paRad = (35 * Math.PI) / 180;

    // Caso 2a: Dentro sobre el semieje mayor (d = 80 arcmin < a = 120 arcmin)
    const dInside = 80; // arcmin
    const dXiInsideDeg = (dInside * Math.sin(paRad)) / 60;
    const dEtaInsideDeg = (dInside * Math.cos(paRad)) / 60;

    const captureInside: Capture = {
      raDeg: 180.0 + dXiInsideDeg,
      decDeg: 0.0 + dEtaInsideDeg,
      radiusDeg: 0.05,
    };

    const resInside = classifyCapture(captureInside, SYNTHETIC_FIXTURE_ELLIPTIC_GALAXY_240X60_PA35);
    expect(resInside.state).toBe('inside');
    expect(resInside.normalizedRadius).toBeCloseTo(80 / 120, 2);

    // Caso 2b: Fuera sobre el semieje mayor (d = 160 arcmin > a = 120 arcmin, sin solapamiento de radio pequeño)
    const dOutside = 160; // arcmin
    const dXiOutsideDeg = (dOutside * Math.sin(paRad)) / 60;
    const dEtaOutsideDeg = (dOutside * Math.cos(paRad)) / 60;

    const captureOutside: Capture = {
      raDeg: 180.0 + dXiOutsideDeg,
      decDeg: 0.0 + dEtaOutsideDeg,
      radiusDeg: 0.1, // r = 6 arcmin; 120 + 6 = 126 arcmin < 160 arcmin
    };

    const resOutside = classifyCapture(captureOutside, SYNTHETIC_FIXTURE_ELLIPTIC_GALAXY_240X60_PA35);
    expect(resOutside.state).toBe('none');
    expect(resOutside.normalizedRadius).toBeGreaterThan(1.0);
  });

  // 3. Punto sobre el eje menor: dentro y fuera
  it('3. clasifica correctamente sobre el eje menor (dentro < 30 arcmin, fuera > 30 arcmin)', () => {
    // Eje menor perpendicular a PA 35°: PA_minor = 35° + 90° = 125°
    const paMinorRad = (125 * Math.PI) / 180;

    // Caso 3a: Dentro sobre el semieje menor (d = 20 arcmin < b = 30 arcmin)
    const dInside = 20; // arcmin
    const captureMinorInside: Capture = {
      raDeg: 180.0 + (dInside * Math.sin(paMinorRad)) / 60,
      decDeg: 0.0 + (dInside * Math.cos(paMinorRad)) / 60,
      radiusDeg: 0.05,
    };
    const resInside = classifyCapture(captureMinorInside, SYNTHETIC_FIXTURE_ELLIPTIC_GALAXY_240X60_PA35);
    expect(resInside.state).toBe('inside');
    expect(resInside.normalizedRadius).toBeCloseTo(20 / 30, 2);

    // Caso 3b: Fuera sobre el semieje menor (d = 50 arcmin > b = 30 arcmin)
    const dOutside = 50; // arcmin
    const captureMinorOutside: Capture = {
      raDeg: 180.0 + (dOutside * Math.sin(paMinorRad)) / 60,
      decDeg: 0.0 + (dOutside * Math.cos(paMinorRad)) / 60,
      radiusDeg: 0.05, // r = 3 arcmin; 30 + 3 = 33 arcmin < 50 arcmin
    };
    const resOutside = classifyCapture(captureMinorOutside, SYNTHETIC_FIXTURE_ELLIPTIC_GALAXY_240X60_PA35);
    expect(resOutside.state).toBe('none');
  });

  // 4. 'edge' con captura de radio 0.425° (25.5 arcmin)
  it('4. detecta estado "edge" cuando el centro está fuera pero el radio de 0.425° solapa el semieje mayor', () => {
    // a = 120 arcmin. Si el radio de captura r = 0.425° = 25.5 arcmin, a + r = 145.5 arcmin.
    // Un punto a d = 135 arcmin está fuera de la elipse (135 > 120), pero dentro de la elipse inflada (135 < 145.5).
    const paRad = (35 * Math.PI) / 180;
    const dEdge = 135; // arcmin
    const captureEdge: Capture = {
      raDeg: 180.0 + (dEdge * Math.sin(paRad)) / 60,
      decDeg: 0.0 + (dEdge * Math.cos(paRad)) / 60,
      radiusDeg: 0.425, // 25.5 arcmin
    };

    const resEdge = classifyCapture(captureEdge, SYNTHETIC_FIXTURE_ELLIPTIC_GALAXY_240X60_PA35);
    expect(resEdge.state).toBe('edge');
    expect(resEdge.normalizedRadius).toBeGreaterThan(1.0); // No está inside
  });

  // 5. 'none' lejos
  it('5. clasifica como "none" cuando la captura está lejana', () => {
    const captureFar: Capture = {
      raDeg: 190.0, // 10 grados de distancia
      decDeg: 10.0,
      radiusDeg: 0.5,
    };

    const resFar = classifyCapture(captureFar, SYNTHETIC_FIXTURE_ELLIPTIC_GALAXY_240X60_PA35);
    expect(resFar.state).toBe('none');
    expect(resFar.separationDeg).toBeGreaterThan(10);
  });

  // 6. Simetría de la separación
  it('6. garantiza la estricta simetría del cálculo de separación angular (sep(A, B) === sep(B, A))', () => {
    const p1 = { ra: 45.123, dec: -12.456 };
    const p2 = { ra: 187.654, dec: 63.891 };

    const sep1 = calculateAngularSeparation(p1.ra, p1.dec, p2.ra, p2.dec);
    const sep2 = calculateAngularSeparation(p2.ra, p2.dec, p1.ra, p1.dec);

    expect(sep1).toBeCloseTo(sep2, 10);
  });

  // 7. Cruce de RA en 359.9° -> 0.1°
  it('7. maneja adecuadamente el wrap de Ascensión Recta a través del meridiano 0°/360°', () => {
    // Objeto sintético centrado en RA 359.95°, Dec 0°
    const SYNTHETIC_FIXTURE_WRAP_TARGET: FootprintTarget = {
      raDeg: 359.95,
      decDeg: 0.0,
      majorDiameterArcmin: 30.0, // a = 15 arcmin = 0.25°
      minorDiameterArcmin: 30.0,
      positionAngleDeg: 0,
      sizeSource: 'estimate',
    };

    // Captura en RA 0.05°, Dec 0°. Distancia real a través de 0° es 0.1° (6 arcmin < 15 arcmin)
    const captureCross: Capture = {
      raDeg: 0.05,
      decDeg: 0.0,
      radiusDeg: 0.1,
    };

    const resWrap = classifyCapture(captureCross, SYNTHETIC_FIXTURE_WRAP_TARGET);

    expect(resWrap.separationDeg).toBeCloseTo(0.1, 4);
    expect(resWrap.state).toBe('inside');
  });

  // 8. Declinación cercana a +89° (efectos de convergencia en el polo celeste)
  it('8. proyecta con estabilidad numérica en declinaciones altas polares (+89°)', () => {
    const SYNTHETIC_FIXTURE_POLAR_TARGET: FootprintTarget = {
      raDeg: 0.0,
      decDeg: 89.0,
      majorDiameterArcmin: 60.0, // radio angular de 30 arcmin = 0.5°
      minorDiameterArcmin: 60.0,
      positionAngleDeg: 0,
      sizeSource: 'estimate',
    };

    // Captura a 0.2° de distancia (12 arcmin) cerca del polo, dentro del radio de 30 arcmin
    const captureNearPole: Capture = {
      raDeg: 10.0,
      decDeg: 89.2,
      radiusDeg: 0.1,
    };

    const resPolar = classifyCapture(captureNearPole, SYNTHETIC_FIXTURE_POLAR_TARGET);
    expect(resPolar.state).toBe('inside');
    expect(resPolar.separationDeg).toBeLessThan(0.5);
    expect(Number.isFinite(resPolar.normalizedRadius)).toBe(true);
  });

  // 9. Objeto puntual dentro y fuera de POINT_SOURCE_MATCH_RADIUS_ARCMIN
  it('9. clasifica fuentes puntuales según POINT_SOURCE_MATCH_RADIUS_ARCMIN (2 arcmin)', () => {
    const SYNTHETIC_FIXTURE_POINT_STAR: FootprintTarget = {
      raDeg: 50.0,
      decDeg: 25.0,
      majorDiameterArcmin: 0, // Fuente puntual
      minorDiameterArcmin: 0,
      sizeSource: 'estimate',
      category: 'star',
    };

    expect(POINT_SOURCE_MATCH_RADIUS_ARCMIN).toBe(2);

    // Caso 9a: Separación de 1 arcmin (< 2 arcmin) => inside
    const captureInside: Capture = {
      raDeg: 50.0 + 1.0 / (60 * Math.cos((25 * Math.PI) / 180)),
      decDeg: 25.0,
      radiusDeg: 0.01,
    };
    const resInside = classifyCapture(captureInside, SYNTHETIC_FIXTURE_POINT_STAR);
    expect(resInside.state).toBe('inside');

    // Caso 9b: Separación de 5 arcmin (> 2 arcmin + radio de 0.5 arcmin) => none
    const captureOutside: Capture = {
      raDeg: 50.0 + 5.0 / (60 * Math.cos((25 * Math.PI) / 180)),
      decDeg: 25.0,
      radiusDeg: 0.5 / 60, // 0.5 arcmin
    };
    const resOutside = classifyCapture(captureOutside, SYNTHETIC_FIXTURE_POINT_STAR);
    expect(resOutside.state).toBe('none');
  });
});

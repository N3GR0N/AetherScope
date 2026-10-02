/**
 * AetherScope - Space Telescopes Specification & Orbital Telemetry
 * Precision orbital parameters, optics, and default sensors for JWST & Hubble.
 */

export interface SpaceTelescope {
  id: 'jwst' | 'hubble';
  name: string;
  fullName: string;
  orbitType: string;
  altitudeInfo: string;
  targetInitial: string;
  fovInitial: number;
  baseSurvey: string;
  overlaySurvey?: string;
  instruments: string[];
  trajectoryColor: string; // Color hexadecimal para la estela orbital
}

export const TELESCOPES: Record<'jwst' | 'hubble', SpaceTelescope> = {
  jwst: {
    id: 'jwst',
    name: 'James Webb (JWST)',
    fullName: 'James Webb Space Telescope',
    orbitType: 'Halo Orbit en Punto Lagrange L2',
    altitudeInfo: '~1.500.000 km de la Tierra',
    targetInitial: '18 18 48 -13 49 00', // Pilares de la Creación (M16)
    fovInitial: 0.18,
    baseSurvey: 'https://alasky.cds.unistra.fr/HST-hips/color',
    overlaySurvey: 'https://skies.esac.esa.int/JWST/NIRCam_Imaging/',
    instruments: ['NIRCam', 'MIRI', 'NIRSpec', 'FGS/NIRISS'],
    trajectoryColor: '#eab308', // Oro característico de espejos de berilio
  },
  hubble: {
    id: 'hubble',
    name: 'Hubble (HST)',
    fullName: 'Hubble Space Telescope',
    orbitType: 'Órbita Terrestre Baja (LEO - 28.5° inc)',
    altitudeInfo: '~535 km sobre la superficie',
    targetInitial: '18 18 48 -13 49 00',
    fovInitial: 0.25,
    baseSurvey: 'https://alasky.cds.unistra.fr/HST-hips/color',
    instruments: ['WFC3', 'ACS', 'STIS', 'COS'],
    trajectoryColor: '#38bdf8', // Cian / Azul orbital reflectante
  },
};

export const DEFAULT_TELESCOPE = TELESCOPES.jwst;

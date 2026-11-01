import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  querySimbadConeCapture,
  identifyCelestialCapture,
  clearCrossMatchCache,
  SIMBAD_TAP_ENDPOINTS,
} from '@/lib/astronomy/crossmatch';
import {
  checkSurveyHealth,
  clearSurveyHealthCache,
  isCdsHost,
  findFirstAvailableNonCdsSurvey,
  SPECTRAL_SURVEYS,
} from '@/lib/astronomy/surveys';
import { GET as simbadRouteGet } from '@/app/api/simbad/route';
import { GET as cdsStatusRouteGet, clearCdsStatusServerCache } from '@/app/api/cds-status/route';
import {
  runPoll,
  onCdsRecovered,
  _resetRecoveryManagerForTests,
  _setDegradedStateForTests,
} from '@/lib/hooks/useCdsRecovery';
import type { Capture } from '@/lib/astronomy/footprint';

describe('Resiliencia y Failover ante Degradación de CDS Estrasburgo', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearCrossMatchCache();
    clearSurveyHealthCache();
    clearCdsStatusServerCache();
    _resetRecoveryManagerForTests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    _resetRecoveryManagerForTests();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Cadena de failover de SIMBAD TAP en crossmatch.ts
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Cadena de failover de SIMBAD TAP (crossmatch.ts)', () => {
    it('incluye el endpoint oficial de Estrasburgo y el espejo de Harvard', () => {
      expect(SIMBAD_TAP_ENDPOINTS).toContain('https://simbad.cds.unistra.fr/simbad/sim-tap/sync');
      expect(SIMBAD_TAP_ENDPOINTS).toContain('https://simbad.cfa.harvard.edu/simbad/sim-tap/sync');
    });
    const testCapture: Capture = {
      raDeg: 200.0,
      decDeg: -20.0,
      radiusDeg: 0.1,
    };

    it('éxito en el endpoint primario (CDS): no recurre al espejo', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('simbad.cds.unistra.fr')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                ['HD 116658', 'Star', 200.0, -20.0, null, null, null],
              ],
            }),
          });
        }
        return Promise.reject(new Error('Should not call mirror if primary succeeds'));
      });

      global.fetch = mockFetch;

      const result = await querySimbadConeCapture(testCapture, 500);

      expect(result.unavailable).toBeFalsy();
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].name).toBe('HD 116658');
      expect(result.candidates[0].designation).toBe('SIMBAD HD 116658');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0].toString()).toContain('simbad.cds.unistra.fr');
    });

    it('fallo del endpoint primario (CDS) con failover exitoso al espejo secundario (Harvard)', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('simbad.cds.unistra.fr')) {
          // Primario falla por timeout / desconexión
          return Promise.reject(new Error('Connection timed out'));
        }
        if (urlStr.includes('simbad.cfa.harvard.edu')) {
          // Espejo de Harvard responde 200
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                ['Spica Mirror', 'B0IV', 200.001, -20.001, 0.2, 0.2, 45],
              ],
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected url: ${urlStr}`));
      });

      global.fetch = mockFetch;

      const result = await querySimbadConeCapture(testCapture, 500);

      expect(result.unavailable).toBeFalsy();
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].name).toBe('Spica Mirror');
      expect(result.candidates[0].designation).toBe('SIMBAD Spica Mirror');
      // Verificamos que ambos endpoints fueron intentados en orden
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0].toString()).toContain('simbad.cds.unistra.fr');
      expect(mockFetch.mock.calls[1][0].toString()).toContain('simbad.cfa.harvard.edu');
    });

    it('timeout en todos los endpoints: devuelve unavailable explícito (no "sin match")', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error('AbortError: The operation was aborted due to timeout'));
      });

      global.fetch = mockFetch;

      // Coordenadas que NO corresponden a ningún objeto del catálogo curado local
      const remoteCapture: Capture = {
        raDeg: 12.3456,
        decDeg: 78.9012,
        radiusDeg: 0.05,
      };

      const match = await identifyCelestialCapture(remoteCapture);

      // NO debe retornar state: 'none' (falso negativo de "campo sin objeto catalogado")
      expect(match.state).toBe('unavailable');
      expect(match.simbadUnavailable).toBe(true);
      expect(match.state).not.toBe('none');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Helper de salud de surveys HiPS (surveys.ts)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Helper de salud de surveys HiPS (surveys.ts)', () => {
    it('devuelve true cuando el servidor responde HTTP 200 OK', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const isHealthy = await checkSurveyHealth('https://skies.esac.esa.int/JWST/NIRCam_Imaging/', 1000);
      expect(isHealthy).toBe(true);
    });

    it('devuelve false cuando la petición es abortada por timeout', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const isHealthy = await checkSurveyHealth('https://alasky.cds.unistra.fr/DSS/DSSColor', 100);
      expect(isHealthy).toBe(false);
    });

    it('devuelve false ante un error HTTP no-2xx (ej. 503 Service Unavailable o 404)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const isHealthy = await checkSurveyHealth('https://alasky.cds.unistra.fr/DSS/DSSColor', 1000);
      expect(isHealthy).toBe(false);
    });

    it('utiliza la caché en memoria y no vuelve a consultar el servidor dentro de la ventana de 60s', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const url = 'https://cdaftp.cfa.harvard.edu/cxc-hips';
      const first = await checkSurveyHealth(url);
      const second = await checkSurveyHealth(url);

      expect(first).toBe(true);
      expect(second).toBe(true);
      // Solo 1 llamada a fetch gracias a la caché en memoria de 60s
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('isCdsHost distingue correctamente hosts del CDS de alternativas independientes', () => {
      expect(isCdsHost('https://alasky.cds.unistra.fr/DSS/DSSColor')).toBe(true);
      expect(isCdsHost('https://alaskybis.cds.unistra.fr/2MASS/Color')).toBe(true);
      expect(isCdsHost('https://simbad.cds.unistra.fr/simbad/sim-tap/sync')).toBe(true);
      expect(isCdsHost('http://cdsarc.u-strasbg.fr/viz-bin/qcat')).toBe(true);

      // Alternativas fuera del CDS
      expect(isCdsHost('https://skies.esac.esa.int/JWST/NIRCam_Imaging/')).toBe(false);
      expect(isCdsHost('https://cdaftp.cfa.harvard.edu/cxc-hips')).toBe(false);
      expect(isCdsHost('https://simbad.cfa.harvard.edu/simbad/sim-tap/sync')).toBe(false);
    });

    it('findFirstAvailableNonCdsSurvey prioriza JWST o Chandra cuando están disponibles', async () => {
      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const u = url.toString();
        // ESA y Harvard responden OK
        if (u.includes('esac.esa.int') || u.includes('cfa.harvard.edu')) {
          return Promise.resolve({ ok: true, status: 200 });
        }
        return Promise.resolve({ ok: false, status: 503 });
      });

      const survey = await findFirstAvailableNonCdsSurvey(SPECTRAL_SURVEYS);
      expect(survey).not.toBeNull();
      expect(['jwst', 'xray']).toContain(survey?.id);
      expect(isCdsHost(survey!.hipsUrl)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Route Handler Proxy SIMBAD (/api/simbad)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Route Handler Proxy SIMBAD (/api/simbad)', () => {
    it('valida parámetros y rechaza coordenadas inválidas con status 400', async () => {
      const request = new Request('http://localhost:3000/api/simbad?ra=invalid&dec=0');
      const response = await simbadRouteGet(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toBeDefined();
    });

    it('valida y limita el radio máximo a 2.5 grados para prevenir abuso', async () => {
      const request = new Request('http://localhost:3000/api/simbad?ra=180&dec=0&radius=10.0');
      const response = await simbadRouteGet(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toContain('2.5');
    });

    it('realiza failover al espejo de Harvard server-side si el CDS no responde', async () => {
      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = url.toString();
        if (urlStr.includes('simbad.cds.unistra.fr')) {
          return Promise.reject(new Error('Gateway Timeout'));
        }
        if (urlStr.includes('simbad.cfa.harvard.edu')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              data: [['Rigel', 'Supergiant', 78.63, -8.2, 0.1, 0.1, 0]],
            }),
          });
        }
        return Promise.reject(new Error('Unknown host'));
      });

      const request = new Request('http://localhost:3000/api/simbad?ra=78.63&dec=-8.2&radius=0.1');
      const response = await simbadRouteGet(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data).toBeDefined();
      expect(json.data.length).toBe(1);
      expect(json.data[0][0]).toBe('Rigel');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Route Handler de Estado del CDS (/api/cds-status)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Route Handler de Estado del CDS (/api/cds-status)', () => {
    it('devuelve { simbad: false, hips: false } cuando los servicios del CDS están caídos', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error('ETIMEDOUT'));
      });

      const response = await cdsStatusRouteGet();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.simbad).toBe(false);
      expect(json.hips).toBe(false);
      expect(json.checkedAt).toBeDefined();
    });

    it('devuelve { simbad: true, hips: true } cuando los servicios del CDS responden OK', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const response = await cdsStatusRouteGet();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.simbad).toBe(true);
      expect(json.hips).toBe(true);
      expect(json.checkedAt).toBeDefined();
    });

    it('el caché de /api/cds-status devuelve el mismo resultado dentro de los 60 s sin volver a golpear al CDS', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const res1 = await cdsStatusRouteGet();
      expect(res1.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Segunda llamada inmediata dentro de los 60s
      const res2 = await cdsStatusRouteGet();
      expect(res2.status).toBe(200);
      // No debe realizar nuevas peticiones HTTP
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const json1 = await res1.json();
      const json2 = await res2.json();
      expect(json2.checkedAt).toBe(json1.checkedAt);
      expect(res2.headers.get('X-Cache')).toBe('HIT');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Reanudación Automática y useCdsRecovery
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Reanudación Automática y useCdsRecovery', () => {
    it('transición degradado → OK dispara el callback de recuperación una sola vez', async () => {
      _resetRecoveryManagerForTests();
      _setDegradedStateForTests(true);

      // Mock de /api/cds-status respondiendo recuperado (ambos true)
      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        if (url.toString().includes('/api/cds-status')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ simbad: true, hips: true, checkedAt: new Date().toISOString() }),
          });
        }
        return Promise.reject(new Error('Unexpected fetch'));
      });

      const onRecoveredSpy = vi.fn();
      const unsubscribe = onCdsRecovered(onRecoveredSpy);

      // El registro inicial o primer sondeo dispara la transición
      await runPoll();
      expect(onRecoveredSpy).toHaveBeenCalledTimes(1);

      // Segundo sondeo: sigue OK, NO debe volver a disparar
      await runPoll();
      expect(onRecoveredSpy).toHaveBeenCalledTimes(1);

      unsubscribe();
      _resetRecoveryManagerForTests();
    });

    it('/analyze reintenta el crossmatch al recuperarse y limpia el aviso "SIMBAD no disponible"', async () => {
      // 1. Simular estado degradado inicial: SIMBAD falla en todos los endpoints
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error('SIMBAD Down'));
      });

      const capture: Capture = {
        raDeg: 12.3456,
        decDeg: 78.9012,
        radiusDeg: 0.05,
      };

      const degradedMatch = await identifyCelestialCapture(capture);
      expect(degradedMatch.state).toBe('unavailable');
      expect(degradedMatch.simbadUnavailable).toBe(true);

      // 2. Transición de recuperación: SIMBAD vuelve a responder con datos
      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const u = url.toString();
        if (u.includes('simbad')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              data: [['Polaris Recovered', 'Star', 12.3456, 78.9012, null, null, null]],
            }),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      // Se ejecuta el flujo de recuperación de /analyze: limpia caché
      clearCrossMatchCache();

      // 3. Al reintentar con las mismas coordenadas, obtiene resultados reales y limpia el aviso
      const recoveredMatch = await identifyCelestialCapture(capture);
      expect(recoveredMatch.state).not.toBe('unavailable');
      expect(recoveredMatch.simbadUnavailable).toBeFalsy();
      expect(recoveredMatch.candidates.length).toBeGreaterThan(0);
      expect(recoveredMatch.candidates[0].name).toBe('Polaris Recovered');
    });
  });
});

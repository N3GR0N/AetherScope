import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  querySimbadConeCapture,
  identifyCelestialCapture,
  clearCrossMatchCache,
} from '@/lib/astronomy/crossmatch';
import {
  checkSurveyHealth,
  clearSurveyHealthCache,
  isCdsHost,
  findFirstAvailableNonCdsSurvey,
  SPECTRAL_SURVEYS,
} from '@/lib/astronomy/surveys';
import { GET as simbadRouteGet, SIMBAD_TAP_ENDPOINTS } from '@/app/api/simbad/route';
import { GET as cdsStatusRouteGet, clearCdsStatusServerCache } from '@/app/api/cds-status/route';
import {
  runPoll,
  onCdsRecovered,
  _resetRecoveryManagerForTests,
  _setDegradedStateForTests,
  _getCurrentCdsStateForTests,
  _getConsecutiveFailuresForTests,
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
  // 1. Delegación segura de SIMBAD TAP a /api/simbad (crossmatch.ts)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Consulta a SIMBAD en crossmatch.ts (delegación a /api/simbad)', () => {
    const testCapture: Capture = {
      raDeg: 200.0,
      decDeg: -20.0,
      radiusDeg: 0.1,
    };

    it('crossmatch.ts no hace fetch a hosts externos y llama exclusivamente a /api/simbad', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = url.toString();
        // Verificar que NO contacta directamente a Estrasburgo ni a Harvard desde el cliente
        if (urlStr.includes('simbad.cds.unistra.fr') || urlStr.includes('simbad.cfa.harvard.edu')) {
          throw new Error(`Violación de seguridad: crossmatch.ts llamó directamente a host externo: ${urlStr}`);
        }
        if (urlStr.startsWith('/api/simbad')) {
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
        return Promise.reject(new Error(`URL no esperada: ${urlStr}`));
      });

      global.fetch = mockFetch;

      const result = await querySimbadConeCapture(testCapture, 500);

      expect(result.unavailable).toBeFalsy();
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].name).toBe('HD 116658');
      expect(result.candidates[0].designation).toBe('SIMBAD HD 116658');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0].toString();
      expect(calledUrl).toMatch(/^\/api\/simbad\?ra=200&dec=-20&radius=0\.1/);
      expect(calledUrl).not.toContain('unistra');
      expect(calledUrl).not.toContain('harvard');
    });

    it('fallo HTTP de /api/simbad (ej. status 503) deriva en unavailable: true sin lanzar', async () => {
      const mockFetch = vi.fn().mockImplementation((url: string | URL) => {
        if (url.toString().startsWith('/api/simbad')) {
          return Promise.resolve({
            ok: false,
            status: 503,
            json: async () => ({ error: 'Todos los endpoints de SIMBAD TAP no están disponibles' }),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      global.fetch = mockFetch;

      const result = await querySimbadConeCapture(testCapture, 500);

      expect(result.unavailable).toBe(true);
      expect(result.candidates).toEqual([]);
      expect(result.bestMatch).toBeNull();
    });

    it('rechazo de red (NetworkError) en /api/simbad deriva en unavailable: true sin lanzar', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new TypeError('NetworkError when attempting to fetch resource'));
      });

      const result = await querySimbadConeCapture(testCapture, 500);

      expect(result.unavailable).toBe(true);
      expect(result.candidates).toEqual([]);
      expect(result.bestMatch).toBeNull();
    });

    it('fallo en /api/simbad hace que identifyCelestialCapture devuelva state: unavailable', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error('AbortError: The operation was aborted due to timeout'));
      });

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
  // 2.1. Manejo robusto de NetworkError y fallo de infraestructura sin lanzar
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Manejo robusto de NetworkError y fallos de infraestructura', () => {
    it('checkSurveyHealth no lanza excepción ante NetworkError y retorna false', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new TypeError('NetworkError when attempting to fetch resource'));
      });

      const result = await checkSurveyHealth('https://alasky.cds.unistra.fr/DSS/DSSColor');
      expect(result).toBe(false);
    });

    it('querySimbadConeCapture no lanza excepción ante NetworkError y deriva en unavailable: true', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new TypeError('NetworkError when attempting to fetch resource'));
      });

      const result = await querySimbadConeCapture({ raDeg: 100, decDeg: -10, radiusDeg: 0.1 });
      expect(result.unavailable).toBe(true);
      expect(result.candidates).toEqual([]);
      expect(result.bestMatch).toBeNull();
    });

    it('runPoll no lanza ante NetworkError y asigna estado down', async () => {
      _resetRecoveryManagerForTests();
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new TypeError('NetworkError when attempting to fetch resource'));
      });

      onCdsRecovered(() => {}); // registro para que haya suscriptor
      await expect(runPoll()).resolves.not.toThrow();

      // Sondeo derivó en down sin lanzar excepción
      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        if (url.toString().includes('/api/cds-status')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ simbad: false, hips: false, checkedAt: new Date().toISOString() }),
          });
        }
        return Promise.reject(new Error('err'));
      });
      await runPoll();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Route Handler Proxy SIMBAD (/api/simbad)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Route Handler Proxy SIMBAD (/api/simbad)', () => {
    it('incluye el endpoint oficial de Estrasburgo y el espejo de Harvard en el proxy', () => {
      expect(SIMBAD_TAP_ENDPOINTS).toContain('https://simbad.cds.unistra.fr/simbad/sim-tap/sync');
      expect(SIMBAD_TAP_ENDPOINTS).toContain('https://simbad.cfa.harvard.edu/simbad/sim-tap/sync');
    });

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

    it('consulta endpoints TAP en paralelo (Promise.any) y devuelve el primero que responda bien', async () => {
      const calledUrls: string[] = [];
      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = url.toString();
        calledUrls.push(urlStr);
        if (urlStr.includes('simbad.cds.unistra.fr')) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ data: [['Slow CDS', 'Star', 10, 10, null, null, null]] }),
              });
            }, 80);
          });
        }
        if (urlStr.includes('simbad.cfa.harvard.edu')) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ data: [['Fast Harvard', 'Star', 10, 10, null, null, null]] }),
              });
            }, 10);
          });
        }
        return Promise.reject(new Error('Unknown host'));
      });

      const request = new Request('http://localhost:3000/api/simbad?ra=10&dec=10&radius=0.1');
      const response = await simbadRouteGet(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data[0][0]).toBe('Fast Harvard');
      expect(response.headers.get('X-SIMBAD-Endpoint')).toContain('harvard.edu');
      expect(calledUrls.some((u) => u.includes('unistra'))).toBe(true);
      expect(calledUrls.some((u) => u.includes('harvard'))).toBe(true);
    });

    it('devuelve status 503 con unavailable: true si todos los endpoints fallan', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure on all mirrors'));

      const request = new Request('http://localhost:3000/api/simbad?ra=10&dec=10&radius=0.1');
      const response = await simbadRouteGet(request);
      expect(response.status).toBe(503);

      const json = await response.json();
      expect(json.unavailable).toBe(true);
      expect(json.error).toBeDefined();
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

    it('pasa a down solo tras 2 comprobaciones fallidas consecutivas y a ok con 1 exitosa', async () => {
      _resetRecoveryManagerForTests();

      let mockHipsOk = false;
      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        if (url.toString().includes('/api/cds-status')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ simbad: true, hips: mockHipsOk, checkedAt: '2026-11-01T12:00:00Z' }),
          });
        }
        return Promise.reject(new Error('err'));
      });

      const unsubscribe = onCdsRecovered(() => {});

      // Inicialmente en 'checking'
      expect(_getCurrentCdsStateForTests()).toBe('checking');
      expect(_getConsecutiveFailuresForTests()).toBe(0);

      // Comprobación 1 fallida: aún NO debe pasar a 'down' (queda en 'checking', fallos = 1)
      await runPoll();
      expect(_getConsecutiveFailuresForTests()).toBe(1);
      expect(_getCurrentCdsStateForTests()).toBe('checking');

      // Comprobación 2 fallida consecutiva: ahora SÍ debe pasar a 'down'
      await runPoll();
      expect(_getConsecutiveFailuresForTests()).toBe(2);
      expect(_getCurrentCdsStateForTests()).toBe('down');

      // Comprobación 3 exitosa (1 sola): pasa inmediatamente a 'ok' y resetea fallos
      mockHipsOk = true;
      await runPoll();
      expect(_getConsecutiveFailuresForTests()).toBe(0);
      expect(_getCurrentCdsStateForTests()).toBe('ok');

      // Si estando 'ok' ocurre 1 fallo aislado, NO pasa a 'down' de inmediato
      mockHipsOk = false;
      await runPoll();
      expect(_getConsecutiveFailuresForTests()).toBe(1);
      expect(_getCurrentCdsStateForTests()).toBe('ok');

      // Segundo fallo consecutivo: ahora sí pasa a 'down'
      await runPoll();
      expect(_getConsecutiveFailuresForTests()).toBe(2);
      expect(_getCurrentCdsStateForTests()).toBe('down');

      unsubscribe();
    });
  });
});

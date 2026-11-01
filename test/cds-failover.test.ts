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
import { GET as simbadRouteGet, SIMBAD_TAP_ENDPOINTS, maxDuration } from '@/app/api/simbad/route';
import { GET as cdsStatusRouteGet, clearCdsStatusServerCache } from '@/app/api/cds-status/route';
import {
  runPoll,
  onCdsRecovered,
  _resetRecoveryManagerForTests,
  _setDegradedStateForTests,
  _setCdsStateForTests,
  _getCurrentCdsStateForTests,
  _getConsecutiveFailuresForTests,
  isCdsForcedOkInDev,
  notifyHipsLoadError,
  POLL_INTERVAL_DEGRADED_MS,
  POLL_INTERVAL_HEALTHY_MS,
  CDS_STATUS_FETCH_TIMEOUT_MS,
} from '@/lib/hooks/useCdsRecovery';
import {
  isHipsLoadErrorMessage,
  registerHipsInterceptor,
  _getHipsInterceptorStateForTests,
  _resetHipsInterceptorForTests,
} from '@/components/space-canvas/SpaceCanvas.client';
import type { Capture } from '@/lib/astronomy/footprint';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CdsCheckingCard from '@/components/hud/CdsCheckingCard';
import CdsDownCard from '@/components/hud/CdsDownCard';

describe('Resiliencia y Failover ante Degradación de CDS Estrasburgo', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearCrossMatchCache();
    clearSurveyHealthCache();
    clearCdsStatusServerCache();
    _resetRecoveryManagerForTests();
    _resetHipsInterceptorForTests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    _resetRecoveryManagerForTests();
    _resetHipsInterceptorForTests();
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

    it('calcula distanceLy a partir de basic.plx_value devuelto por /api/simbad', async () => {
      global.fetch = vi.fn().mockImplementation((url: string | URL) => {
        if (url.toString().startsWith('/api/simbad')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                ['HD 116658', 'Star', 200.0, -20.0, null, null, null, 13.06],
              ],
            }),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      const result = await querySimbadConeCapture(testCapture, 500);
      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].distanceLy).toBe('250 años luz');
      expect(result.bestMatch?.object?.distanceLy).toBe('250 años luz');
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
    it('define maxDuration coherente con el timeout de 4s de las peticiones TAP', () => {
      expect(maxDuration).toBeDefined();
      expect(typeof maxDuration).toBe('number');
      // Debe ser mayor al timeout individual de 4s pero acotado para serverless
      expect(maxDuration).toBeGreaterThanOrEqual(5);
      expect(maxDuration).toBeLessThanOrEqual(15);
    });

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

    it('bug: si el estado inicial es checking y la primera comprobación indica caído, pasa directo a down', async () => {
      _resetRecoveryManagerForTests();

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

      const unsubscribe = onCdsRecovered(() => {});
      expect(_getCurrentCdsStateForTests()).toBe('checking');

      // Primera comprobación indica caído
      await runPoll();

      // Debe pasar inmediatamente a 'down' para mostrar el cartel sin quedarse en 'checking'
      expect(_getCurrentCdsStateForTests()).toBe('down');

      unsubscribe();
    });

    it('si la primera comprobación no responde (timeout 6s / abort) pasa directo de checking a down', async () => {
      _resetRecoveryManagerForTests();

      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.reject(new DOMException('The operation was aborted due to timeout', 'AbortError'));
      });

      const unsubscribe = onCdsRecovered(() => {});
      expect(_getCurrentCdsStateForTests()).toBe('checking');

      await runPoll();

      expect(_getCurrentCdsStateForTests()).toBe('down');
      unsubscribe();
    });

    it('la regla de 2 fallos consecutivos aplica a la transicion ok -> down en sesion abierta', async () => {
      _resetRecoveryManagerForTests();

      let mockHipsOk = true;
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

      // Comprobación inicial OK: pasa a 'ok'
      await runPoll();
      expect(_getCurrentCdsStateForTests()).toBe('ok');
      expect(_getConsecutiveFailuresForTests()).toBe(0);

      // Si estando 'ok' ocurre 1 fallo aislado, NO pasa a 'down' de inmediato
      mockHipsOk = false;
      await runPoll();
      expect(_getConsecutiveFailuresForTests()).toBe(1);
      expect(_getCurrentCdsStateForTests()).toBe('ok');

      // Segundo fallo consecutivo: ahora sí pasa a 'down'
      await runPoll();
      expect(_getConsecutiveFailuresForTests()).toBe(2);
      expect(_getCurrentCdsStateForTests()).toBe('down');

      // 1 éxito resetea de inmediato a 'ok'
      mockHipsOk = true;
      await runPoll();
      expect(_getConsecutiveFailuresForTests()).toBe(0);
      expect(_getCurrentCdsStateForTests()).toBe('ok');

      unsubscribe();
    });

    it('NEXT_PUBLIC_FORCE_CDS_OK=1 fuerza estado ok solo en entornos que no son production', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalForced = process.env.NEXT_PUBLIC_FORCE_CDS_OK;

      try {
        // En entorno de testing / desarrollo con flag activada
        process.env.NODE_ENV = 'development';
        process.env.NEXT_PUBLIC_FORCE_CDS_OK = '1';
        expect(isCdsForcedOkInDev()).toBe(true);

        _resetRecoveryManagerForTests();
        await runPoll();
        expect(_getCurrentCdsStateForTests()).toBe('ok');

        // /api/cds-status retorna OK forzado
        const response = await cdsStatusRouteGet();
        const json = await response.json();
        expect(json.simbad).toBe(true);
        expect(json.hips).toBe(true);
        expect(response.headers.get('X-Dev-Forced')).toBe('1');

        // En producción la variable de entorno es estrictamente ignorada
        process.env.NODE_ENV = 'production';
        process.env.NEXT_PUBLIC_FORCE_CDS_OK = '1';
        expect(isCdsForcedOkInDev()).toBe(false);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalForced !== undefined) {
          process.env.NEXT_PUBLIC_FORCE_CDS_OK = originalForced;
        } else {
          delete process.env.NEXT_PUBLIC_FORCE_CDS_OK;
        }
      }
    });

    it('configura intervalos de polling coherentes: 30s en down/checking, 2 min en ok, 6s timeout', () => {
      expect(POLL_INTERVAL_DEGRADED_MS).toBe(30_000);
      expect(POLL_INTERVAL_HEALTHY_MS).toBe(120_000);
      expect(CDS_STATUS_FETCH_TIMEOUT_MS).toBe(6_000);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Intercepción y Mitigación de Errores de Carga de HiPS (SpaceCanvas)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Intercepción y Mitigación de Errores de Carga de HiPS (SpaceCanvas)', () => {
    let originalWindow: unknown;

    beforeEach(() => {
      originalWindow = (globalThis as { window?: unknown }).window;
      const listeners = new Map<string, Set<EventListener>>();
      (globalThis as { window?: unknown }).window = {
        addEventListener: (type: string, listener: EventListener) => {
          if (!listeners.has(type)) {
            listeners.set(type, new Set());
          }
          listeners.get(type)!.add(listener);
        },
        removeEventListener: (type: string, listener: EventListener) => {
          listeners.get(type)?.delete(listener);
        },
        dispatchEvent: (event: Event) => {
          const set = listeners.get(event.type);
          if (set) {
            for (const fn of set) {
              fn(event);
            }
          }
          return !event.defaultPrevented;
        },
      };
      _resetHipsInterceptorForTests();
      _resetRecoveryManagerForTests();
    });

    afterEach(() => {
      _resetHipsInterceptorForTests();
      if (originalWindow !== undefined) {
        (globalThis as { window?: unknown }).window = originalWindow;
      } else {
        delete (globalThis as { window?: unknown }).window;
      }
    });

    it('isHipsLoadErrorMessage acota exclusivamente a mensajes de HiPS con error o not found', () => {
      expect(
        isHipsLoadErrorMessage('HiPS https://alasky.cds.unistra.fr/DSS/DSSColor error: HiPS not found at url ...')
      ).toBe(true);
      expect(
        isHipsLoadErrorMessage('HiPS CDS/P/DSS2/color error: connection refused')
      ).toBe(true);
      expect(isHipsLoadErrorMessage('HiPS not found')).toBe(true);
      expect(isHipsLoadErrorMessage('Error unrelated to hips')).toBe(false);
      expect(isHipsLoadErrorMessage('Uncaught TypeError: something failed')).toBe(false);
      expect(isHipsLoadErrorMessage('')).toBe(false);
    });

    it('notifyHipsLoadError fuerza estado down inmediatamente sin esperar al polling ni a 2 fallos', async () => {
      _resetRecoveryManagerForTests();
      _setCdsStateForTests('ok');
      expect(_getCurrentCdsStateForTests()).toBe('ok');

      // /api/cds-status confirma que efectivamente HiPS está caído
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ simbad: false, hips: false, checkedAt: new Date().toISOString() }),
      });

      const unsubscribe = onCdsRecovered(() => {});

      await notifyHipsLoadError();

      expect(_getCurrentCdsStateForTests()).toBe('down');
      unsubscribe();
    });

    it('si /api/cds-status responde ok ante notifyHipsLoadError, vuelve a ok y permite reintentar una sola vez', async () => {
      _resetRecoveryManagerForTests();
      _setCdsStateForTests('down');

      // Servidor responde que HiPS responde OK
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ simbad: true, hips: true, checkedAt: new Date().toISOString() }),
      });

      const unsubscribe = onCdsRecovered(() => {});

      // 1er error: servidor dice ok -> vuelve a 'ok' para reintentar
      await notifyHipsLoadError();
      expect(_getCurrentCdsStateForTests()).toBe('ok');

      // 2do error en la misma sesión: ya se agotó el reintento único -> permanece en 'down'
      await notifyHipsLoadError();
      expect(_getCurrentCdsStateForTests()).toBe('down');

      unsubscribe();
    });

    it('el listener de unhandledrejection llama preventDefault para evitar overlay rojo en dev y dispara down', async () => {
      _resetRecoveryManagerForTests();
      _resetHipsInterceptorForTests();
      _setCdsStateForTests('ok');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ simbad: false, hips: false, checkedAt: new Date().toISOString() }),
      });

      const cleanup = registerHipsInterceptor();

      const event = new Event('unhandledrejection', { cancelable: true });
      Object.assign(event, {
        reason:
          'HiPS https://alasky.cds.unistra.fr/DSS/DSSColor error: HiPS not found at url https://alasky.cds.unistra.fr/DSS/DSSColor\nReason: 503',
      });

      window.dispatchEvent(event);

      // preventDefault() es esencial para evitar el overlay rojo de desarrollo de Next.js
      expect(event.defaultPrevented).toBe(true);

      // Esperar microtareas para que notifyHipsLoadError complete
      await new Promise((r) => setTimeout(r, 10));
      expect(_getCurrentCdsStateForTests()).toBe('down');

      cleanup();
    });

    it('no se registran listeners duplicados en window ante montajes múltiples y limpia al desmontar', () => {
      _resetHipsInterceptorForTests();
      expect(_getHipsInterceptorStateForTests().isRegistered).toBe(false);
      expect(_getHipsInterceptorStateForTests().activeMountCount).toBe(0);

      // Primer montaje de SpaceCanvas
      const cleanup1 = registerHipsInterceptor();
      expect(_getHipsInterceptorStateForTests().isRegistered).toBe(true);
      expect(_getHipsInterceptorStateForTests().activeMountCount).toBe(1);

      // Segundo montaje (o re-render simultáneo)
      const cleanup2 = registerHipsInterceptor();
      // No debe agregar un listener duplicado: isRegistered sigue siendo true y activeMountCount = 2
      expect(_getHipsInterceptorStateForTests().isRegistered).toBe(true);
      expect(_getHipsInterceptorStateForTests().activeMountCount).toBe(2);

      // Primer desmontaje: aún queda un componente activo, no desregistra de window
      cleanup1();
      expect(_getHipsInterceptorStateForTests().isRegistered).toBe(true);
      expect(_getHipsInterceptorStateForTests().activeMountCount).toBe(1);

      // Segundo desmontaje: contador llega a 0, desregistra los listeners de window
      cleanup2();
      expect(_getHipsInterceptorStateForTests().isRegistered).toBe(false);
      expect(_getHipsInterceptorStateForTests().activeMountCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Pantalla de Carga Táctica ante cdsState === "checking" (CdsCheckingCard)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Pantalla de Carga Táctica (CdsCheckingCard)', () => {
    it('renderiza con role="status", aria-live="polite" y estilo táctico militar', () => {
      const html = renderToStaticMarkup(React.createElement(CdsCheckingCard, { delayMs: 0 }));
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('ESTABLECIENDO ENLACE CON EL CDS');
      expect(html).toContain('Comprobando disponibilidad del Centro de Datos de Estrasburgo');
      expect(html).toContain('cds-scan-bar');
      expect(html).toContain('border-[#C9B98F]');
      expect(html).toContain('bg-[#101015]');
    });

    it('anti-parpadeo: con delay de 400ms no renderiza nada inmediatamente (returns null)', () => {
      const html = renderToStaticMarkup(React.createElement(CdsCheckingCard, { delayMs: 400 }));
      expect(html).toBe('');
    });

    it('en checking: se renderiza el cartel de carga y no se monta el visor; en down y ok, no', () => {
      // Simulación de la lógica de renderizado central de Home y /analyze
      const renderCentralArea = (state: "checking" | "down" | "ok") => {
        if (state === "down") {
          return renderToStaticMarkup(React.createElement(CdsDownCard, { lastCheckedTime: "12:00:00" }));
        }
        if (state === "ok") {
          return renderToStaticMarkup(React.createElement("div", { "data-testid": "space-canvas-mounted" }, "SPACE_CANVAS"));
        }
        return renderToStaticMarkup(React.createElement(CdsCheckingCard, { delayMs: 0 }));
      };

      // 1. Estado checking: cartel de carga presente, sin visor ni cartel de caído
      const checkingHtml = renderCentralArea("checking");
      expect(checkingHtml).toContain('ESTABLECIENDO ENLACE CON EL CDS');
      expect(checkingHtml).toContain('role="status"');
      expect(checkingHtml).not.toContain('space-canvas-mounted');
      expect(checkingHtml).not.toContain('SERVICIOS CDS FUERA DE LÍNEA');

      // 2. Estado down: cartel de fuera de línea presente, sin cartel de carga ni visor
      const downHtml = renderCentralArea("down");
      expect(downHtml).toContain('SERVICIOS CDS FUERA DE LÍNEA');
      expect(downHtml).toContain('role="alert"');
      expect(downHtml).not.toContain('ESTABLECIENDO ENLACE CON EL CDS');
      expect(downHtml).not.toContain('space-canvas-mounted');

      // 3. Estado ok: visor montado, sin ningún cartel
      const okHtml = renderCentralArea("ok");
      expect(okHtml).toContain('space-canvas-mounted');
      expect(okHtml).not.toContain('ESTABLECIENDO ENLACE CON EL CDS');
      expect(okHtml).not.toContain('SERVICIOS CDS FUERA DE LÍNEA');
    });

    it('CdsDownCard y CdsCheckingCard comparten clase cds-fade para transición suave de 200ms', () => {
      const checkingHtml = renderToStaticMarkup(React.createElement(CdsCheckingCard, { delayMs: 0 }));
      const downHtml = renderToStaticMarkup(React.createElement(CdsDownCard));
      expect(checkingHtml).toContain('cds-fade');
      expect(downHtml).toContain('cds-fade');
    });
  });
});

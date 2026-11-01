import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface CdsStatusData {
  simbad: boolean;
  hips: boolean;
  checkedAt: string;
}

interface ServerCacheEntry extends CdsStatusData {
  timestamp: number;
}

export const CDS_STATUS_SERVER_CACHE_TTL_MS = 60_000;
let cachedServerStatus: ServerCacheEntry | null = null;

export function clearCdsStatusServerCache(): void {
  cachedServerStatus = null;
}

export function getCdsStatusServerCache(): ServerCacheEntry | null {
  return cachedServerStatus;
}

async function pingEndpoint(url: string, timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "*/*",
        "User-Agent": "AetherScope-HealthCheck/1.0",
      },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const now = Date.now();

  if (cachedServerStatus && now - cachedServerStatus.timestamp < CDS_STATUS_SERVER_CACHE_TTL_MS) {
    return NextResponse.json(
      {
        simbad: cachedServerStatus.simbad,
        hips: cachedServerStatus.hips,
        checkedAt: cachedServerStatus.checkedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Cache": "HIT",
        },
      }
    );
  }

  const [simbadOk, hipsOk] = await Promise.all([
    pingEndpoint("https://simbad.cds.unistra.fr/simbad/sim-tap/sync"),
    pingEndpoint("https://alasky.cds.unistra.fr/DSS/DSSColor/properties"),
  ]);

  const checkedAt = new Date().toISOString();
  cachedServerStatus = {
    simbad: simbadOk,
    hips: hipsOk,
    checkedAt,
    timestamp: now,
  };

  return NextResponse.json(
    {
      simbad: simbadOk,
      hips: hipsOk,
      checkedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Cache": "MISS",
      },
    }
  );
}

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
  const [simbadOk, hipsOk] = await Promise.all([
    pingEndpoint("https://simbad.cds.unistra.fr/simbad/sim-tap/sync"),
    pingEndpoint("https://alasky.cds.unistra.fr/DSS/DSSColor/properties"),
  ]);

  return NextResponse.json(
    {
      simbad: simbadOk,
      hips: hipsOk,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

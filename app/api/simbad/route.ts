import { NextResponse } from "next/server";
import { sanitizeCoordinateParams } from "@/lib/astronomy/coordinates";

export const dynamic = "force-dynamic";

export const SIMBAD_TAP_ENDPOINTS = [
  "https://simbad.cds.unistra.fr/simbad/sim-tap/sync",
  "https://simbad.cfa.harvard.edu/simbad/sim-tap/sync",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawRa = searchParams.get("ra");
    const rawDec = searchParams.get("dec");
    const rawRadius = searchParams.get("radius") ?? "0.2";

    if (!rawRa || !rawDec) {
      return NextResponse.json(
        { error: "Parámetros 'ra' y 'dec' son obligatorios" },
        { status: 400 }
      );
    }

    const parsedRawRa = parseFloat(rawRa);
    const parsedRawDec = parseFloat(rawDec);
    const parsedRadius = parseFloat(rawRadius);

    if (
      isNaN(parsedRawRa) ||
      !isFinite(parsedRawRa) ||
      isNaN(parsedRawDec) ||
      !isFinite(parsedRawDec) ||
      isNaN(parsedRadius) ||
      !isFinite(parsedRadius) ||
      parsedRadius <= 0 ||
      parsedRadius > 2.5
    ) {
      return NextResponse.json(
        { error: "Parámetros astronómicos inválidos o radio fuera de rango (máx 2.5°)" },
        { status: 400 }
      );
    }

    const { ra, dec } = sanitizeCoordinateParams(rawRa, rawDec, rawRadius);

    const cleanRa = Number(ra.toFixed(6));
    const cleanDec = Number(dec.toFixed(6));
    const cleanRadius = Number(Math.min(Math.max(parsedRadius, 0.01), 2.5).toFixed(4));

    const adql = `
      SELECT TOP 30
        basic.main_id,
        otypedef.otype_longname,
        basic.ra,
        basic.dec,
        basic.galdim_majaxis,
        basic.galdim_minaxis,
        basic.galdim_angle,
        DISTANCE(POINT('ICRS', basic.ra, basic.dec), POINT('ICRS', ${cleanRa}, ${cleanDec})) AS dist
      FROM basic
      LEFT JOIN otypedef ON basic.otype = otypedef.otype
      WHERE CONTAINS(POINT('ICRS', basic.ra, basic.dec), CIRCLE('ICRS', ${cleanRa}, ${cleanDec}, ${cleanRadius})) = 1
      ORDER BY dist ASC
    `.trim().replace(/\s+/g, " ");

    for (const endpoint of SIMBAD_TAP_ENDPOINTS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      try {
        const fullUrl = `${endpoint}?request=doQuery&lang=adql&format=json&query=${encodeURIComponent(adql)}`;
        const res = await fetch(fullUrl, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        }).catch(() => null);
        clearTimeout(timer);

        if (res && res.ok) {
          const data: unknown = await res.json().catch(() => null);
          if (data) {
            return NextResponse.json(data, {
              status: 200,
              headers: {
                "X-SIMBAD-Endpoint": endpoint,
                "Cache-Control": "public, max-age=60",
              },
            });
          }
        }
      } catch {
        clearTimeout(timer);
        // Continue to next mirror endpoint
      }
    }

    return NextResponse.json(
      {
        error: "Todos los endpoints de SIMBAD TAP no están disponibles",
        unavailable: true,
      },
      { status: 503 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Error interno al procesar consulta a SIMBAD", details: String(err) },
      { status: 500 }
    );
  }
}

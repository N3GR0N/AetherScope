import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const { error } = await supabase
      .from("coordinates")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

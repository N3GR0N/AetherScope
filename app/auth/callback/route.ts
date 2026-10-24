import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase/client';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/reset-password';

  if (code) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.exchangeCodeForSession(code);
      } catch (err) {
        console.error('[AetherScope] Error intercambiando código de autenticación en callback:', err);
      }
    }
  }

  // Redirigir al destino de recuperación o perfil
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

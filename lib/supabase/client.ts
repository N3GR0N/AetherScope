/**
 * AetherScope - Supabase Client Singleton
 * Configuración segura del cliente público de Supabase para Auth y Base de Datos.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return { url, key };
}

let clientInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const { url, key } = getCredentials();
  return Boolean(url && key);
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getCredentials();
  if (!url || !key) {
    return null;
  }

  if (!clientInstance) {
    const isBrowser = typeof window !== 'undefined';
    clientInstance = createClient(url, key, {
      auth: {
        persistSession: isBrowser,
        autoRefreshToken: isBrowser,
        detectSessionInUrl: isBrowser,
      },
    });
  }

  return clientInstance;
}

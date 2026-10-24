/**
 * AetherScope - Authentication Service Implementations
 */

import type { AuthService, AuthUser, AuthCredentials } from './types';
import { SupabaseAuthService } from './supabaseAuthService';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export class NoAuthService implements AuthService {
  async getUser(): Promise<AuthUser | null> {
    return null;
  }

  async signIn(_credentials?: AuthCredentials): Promise<AuthUser | null> {
    void _credentials;
    console.warn('[AetherScope] NoAuthService: Autenticación no disponible en modo local.');
    return null;
  }

  async signUp(_credentials: AuthCredentials): Promise<AuthUser | null> {
    void _credentials;
    console.warn('[AetherScope] NoAuthService: Registro no disponible en modo local.');
    return null;
  }

  async signOut(): Promise<void> {
    console.warn('[AetherScope] NoAuthService: Sesión no disponible en modo local.');
  }

  onAuthStateChange(_callback: (user: AuthUser | null) => void): () => void {
    void _callback;
    return () => {};
  }
}

let activeAuthService: AuthService | null = null;

export function getAuthService(): AuthService {
  const backend = process.env.NEXT_PUBLIC_NOTES_BACKEND;

  if (backend === 'supabase' || (backend !== 'local' && isSupabaseConfigured())) {
    if (!activeAuthService || !(activeAuthService instanceof SupabaseAuthService)) {
      activeAuthService = new SupabaseAuthService();
    }
    return activeAuthService;
  }

  if (!activeAuthService || !(activeAuthService instanceof NoAuthService)) {
    activeAuthService = new NoAuthService();
  }
  return activeAuthService;
}

export const defaultAuthService: AuthService = getAuthService();

export * from './types';
export * from './supabaseAuthService';

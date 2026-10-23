/**
 * AetherScope - Authentication Service Implementations
 */

import type { AuthService, AuthUser } from './types';

export class NoAuthService implements AuthService {
  async getUser(): Promise<AuthUser | null> {
    return null;
  }

  async signIn(): Promise<void> {
    console.warn('[AetherScope] NoAuthService: Autenticación no disponible en modo local.');
  }

  async signOut(): Promise<void> {
    console.warn('[AetherScope] NoAuthService: Sesión no disponible en modo local.');
  }
}

export const defaultAuthService: AuthService = new NoAuthService();

export * from './types';

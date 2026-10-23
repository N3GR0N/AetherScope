/**
 * AetherScope - Authentication Service Types
 * Contrato de abstracción para autenticación de usuarios.
 */

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthService {
  getUser(): Promise<AuthUser | null>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

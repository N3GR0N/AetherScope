/**
 * AetherScope - Authentication Service Types
 * Contrato de abstracción para autenticación de usuarios.
 */

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthService {
  getUser(): Promise<AuthUser | null>;
  signIn(credentials?: AuthCredentials): Promise<AuthUser | null>;
  signUp?(credentials: AuthCredentials): Promise<AuthUser | null>;
  signOut(): Promise<void>;
  onAuthStateChange?(callback: (user: AuthUser | null) => void): () => void;
}

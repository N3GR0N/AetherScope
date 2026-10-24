/**
 * AetherScope - Supabase Authentication Service
 * Autenticación real conectada a Supabase Auth (PostgreSQL).
 * Incluye validación de complejidad de contraseña y protección.
 */

import { getSupabaseClient } from '@/lib/supabase/client';
import type { AuthService, AuthUser, AuthCredentials } from './types';

export function validatePasswordSecurity(password: string): { valid: boolean; reason?: string } {
  if (typeof password !== 'string' || password.length < 6) {
    return {
      valid: false,
      reason: 'La contraseña debe tener al menos 6 caracteres.',
    };
  }
  if (password.length > 128) {
    return {
      valid: false,
      reason: 'La contraseña no puede exceder los 128 caracteres (mitigación DoS/CPU).',
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      reason: 'La contraseña debe contener al menos una letra mayúscula (A-Z).',
    };
  }
  return { valid: true };
}

export function validateEmailSecurity(email: string): { valid: boolean; reason?: string } {
  if (typeof email !== 'string' || !email.trim()) {
    return {
      valid: false,
      reason: 'El correo electrónico es requerido.',
    };
  }
  const trimmed = email.trim();
  if (trimmed.length > 254) {
    return {
      valid: false,
      reason: 'El correo electrónico excede la longitud máxima permitida (254 caracteres).',
    };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return {
      valid: false,
      reason: 'Formato de correo electrónico no válido.',
    };
  }
  return { valid: true };
}

export class SupabaseAuthService implements AuthService {
  async getUser(): Promise<AuthUser | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email || '',
      };
    } catch (err) {
      console.warn('[AetherScope] Error obteniendo usuario autenticado:', err);
      return null;
    }
  }

  async signIn(credentials?: AuthCredentials): Promise<AuthUser | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase no está configurado en las variables de entorno.');
    }

    if (!credentials?.email || !credentials?.password) {
      throw new Error('Debes proporcionar correo electrónico y contraseña.');
    }

    const emailValidation = validateEmailSecurity(credentials.email);
    if (!emailValidation.valid) {
      throw new Error(emailValidation.reason);
    }

    if (credentials.password.length > 128) {
      throw new Error('La contraseña excede el límite de longitud permitido.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email.trim(),
      password: credentials.password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Credenciales incorrectas. Verifica tu correo y contraseña.');
      }
      throw new Error(error.message);
    }

    if (!data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email || '',
    };
  }

  async signUp(credentials: AuthCredentials): Promise<AuthUser | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase no está configurado en las variables de entorno.');
    }

    if (!credentials?.email || !credentials?.password) {
      throw new Error('Debes proporcionar correo electrónico y contraseña.');
    }

    const emailValidation = validateEmailSecurity(credentials.email);
    if (!emailValidation.valid) {
      throw new Error(emailValidation.reason);
    }

    const validation = validatePasswordSecurity(credentials.password);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const { data, error } = await supabase.auth.signUp({
      email: credentials.email.trim(),
      password: credentials.password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        throw new Error('Este correo electrónico ya se encuentra registrado.');
      }
      throw new Error(error.message);
    }

    if (!data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email || '',
    };
  }

  async signOut(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return () => {};
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        callback({
          id: session.user.id,
          email: session.user.email || '',
        });
      } else {
        callback(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }
}

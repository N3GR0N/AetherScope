/**
 * AetherScope - Notes Repository Factory
 * Selección del backend activo según NEXT_PUBLIC_NOTES_BACKEND ('local' | 'supabase').
 */

import type { NotesRepository } from './repository';
import { LocalNotesRepository } from './localRepository';

/**
 * Stub tipado para futuro backend Supabase remoto.
 * No importa paquetes externos ni requiere dependencias instaladas.
 */
class SupabaseNotesRepository implements NotesRepository {
  async list(): Promise<never> {
    throw new Error('SupabaseNotesRepository: Backend Supabase aún no implementado.');
  }
  async listForCapture(): Promise<never> {
    throw new Error('SupabaseNotesRepository: Backend Supabase aún no implementado.');
  }
  async create(): Promise<never> {
    throw new Error('SupabaseNotesRepository: Backend Supabase aún no implementado.');
  }
  async update(): Promise<never> {
    throw new Error('SupabaseNotesRepository: Backend Supabase aún no implementado.');
  }
  async remove(): Promise<never> {
    throw new Error('SupabaseNotesRepository: Backend Supabase aún no implementado.');
  }
  async exportAll(): Promise<never> {
    throw new Error('SupabaseNotesRepository: Backend Supabase aún no implementado.');
  }
  async importAll(): Promise<never> {
    throw new Error('SupabaseNotesRepository: Backend Supabase aún no implementado.');
  }
}

// Instancia singleton para el cliente
let localRepoInstance: LocalNotesRepository | null = null;
let supabaseRepoInstance: SupabaseNotesRepository | null = null;

export function getNotesRepository(): NotesRepository {
  const backend = process.env.NEXT_PUBLIC_NOTES_BACKEND || 'local';

  if (backend === 'supabase') {
    if (!supabaseRepoInstance) {
      supabaseRepoInstance = new SupabaseNotesRepository();
    }
    return supabaseRepoInstance;
  }

  if (!localRepoInstance) {
    localRepoInstance = new LocalNotesRepository();
  }
  return localRepoInstance;
}

export * from './types';
export * from './repository';
export * from './localRepository';

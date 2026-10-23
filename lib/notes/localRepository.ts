/**
 * AetherScope - Local Notes Repository (localStorage v1)
 * Almacenamiento local aislado y seguro con protección SSR, modo incógnito y sincronización entre pestañas.
 */

import { calculateAngularSeparation } from '@/lib/astronomy/coordinates';
import type { Capture } from '@/lib/astronomy/footprint';
import type { CaptureMatch } from '@/lib/astronomy/crossmatch';
import type { MissionNote } from './types';
import type { NotesRepository, CreateNoteInput, UpdateNotePatch, ImportResult } from './repository';

const STORAGE_KEY = 'aetherscope:notes:v1';
const CURRENT_VERSION = 1;

interface StorageEnvelope {
  version: number;
  notes: MissionNote[];
}

export class LocalNotesRepository implements NotesRepository {
  private persistedRequested = false;

  private isClient(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private readEnvelope(): StorageEnvelope {
    if (!this.isClient()) {
      return { version: CURRENT_VERSION, notes: [] };
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { version: CURRENT_VERSION, notes: [] };
      }

      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === CURRENT_VERSION && Array.isArray(parsed.notes)) {
        return parsed as StorageEnvelope;
      }

      // Migración defensiva si fuera un array simple de versiones anteriores
      if (Array.isArray(parsed)) {
        return { version: CURRENT_VERSION, notes: parsed as MissionNote[] };
      }

      return { version: CURRENT_VERSION, notes: [] };
    } catch (err) {
      console.warn('[AetherScope] Error leyendo localStorage de bitácora:', err);
      return { version: CURRENT_VERSION, notes: [] };
    }
  }

  private writeEnvelope(envelope: StorageEnvelope): void {
    if (!this.isClient()) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch (err: unknown) {
      if (
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      ) {
        throw new Error('CUOTA_EXCEDIDA: La memoria local del navegador está llena. Por favor exportá o eliminá notas.');
      }
      throw new Error('ERROR_STORAGE: No se pudo guardar la nota en el almacenamiento local del navegador.');
    }
  }

  private async requestPersistenceBestEffort(): Promise<void> {
    if (this.persistedRequested || !this.isClient()) return;
    this.persistedRequested = true;

    try {
      if (navigator.storage && typeof navigator.storage.persist === 'function') {
        const isPersisted = await navigator.storage.persisted();
        if (!isPersisted) {
          await navigator.storage.persist();
        }
      }
    } catch {
      // Best-effort silencioso si el navegador no permite solicitar persistencia
    }
  }

  public async list(): Promise<MissionNote[]> {
    const env = this.readEnvelope();
    // Ordenar descendente por fecha de actualización / creación
    return [...env.notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async listForCapture(capture: Capture, match: CaptureMatch): Promise<MissionNote[]> {
    const allNotes = await this.list();

    // Caso A: Hay un objeto identificado (en 'inside' o 'edge')
    if (match.object && (match.state === 'inside' || match.state === 'edge') && match.object.id) {
      const targetId = match.object.id;
      return allNotes.filter((note) => note.objectId === targetId);
    }

    // Caso B: Campo sin objeto catalogado ('none' o sin id) -> Solapamiento espacial de huellas
    return allNotes.filter((note) => {
      // Si la nota tenía un objeto asociado específico, no pertenece a este campo sin objeto
      if (note.objectId) return false;

      const separationDeg = calculateAngularSeparation(
        capture.raDeg,
        capture.decDeg,
        note.raDeg,
        note.decDeg
      );

      return separationDeg <= note.radiusDeg + capture.radiusDeg;
    });
  }

  public async create(input: CreateNoteInput): Promise<MissionNote> {
    const trimmedBody = input.body.trim();
    if (!trimmedBody) {
      throw new Error('VALIDACION: La nota no puede estar vacía.');
    }

    await this.requestPersistenceBestEffort();

    const now = new Date().toISOString();
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `note-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newNote: MissionNote = {
      id,
      objectId: input.objectId ?? null,
      objectName: input.objectName ?? null,
      raDeg: input.raDeg,
      decDeg: input.decDeg,
      radiusDeg: input.radiusDeg,
      body: trimmedBody,
      createdAt: now,
      updatedAt: now,
    };

    const env = this.readEnvelope();
    env.notes.push(newNote);
    this.writeEnvelope(env);

    return newNote;
  }

  public async update(id: string, patch: UpdateNotePatch): Promise<MissionNote> {
    const env = this.readEnvelope();
    const index = env.notes.findIndex((n) => n.id === id);

    if (index === -1) {
      throw new Error(`NOT_FOUND: Nota con id ${id} no encontrada.`);
    }

    const current = env.notes[index];
    const updated: MissionNote = {
      ...current,
      body: patch.body !== undefined ? patch.body.trim() : current.body,
      objectName: patch.objectName !== undefined ? patch.objectName : current.objectName,
      objectId: patch.objectId !== undefined ? patch.objectId : current.objectId,
      updatedAt: new Date().toISOString(),
    };

    env.notes[index] = updated;
    this.writeEnvelope(env);

    return updated;
  }

  public async remove(id: string): Promise<boolean> {
    const env = this.readEnvelope();
    const initialLen = env.notes.length;
    env.notes = env.notes.filter((n) => n.id !== id);

    if (env.notes.length !== initialLen) {
      this.writeEnvelope(env);
      return true;
    }

    return false;
  }

  public async exportAll(): Promise<string> {
    const env = this.readEnvelope();
    return JSON.stringify(env, null, 2);
  }

  public async importAll(jsonString: string): Promise<ImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('FORMATO_INVALIDO: El archivo no contiene un JSON válido.');
    }

    let notesToImport: MissionNote[] = [];

    if (parsed && typeof parsed === 'object') {
      const maybeEnv = parsed as Record<string, unknown>;
      if (Array.isArray(maybeEnv.notes)) {
        notesToImport = maybeEnv.notes as MissionNote[];
      } else if (Array.isArray(parsed)) {
        notesToImport = parsed as MissionNote[];
      }
    }

    if (!Array.isArray(notesToImport)) {
      throw new Error('ESQUEMA_INVALIDO: No se encontró una lista de notas válida en el archivo.');
    }

    const env = this.readEnvelope();
    const existingIds = new Set(env.notes.map((n) => n.id));

    let importedCount = 0;
    let skippedCount = 0;

    for (const raw of notesToImport) {
      // Validación básica de esquema para cada nota
      if (
        raw &&
        typeof raw.id === 'string' &&
        typeof raw.body === 'string' &&
        typeof raw.raDeg === 'number' &&
        typeof raw.decDeg === 'number' &&
        typeof raw.radiusDeg === 'number'
      ) {
        if (existingIds.has(raw.id)) {
          // No pisar ids existentes
          skippedCount++;
        } else {
          env.notes.push({
            id: raw.id,
            objectId: raw.objectId ?? null,
            objectName: raw.objectName ?? null,
            raDeg: raw.raDeg,
            decDeg: raw.decDeg,
            radiusDeg: raw.radiusDeg,
            body: raw.body,
            createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
            updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
          });
          existingIds.add(raw.id);
          importedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    if (importedCount > 0) {
      this.writeEnvelope(env);
    }

    return { importedCount, skippedCount };
  }
}

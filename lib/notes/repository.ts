/**
 * AetherScope - Mission Notes Repository Interface
 * Contrato agnóstico de almacenamiento (asíncrono para compatibilidad futura con backend remoto).
 */

import type { Capture } from '@/lib/astronomy/footprint';
import type { CaptureMatch } from '@/lib/astronomy/crossmatch';
import type { MissionNote } from './types';

export interface CreateNoteInput {
  objectId?: string | null;
  objectName?: string | null;
  raDeg: number;
  decDeg: number;
  radiusDeg: number;
  body: string;
}

export interface UpdateNotePatch {
  body?: string;
  objectName?: string | null;
  objectId?: string | null;
}

export interface ImportResult {
  importedCount: number;
  skippedCount: number;
}

export interface NotesRepository {
  list(): Promise<MissionNote[]>;
  listForCapture(capture: Capture, match: CaptureMatch): Promise<MissionNote[]>;
  create(input: CreateNoteInput): Promise<MissionNote>;
  update(id: string, patch: UpdateNotePatch): Promise<MissionNote>;
  remove(id: string): Promise<boolean>;
  removeMany(ids: string[]): Promise<number>;
  exportAll(): Promise<string>;
  importAll(jsonString: string): Promise<ImportResult>;
}

/**
 * AetherScope - Supabase Notes Repository
 * Implementación remota conectada a PostgreSQL / Supabase con modelo ternario
 * (auth.users + coordinates + mission_notes) y aislamiento RLS por usuario.
 */

import { calculateAngularSeparation } from '@/lib/astronomy/coordinates';
import type { Capture } from '@/lib/astronomy/footprint';
import type { CaptureMatch } from '@/lib/astronomy/crossmatch';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { MissionNote } from './types';
import type {
  NotesRepository,
  CreateNoteInput,
  UpdateNotePatch,
  ImportResult,
} from './repository';

interface SupabaseCoordinateRow {
  id: string;
  ra_deg: number;
  dec_deg: number;
  radius_deg: number;
  object_id: string | null;
  object_name: string | null;
}

interface SupabaseNoteRow {
  id: string;
  user_id: string;
  coordinate_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  coordinates: SupabaseCoordinateRow | SupabaseCoordinateRow[] | null;
}

export class SupabaseNotesRepository implements NotesRepository {
  private getClient() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error(
        'Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
      );
    }
    return supabase;
  }

  private mapRowToNote(row: SupabaseNoteRow): MissionNote {
    const rawCoord = row.coordinates;
    const coord: SupabaseCoordinateRow | null = Array.isArray(rawCoord) ? rawCoord[0] || null : rawCoord;

    return {
      id: row.id,
      userId: row.user_id,
      coordinateId: row.coordinate_id,
      objectId: coord?.object_id ?? null,
      objectName: coord?.object_name ?? null,
      raDeg: coord?.ra_deg ?? 0,
      decDeg: coord?.dec_deg ?? 0,
      radiusDeg: coord?.radius_deg ?? 0.1,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public async list(): Promise<MissionNote[]> {
    const supabase = this.getClient();

    // 0. Si el operador no está autenticado, no hay notas remotas que listar
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return [];
    }

    const { data, error } = await supabase
      .from('mission_notes')
      .select(`
        id,
        user_id,
        coordinate_id,
        body,
        created_at,
        updated_at,
        coordinates (
          id,
          ra_deg,
          dec_deg,
          radius_deg,
          object_id,
          object_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        return [];
      }
      throw new Error(`Error al listar notas: ${error.message}`);
    }

    const rows = (data || []) as unknown as SupabaseNoteRow[];
    return rows.map((row) => this.mapRowToNote(row));
  }

  public async listForCapture(capture: Capture, match: CaptureMatch): Promise<MissionNote[]> {
    const allUserNotes = await this.list();

    // Caso A: Hay un objeto identificado en catálogo
    if (match.object && (match.state === 'inside' || match.state === 'edge') && match.object.id) {
      const targetId = match.object.id;
      return allUserNotes.filter((note) => note.objectId === targetId);
    }

    // Caso B: Campo sin objeto catalogado -> Solapamiento angular circular
    return allUserNotes.filter((note) => {
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
    const supabase = this.getClient();
    const trimmedBody = input.body.trim();
    if (!trimmedBody) {
      throw new Error('VALIDACION: La nota no puede estar vacía.');
    }
    if (trimmedBody.length > 10000) {
      throw new Error('VALIDACION: La nota no puede superar los 10.000 caracteres.');
    }
    if (!Number.isFinite(input.raDeg) || input.raDeg < 0 || input.raDeg >= 360) {
      throw new Error('VALIDACION: Coordenada RA fuera de rango permitido [0, 360).');
    }
    if (!Number.isFinite(input.decDeg) || input.decDeg < -90 || input.decDeg > 90) {
      throw new Error('VALIDACION: Coordenada Dec fuera de rango permitido [-90, +90].');
    }

    const cleanRadius =
      Number.isFinite(input.radiusDeg) && input.radiusDeg > 0 && input.radiusDeg <= 180
        ? input.radiusDeg
        : 0.1;
    const cleanObjectId =
      typeof input.objectId === 'string' ? input.objectId.trim().slice(0, 255) || null : null;
    const cleanObjectName =
      typeof input.objectName === 'string' ? input.objectName.trim().slice(0, 255) || null : null;

    // 0. Verificar sesión del operador autenticado
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Debes iniciar sesión con tu cuenta de operador para registrar observaciones en la base de datos.');
    }

    // 1. Obtener o registrar las coordenadas celestes (Entidad coordinates)
    let coordinateId: string | null = null;

    try {
      const { data: rpcCoordId, error: rpcError } = await supabase.rpc('upsert_coordinate', {
        p_ra_deg: input.raDeg,
        p_dec_deg: input.decDeg,
        p_radius_deg: cleanRadius,
        p_object_id: cleanObjectId,
        p_object_name: cleanObjectName,
      });

      if (!rpcError && rpcCoordId) {
        coordinateId = rpcCoordId as string;
      }
    } catch {
      // Si la función RPC no estuviera desplegada, fallback a SELECT + INSERT directo
    }

    if (!coordinateId) {
      const { data: existingCoord } = await supabase
        .from('coordinates')
        .select('id')
        .eq('ra_deg', input.raDeg)
        .eq('dec_deg', input.decDeg)
        .maybeSingle();

      if (existingCoord?.id) {
        coordinateId = existingCoord.id;
      } else {
        const { data: newCoord, error: insertCoordError } = await supabase
          .from('coordinates')
          .insert({
            ra_deg: input.raDeg,
            dec_deg: input.decDeg,
            radius_deg: cleanRadius,
            object_id: cleanObjectId,
            object_name: cleanObjectName,
          })
          .select('id')
          .single();

        if (insertCoordError || !newCoord?.id) {
          throw new Error(`Error al registrar coordenadas: ${insertCoordError?.message}`);
        }
        coordinateId = newCoord.id;
      }
    }

    // 2. Insertar la nota en la relación ternaria mission_notes vinculada al user_id del operador
    const { data: noteRow, error: insertNoteError } = await supabase
      .from('mission_notes')
      .insert({
        user_id: user.id,
        coordinate_id: coordinateId,
        body: trimmedBody,
      })
      .select(`
        id,
        user_id,
        coordinate_id,
        body,
        created_at,
        updated_at,
        coordinates (
          id,
          ra_deg,
          dec_deg,
          radius_deg,
          object_id,
          object_name
        )
      `)
      .single();

    if (insertNoteError || !noteRow) {
      throw new Error(`Error al guardar la nota: ${insertNoteError?.message}`);
    }

    return this.mapRowToNote(noteRow as unknown as SupabaseNoteRow);
  }

  public async update(id: string, patch: UpdateNotePatch): Promise<MissionNote> {
    const supabase = this.getClient();

    const updatePayload: Record<string, unknown> = {};
    if (patch.body !== undefined) {
      const trimmed = patch.body.trim();
      if (!trimmed) {
        throw new Error('VALIDACION: La nota no puede estar vacía.');
      }
      if (trimmed.length > 10000) {
        throw new Error('VALIDACION: La nota no puede superar los 10.000 caracteres.');
      }
      updatePayload.body = trimmed;
    }

    const { data, error } = await supabase
      .from('mission_notes')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        id,
        user_id,
        coordinate_id,
        body,
        created_at,
        updated_at,
        coordinates (
          id,
          ra_deg,
          dec_deg,
          radius_deg,
          object_id,
          object_name
        )
      `)
      .single();

    if (error || !data) {
      throw new Error(`Error al actualizar la nota: ${error?.message}`);
    }

    return this.mapRowToNote(data as unknown as SupabaseNoteRow);
  }

  public async remove(id: string): Promise<boolean> {
    const supabase = this.getClient();

    const { error } = await supabase.from('mission_notes').delete().eq('id', id);

    if (error) {
      throw new Error(`Error al eliminar la nota: ${error.message}`);
    }

    return true;
  }

  public async removeMany(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const supabase = this.getClient();

    const { error } = await supabase.from('mission_notes').delete().in('id', ids);

    if (error) {
      throw new Error(`Error al eliminar las notas: ${error.message}`);
    }

    return ids.length;
  }

  public async exportAll(): Promise<string> {
    const notes = await this.list();
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        backend: 'supabase',
        notes,
      },
      null,
      2
    );
  }

  public async importAll(jsonString: string): Promise<ImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('FORMATO_INVALIDO: El archivo no contiene un JSON válido.');
    }

    const envelope = parsed as { notes?: MissionNote[] };
    const notesArray = Array.isArray(envelope)
      ? (envelope as MissionNote[])
      : Array.isArray(envelope?.notes)
      ? envelope.notes
      : null;

    if (!notesArray) {
      throw new Error('FORMATO_INVALIDO: Estructura de notas no reconocida.');
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (const item of notesArray) {
      if (
        !item ||
        typeof item.body !== 'string' ||
        !item.body.trim() ||
        item.body.length > 10000 ||
        typeof item.raDeg !== 'number' ||
        !Number.isFinite(item.raDeg) ||
        item.raDeg < 0 ||
        item.raDeg >= 360 ||
        typeof item.decDeg !== 'number' ||
        !Number.isFinite(item.decDeg) ||
        item.decDeg < -90 ||
        item.decDeg > 90
      ) {
        skippedCount++;
        continue;
      }

      const radius =
        typeof item.radiusDeg === 'number' &&
        Number.isFinite(item.radiusDeg) &&
        item.radiusDeg > 0 &&
        item.radiusDeg <= 180
          ? item.radiusDeg
          : 0.1;

      try {
        await this.create({
          objectId:
            typeof item.objectId === 'string' ? item.objectId.trim().slice(0, 255) || null : null,
          objectName:
            typeof item.objectName === 'string' ? item.objectName.trim().slice(0, 255) || null : null,
          raDeg: item.raDeg,
          decDeg: item.decDeg,
          radiusDeg: radius,
          body: item.body.trim(),
        });
        importedCount++;
      } catch {
        skippedCount++;
      }
    }

    return { importedCount, skippedCount };
  }
}

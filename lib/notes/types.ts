/**
 * AetherScope - Mission Notes Data Types
 * Modelo ternario: Usuario + Coordenadas + Nota
 */

export interface CelestialCoordinate {
  id: string;
  raDeg: number;
  decDeg: number;
  radiusDeg: number;
  objectId?: string | null;
  objectName?: string | null;
  createdAt: string;
}

export interface MissionNote {
  id: string; // UUID v4
  userId?: string; // Foreign key a auth.users
  coordinateId?: string; // Foreign key a coordinates
  objectId: string | null;
  objectName: string | null;
  raDeg: number;
  decDeg: number;
  radiusDeg: number;
  body: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

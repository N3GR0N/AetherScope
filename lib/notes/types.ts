/**
 * AetherScope - Mission Notes Data Types
 */

export interface MissionNote {
  id: string; // UUID v4
  objectId: string | null;
  objectName: string | null;
  raDeg: number;
  decDeg: number;
  radiusDeg: number;
  body: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

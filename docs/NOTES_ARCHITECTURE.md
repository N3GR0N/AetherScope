# Arquitectura de Bitácora de Misión (Mission Notes)

Este documento detalla la arquitectura desacoplada de la bitácora de misión en **AetherScope**, diseñada para funcionar de forma inmediata en el navegador (`localStorage`) y migrar de manera transparente a una base de datos remota con autenticación (`Supabase`) en el futuro.

---

## 1. Esquema de Datos (`MissionNote`)

Cada anotación de misión se modela de manera agnóstica a la infraestructura:

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` (UUID v4) | Identificador único universal de la nota. |
| `objectId` | `string \| null` | ID del objeto astronómico catalogado si la captura coincide ('inside' o 'edge'). |
| `objectName` | `string \| null` | Nombre legible del objeto celeste o sector observado. |
| `raDeg` | `number` | Ascensión Recta central de la captura en grados decimales [0, 360). |
| `decDeg` | `number` | Declinación central de la captura en grados decimales [-90, +90]. |
| `radiusDeg` | `number` | Radio angular de la captura (FOV / 2) en grados decimales (> 0). |
| `body` | `string` | Contenido en texto de la hipótesis u observación (máx. 10.000 caracteres). |
| `createdAt` | `string` (ISO 8601) | Marca temporal de creación. |
| `updatedAt` | `string` (ISO 8601) | Marca temporal de última modificación. |

### Criterio de Consulta (`listForCapture`)
- **Si hay un objeto identificado:** La bitácora filtra y retorna todas las notas asociadas al mismo `objectId`.
- **Si el campo no tiene objeto catalogado (`none`):** La bitácora retorna todas las notas astronómicas cuya huella angular circular (centro + radio) se solape con la captura actual:
  $$\text{distancia\_angular}(C_{\text{captura}}, C_{\text{nota}}) \le r_{\text{captura}} + r_{\text{nota}}$$
  Sin necesidad de discretizar el cielo en celdas ni grillas fijas.

---

## 2. Cómo Cambiar de Backend

El punto de entrada del repositorio es `getNotesRepository()` en `lib/notes/index.ts`:

1. **Modo Local (Activo por defecto):**
   ```env
   NEXT_PUBLIC_NOTES_BACKEND=local
   ```
   Utiliza `LocalNotesRepository`, almacenando las notas en `localStorage` bajo la clave versionada `aetherscope:notes:v1`. Incluye soporte para modo incógnito, protección SSR, sincronización entre pestañas y utilidades de importación/exportación JSON.

2. **Modo Remoto (Supabase):**
   ```env
   NEXT_PUBLIC_NOTES_BACKEND=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<tu-anon-key>
   ```
   Al configurar esta variable, la fábrica despacha `SupabaseNotesRepository`.

---

## 3. Pasos Requeridos para Activar Cuentas y Base de Datos

Para dar de alta el backend remoto en el futuro:

1. **Aplicar la migración SQL en Supabase:**
   Ejecutar el script preparado en `supabase/migrations/20260101000000_create_mission_notes.sql`. Este crea la tabla `public.mission_notes`, índices optimizados en `user_id` y `object_id`, y políticas de Row Level Security (RLS) que aíslan las notas por usuario (`auth.uid()`).

2. **Instalar el cliente oficial:**
   ```bash
   npm install @supabase/supabase-js
   ```

3. **Implementar `SupabaseNotesRepository`:**
   En `lib/notes/index.ts`, conectar las operaciones CRUD contra `supabase.from('mission_notes')`.

4. **Implementar `SupabaseAuthService`:**
   En `lib/auth/`, conectar `supabase.auth.getUser()`, `signInWithPassword()` / OAuth y `signOut()`, e inyectar el servicio en `AuthProvider`.

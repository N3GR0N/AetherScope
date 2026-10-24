# AETHERSCOPE — Deep Space Spectral Navigator

**AetherScope** es una plataforma científica e interactiva de exploración astronómica y análisis espectroscópico del espacio profundo. Diseñada con una estética táctica industrial retro-futurista e impulsada por datos reales de observatorios espaciales (**JWST, Hubble, Chandra, Gaia, AllWISE, DSS2**) mediante la infraestructura HiPS de CDS / ESA / NASA y un backend relacional en **PostgreSQL / Supabase**.

---

## 🌌 Módulos del Sistema

### 1. Lienzo de Navegación Celeste 360° (`/`)
- **Motor Cartográfico WebGL2:** Potenciado por **Aladin Lite v3** (`Rust/WASM` + WebGL).
- **Cartografía Espectral Multibanda en Tiempo Real:**
  - **JWST Infrarrojo Cercano / Medio (0.6 – 28 µm):** Penetración de polvo cósmico y regiones de formación estelar.
  - **Hubble & DSS2 Óptico (380 – 750 nm):** Fotosferas estelares y gas ionizado resplandeciente.
  - **Chandra Rayos X (0.1 – 10 keV):** Agujeros negros, púlsares y plasmas a millones de grados.
  - **Gaia DR3 Astrometría:** Densidad y flujo de más de 1.800 millones de fuentes estelares.
  - **AllWISE Infrarrojo Térmico:** Filamentos fríos interestelares y enanas marrones.
- **Control Deslizante de Mezcla Espectral (Blend Slider):** Fusión continua de longitudes de onda en vivo.
- **HUD de Orientación y Retícula Óptica:** Cuadrícula de coordenadas ecuatoriales J2000 (Ascensión Recta y Declinación), escala angular dinámica y retícula central de inspección.
- **Catálogo Científico Curado:** Acceso rápido y cinemática suave hacia objetivos célebres (*Nebulosa de Orión, Carina, SMACS 0723, Pilares de la Creación, Galaxia del Sombrero, Sagitario A\**, entre otros).
- **Transición Táctica hacia Laboratorio:** Botón integrado para trasladar las coordenadas y campo de visión exactos al espectrógrafo de laboratorio.

### 2. Laboratorio Espectroscópico y Análisis Astrofísico (`/analyze`)
- **Desglose Multiespectral Sincronizado:** Lienzo bloqueado en coordenadas de captura con filtros espectrales dedicados.
- **Inferencia de Fenómenos Físicos:** Detección de firmas dominantes (aceleración gravitacional, frentes de choque de supernovas, vientos estelares intensos, emisión PAH).
- **Composición Química e Histograma Espectral:** Confianza estadística y detección de elementos clave ($H\alpha$, $[O\text{ III}]$, $[S\text{ II}]$, hidrocarburos aromáticos policíclicos, $Fe\text{ XXV}$, monóxido de carbono).
- **Bitácora de Observaciones de Misión:** Registro de notas científicas por sector, persistencia híbrida (Supabase con fallback a `localStorage`), sincronización entre pestañas en tiempo real y soporte completo para exportación/importación en formato JSON.
- **Purga de Sector:** Botón `VACIAR` para limpiar todas las notas de un sector con confirmación técnica estilizada.

### 3. Perfil de Operador y Catálogo Personal (`/profile`)
- **Generador Procedural de Avatares Astronómicos:** Creación algorítmica de insignias celestes únicas en SVG basadas en la identidad del operador, con opción de regeneración aleatoria y persistencia local.
- **Seguridad y Restablecimiento de Credenciales:** Solicitud de cambio de contraseña por correo con intervalo de seguridad criptográfica de 30 días y formulario en línea para asignación de nueva clave.
- **Catálogo Personal de Objetos Observados:** Agrupación inteligente de todas las notas registradas por cuerpo celeste o sector de cielo profundo.
- **Fichas Comparativas Astrofísicas:** Visualización comparativa de tipo de formación cósmica, dimensiones angulares/físicas y líneas espectrales detectadas para cada objeto registrado.
- **Acceso Rápido a Laboratorio:** Botón directo para re-inspeccionar cualquier objeto de la bitácora en el espectrógrafo del laboratorio.
- **Eliminación Granular:** Capacidad de eliminar notas individuales o purgar un objeto completo del catálogo personal mediante el modal de confirmación técnica.

### 4. Monitoreo y Salud del Sistema (`/api/health`)
- **Endpoint Dinámico de Health Check:** Ruta HTTP GET sin caché (`export const dynamic = "force-dynamic"`) diseñada para monitores externos (StatusCake, UptimeRobot).
- **Keep-Alive de Base de Datos:** Realiza una consulta mínima y económica a la tabla `coordinates` de Supabase para prevenir la suspensión por inactividad de proyectos en el plan gratuito (*free-tier*).
- **Respuesta Segura:** Retorna `{ ok: true }` (200) ante éxito y `{ ok: false }` (500) ante fallos sin filtrar detalles de error internos.

---

## 🛡️ Seguridad y Resiliencia (Auditoría v0.1.0)

AetherScope incorpora un modelo de **Defensa en Profundidad**:

1. **Modelo de Datos Ternario y Row Level Security (RLS):**
   - Estructura relacional reificada: `auth.users` + `coordinates` + `mission_notes`.
   - Políticas RLS estrictas en PostgreSQL: los usuarios únicamente pueden leer, actualizar o eliminar sus propias notas (`(auth.uid() = user_id)`), mientras que las coordenadas astronómicas permanecen públicas y reutilizables.
2. **Hardening de Funciones PostgreSQL:**
   - La función `upsert_coordinate` opera con `SECURITY DEFINER` fijando explícitamente `SET search_path = public, pg_temp;` para prevenir secuestro de esquemas (*search_path hijacking*).
   - Privilegios restringidos: ejecución revocada para `PUBLIC`/`anon` y concedida exclusivamente a `authenticated`.
3. **Mitigación de Denegación de Servicio (DoS) y Complejidad de Acceso:**
   - Contraseñas acotadas a un máximo de **128 caracteres** para prevenir agotamiento de CPU por hashing intensivo (Bcrypt / Argon2).
   - Bloqueo preventivo de **5 minutos** tras **4 intentos fallidos** de contraseña.
   - Requisitos de contraseña: mínimo 6 caracteres y al menos una letra mayúscula.
   - Longitud de correo electrónico validada bajo el estándar RFC 5321 (máximo 254 caracteres).
4. **Sanitización Numérica y Protección de Shaders:**
   - Normalización y acotamiento de parámetros angulares ($RA \in [0, 360)$, $Dec \in [-90, +90]$, $FOV \in [0.01, 180]$) para evitar la inyección de `NaN`/`Infinity` que congele matrices trigonométricas o shaders de WebGL.
5. **Cabeceras HTTP de Seguridad:**
   - Inyección en `next.config.ts`: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `Strict-Transport-Security` (HSTS) y `Permissions-Policy`.
6. **Modal Técnico de Confirmación:**
   - Reemplazo de los diálogos nativos del navegador por el componente accesible [`ConfirmDeleteModal`](components/ui/ConfirmDeleteModal.tsx).

---

## 🎨 Identidad Visual y Estética

La interfaz de AetherScope utiliza una paleta industrial retro-futurista:

| Token | Hex | Aplicación |
| :--- | :--- | :--- |
| **Fondo Profundo** | `#101015` | Lienzo base cósmico y áreas no expuestas |
| **Superficie / Barra** | `#17171C` | Cabeceras tácticas y docks de control |
| **Contenedores** | `#1A1A1F` | Fichas de metadatos, tarjetas de análisis y modales |
| **Líneas y Bordes** | `#2B2B31` / `#3A3A42` | Separadores técnicos y cuadrícula de telemetría |
| **Acento Espectral** | `#506385` | Azul pizarra / celeste para botones y elementos activos |
| **Texto Técnico** | `#F1F0E1` | Blanco cremoso para alta legibilidad en pantallas oscuras |
| **Etiquetas Secundarias** | `#9A9A92` | Gris atenuado para unidades angulares y telemetría |
| **Alerta / Peligro** | `#EF4444` / `#5C2B2B` | Purgas de datos y advertencias de seguridad |

**Tipografías:**
- Interfaz y lecturas científicas: `Proto Mono` / `Share Tech Mono` (monoespaciada con números tabulares).

---

## 🛠️ Stack Tecnológico

- **Framework:** Next.js 16 (App Router con Turbopack, TypeScript).
- **Librería de UI:** React 19.
- **Estilos:** Tailwind CSS v4 (`@tailwindcss/postcss`).
- **Base de Datos & Autenticación:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`, PostgreSQL con RLS).
- **Motor Cartográfico:** Aladin Lite v3 (CDS Estrasburgo).
- **Pruebas:** Vitest v5 (tests unitarios de footprint, coordenadas y health check).
- **Iconografía:** `lucide-react`.

---

## 🚀 Instalación y Despliegue

### Requisitos Previos
- **Node.js** v20+ (recomendado v22 o superior).
- **npm** o gestor de paquetes compatible.
- Proyecto de **Supabase** (opcional para desarrollo básico con almacenamiento local, requerido para autenticación multi-dispositivo y persistencia en la nube).

### Configuración de Variables de Entorno
Copia el archivo de plantilla `.env.example` como `.env.local`:

```bash
cp .env.example .env.local
```

Configura tus credenciales de Supabase en `.env.local`:

```env
NEXT_PUBLIC_NOTES_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-anon-key
```

### Comandos Disponibles

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo en `http://localhost:3000` con Turbopack. |
| `npm run build` | Compila la aplicación para producción generando las rutas estáticas y dinámicas. |
| `npm run start` | Sirve la compilación de producción optimizada. |
| `npm run lint` | Ejecuta el análisis de linter estático (ESLint v9). |
| `npm test` | Ejecuta la suite de pruebas unitarias con Vitest. |

---

## 📡 Verificación del Endpoint de Monitoreo

Para comprobar el estado del sistema y la conectividad con Supabase:

### En Local:
```bash
curl -i http://localhost:3000/api/health
```

### En Producción (Vercel / Dominio Propio):
```bash
curl -i https://<tu-proyecto>.vercel.app/api/health
```

**Respuesta exitosa (HTTP 200 OK):**
```json
{"ok":true}
```

---

## 📄 Licencia

Este proyecto está disponible bajo fines de investigación y docencia académica en astrofísica y tecnologías web modernas.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Usuarios principales**: Astrónomos aficionados, estudiantes de astrofísica y ciencias espaciales, divulgadores científicos y observadores del cielo nocturno.
- **Situación**: Sesiones de exploración celeste interactiva, preparación y registro de salidas de observación astronómica, comparación y mezcla de capas multiespectrales de cielo profundo, y caracterización o descubrimiento de entidades celestes (estrellas, planetas, cúmulos, nebulosas, galaxias).
- **Trabajo a realizar (Job to be done)**: Navegar el firmamento en coordenadas astronómicas estándar (J2000), inspeccionar visual y espectralmente cualquier sector bajo la retícula de colimación, identificar candidatos mediante huella angular rigurosa (NED/SIMBAD), analizar su régimen físico en el Laboratorio y mantener una bitácora de campo persistente.

## Product Purpose

AetherScope es una estación de trabajo y visualizador astronómico interactivo de cielo profundo. Existe para democratizar y unificar en una sola interfaz web fluida la exploración del cosmos con datos reales de telescopios espaciales y el análisis espectroscópico riguroso. El éxito significa que cualquier observador pueda recorrer el lienzo celeste, contrastar la radiación en múltiples longitudes de onda (desde radio hasta rayos X), identificar objetos con precisión sin falsos positivos de vecindad y registrar observaciones científicas reproducibles.

## Positioning

A diferencia de planetarios estáticos o visores genéricos que solo muestran imágenes compuestas o catálogos aislados, AetherScope combina:
1. **Lienzo WebGL interactivo** con encuestas HiPS científicas reales (CDS/ESA/NASA).
2. **Motor de huella angular elíptica** en tiempo real (`lib/astronomy/footprint.ts` y `crossmatch.ts`) que clasifica el sector según el tamaño angular verificado en SIMBAD/NED (diámetro mayor, menor y ángulo de posición), eliminando asignaciones arbitrarias por proximidad.
3. **Laboratorio Espectroscópico Multicanal** con mezcla simultánea de filtros (óptico DSS2, infrarrojo JWST, rayos X Chandra, radio VLSS, ultravioleta Galex) y caracterización de regímenes térmicos y firmas elementales.
4. **Bitácora de misión con resiliencia offline** (almacenamiento local directo) y sincronización opcional en la nube bajo Row Level Security (Supabase).

## Operating Context

- **Entornos**: Navegación en escritorio y dispositivos móviles, frecuentemente en condiciones de baja luminosidad (noches de observación astronómica o estudio nocturno).
- **Herramientas y fuentes vinculadas**: Catálogos astronómicos (SIMBAD TAP, NED, Gaia DR3), repositorios HiPS de Estrasburgo y telescopios espaciales (Hubble, JWST, Chandra, Galex).
- **Flujo operativo central**:
  1. Exploración libre en el Mapa (`/`) con control de FOV y retícula de colimación.
  2. Detección y focalización de un sector u objeto cósmico en la tarjeta de objetivo.
  3. Transición al Laboratorio (`/analyze`) para mezcla espectral y descomposición de firmas físicas.
  4. Registro de observaciones en la Bitácora de Misión.
  5. Consulta y gestión de notas y catálogo personal en el Perfil (`/profile`).

## Capabilities and Constraints

- **Capacidades confirmadas**:
  - Lienzo celeste continuo con navegación por arrastre, zoom asistido y retícula de precisión de 1px.
  - Selección y conmutación de capas espectrales HiPS normalizadas.
  - Algoritmo de clasificación de huella angular: estados `inside`, `edge` y `none` con cálculo elíptico rotado en plano tangente.
  - Descomposición física aproximada: temperatura Kelvin, radiación dominante y firmas químicas catalogadas.
  - Bitácora con exportación e importación en formato JSON, creación, edición y purga granular de notas.
  - Autenticación de operadores con protección anti-spam (cooldown de 5 minutos en cambio de contraseña) y generación de avatares procedurales.
- **Restricciones técnicas**:
  - Límite de campo angular para análisis espectral (FOV ≤ 5°).
  - Resiliencia obligatoria ante caídas de CDS Estrasburgo: cartel táctico sereno (`CdsDownCard`) sin bloquear la interfaz ni inventar datos.
  - Cero scroll horizontal en resoluciones móviles estándar (ancho mínimo 375px).

## Brand Commitments

- **Nombre**: AetherScope — Deep Space Spectral Navigator.
- **Tono**: Técnico, sobrio, científico y sin estridencias publicitarias.
- **Identidad visual**: Fondo oscuro profundo (`#101015`, `#16171D`), acento ámbar/dorado estelar (`#D8A24A`), texto hueso (`#F1F0E1`). Ausencia absoluta de gradientes, halos de neón, emojis o adornos artificiales ("no AI-slop").
- **Tipografía**: Inter para texto de interfaz legible y Geist Mono estrictamente para telemetría astrométrica, coordenadas y datos tabulares.

## Evidence on Hand

- Catálogo local verificado en literatura (`lib/astronomy/database.ts` y `targets.ts`).
- Endpoints TAP de SIMBAD y servicios HiPS de Aladin Lite v3.
- Modelos matemáticos de coordenadas estándar J2000, trigonometría esférica Haversine y proyección elíptica.
- Regla de honestidad científica: cuando un objeto carece de dimensiones en literatura, se documenta como `estimate` o `undefined` sin inventar métricas.

## Product Principles

1. **Fidelidad Astronómica**: Todo dato, coordenada o dimensión angular expuesta proviene de fuentes científicas verificables o se explicita claramente como estimación de campo.
2. **Exploración sin Fricción**: La interfaz responde de inmediato y guía al usuario fluidamente desde el firmamento abierto hasta la inspección espectroscópica detallada.
3. **Resiliencia Operativa**: La herramienta funciona con normalidad en modo local u offline, notificando fallos externos con serenidad y sin interrumpir el trabajo de campo.
4. **Sobriedad Visual Funcional**: El diseño plano, limpio y de alto contraste prioriza la visibilidad en la oscuridad y el protagonismo de las imágenes cósmicas reales.

## Accessibility & Inclusion

- Interfaz de alto contraste adaptada para visión nocturna y descanso visual.
- Hit targets táctiles mínimos de 40px en botones y controles interactivos.
- Anillo de foco accesible universal (`2px --accent, 2px offset`) para navegación con teclado.
- Soporte para preferencias de reducción de movimiento (`prefers-reduced-motion`).

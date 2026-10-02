# AETHERSCOPE — Deep Space Spectral Navigator

AetherScope es un visualizador y analizador del espacio profundo en lienzo celeste interactivo de 360°, diseñado con estética profesional **Apple Pro / macOS** y potenciado por datos astronómicos reales de misiones espaciales (**JWST, Hubble, Chandra, Gaia, AllWISE**) a través de la infraestructura HiPS de CDS / ESA / NASA.

---

## 🌌 Características Principales

1. **Lienzo Celeste Abierto (Infinite Sky Canvas):**
   - Motor astronómico **Aladin Lite v3** (`WebGL2` + `Rust/WASM`).
   - Coordenadas ecuatoriales J2000 en tiempo real (Ascensión Recta, Declinación, Proyección Sinusoidal).
   - Zoom cósmico continuo y escala angular adaptativa (grados, minutos de arco, segundos de arco).

2. **Dial Espectral Interactivo (Multi-Wavelength Switcher):**
   - Dock flotante con estética macOS Liquid Glass.
   - Alternancia en vivo entre longitudes de onda:
     - **JWST Infrarrojo Cercano / Medio (0.6 – 28 µm):** Penetración de gas y polvo estelar denso.
     - **Hubble & DSS2 Óptico (380 – 750 nm):** Fotosferas estelares y gas ionizado resplandeciente.
     - **Chandra Rayos X (0.1 – 10 keV):** Agujeros negros, púlsares y plasmas extremos.
     - **Gaia DR3 Astrometría:** Cartografía de flujo y densidad estelar de 1.800 millones de estrellas.
     - **AllWISE Infrarrojo Térmico:** Filamentos fríos interestelares y enanas marrones.
   - **Control deslizante de mezcla (Blend Slider):** Fusión y cruce espectral suave en tiempo real entre capas.

3. **Panel Táctico de Objetivo (Target Inspector):**
   - Navegación cinemática suave hacia objetivos célebres:
     - *Nebulosa Carina (Cosmic Cliffs / NGC 3324)*
     - *Campo Profundo SMACS 0723 (Lente Gravitacional)*
     - *Pilares de la Creación (Messier 16 / Águila)*
     - *Galaxia del Sombrero (Messier 104)*
     - *Sagitario A\* (Centro Galáctico)*
     - *Nebulosa del Anillo del Sur (NGC 3132)*
     - *Quinteto de Stephan (HCG 92)*
   - Ficha astrofísica detallada: Distancia en años luz, corrimiento al rojo ($z$), constelación, observatorio líder, líneas de emisión y composición química detectada (Hα, [O III], [S II], PAH, Fe XXV).

4. **HUD de Retícula de Precisión (Target Crosshair):**
   - Retícula óptica central con sub-marcas de precisión y lectura de diámetro angular.
   - Marcadores de orientación cardinal celeste (N, E).
   - Alternancia de rejilla de coordenadas astronómicas RA / Dec.

---

## 🎨 Identidad Visual: Apple Pro / macOS

- **Superficies:** Ventanas flotantes en Liquid Glass (`backdrop-blur-2xl`, `backdrop-saturate-[180%]`, reflejo especular superior `inset 0 1px 0 0 rgba(255,255,255,0.15)`).
- **Tipografía:** UI en `Geist Sans` y telemetría de precisión en `Geist Mono` con números tabulares.
- **Micro-interacciones:** Resortes fluidos `cubic-bezier(0.16, 1, 0.3, 1)`.

---

## 🛠️ Stack Tecnológico

- **Framework:** Next.js 16 (App Router, TypeScript).
- **Estilos:** Tailwind CSS v4.
- **Motor Cartográfico:** Aladin Lite v3 (CDS / Estrasburgo).
- **Iconografía:** `lucide-react`.

---

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Compilación de producción
npm run build

# Verificación de linter
npm run lint
```

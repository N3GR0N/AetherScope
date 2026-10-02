import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AetherScope — Deep Space Spectral Navigator",
  description:
    "Visualizador y analizador del espacio profundo en lienzo celeste abierto, potenciado por datos reales de telescopios espaciales (JWST, Hubble, Chandra, Gaia) a través de encuestas HiPS/CDS/ESA.",
  keywords: [
    "astronomy",
    "JWST",
    "Hubble",
    "Chandra",
    "Gaia",
    "Aladin Lite",
    "HiPS",
    "deep space",
    "celestial map",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark h-full w-full overflow-hidden select-none bg-black ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="h-full w-full overflow-hidden bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}

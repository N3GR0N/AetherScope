import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Share_Tech_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-proto-next",
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
  themeColor: "#101015",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark h-full w-full overflow-hidden select-none bg-[#101015] ${shareTechMono.variable}`}
    >
      <body className="h-full w-full overflow-hidden bg-[#101015] text-[#F1F0E1] antialiased font-[family-name:var(--font-proto)]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

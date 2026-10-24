"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSpace } from "@/context/SpaceContext";
import { useAuth } from "@/components/auth/AuthProvider";
import AuthModal from "@/components/auth/AuthModal";
import { useIsMounted } from "@/lib/hooks/useIsMounted";
import { Maximize2, Minimize2, User as UserIcon } from "lucide-react";

interface HeaderBarProps {
  showCrosshair?: boolean;
  onToggleCrosshair?: () => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  inspectorOpen?: boolean;
  onToggleInspector?: () => void;
}

export default function HeaderBar(props: HeaderBarProps = {}) {
  const isMounted = useIsMounted();
  const space = useSpace();
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const showCrosshair = props.showCrosshair ?? space.showCrosshair;
  const onToggleCrosshair = props.onToggleCrosshair ?? space.toggleCrosshair;
  const showGrid = props.showGrid ?? space.showGrid;
  const onToggleGrid = props.onToggleGrid ?? space.toggleGrid;
  const inspectorOpen = props.inspectorOpen ?? space.isCatalogOpen;
  const onToggleInspector = props.onToggleInspector ?? space.toggleCatalog;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#17171C] border-b border-[#2B2B31] px-4 md:px-6 flex items-center justify-between z-40 select-none">
        {/* Left Section: Favicon & Typography Branding */}
        <div className="flex items-center gap-3">
          {/* Favicon icon */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/favicon.ico"
            alt="AetherScope"
            className="w-5 h-5 shrink-0 object-contain"
          />

          <div className="flex flex-col">
            <span className="text-[12px] md:text-[13px] font-semibold text-[#F1F0E1] tracking-[0.24em] leading-tight uppercase font-[family-name:var(--font-proto)]">
              AETHERSCOPE
            </span>
            <span className="text-[9px] text-[#9A9A92] tracking-[0.16em] leading-none uppercase font-[family-name:var(--font-proto)]">
              DEEP SPACE SPECTRAL NAVIGATOR
            </span>
          </div>
        </div>

        {/* Right Section: Tactical Tools Group & Action Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Central Precision Crosshair Toggle */}
            <button
              onClick={onToggleCrosshair}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] font-[family-name:var(--font-proto)] transition-colors cursor-pointer border ${
                showCrosshair
                  ? "bg-[#506385] text-[#F1F0E1] border-[#506385]"
                  : "bg-transparent text-[#F1F0E1] border-[#3A3A42] hover:bg-[#1A1A1F]"
              }`}
              title="Alternar retícula central de inspección"
            >
              RETÍCULA
            </button>

            {/* Coordinate Grid Toggle */}
            <button
              onClick={onToggleGrid}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] font-[family-name:var(--font-proto)] transition-colors cursor-pointer border ${
                showGrid
                  ? "bg-[#506385] text-[#F1F0E1] border-[#506385]"
                  : "bg-transparent text-[#F1F0E1] border-[#3A3A42] hover:bg-[#1A1A1F]"
              }`}
              title="Alternar rejilla de coordenadas celestes"
            >
              REJILLA
            </button>

            {/* Target Catalog Gallery Toggle */}
            <button
              onClick={onToggleInspector}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] font-[family-name:var(--font-proto)] transition-colors cursor-pointer border ${
                inspectorOpen
                  ? "bg-[#506385] text-[#F1F0E1] border-[#506385]"
                  : "bg-transparent text-[#F1F0E1] border-[#3A3A42] hover:bg-[#1A1A1F]"
              }`}
              title="Abrir catálogo curado de objetos astronómicos"
            >
              CATÁLOGO
            </button>

            {/* Profile Navigation Button (if authenticated and mounted) */}
            {isMounted && user ? (
              <Link
                href="/profile"
                className="px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] font-[family-name:var(--font-proto)] transition-colors cursor-pointer border bg-[#1A1A1F] text-[#F1F0E1] border-[#3A3A42] hover:bg-[#506385] hover:border-[#506385] flex items-center gap-1.5"
                title="Acceder a Mi Perfil y Bitácora Personal"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#506385] group-hover:text-[#F1F0E1]" />
                <span className="hidden md:inline">MI PERFIL</span>
              </Link>
            ) : null}

            {/* Operator Auth Status / Access Button */}
            <button
              onClick={() => setAuthModalOpen(true)}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] font-[family-name:var(--font-proto)] transition-colors cursor-pointer border flex items-center gap-1.5 ${
                isMounted && user
                  ? "bg-[#16222F] text-[#F1F0E1] border-[#506385] hover:bg-[#1E2E3E]"
                  : "bg-transparent text-[#F1F0E1] border-[#3A3A42] hover:bg-[#1A1A1F]"
              }`}
              title={isMounted && user ? `Operador: ${user.email} (Haz clic para gestionar sesión)` : "Iniciar sesión o registrarse"}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isMounted && user ? "bg-[#506385] animate-pulse" : "bg-[#9A9A92]"
                }`}
              />
              <span className="truncate max-w-[80px] sm:max-w-[110px]">
                {isMounted && user ? user.email.split("@")[0].toUpperCase() : "ACCESO"}
              </span>
            </button>
          </div>

          {/* Tactical Fullscreen Button (Bidirectional Double Arrow) */}
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-full bg-[#F1F0E1] text-[#101015] flex items-center justify-center hover:opacity-90 active:scale-95 transition-all cursor-pointer ml-1"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-[#101015]" strokeWidth={2.2} />
            ) : (
              <Maximize2 className="w-4 h-4 text-[#101015]" strokeWidth={2.2} />
            )}
          </button>
        </div>
      </header>

      {/* Operator Authentication & Profile Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  );
}

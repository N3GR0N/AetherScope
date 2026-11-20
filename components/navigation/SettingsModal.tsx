"use client";

import React, { useEffect, useState } from "react";
import { useSpace } from "@/context/SpaceContext";
import { useAuth } from "@/components/auth/AuthProvider";
import { X, Crosshair, Grid, Compass, Maximize2, Minimize2, User as UserIcon } from "lucide-react";
import AuthModal from "@/components/auth/AuthModal";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const space = useSpace();
  const { user } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes y herramientas del instrumental"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-panel-enter"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-[var(--surface-1)] border border-[var(--border)] rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <h3 className="text-[14px] font-semibold text-[var(--text)]">Ajustes del Instrumental</h3>
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] rounded-full hover:bg-[var(--surface-1)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Options */}
          <div className="p-4 space-y-2.5">
            {/* Retícula */}
            <div className="flex items-center justify-between p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="flex items-center gap-3">
                <Crosshair className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <div className="text-[13px] font-medium text-[var(--text)]">Retícula de Precisión</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Punto de mira central para alineación astronómica</div>
                </div>
              </div>
              <button
                onClick={space.toggleCrosshair}
                className={`px-3 py-1 text-[12px] rounded-full transition-colors font-medium cursor-pointer ${
                  space.showCrosshair
                    ? "bg-[var(--accent)] text-[var(--on-accent)] font-semibold"
                    : "bg-[var(--surface-1)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)]"
                }`}
              >
                {space.showCrosshair ? "ACTIVA" : "INACTIVA"}
              </button>
            </div>

            {/* Rejilla */}
            <div className="flex items-center justify-between p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="flex items-center gap-3">
                <Grid className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <div className="text-[13px] font-medium text-[var(--text)]">Rejilla de Coordenadas</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Cuadrícula equatorial J2000.0 proyectada en la esfera celeste</div>
                </div>
              </div>
              <button
                onClick={space.toggleGrid}
                className={`px-3 py-1 text-[12px] rounded-full transition-colors font-medium cursor-pointer ${
                  space.showGrid
                    ? "bg-[var(--accent)] text-[var(--on-accent)] font-semibold"
                    : "bg-[var(--surface-1)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)]"
                }`}
              >
                {space.showGrid ? "ACTIVA" : "INACTIVA"}
              </button>
            </div>

            {/* Catálogo de objetivos */}
            <div className="flex items-center justify-between p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="flex items-center gap-3">
                <Compass className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <div className="text-[13px] font-medium text-[var(--text)]">Catálogo de Objetos</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Galería curada de objetivos celestes y coordenadas</div>
                </div>
              </div>
              <button
                onClick={() => {
                  space.setCatalogOpen(true);
                  onClose();
                }}
                className="px-3 py-1 text-[12px] rounded-full bg-[var(--surface-1)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
              >
                ABRIR
              </button>
            </div>

            {/* Pantalla completa */}
            <div className="flex items-center justify-between p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="flex items-center gap-3">
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-[var(--accent)]" /> : <Maximize2 className="w-4 h-4 text-[var(--accent)]" />}
                <div>
                  <div className="text-[13px] font-medium text-[var(--text)]">Pantalla Completa</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Inmersión completa para navegación astronómica</div>
                </div>
              </div>
              <button
                onClick={toggleFullscreen}
                className="px-3 py-1 text-[12px] rounded-full bg-[var(--surface-1)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
              >
                {isFullscreen ? "SALIR" : "ACTIVAR"}
              </button>
            </div>

            {/* Sesión de Operador */}
            <div className="flex items-center justify-between p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="flex items-center gap-3">
                <UserIcon className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <div className="text-[13px] font-medium text-[var(--text)]">
                    {user ? `Operador: ${user.email?.split("@")[0]}` : "Sesión de Operador"}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {user ? "Sesión activa en AetherScope" : "Acceder para sincronizar bitácora"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-3 py-1 text-[12px] rounded-full bg-[var(--surface-1)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
              >
                {user ? "GESTIONAR" : "ACCEDER"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}

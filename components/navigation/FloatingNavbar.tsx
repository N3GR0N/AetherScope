"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSpace } from "@/context/SpaceContext";
import { useCdsRecovery } from "@/lib/hooks/useCdsRecovery";
import SearchModal from "./SearchModal";
import SettingsModal from "./SettingsModal";
import {
  Compass,
  FlaskConical,
  BookOpen,
  Settings,
  Search,
} from "lucide-react";

interface FloatingNavbarProps {
  onToggleNotes?: () => void;
  isNotesOpen?: boolean;
}

export default function FloatingNavbar({ onToggleNotes, isNotesOpen }: FloatingNavbarProps) {
  const pathname = usePathname();
  const space = useSpace();
  const { cdsState } = useCdsRecovery();

  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Active indicator position state
  const navContainerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number } | null>(
    null
  );

  const isMapActive = pathname === "/";
  const isLabActive = pathname?.startsWith("/analyze");
  const isNotesActive = isNotesOpen || pathname === "/profile";

  // Build coordinate params for Laboratorio link
  const labHref =
    space.currentRa !== undefined && space.currentDec !== undefined && space.currentFov !== undefined
      ? `/analyze?ra=${space.currentRa.toFixed(5)}&dec=${space.currentDec.toFixed(5)}&fov=${space.currentFov.toFixed(4)}`
      : "/analyze";

  // Global ⌘K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Update sliding indicator position
  useEffect(() => {
    if (!navContainerRef.current) return;
    const activeEl = navContainerRef.current.querySelector<HTMLElement>('[data-active="true"]');
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.clientWidth,
      });
    } else {
      setIndicatorStyle(null);
    }
  }, [pathname, isNotesOpen]);

  return (
    <>
      {/* ── Desktop Top Floating Bar (>= 768px) ── */}
      <header className="hidden md:flex fixed top-4 left-6 right-6 z-40 items-center justify-between pointer-events-none select-none">
        {/* Top-Left: Logo Mark + AetherScope Title (NO version number) */}
        <Link
          href="/"
          className="pointer-events-auto flex items-center gap-3 px-3.5 py-2 glass-panel rounded-full hover:bg-[var(--surface-2)] transition-colors min-h-[44px]"
          title="AetherScope — Deep Space Spectral Navigator"
        >
          {/* Logo mark SVG */}
          <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m4.93 4.93 4.24 4.24" />
              <path d="m14.83 9.17 4.24-4.24" />
              <path d="m14.83 14.83 4.24 4.24" />
              <path d="m9.17 14.83-4.24 4.24" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <span className="font-semibold text-[14px] text-[var(--text)] tracking-tight">
            AetherScope
          </span>
        </Link>

        {/* Top-Center: Floating Pill Navbar */}
        <nav
          aria-label="Navegación principal"
          className="pointer-events-auto flex items-center gap-1.5 p-1 glass-panel rounded-full relative min-h-[48px]"
        >
          <div ref={navContainerRef} className="flex items-center gap-1 relative">
            {/* Sliding Pill Indicator (220ms ease-out) */}
            {indicatorStyle && (
              <div
                className="absolute top-0 bottom-0 bg-[var(--accent)] rounded-full transition-[transform,width] duration-[220ms] ease-out pointer-events-none"
                style={{
                  transform: `translateX(${indicatorStyle.left}px)`,
                  width: `${indicatorStyle.width}px`,
                }}
              />
            )}

            {/* 1. Mapa */}
            <Link
              href="/"
              data-active={isMapActive}
              aria-current={isMapActive ? "page" : undefined}
              className={`relative z-10 px-4 py-2 rounded-full text-[13px] font-medium transition-colors min-h-[40px] flex items-center justify-center ${
                isMapActive
                  ? "text-[var(--on-accent)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
              }`}
            >
              Mapa
            </Link>

            {/* 2. Laboratorio */}
            <Link
              href={labHref}
              data-active={isLabActive}
              aria-current={isLabActive ? "page" : undefined}
              className={`relative z-10 px-4 py-2 rounded-full text-[13px] font-medium transition-colors min-h-[40px] flex items-center justify-center ${
                isLabActive
                  ? "text-[var(--on-accent)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
              }`}
            >
              Laboratorio
            </Link>

            {/* 3. Bitácora */}
            <button
              type="button"
              onClick={onToggleNotes}
              data-active={isNotesActive}
              aria-current={isNotesActive ? "true" : undefined}
              className={`relative z-10 px-4 py-2 rounded-full text-[13px] font-medium transition-colors min-h-[40px] flex items-center justify-center cursor-pointer ${
                isNotesActive
                  ? "text-[var(--on-accent)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
              }`}
            >
              Bitácora
            </button>

            {/* 4. Ajustes */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="relative z-10 px-4 py-2 rounded-full text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors min-h-[40px] flex items-center justify-center cursor-pointer"
            >
              Ajustes
            </button>
          </div>

          <div className="h-5 w-[1px] bg-[var(--border)] mx-1" />

          {/* Quick Search Field Trigger (⌘K) */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] text-[12px] min-h-[36px] transition-colors cursor-pointer"
            title="Buscar objeto o coordenadas (⌘K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[12px]">Buscar objetivo...</span>
            <span className="font-mono text-[10px] bg-[var(--surface-1)] border border-[var(--border)] px-1.5 py-0.5 rounded-[4px] text-[var(--text-muted)]">
              ⌘K
            </span>
          </button>
        </nav>

        {/* Top-Right: CDS Status Pill & Settings Icon Button */}
        <div className="pointer-events-auto flex items-center gap-2.5">
          {/* CDS Status Pill */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 glass-panel rounded-full text-[12px] min-h-[40px]"
            title={
              cdsState === "ok"
                ? "Servicios CDS Estrasburgo y SIMBAD en línea"
                : cdsState === "down"
                ? "Servicios CDS Estrasburgo fuera de línea"
                : "Verificando enlace astronómico CDS..."
            }
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                cdsState === "ok"
                  ? "bg-[var(--ok)]"
                  : cdsState === "down"
                  ? "bg-[var(--error)]"
                  : "bg-[var(--accent)] animate-pulse"
              }`}
            />
            <span className="text-[12px] text-[var(--text)] font-medium">
              {cdsState === "ok" ? "CDS OK" : cdsState === "down" ? "CDS OFFLINE" : "CDS CHECK"}
            </span>
          </div>

          {/* Settings Trigger Icon Button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            title="Ajustes y herramientas del visor"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Mobile Top Search Bar (< 768px) ── */}
      <div className="md:hidden fixed top-3 left-3 right-3 z-40 flex items-center gap-2 pointer-events-auto">
        <Link
          href="/"
          className="w-10 h-10 rounded-full glass-panel flex items-center justify-center shrink-0 bg-[var(--surface-1)]"
          title="AetherScope"
        >
          <div className="w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3 h-3"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
        </Link>

        {/* Mobile Search Input trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex-1 glass-panel rounded-full px-3.5 py-2 flex items-center justify-between text-[13px] text-[var(--text-muted)] min-h-[40px] cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span>Buscar objetivo cósmico...</span>
          </div>
          <span className="w-2 h-2 rounded-full shrink-0 ml-1">
            <span
              className={`block w-2 h-2 rounded-full ${
                cdsState === "ok" ? "bg-[var(--ok)]" : "bg-[var(--error)]"
              }`}
            />
          </span>
        </button>

        <button
          onClick={() => setSettingsOpen(true)}
          className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-[var(--text-muted)] shrink-0 cursor-pointer"
          title="Ajustes"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* ── Mobile Bottom Floating Pill Navbar (< 768px) ── */}
      <nav
        aria-label="Navegación móvil"
        className="md:hidden fixed bottom-4 left-4 right-4 z-40 p-1.5 glass-panel rounded-full flex items-center justify-around shadow-[0_8px_24px_rgba(0,0,0,0.35)] pointer-events-auto"
      >
        <Link
          href="/"
          aria-current={isMapActive ? "page" : undefined}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-full text-[11px] font-medium min-h-[40px] transition-colors ${
            isMapActive
              ? "bg-[var(--accent)] text-[var(--on-accent)] font-semibold"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Mapa</span>
        </Link>

        <Link
          href={labHref}
          aria-current={isLabActive ? "page" : undefined}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-full text-[11px] font-medium min-h-[40px] transition-colors ${
            isLabActive
              ? "bg-[var(--accent)] text-[var(--on-accent)] font-semibold"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>Laboratorio</span>
        </Link>

        <button
          type="button"
          onClick={onToggleNotes}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-full text-[11px] font-medium min-h-[40px] transition-colors cursor-pointer ${
            isNotesActive
              ? "bg-[var(--accent)] text-[var(--on-accent)] font-semibold"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Bitácora</span>
        </button>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-full text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] min-h-[40px] transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span>Ajustes</span>
        </button>
      </nav>

      {/* Modals */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

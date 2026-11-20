"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { COSMIC_TARGETS, type CosmicTarget } from "@/lib/astronomy/targets";
import { useSpace } from "@/context/SpaceContext";
import { Search, X, Telescope, Compass, ArrowRight } from "lucide-react";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { navigateToTarget, getAladinInstance } = useSpace();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setTimeout(() => setQuery(""), 0);
    }
  }, [isOpen]);

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredTargets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COSMIC_TARGETS.slice(0, 6);
    return COSMIC_TARGETS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.constellation.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [query]);

  // Check if query is coordinates "ra, dec" or "ra dec"
  const parsedCoords = useMemo(() => {
    const parts = query.trim().split(/[\s,]+/);
    if (parts.length === 2) {
      const ra = parseFloat(parts[0]);
      const dec = parseFloat(parts[1]);
      if (!isNaN(ra) && !isNaN(dec) && ra >= 0 && ra <= 360 && dec >= -90 && dec <= 90) {
        return { ra, dec };
      }
    }
    return null;
  }, [query]);

  if (!isOpen) return null;

  const handleSelectTarget = (target: CosmicTarget) => {
    navigateToTarget(target);
    onClose();
  };

  const handleGoToCoords = () => {
    if (!parsedCoords) return;
    const aladin = getAladinInstance();
    if (aladin?.gotoRaDec) {
      aladin.gotoRaDec(parsedCoords.ra, parsedCoords.dec);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buscar objetos cósmicos o coordenadas"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-xs select-none animate-panel-enter"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--surface-1)] border border-[var(--border)] rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <Search className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, catálogo (M104, NGC), constelación o RA, Dec..."
            className="w-full bg-transparent text-[var(--text)] placeholder:text-[var(--text-muted)] text-[14px] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded-[6px] bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-muted)]">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-[360px] overflow-y-auto p-2 space-y-1">
          {parsedCoords && (
            <button
              onClick={handleGoToCoords}
              className="w-full text-left p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--accent)] hover:opacity-90 flex items-center justify-between text-[13px] text-[var(--text)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-[var(--accent)]" />
                <span>Navegar a coordenadas: <strong className="font-mono tabular-nums">{parsedCoords.ra.toFixed(4)}°, {parsedCoords.dec.toFixed(4)}°</strong></span>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--accent)]" />
            </button>
          )}

          {filteredTargets.length > 0 ? (
            filteredTargets.map((target) => (
              <button
                key={target.id}
                onClick={() => handleSelectTarget(target)}
                className="w-full text-left p-3 rounded-[12px] hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--border)] flex items-center justify-between text-[13px] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--accent)]">
                    <Telescope className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
                      {target.name}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {target.constellation} · {target.distance}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)] block">
                    {target.ra} · {target.dec}
                  </span>
                  <span className="text-[10px] uppercase text-[var(--text-muted)]">
                    {target.category}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="py-8 text-center text-[var(--text-muted)] text-[13px]">
              No se encontraron objetos astronómicos para &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

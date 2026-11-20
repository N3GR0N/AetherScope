"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSpace } from "@/context/SpaceContext";
import { getNotesRepository, type MissionNote } from "@/lib/notes";
import { matchLocalDossierCapture } from "@/lib/astronomy/crossmatch";
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal";
import {
  X,
  BookOpen,
  Trash2,
  Download,
  Upload,
  Layers,
  Send,
  Loader2,
} from "lucide-react";

interface MissionNotesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MissionNotesPanel({ isOpen, onClose }: MissionNotesPanelProps) {
  const space = useSpace();
  const { currentRa, currentDec, currentFov, primarySurvey } = space;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState<MissionNote[]>([]);
  const [newNoteBody, setNewNoteBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const notesRepo = getNotesRepository();

  const localMatchResult = matchLocalDossierCapture({
    raDeg: currentRa,
    decDeg: currentDec,
    radiusDeg: currentFov / 2,
  });
  const localMatch = localMatchResult?.object ?? null;

  const currentCapture = {
    raDeg: currentRa,
    decDeg: currentDec,
    radiusDeg: currentFov / 2,
  };

  const loadNotes = async () => {
    try {
      const list = await notesRepo.listForCapture(currentCapture, localMatchResult);
      setNotes(list);
    } catch (err) {
      console.warn("[AetherScope] Error cargando notas en panel:", err);
    }
  };

  useEffect(() => {
    let active = true;
    if (isOpen) {
      notesRepo
        .listForCapture(
          { raDeg: currentRa, decDeg: currentDec, radiusDeg: currentFov / 2 },
          localMatchResult
        )
        .then((list) => {
          if (active) setNotes(list);
        })
        .catch((err) => {
          console.warn("[AetherScope] Error cargando notas en panel:", err);
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen, currentRa, currentDec, currentFov, notesRepo, localMatchResult]);

  if (!isOpen) return null;

  const handleSaveNote = async () => {
    if (!newNoteBody.trim()) return;
    setIsSaving(true);
    try {
      await notesRepo.create({
        objectId: localMatch?.id || null,
        objectName: localMatch?.name || "Sector de Cielo Profundo",
        raDeg: currentRa,
        decDeg: currentDec,
        radiusDeg: currentFov / 2,
        body: newNoteBody.trim(),
      });
      setNewNoteBody("");
      await loadNotes();
    } catch (err) {
      console.warn("[AetherScope] Error guardando nota:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await notesRepo.remove(deleteId);
      setDeleteId(null);
      await loadNotes();
    } catch (err) {
      console.warn("[AetherScope] Error eliminando nota:", err);
    }
  };

  const handleExport = async () => {
    try {
      const json = await notesRepo.exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aetherscope-bitacora-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("[AetherScope] Error exportando bitácora:", err);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await notesRepo.importAll(text);
      await loadNotes();
    } catch (err) {
      console.warn("[AetherScope] Error importando bitácora:", err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <aside
        aria-label="Panel de Bitácora de Misión y Espectro"
        className="fixed top-16 left-3 right-3 md:left-auto md:right-6 md:top-20 z-40 md:w-[380px] pointer-events-auto select-none animate-panel-enter"
      >
        <div className="solid-card p-5 max-h-[calc(100vh-120px)] flex flex-col gap-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-[14px] font-semibold text-[var(--text)]">Bitácora de Misión</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Spectral Preview Block */}
          <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Capa Espectral Activa</span>
              </span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                {primarySurvey?.agency || "CDS / ESA"}
              </span>
            </div>
            <div className="text-[13px] font-medium text-[var(--text)]">
              {primarySurvey?.name || "DSS2 Óptico Color"}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono">
              {primarySurvey?.wavelengthBand || "Espectro Visible (Luz Óptica)"}
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[140px] max-h-[220px] pr-1">
            {notes.length > 0 ? (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span className="font-mono tabular-nums">
                      {new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => setDeleteId(note.id)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors cursor-pointer"
                      title="Eliminar nota"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[12px] text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                    {note.body}
                  </p>
                  <div className="text-[10px] font-mono tabular-nums text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
                    {note.raDeg.toFixed(4)}°, {note.decDeg.toFixed(4)}° · {note.objectName || "Sector libre"}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-[var(--text-muted)] text-[12px]">
                Sin observaciones registradas para este sector.
              </div>
            )}
          </div>

          {/* New Note Textarea & Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border)]">
            <textarea
              value={newNoteBody}
              onChange={(e) => setNewNoteBody(e.target.value)}
              placeholder="Escribe una observación astrofísica para este sector..."
              rows={2}
              className="w-full bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-muted)] border border-[var(--border)] rounded-[12px] p-2.5 text-[12px] focus:outline-none focus:border-[var(--border-strong)] resize-none"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExport}
                  className="p-2 rounded-[8px] hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                  title="Exportar bitácora a JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-[8px] hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                  title="Importar notas desde JSON"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImport}
                  className="hidden"
                />
              </div>

              <button
                type="button"
                disabled={!newNoteBody.trim() || isSaving}
                onClick={handleSaveNote}
                className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-[12px] flex items-center gap-1.5 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Guardar nota</span>
              </button>
            </div>

            <div className="text-[10px] text-[var(--text-muted)] text-center pt-1">
              Modo local · Notas almacenadas en este navegador
            </div>
          </div>
        </div>
      </aside>

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteId)}
        title="Eliminar observación"
        description="¿Estás seguro de que deseas eliminar esta nota de la bitácora? Esta acción no se puede deshacer."
        confirmLabel="Eliminar nota"
        cancelLabel="Cancelar"
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

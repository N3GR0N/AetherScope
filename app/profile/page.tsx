"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getNotesRepository, type MissionNote } from "@/lib/notes";
import { COSMIC_TARGETS, type CosmicTarget, getTargetDecimalCoords } from "@/lib/astronomy/targets";
import { formatCoordinates, getConstellation } from "@/lib/astronomy/coordinates";
import { getSupabaseClient } from "@/lib/supabase/client";
import { CelestialAvatar, generateRandomSeed } from "@/lib/auth/avatarGenerator";
import { validatePasswordSecurity } from "@/lib/auth/supabaseAuthService";
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal";
import {
  ArrowLeft,
  RefreshCw,
  User,
  KeyRound,
  ShieldCheck,
  Telescope,
  Atom,
  Compass,
  FileText,
  Clock,
  ExternalLink,
  Lock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Layers,
  Trash2,
} from "lucide-react";

interface ObservedObjectSummary {
  id: string;
  name: string;
  categoryLabel: string;
  constellation: string;
  distance: string;
  formation: string;
  detectedElements: string[];
  sizeDisplay: string;
  raDeg: number;
  decDeg: number;
  fovDeg: number;
  notes: MissionNote[];
}

function formatCooldown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut, loading: authLoading } = useAuth();
  const notesRepo = useMemo(() => getNotesRepository(), []);

  // 1. Estado de notas y objetos observados
  const [userNotes, setUserNotes] = useState<MissionNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // 2. Estado de avatar generativo (inicialización perezosa)
  const [avatarSeed, setAvatarSeed] = useState<string>(() => {
    if (typeof window === "undefined" || !user) return "OP-INIT";
    try {
      const saved = window.localStorage.getItem(`aetherscope:avatar:${user.id}`);
      if (saved) return saved;
      const initialSeed = user.email ? `OP-${user.email.slice(0, 4).toUpperCase()}` : generateRandomSeed();
      window.localStorage.setItem(`aetherscope:avatar:${user.id}`, initialSeed);
      return initialSeed;
    } catch {
      return "OP-INIT";
    }
  });

  // 3. Estado de cambio de contraseña con intervalo de 5 minutos por usuario
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  // Reloj de actualización cada segundo para derivar el temporizador sin desincronizaciones
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cálculo derivado puro del tiempo de espera para el usuario activo (evita bloqueos cruzados)
  const cooldownSeconds = useMemo(() => {
    if (typeof window === "undefined" || !user?.id) return 0;
    try {
      const raw = window.localStorage.getItem(`aetherscope:pwd_change:${user.id}`);
      if (!raw) return 0;
      const elapsedMs = currentTime - parseInt(raw, 10);
      const remainingMs = 5 * 60 * 1000 - elapsedMs; // 5 minutos exactos
      return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
    } catch {
      return 0;
    }
  }, [user, currentTime]);

  // 4. Estado para definir nueva contraseña en modo recuperación / confirmación
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.location.hash.includes("type=recovery");
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Si se ingresó a /profile con tokens o código de recuperación (ej. enlaces de correos anteriores),
  // redirigir inmediatamente a la interfaz dedicada /reset-password preservando parámetros
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search;
    const hash = window.location.hash;
    const hasRecovery =
      search.includes("code=") ||
      search.includes("recovery=true") ||
      search.includes("mode=recovery") ||
      hash.includes("type=recovery") ||
      hash.includes("access_token=");

    if (hasRecovery) {
      router.replace(`/reset-password${search}${hash}`);
    }
  }, [router]);



  // 5. Estado de confirmación para modal estilizado de eliminación
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: "note" | "object";
    title: string;
    description: string;
    targetName?: string;
    noteId?: string;
    objectSummary?: ObservedObjectSummary;
    isProcessing?: boolean;
  }>({
    isOpen: false,
    type: "note",
    title: "",
    description: "",
  });

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Redirigir a inicio si no está autenticado tras cargar
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  // Cargar notas del usuario
  useEffect(() => {
    let active = true;
    if (!user) return;

    notesRepo
      .list()
      .then((notes) => {
        if (active) {
          setUserNotes(notes);
          setNotesLoading(false);
        }
      })
      .catch((err) => {
        console.warn("[AetherScope] Error cargando notas del perfil:", err);
        if (active) {
          setNotesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [notesRepo, user]);


  // Agrupar las notas por objeto observado y construir fichas técnicas
  const observedObjects: ObservedObjectSummary[] = useMemo(() => {
    if (!userNotes.length) return [];

    const map = new Map<string, MissionNote[]>();

    userNotes.forEach((note) => {
      const key = note.objectId || `${note.raDeg.toFixed(2)},${note.decDeg.toFixed(2)}`;
      const existing = map.get(key) || [];
      existing.push(note);
      map.set(key, existing);
    });

    const result: ObservedObjectSummary[] = [];

    map.forEach((notesForObj, key) => {
      const firstNote = notesForObj[0];
      const matchedTarget = COSMIC_TARGETS.find(
        (t) => t.id === firstNote.objectId || t.id === key
      );

      if (matchedTarget) {
        const coords = getTargetDecimalCoords(matchedTarget);
        result.push({
          id: matchedTarget.id,
          name: matchedTarget.name,
          categoryLabel: getCategoryLabel(matchedTarget.category),
          constellation: matchedTarget.constellation,
          distance: matchedTarget.distance,
          formation: matchedTarget.description,
          detectedElements: matchedTarget.spectroscopy.detectedElements,
          sizeDisplay: matchedTarget.majorDiameterArcmin
            ? `${matchedTarget.majorDiameterArcmin}′ × ${matchedTarget.minorDiameterArcmin || matchedTarget.majorDiameterArcmin}′`
            : "Extensión difusa",
          raDeg: coords.raDeg,
          decDeg: coords.decDeg,
          fovDeg: matchedTarget.fov,
          notes: notesForObj,
        });
      } else {
        const constell = getConstellation(firstNote.raDeg, firstNote.decDeg);
        const name = firstNote.objectName || `Sector RA ${firstNote.raDeg.toFixed(2)}° Dec ${firstNote.decDeg.toFixed(2)}°`;
        result.push({
          id: key,
          name,
          categoryLabel: "SECTOR DE CIELO PROFUNDO",
          constellation: constell,
          distance: "Dispersión fotométrica galáctica",
          formation: "Estructura de campo profundo y emisión estelar de fondo continua.",
          detectedElements: ["H I (21cm)", "He II", "Polvo interestelar", "Continuo estelar"],
          sizeDisplay: `${(firstNote.radiusDeg * 120).toFixed(1)}′ (FOV de captura)`,
          raDeg: firstNote.raDeg,
          decDeg: firstNote.decDeg,
          fovDeg: firstNote.radiusDeg * 2,
          notes: notesForObj,
        });
      }
    });

    return result;
  }, [userNotes]);

  // Selección activa derivada
  const activeSelectedId = selectedObjectId || (observedObjects.length > 0 ? observedObjects[0].id : null);
  const selectedObject = useMemo(() => {
    return observedObjects.find((o) => o.id === activeSelectedId) || observedObjects[0] || null;
  }, [observedObjects, activeSelectedId]);

  // Generar nuevo avatar aleatorio
  const handleGenerateRandomAvatar = () => {
    if (!user) return;
    const newSeed = generateRandomSeed();
    setAvatarSeed(newSeed);
    try {
      window.localStorage.setItem(`aetherscope:avatar:${user.id}`, newSeed);
    } catch {
      // Best-effort
    }
  };

  // Solicitar cambio de contraseña por correo con intervalo de 5 minutos
  const handleRequestPasswordReset = async () => {
    if (!user?.email || !user?.id) return;

    if (cooldownSeconds > 0) {
      setPasswordMsg({
        type: "error",
        text: `Restricción de seguridad activa: Podrás solicitar otro correo en ${formatCooldown(cooldownSeconds)}.`,
      });
      return;
    }

    setPasswordLoading(true);
    setPasswordMsg(null);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error("Cliente Supabase no configurado.");
      }

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw new Error(error.message);
      }

      const now = Date.now();
      try {
        window.localStorage.setItem(`aetherscope:pwd_change:${user.id}`, now.toString());
      } catch {
        // Best-effort
      }
      setCurrentTime(now);

      setPasswordMsg({
        type: "success",
        text: `Se ha enviado un enlace de confirmación a ${user.email}. Revisa tu bandeja de entrada para completar el cambio seguro.`,
      });
    } catch (err) {
      let message = err instanceof Error ? err.message : "Error al solicitar restablecimiento.";
      if (message.toLowerCase().includes("rate limit") || message.toLowerCase().includes("rate_limit")) {
        message = "Límite de envíos alcanzado en el servidor de correo (protección anti-spam de Supabase). Por favor, aguarda unos minutos antes de solicitar otro email.";
      }
      setPasswordMsg({ type: "error", text: message });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Guardar nueva contraseña confirmada
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateMsg(null);

    const validation = validatePasswordSecurity(newPassword);
    if (!validation.valid) {
      setUpdateMsg({ type: "error", text: validation.reason || "Contraseña no válida." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setUpdateMsg({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }

    setUpdatingPassword(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Cliente Supabase no configurado.");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);

      setUpdateMsg({
        type: "success",
        text: "Contraseña actualizada exitosamente. Tu cuenta está protegida.",
      });
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsRecoveryMode(false);
      }, 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al actualizar la contraseña.";
      setUpdateMsg({ type: "error", text: message });
    } finally {
      setUpdatingPassword(false);
    }
  };

  // 6. Solicitud y confirmación de eliminación con modal técnico estilizado
  const requestDeleteNote = (note: MissionNote) => {
    const snippet = note.body.length > 55 ? `${note.body.slice(0, 55)}...` : note.body;
    setDeleteModalState({
      isOpen: true,
      type: "note",
      title: "ELIMINAR OBSERVACIÓN INDIVIDUAL",
      description: "¿Deseas eliminar permanentemente esta observación de tu bitácora de misión?",
      targetName: `"${snippet}"`,
      noteId: note.id,
      isProcessing: false,
    });
  };

  const requestDeleteObject = (objectSummary: ObservedObjectSummary) => {
    const count = objectSummary.notes.length;
    setDeleteModalState({
      isOpen: true,
      type: "object",
      title: "ELIMINAR OBJETO DEL CATÁLOGO",
      description: `¿Confirmas la remoción de este cuerpo celeste del catálogo? Se purgarán definitivamente las ${count} ${
        count === 1 ? "observación registrada" : "observaciones registradas"
      } en este objeto.`,
      targetName: objectSummary.name,
      objectSummary,
      isProcessing: false,
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteModalState.type === "note" && deleteModalState.noteId) {
      setDeleteModalState((s) => ({ ...s, isProcessing: true }));
      try {
        await notesRepo.remove(deleteModalState.noteId);
        setUserNotes((prev) => prev.filter((n) => n.id !== deleteModalState.noteId));
        setDeleteModalState((s) => ({ ...s, isOpen: false, isProcessing: false }));
      } catch (err: unknown) {
        console.warn("[AetherScope] Error eliminando nota:", err);
        setDeleteModalState((s) => ({ ...s, isProcessing: false }));
      }
    } else if (deleteModalState.type === "object" && deleteModalState.objectSummary) {
      setDeleteModalState((s) => ({ ...s, isProcessing: true }));
      try {
        const noteIds = deleteModalState.objectSummary.notes.map((n) => n.id);
        await notesRepo.removeMany(noteIds);
        setUserNotes((prev) => prev.filter((n) => !noteIds.includes(n.id)));
        if (selectedObjectId === deleteModalState.objectSummary.id) {
          setSelectedObjectId(null);
        }
        setDeleteModalState((s) => ({ ...s, isOpen: false, isProcessing: false }));
      } catch (err: unknown) {
        console.warn("[AetherScope] Error eliminando elemento:", err);
        setDeleteModalState((s) => ({ ...s, isProcessing: false }));
      }
    }
  };

  function getCategoryLabel(category: CosmicTarget["category"]): string {
    switch (category) {
      case "nebula":
        return "NEBULOSA DE EMISIÓN / H II";
      case "galaxy":
        return "GALAXIA ESPIRAL";
      case "deep-field":
        return "CAMPO PROFUNDO / LENTE";
      case "black-hole":
        return "OBJETO COMPACTO / AGUJERO NEGRO";
      default:
        return "OBJETO CÓSMICO";
    }
  }

  if (authLoading || !user) {
    return (
      <div className="w-screen h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--text)] font-[family-name:var(--font-sans)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[var(--text-muted)]">
            Verificando identidad de operador...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[var(--bg)] text-[var(--text)] select-none font-[family-name:var(--font-sans)] flex flex-col overflow-hidden">
      {/* ─── 1. Header de Navegación ─── */}
      <header className="h-16 bg-[var(--surface-1)] border-b border-[var(--border)] px-4 md:px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-1)] text-[var(--text)] text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer min-h-[36px]"
            title="Regresar a la visualización celeste libre"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Volver al mapa</span>
          </Link>

          <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="text-[var(--border-strong)]">/</span>
            <span className="text-[var(--text)] font-semibold">AetherScope</span>
            <span className="text-[var(--border-strong)]">/</span>
            <span>Perfil de operador y bitácora</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => signOut()}
            className="px-3.5 py-1.5 rounded-full border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--surface-2)] hover:bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
          >
            <LogOut className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      {/* ─── 2. Contenido Principal del Perfil ─── */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 overflow-y-auto">
        {/* COLUMNA IZQUIERDA: Tarjeta de Operador y Seguridad (4 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-5">
          {/* Tarjeta de Avatar y Credenciales */}
          <div className="solid-card rounded-[20px] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex flex-col items-center gap-4">
            {/* Avatar Procedural */}
            <div className="relative group">
              <CelestialAvatar seed={avatarSeed} size={130} />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--surface-1)] border border-[var(--accent)] flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
              </div>
            </div>

            {/* Botón Generador Aleatorio */}
            <button
              onClick={handleGenerateRandomAvatar}
              className="w-full py-2 px-4 rounded-full border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--surface-2)] hover:bg-[var(--surface-1)] text-[var(--text)] text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[40px]"
              title="Generar nueva firma astronómica procedural"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Generar avatar aleatorio</span>
            </button>

            {/* Datos del Operador */}
            <div className="w-full space-y-2.5 pt-3 border-t border-[var(--border)]">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                  <User className="w-3 h-3 text-[var(--accent)]" />
                  <span>Identificador de operador</span>
                </span>
                <span className="text-xs font-mono text-[var(--text)] break-all">{user.email}</span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                  UID EN BASE DE DATOS
                </span>
                <span className="text-[10px] font-mono text-[var(--text-muted)] break-all">{user.id}</span>
              </div>

              <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-muted)] flex items-start gap-2 leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                <span>
                  Row Level Security activa: cada observación está protegida bajo tu identificador de operador.
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta de Seguridad: Cambio de Contraseña */}
          <div className="solid-card rounded-[20px] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex flex-col gap-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text)] pb-2 border-b border-[var(--border)]">
              <KeyRound className="w-4 h-4 text-[var(--accent)]" />
              <span>Seguridad y contraseña</span>
            </div>

            {isRecoveryMode ? (
              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                  <span>Enlace de recuperación autenticado. Establece tu nueva credencial de acceso.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-muted)]">
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres, 1 mayúscula"
                    maxLength={128}
                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] px-3.5 py-2.5 rounded-[12px] text-xs text-[var(--text)] outline-none font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-muted)]">
                    Confirmar contraseña
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    maxLength={128}
                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] px-3.5 py-2.5 rounded-[12px] text-xs text-[var(--text)] outline-none font-mono"
                    required
                  />
                </div>

                {updateMsg && (
                  <div
                    className={`p-3 rounded-[12px] border text-xs flex items-start gap-2 ${
                      updateMsg.type === "success"
                        ? "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
                        : "bg-[var(--surface-2)] border-[var(--error)] text-[var(--error)]"
                    }`}
                  >
                    {updateMsg.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--ok)] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />
                    )}
                    <span>{updateMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="w-full py-2.5 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[40px]"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{updatingPassword ? "Actualizando..." : "Guardar nueva contraseña"}</span>
                </button>
              </form>
            ) : (
              <>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Por protocolo de seguridad, las solicitudes de restablecimiento de contraseña tienen un intervalo de espera de 5 minutos entre intentos.
                </p>

                {/* Advertencia de tiempo restante si aplica */}
                {cooldownSeconds > 0 ? (
                  <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] flex items-start gap-2.5 text-xs text-[var(--text-muted)]">
                    <Lock className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-[var(--text)] font-semibold text-xs">
                        Intervalo de seguridad activo (5 min)
                      </div>
                      <div>
                        Próxima solicitud habilitada en{" "}
                        <span className="text-[var(--accent)] font-mono font-bold">
                          {formatCooldown(cooldownSeconds)}
                        </span>.
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Mensajes de feedback */}
                {passwordMsg && (
                  <div
                    className={`p-3 rounded-[12px] border text-xs flex items-start gap-2 ${
                      passwordMsg.type === "success"
                        ? "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
                        : "bg-[var(--surface-2)] border-[var(--error)] text-[var(--error)]"
                    }`}
                  >
                    {passwordMsg.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--ok)] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />
                    )}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <button
                  onClick={handleRequestPasswordReset}
                  disabled={passwordLoading || cooldownSeconds > 0}
                  className="w-full py-2.5 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted)] text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[40px] disabled:cursor-not-allowed"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>
                    {cooldownSeconds > 0
                      ? `Esperar (${formatCooldown(cooldownSeconds)})`
                      : passwordLoading
                      ? "Enviando correo..."
                      : "Solicitar cambio por email"}
                  </span>
                </button>
              </>
            )}
          </div>
        </section>

        {/* COLUMNA DERECHA: Catálogo Personal de Objetos Observados (8 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-5">
          <div className="solid-card rounded-[20px] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <Telescope className="w-4 h-4 text-[var(--accent)]" />
                <h2 className="text-xs font-semibold text-[var(--text)]">
                  Catálogo personal de observaciones
                </h2>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] font-mono text-[var(--text-muted)]">
                {observedObjects.length} {observedObjects.length === 1 ? "objeto" : "objetos"}
              </span>
            </div>

            {notesLoading ? (
              <div className="py-16 text-center text-xs text-[var(--text-muted)]">
                Cargando bitácora de observaciones...
              </div>
            ) : observedObjects.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <FileText className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-60" />
                <p className="text-xs text-[var(--text-muted)]">
                  Aún no has registrado notas de observación en ningún sector celeste.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold transition-colors min-h-[40px]"
                >
                  <Telescope className="w-3.5 h-3.5" />
                  <span>Explorar el mapa celeste</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 flex-1">
                {/* Lista de Objetos (5 cols) */}
                <div className="md:col-span-5 space-y-2 max-h-[260px] md:max-h-[580px] overflow-y-auto pr-1">
                  {observedObjects.map((obj) => {
                    const isSelected = obj.id === activeSelectedId;
                    return (
                      <div
                        key={obj.id}
                        onClick={() => setSelectedObjectId(obj.id)}
                        className={`w-full text-left p-3 rounded-[12px] border transition-colors flex flex-col gap-1.5 cursor-pointer ${
                          isSelected
                            ? "bg-[var(--surface-2)] border-[var(--accent)] text-[var(--text)]"
                            : "bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold truncate max-w-[160px] text-[var(--text)]">
                            {obj.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)]">
                              {obj.notes.length} {obj.notes.length === 1 ? "nota" : "notas"}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeleteObject(obj);
                              }}
                              className="w-6 h-6 rounded-full hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--error)] flex items-center justify-center transition-colors cursor-pointer"
                              title={`Eliminar "${obj.name}" y todas sus notas`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)]">
                          <span>{obj.constellation}</span>
                          <span>•</span>
                          <span>{formatCoordinates(obj.raDeg, obj.decDeg).raHms}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Panel de Detalle y Comparativa Astrofísica (7 cols) */}
                {selectedObject && (
                  <div className="md:col-span-7 flex flex-col gap-4 p-4 rounded-[16px] bg-[var(--surface-2)] border border-[var(--border)] overflow-hidden">
                    {/* Encabezado del Objeto */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[var(--border)]">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-[var(--accent)] font-medium truncate">
                          {selectedObject.categoryLabel}
                        </div>
                        <h3 className="text-base font-semibold text-[var(--text)] break-words">
                          {selectedObject.name}
                        </h3>
                        <div className="text-xs text-[var(--text-muted)] font-mono truncate">
                          Constelación: {selectedObject.constellation} · Distancia: {selectedObject.distance}
                        </div>
                      </div>

                      {/* Acciones del Objeto: Analizar y Eliminar */}
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                        <Link
                          href={`/analyze?ra=${selectedObject.raDeg.toFixed(5)}&dec=${selectedObject.decDeg.toFixed(5)}&fov=${selectedObject.fovDeg.toFixed(3)}`}
                          className="px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                          title="Ir a analizar este objeto con el espectrógrafo del Laboratorio"
                        >
                          <Telescope className="w-3.5 h-3.5" />
                          <span>Analizar</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => requestDeleteObject(selectedObject)}
                          className="px-3 py-1.5 rounded-full bg-[var(--surface-1)] border border-[var(--error)] text-[var(--error)] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                          title={`Eliminar "${selectedObject.name}" y todas sus notas`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>

                    {/* Ficha Astrofísica Comparativa */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      {/* Formación Cósmica */}
                      <div className="p-3 rounded-[12px] bg-[var(--surface-1)] border border-[var(--border)] flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--accent)] font-medium">
                          <Layers className="w-3 h-3" />
                          <span>Formación</span>
                        </div>
                        <p className="text-xs text-[var(--text)] leading-relaxed">
                          {selectedObject.formation}
                        </p>
                      </div>

                      {/* Extensión y Dimensiones */}
                      <div className="p-3 rounded-[12px] bg-[var(--surface-1)] border border-[var(--border)] flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--accent)] font-medium">
                          <Compass className="w-3 h-3" />
                          <span>Dimensión</span>
                        </div>
                        <p className="text-xs text-[var(--text)] font-mono leading-relaxed">
                          {selectedObject.sizeDisplay}
                        </p>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {selectedObject.raDeg.toFixed(3)}°, {selectedObject.decDeg.toFixed(3)}°
                        </span>
                      </div>

                      {/* Composición Química Espectral */}
                      <div className="sm:col-span-2 p-3 rounded-[12px] bg-[var(--surface-1)] border border-[var(--border)] flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--accent)] font-medium">
                          <Atom className="w-3 h-3" />
                          <span>Composición química y líneas espectrales</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedObject.detectedElements.map((el, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-[8px] bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] font-mono"
                            >
                              {el}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bitácora de Observaciones Personales para este Objeto */}
                    <div className="flex-1 flex flex-col gap-2 pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
                          <span>Notas registradas ({selectedObject.notes.length})</span>
                        </span>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedObject.notes.map((note) => (
                          <div
                            key={note.id}
                            className="p-3 rounded-[12px] bg-[var(--surface-1)] border border-[var(--border)] flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="flex-1 space-y-1 min-w-0">
                              <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
                                <Clock className="w-3 h-3 text-[var(--accent)]" />
                                <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>
                                  {new Date(note.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text)] leading-relaxed break-words">
                                {note.body}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => requestDeleteNote(note)}
                              className="w-7 h-7 rounded-full hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--error)] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                              title="Eliminar esta observación"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Modal Técnico de Confirmación de Eliminación */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        title={deleteModalState.title}
        description={deleteModalState.description}
        targetName={deleteModalState.targetName}
        isProcessing={deleteModalState.isProcessing}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModalState((s) => ({ ...s, isOpen: false }))}
      />
    </div>
  );
}

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

  // 3. Estado de cambio de contraseña
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [daysUntilNextChange, setDaysUntilNextChange] = useState<number>(() => {
    if (typeof window === "undefined" || !user) return 0;
    try {
      const raw = window.localStorage.getItem(`aetherscope:pwd_change:${user.id}`);
      if (!raw) return 0;
      const diffMs = new Date().getTime() - parseInt(raw, 10);
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays < 30 ? Math.ceil(30 - diffDays) : 0;
    } catch {
      return 0;
    }
  });

  // 4. Estado para definir nueva contraseña en modo recuperación / confirmación
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.location.hash.includes("type=recovery");
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  // Solicitar cambio de contraseña por correo con restricción de 30 días
  const handleRequestPasswordReset = async () => {
    if (!user?.email) return;

    if (daysUntilNextChange > 0) {
      setPasswordMsg({
        type: "error",
        text: `Restricción de seguridad activa: Podrás solicitar otro cambio de contraseña en ${daysUntilNextChange} días.`,
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
        redirectTo: `${window.location.origin}/profile`,
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
      setDaysUntilNextChange(30);

      setPasswordMsg({
        type: "success",
        text: `Se ha enviado un enlace de confirmación a ${user.email}. Revisa tu bandeja de entrada para completar el cambio seguro.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al solicitar restablecimiento.";
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
      <div className="w-screen h-screen bg-[#101015] flex items-center justify-center text-[#F1F0E1] font-[family-name:var(--font-proto)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#506385] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs uppercase tracking-[0.2em] text-[#9A9A92]">
            VERIFICANDO IDENTIDAD DE OPERADOR...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#101015] text-[#F1F0E1] select-none font-[family-name:var(--font-proto)] flex flex-col overflow-hidden">
      {/* ─── 1. Header de Navegación ─── */}
      <header className="h-14 bg-[#17171C] border-b border-[#2B2B31] px-3 sm:px-4 md:px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-4">
          <Link
            href="/"
            className="px-2.5 sm:px-3 py-1.5 border border-[#3A3A42] bg-transparent hover:bg-[#1A1A1F] text-[#F1F0E1] text-[10.5px] sm:text-[11px] uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer"
            title="Regresar a la visualización celeste libre"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#506385]" />
            <span>VOLVER AL MAPA</span>
          </Link>

          <div className="hidden sm:flex items-center gap-2 text-[10px] text-[#9A9A92] uppercase tracking-[0.18em]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/favicon.ico"
              alt="AetherScope"
              className="w-4 h-4 shrink-0 object-contain"
            />
            <span>AETHERSCOPE</span>
            <span>{"//"}</span>
            <span className="text-[#F1F0E1]">PERFIL DE OPERADOR Y BITÁCORA</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => signOut()}
            className="px-2.5 sm:px-3 py-1.5 border border-[#3A3A42] hover:border-[#506385] bg-transparent hover:bg-[#1A1A1F] text-[#9A9A92] hover:text-[#F1F0E1] text-[10.5px] sm:text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-[#506385]" />
            <span className="hidden sm:inline">CERRAR SESIÓN</span>
          </button>
        </div>
      </header>

      {/* ─── 2. Contenido Principal del Perfil ─── */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 overflow-y-auto">
        {/* COLUMNA IZQUIERDA: Tarjeta de Operador y Seguridad (4 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-5">
          {/* Tarjeta de Avatar y Credenciales */}
          <div className="p-5 bg-[#17171C] border border-[#2B2B31] flex flex-col items-center gap-4 shadow-xl">
            {/* Avatar Procedural */}
            <div className="relative group">
              <CelestialAvatar seed={avatarSeed} size={130} />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#17171C] border border-[#506385] flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[#506385]" />
              </div>
            </div>

            {/* Botón Generador Aleatorio */}
            <button
              onClick={handleGenerateRandomAvatar}
              className="w-full py-2 px-3 border border-[#3A3A42] hover:border-[#506385] bg-[#1A1A1F] hover:bg-[#202027] text-[#F1F0E1] text-[10.5px] uppercase tracking-[0.14em] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              title="Generar nueva firma astronómica procedural"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#506385]" />
              <span>GENERAR AVATAR ALEATORIO</span>
            </button>

            {/* Datos del Operador */}
            <div className="w-full space-y-2.5 pt-3 border-t border-[#2B2B31]">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9.5px] uppercase tracking-wider text-[#9A9A92] flex items-center gap-1.5">
                  <User className="w-3 h-3 text-[#506385]" />
                  <span>IDENTIFICADOR DE OPERADOR</span>
                </span>
                <span className="text-xs font-mono text-[#F1F0E1] break-all">{user.email}</span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[9.5px] uppercase tracking-wider text-[#9A9A92]">
                  UID EN BASE DE DATOS
                </span>
                <span className="text-[10px] font-mono text-[#9A9A92] break-all">{user.id}</span>
              </div>

              <div className="p-2.5 bg-[#101015] border border-[#2B2B31] text-[10px] text-[#9A9A92] flex items-start gap-2 leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 text-[#506385] shrink-0 mt-0.5" />
                <span>
                  Row Level Security activa: cada observación está encriptada y protegida bajo tu UID.
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta de Seguridad: Cambio de Contraseña (30 Días) */}
          <div className="p-5 bg-[#17171C] border border-[#2B2B31] flex flex-col gap-3 shadow-xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#F1F0E1] pb-2 border-b border-[#2B2B31]">
              <KeyRound className="w-4 h-4 text-[#506385]" />
              <span>SEGURIDAD Y CONTRASEÑA</span>
            </div>

            {isRecoveryMode ? (
              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <div className="p-2.5 bg-[#101015] border border-[#506385] text-[11px] text-[#F1F0E1] flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#506385] shrink-0 mt-0.5" />
                  <span>Enlace de recuperación autenticado. Establece tu nueva credencial de acceso.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#9A9A92]">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres, 1 mayúscula"
                    maxLength={128}
                    className="w-full bg-[#101015] border border-[#2B2B31] focus:border-[#506385] px-3 py-2 text-xs text-[#F1F0E1] outline-none font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#9A9A92]">
                    Confirmar Contraseña
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    maxLength={128}
                    className="w-full bg-[#101015] border border-[#2B2B31] focus:border-[#506385] px-3 py-2 text-xs text-[#F1F0E1] outline-none font-mono"
                    required
                  />
                </div>

                {updateMsg && (
                  <div
                    className={`p-2.5 border text-[11px] flex items-start gap-2 ${
                      updateMsg.type === "success"
                        ? "bg-[#101015] border-[#506385] text-[#F1F0E1]"
                        : "bg-[#251515] border-[#5C2B2B] text-[#F1F0E1]"
                    }`}
                  >
                    {updateMsg.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-[#506385] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[#9A9A92] shrink-0 mt-0.5" />
                    )}
                    <span>{updateMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="w-full py-2.5 px-3 bg-[#506385] hover:bg-[#5E749C] disabled:bg-[#1A1A1F] text-[#F1F0E1] text-[10.5px] uppercase tracking-[0.14em] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-[#506385]"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{updatingPassword ? "ACTUALIZANDO..." : "GUARDAR NUEVA CONTRASEÑA"}</span>
                </button>
              </form>
            ) : (
              <>
                <p className="text-[11px] text-[#9A9A92] leading-relaxed">
                  Por protocolo de seguridad criptográfica, las solicitudes de restablecimiento de
                  contraseña están restringidas a un intervalo mínimo de 30 días.
                </p>

                {/* Advertencia de días restantes si aplica */}
                {daysUntilNextChange > 0 ? (
                  <div className="p-3 bg-[#101015] border border-[#3A3A42] flex items-start gap-2.5 text-[11px] text-[#9A9A92]">
                    <Lock className="w-4 h-4 text-[#506385] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-[#F1F0E1] font-semibold uppercase tracking-wider text-[10px]">
                        INTERVALO DE SEGURIDAD ACTIVO
                      </div>
                      <div>
                        Próxima solicitud de cambio habilitada en{" "}
                        <span className="text-[#F1F0E1] font-mono font-bold">
                          {daysUntilNextChange} {daysUntilNextChange === 1 ? "día" : "días"}
                        </span>.
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Mensajes de feedback */}
                {passwordMsg && (
                  <div
                    className={`p-3 border text-[11px] flex items-start gap-2 ${
                      passwordMsg.type === "success"
                        ? "bg-[#101015] border-[#506385] text-[#F1F0E1]"
                        : "bg-[#251515] border-[#5C2B2B] text-[#F1F0E1]"
                    }`}
                  >
                    {passwordMsg.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-[#506385] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[#9A9A92] shrink-0 mt-0.5" />
                    )}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <button
                  onClick={handleRequestPasswordReset}
                  disabled={passwordLoading || daysUntilNextChange > 0}
                  className="w-full py-2.5 px-3 bg-[#506385] hover:bg-[#5E749C] disabled:bg-[#1A1A1F] disabled:border-[#3A3A42] disabled:text-[#9A9A92] disabled:cursor-not-allowed text-[#F1F0E1] text-[10.5px] uppercase tracking-[0.14em] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-[#506385]"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#F1F0E1]" />
                  <span>
                    {daysUntilNextChange > 0
                      ? `CAMBIO BLOQUEADO (${daysUntilNextChange}D)`
                      : passwordLoading
                      ? "ENVIANDO CORREO..."
                      : "SOLICITAR CAMBIO POR EMAIL"}
                  </span>
                </button>
              </>
            )}
          </div>
        </section>

        {/* COLUMNA DERECHA: Catálogo Personal de Objetos Observados (8 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-5">
          <div className="p-5 bg-[#17171C] border border-[#2B2B31] flex flex-col gap-4 shadow-xl flex-1">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2B31]">
              <div className="flex items-center gap-2.5">
                <Telescope className="w-4 h-4 text-[#506385]" />
                <h2 className="text-xs uppercase tracking-[0.18em] font-semibold text-[#F1F0E1]">
                  CATÁLOGO PERSONAL DE OBSERVACIONES
                </h2>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-[#101015] border border-[#2B2B31] text-[#9A9A92]">
                {observedObjects.length} OBJETOS REGISTRADOS
              </span>
            </div>

            {notesLoading ? (
              <div className="py-16 text-center text-xs uppercase tracking-[0.16em] text-[#9A9A92]">
                Cargando bitácora de observaciones...
              </div>
            ) : observedObjects.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <FileText className="w-8 h-8 text-[#506385] mx-auto opacity-60" />
                <p className="text-xs uppercase tracking-[0.14em] text-[#9A9A92]">
                  Aún no has registrado notas de observación en ningún sector celeste.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#506385] hover:bg-[#5E749C] text-[#F1F0E1] text-[11px] uppercase tracking-wider font-semibold transition-colors"
                >
                  <Telescope className="w-3.5 h-3.5" />
                  <span>EXPLORAR EL MAPA CELESTE</span>
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
                        className={`w-full text-left p-3 border transition-colors flex flex-col gap-1.5 cursor-pointer ${
                          isSelected
                            ? "bg-[#1E2532] border-[#506385] text-[#F1F0E1]"
                            : "bg-[#101015] border-[#2B2B31] text-[#9A9A92] hover:bg-[#1A1A1F] hover:text-[#F1F0E1]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wide truncate max-w-[160px] text-[#F1F0E1]">
                            {obj.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#17171C] border border-[#3A3A42] text-[#F1F0E1]">
                              {obj.notes.length} {obj.notes.length === 1 ? "NOTA" : "NOTAS"}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeleteObject(obj);
                              }}
                              className="w-5 h-5 rounded-sm bg-transparent hover:bg-[#251515] border border-transparent hover:border-[#5C2B2B] text-[#9A9A92] hover:text-[#EF4444] flex items-center justify-center transition-colors cursor-pointer"
                              title={`Eliminar "${obj.name}" y todas sus notas`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[9.5px] font-mono text-[#9A9A92]">
                          <span>{obj.constellation}</span>
                          <span>•</span>
                          <span>{formatCoordinates(obj.raDeg, obj.decDeg).raHms} {formatCoordinates(obj.raDeg, obj.decDeg).decDms}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Panel de Detalle y Comparativa Astrofísica (7 cols) */}
                {selectedObject && (
                  <div className="md:col-span-7 flex flex-col gap-4 p-4 bg-[#101015] border border-[#2B2B31] overflow-hidden">
                    {/* Encabezado del Objeto - Layout flexible anti-desbordamiento */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#2B2B31]">
                      <div className="min-w-0 flex-1">
                        <div className="text-[9.5px] uppercase tracking-wider text-[#506385] font-semibold truncate">
                          {selectedObject.categoryLabel}
                        </div>
                        <h3 className="text-sm font-semibold tracking-wide uppercase text-[#F1F0E1] break-words">
                          {selectedObject.name}
                        </h3>
                        <div className="text-[10px] text-[#9A9A92] font-mono truncate">
                          Constelación: {selectedObject.constellation} · Distancia: {selectedObject.distance}
                        </div>
                      </div>

                      {/* Acciones del Objeto: Analizar y Eliminar */}
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                        <Link
                          href={`/analyze?ra=${selectedObject.raDeg.toFixed(5)}&dec=${selectedObject.decDeg.toFixed(5)}&fov=${selectedObject.fovDeg.toFixed(3)}`}
                          className="px-2.5 sm:px-3 py-1.5 bg-[#506385] hover:bg-[#5E749C] text-[#F1F0E1] text-[10px] sm:text-[10.5px] uppercase tracking-[0.14em] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border border-[#506385]"
                          title="Ir a analizar este objeto con el espectrógrafo del Laboratorio"
                        >
                          <Telescope className="w-3.5 h-3.5 text-[#F1F0E1]" />
                          <span>ANALIZAR</span>
                          <ExternalLink className="w-3 h-3 text-[#F1F0E1]" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => requestDeleteObject(selectedObject)}
                          className="px-2.5 sm:px-3 py-1.5 bg-[#251515] hover:bg-[#381A1A] text-[#FCA5A5] hover:text-[#EF4444] border border-[#5C2B2B] hover:border-[#EF4444] text-[10px] sm:text-[10.5px] uppercase tracking-[0.12em] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                          title={`Eliminar "${selectedObject.name}" y todas sus notas`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                          <span>ELIMINAR OBJETO</span>
                        </button>
                      </div>
                    </div>

                    {/* Ficha Astrofísica Comparativa: Formación, Químicos, Tamaño */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Formación Cósmica */}
                      <div className="p-3 bg-[#17171C] border border-[#2B2B31] flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#506385] font-semibold">
                          <Layers className="w-3 h-3 text-[#506385]" />
                          <span>TIPO DE FORMACIÓN</span>
                        </div>
                        <p className="text-[11px] text-[#F1F0E1] leading-relaxed">
                          {selectedObject.formation}
                        </p>
                      </div>

                      {/* Extensión y Dimensiones */}
                      <div className="p-3 bg-[#17171C] border border-[#2B2B31] flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#506385] font-semibold">
                          <Compass className="w-3 h-3 text-[#506385]" />
                          <span>DIMENSIÓN Y TAMAÑO</span>
                        </div>
                        <p className="text-[11px] text-[#F1F0E1] font-mono leading-relaxed">
                          {selectedObject.sizeDisplay}
                        </p>
                        <span className="text-[9.5px] text-[#9A9A92] font-mono">
                          Coords: {selectedObject.raDeg.toFixed(3)}°, {selectedObject.decDeg.toFixed(3)}°
                        </span>
                      </div>

                      {/* Composición Química Espectral */}
                      <div className="sm:col-span-2 p-3 bg-[#17171C] border border-[#2B2B31] flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#506385] font-semibold">
                          <Atom className="w-3 h-3 text-[#506385]" />
                          <span>COMPOSICIÓN QUÍMICA Y LÍNEAS ESPECTRALES</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedObject.detectedElements.map((el, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-[#101015] border border-[#3A3A42] text-[10.5px] text-[#F1F0E1] font-mono uppercase tracking-wider"
                            >
                              {el}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bitácora de Observaciones Personales para este Objeto */}
                    <div className="flex-1 flex flex-col gap-2 pt-2 border-t border-[#2B2B31]">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#9A9A92]">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-[#506385]" />
                          <span>NOTAS REGISTRADAS EN ESTE OBJETO ({selectedObject.notes.length})</span>
                        </span>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedObject.notes.map((note) => (
                          <div
                            key={note.id}
                            className="p-2.5 bg-[#17171C] border border-[#2B2B31] flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="flex-1 space-y-1 min-w-0">
                              <div className="flex items-center gap-2 text-[9px] font-mono text-[#9A9A92]">
                                <Clock className="w-3 h-3 text-[#506385]" />
                                <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>
                                  {new Date(note.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#F1F0E1] uppercase tracking-wide leading-relaxed break-words">
                                {note.body}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => requestDeleteNote(note)}
                              className="w-6 h-6 rounded-sm bg-[#101015] border border-[#2B2B31] hover:border-[#EF4444] text-[#9A9A92] hover:text-[#EF4444] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                              title="Eliminar esta observación"
                            >
                              <Trash2 className="w-3 h-3" />
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

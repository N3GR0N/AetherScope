"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import {
  X,
  User,
  KeyRound,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Clock,
  Check,
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_FAILED_ATTEMPTS = 4;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutos de bloqueo tras 4 fallos
const STORAGE_LOCKOUT_KEY = "aetherscope:auth:lockout";

interface LockoutState {
  attempts: number;
  lockedUntil: number | null;
}

function getStoredLockout(): LockoutState {
  if (typeof window === "undefined") {
    return { attempts: 0, lockedUntil: null };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_LOCKOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LockoutState;
      if (parsed.lockedUntil && parsed.lockedUntil > new Date().getTime()) {
        return parsed;
      }
      window.localStorage.removeItem(STORAGE_LOCKOUT_KEY);
    }
  } catch {
    // Fallback defensivo
  }
  return { attempts: 0, lockedUntil: null };
}

function persistLockout(state: LockoutState): void {
  if (typeof window === "undefined") return;
  try {
    if (state.attempts === 0 && !state.lockedUntil) {
      window.localStorage.removeItem(STORAGE_LOCKOUT_KEY);
    } else {
      window.localStorage.setItem(STORAGE_LOCKOUT_KEY, JSON.stringify(state));
    }
  } catch {
    // Fallback defensivo
  }
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { user, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estado de bloqueo por intentos fallidos
  const [lockout, setLockout] = useState<LockoutState>(getStoredLockout);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const initial = getStoredLockout();
    if (initial.lockedUntil) {
      return Math.max(0, Math.ceil((initial.lockedUntil - new Date().getTime()) / 1000));
    }
    return 0;
  });

  // Reloj de cuenta regresiva cuando hay bloqueo activo
  useEffect(() => {
    if (!lockout.lockedUntil) return;

    const interval = setInterval(() => {
      const currentTime = new Date().getTime();
      const diff = Math.ceil((lockout.lockedUntil! - currentTime) / 1000);
      if (diff <= 0) {
        setSecondsRemaining(0);
        const resetState = { attempts: 0, lockedUntil: null };
        setLockout(resetState);
        persistLockout(resetState);
        setErrorMsg(null);
      } else {
        setSecondsRemaining(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockout.lockedUntil]);

  const isLockedOut = Boolean(lockout.lockedUntil && secondsRemaining > 0);

  // Reglas de validación de contraseña
  const hasMinLength = password.length >= 6;
  const hasUppercase = /[A-Z]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase;

  const remainingAttempts = useMemo(() => {
    return Math.max(0, MAX_FAILED_ATTEMPTS - lockout.attempts);
  }, [lockout.attempts]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (isLockedOut) {
      setErrorMsg(`Acceso bloqueado. Espera ${formatSeconds(secondsRemaining)} antes de reintentar.`);
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg("Completa todos los campos requeridos.");
      return;
    }

    // Validación de contraseña en registro y login
    if (!isPasswordValid) {
      setErrorMsg("La contraseña debe tener al menos 6 caracteres y al menos una letra mayúscula (A-Z).");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn({ email: email.trim(), password });
        // Inicio exitoso: resetear contador de intentos fallidos
        const clearedState = { attempts: 0, lockedUntil: null };
        setLockout(clearedState);
        persistLockout(clearedState);
        setSuccessMsg("Operador autenticado. Cargando sesión...");
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        await signUp({ email: email.trim(), password });
        setSuccessMsg("Cuenta de operador creada exitosamente.");
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error durante la autenticación.";

      if (mode === "signin") {
        const nextAttempts = lockout.attempts + 1;
        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockedUntilTimestamp = new Date().getTime() + LOCKOUT_DURATION_MS;
          const remainingSec = Math.ceil(LOCKOUT_DURATION_MS / 1000);
          const lockedState = { attempts: nextAttempts, lockedUntil: lockedUntilTimestamp };
          setLockout(lockedState);
          persistLockout(lockedState);
          setSecondsRemaining(remainingSec);
          setErrorMsg(
            `BLOQUEO DE SEGURIDAD ACTIVADO: Superaste los 4 intentos permitidos. Espera 5 minutos para volver a intentar.`
          );
        } else {
          const nextState = { attempts: nextAttempts, lockedUntil: null };
          setLockout(nextState);
          persistLockout(nextState);
          const left = MAX_FAILED_ATTEMPTS - nextAttempts;
          setErrorMsg(
            `${msg} Te quedan ${left} ${left === 1 ? "intento" : "intentos"} antes del bloqueo temporal.`
          );
        }
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cerrar sesión.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  function formatSeconds(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs select-none animate-panel-enter">
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[20px] w-full max-w-md max-h-[92vh] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full ${isLockedOut ? "bg-[var(--error)] animate-ping" : "bg-[var(--accent)]"}`} />
            <h2 className="text-[var(--text)] font-semibold text-[14px] tracking-tight">
              {user ? "Perfil de Operador Espacial" : "Control de Acceso y Sesión"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 bg-[var(--surface-1)] flex flex-col gap-4 overflow-y-auto">
          {user ? (
            /* Usuario autenticado */
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-[var(--ok)] text-[11px] font-medium">
                  <User className="w-3.5 h-3.5 text-[var(--ok)]" />
                  <span>Operador Identificado</span>
                </div>
                <div className="text-[var(--text)] font-medium text-sm break-all font-mono">
                  {user.email}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono break-all">
                  UID: {user.id}
                </div>
              </div>

              <div className="p-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] text-[12px] leading-relaxed flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--ok)] mt-0.5" />
                <span>
                  Protección RLS activa: Las notas en cada coordenada solo son visibles para este UID de operador.
                </span>
              </div>

              <Link
                href="/profile"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[13px] font-semibold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Ir a mi perfil y bitácora</span>
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-1)] text-[var(--error)] border border-[var(--error)]/40 text-[12px] font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                <span>Desconectar sesión</span>
              </button>
            </div>
          ) : (
            /* Formulario de Login / Registro */
            <>
              {/* Tab Selector */}
              <div className="grid grid-cols-2 p-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                    mode === "signin"
                      ? "bg-[var(--accent)] text-[var(--on-accent)] font-semibold"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                    mode === "signup"
                      ? "bg-[var(--accent)] text-[var(--on-accent)] font-semibold"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Registrarse
                </button>
              </div>

              {/* Banner de Bloqueo por Fuerza Bruta */}
              {isLockedOut ? (
                <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--error)] text-[var(--error)] text-[12px] flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-[var(--error)]" />
                  <div className="space-y-1">
                    <div className="font-semibold text-[var(--error)]">
                      Terminal bloqueada por seguridad
                    </div>
                    <div>
                      Se excedió el límite de 4 intentos incorrectos. El acceso está suspendido temporalmente.
                    </div>
                    <div className="font-mono text-xs flex items-center gap-1.5 pt-1 text-[var(--text)]">
                      <Clock className="w-3.5 h-3.5 text-[var(--error)]" />
                      <span>Reintento habilitado en: {formatSeconds(secondsRemaining)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Intentos restantes advertencia */
                mode === "signin" &&
                lockout.attempts > 0 && (
                  <div className="px-3 py-1.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--accent)]/50 text-[var(--accent)] text-[11px] flex items-center justify-between">
                    <span>Advertencia de seguridad</span>
                    <span className="font-mono font-bold">
                      {remainingAttempts} / {MAX_FAILED_ATTEMPTS} intentos restantes
                    </span>
                  </div>
                )
              )}

              {/* Mensajes de error o éxito */}
              {errorMsg && !isLockedOut && (
                <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--error)] text-[var(--error)] text-[12px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--ok)] text-[var(--ok)] text-[12px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[var(--text-muted)] font-medium flex items-center gap-1.5">
                    <User className="w-3 h-3 text-[var(--accent)]" />
                    <span>Correo electrónico</span>
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    disabled={isLockedOut || loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operador@aetherscope.org"
                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--border-strong)] rounded-[12px] px-3.5 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] disabled:opacity-40"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[var(--text-muted)] font-medium flex items-center gap-1.5">
                    <KeyRound className="w-3 h-3 text-[var(--accent)]" />
                    <span>Contraseña</span>
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={128}
                    disabled={isLockedOut || loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--border-strong)] rounded-[12px] px-3.5 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] disabled:opacity-40"
                  />
                </div>

                {mode === "signin" && (
                  <div className="flex justify-end -mt-1">
                    <Link
                      href="/reset-password"
                      onClick={onClose}
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                )}

                {/* Checklist visual de requisitos de contraseña */}
                <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-2">
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">
                    Seguridad de contraseña:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        hasMinLength ? "text-[var(--ok)]" : "text-[var(--text-muted)]"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px] ${
                          hasMinLength
                            ? "bg-[var(--ok)]/20 border-[var(--ok)] text-[var(--ok)]"
                            : "border-[var(--border)] bg-transparent"
                        }`}
                      >
                        {hasMinLength && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                      </div>
                      <span>Mín. 6 caracteres</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        hasUppercase ? "text-[var(--ok)]" : "text-[var(--text-muted)]"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px] ${
                          hasUppercase
                            ? "bg-[var(--ok)]/20 border-[var(--ok)] text-[var(--ok)]"
                            : "border-[var(--border)] bg-transparent"
                        }`}
                      >
                        {hasUppercase && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                      </div>
                      <span>1 mayúscula (A-Z)</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLockedOut || loading || (mode === "signup" && !isPasswordValid)}
                  className="w-full mt-1 py-2.5 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-[13px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin text-[var(--on-accent)]" />}
                  <span>
                    {isLockedOut
                      ? `Bloqueado (${formatSeconds(secondsRemaining)})`
                      : mode === "signin"
                      ? "Ingresar a misión"
                      : "Crear cuenta segura"}
                  </span>
                </button>
              </form>

              <div className="text-[10px] text-[var(--text-muted)] text-center pt-1 border-t border-[var(--border)]">
                Máx. 4 intentos de login fallidos antes de bloqueo preventivo por 5 min.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none font-[family-name:var(--font-proto)] animate-in fade-in duration-150">
      <div className="bg-[#17171C] border border-[#2B2B31] w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-4 bg-[#141418] border-b border-[#2B2B31] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 ${isLockedOut ? "bg-[#EF4444] animate-ping" : "bg-[#F1F0E1]"}`} />
            <h2 className="text-[#F1F0E1] font-semibold text-xs tracking-[0.16em] uppercase">
              {user ? "PERFIL DE OPERADOR ESPACIAL" : "CONTROL DE ACCESO Y SEGURIDAD"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-transparent hover:bg-[#202027] text-[#9A9A92] hover:text-[#F1F0E1] flex items-center justify-center transition-colors cursor-pointer border border-[#2B2B31]"
            title="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 bg-[#17171C] flex flex-col gap-4">
          {user ? (
            /* Usuario autenticado */
            <div className="flex flex-col gap-5">
              <div className="p-4 border border-[#2B2B31] bg-[#101015] flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[#9A9A92] text-[11px] uppercase tracking-wider">
                  <User className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>OPERADOR IDENTIFICADO</span>
                </div>
                <div className="text-[#F1F0E1] font-medium text-sm break-all font-mono">
                  {user.email}
                </div>
                <div className="text-[10px] text-[#9A9A92] font-mono break-all">
                  UID: {user.id}
                </div>
              </div>

              <div className="p-3 border border-[#22503B]/60 bg-[#12221A] text-[#86EFAC] text-[11px] leading-relaxed flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Protección RLS activa: Las notas en cada coordenada solo son visibles para este UID de operador.
                </span>
              </div>

              <Link
                href="/profile"
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-[#506385] hover:bg-[#5E749C] text-[#F1F0E1] text-xs uppercase tracking-[0.14em] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-[#506385]"
              >
                <User className="w-4 h-4 text-[#F1F0E1]" />
                <span>IR A MI PERFIL Y BITÁCORA</span>
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-transparent hover:bg-[#2A1F1F] text-[#F87171] border border-[#7F1D1D] hover:border-[#DC2626] text-xs uppercase tracking-[0.14em] font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                <span>DESCONECTAR SESIÓN</span>
              </button>
            </div>
          ) : (
            /* Formulario de Login / Registro */
            <>
              {/* Tab Selector */}
              <div className="grid grid-cols-2 border border-[#2B2B31] bg-[#101015] p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 text-[11px] uppercase tracking-[0.12em] font-medium transition-colors cursor-pointer ${
                    mode === "signin"
                      ? "bg-[#506385] text-[#F1F0E1]"
                      : "text-[#9A9A92] hover:text-[#F1F0E1]"
                  }`}
                >
                  INICIAR SESIÓN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 text-[11px] uppercase tracking-[0.12em] font-medium transition-colors cursor-pointer ${
                    mode === "signup"
                      ? "bg-[#506385] text-[#F1F0E1]"
                      : "text-[#9A9A92] hover:text-[#F1F0E1]"
                  }`}
                >
                  REGISTRARSE
                </button>
              </div>

              {/* Banner de Bloqueo por Fuerza Bruta */}
              {isLockedOut ? (
                <div className="p-3 bg-[#3B1515] border border-[#DC2626] text-[#FCA5A5] text-[11px] flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-[#EF4444]" />
                  <div className="space-y-1">
                    <div className="font-semibold uppercase tracking-wider text-[#F87171]">
                      TERMINAL BLOQUEADA POR SEGURIDAD
                    </div>
                    <div>
                      Se excedió el límite de 4 intentos incorrectos. El acceso está suspendido temporalmente.
                    </div>
                    <div className="font-mono text-xs flex items-center gap-1.5 pt-1 text-[#F1F0E1]">
                      <Clock className="w-3.5 h-3.5 text-[#EF4444]" />
                      <span>Reintento habilitado en: {formatSeconds(secondsRemaining)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Intentos restantes advertencia */
                mode === "signin" &&
                lockout.attempts > 0 && (
                  <div className="px-3 py-1.5 bg-[#2B2215] border border-[#B45309] text-[#FDE68A] text-[10px] uppercase flex items-center justify-between">
                    <span>Advertencia de seguridad</span>
                    <span className="font-mono font-bold">
                      {remainingAttempts} / {MAX_FAILED_ATTEMPTS} intentos restantes
                    </span>
                  </div>
                )
              )}

              {/* Mensajes de error o éxito */}
              {errorMsg && !isLockedOut && (
                <div className="p-3 bg-[#2D1515] border border-[#7F1D1D] text-[#FCA5A5] text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-[#132B1E] border border-[#166534] text-[#86EFAC] text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[#9A9A92] uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3 h-3 text-[#F1F0E1]" />
                    <span>CORREO ELECTRÓNICO</span>
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    disabled={isLockedOut || loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operador@aetherscope.org"
                    className="w-full bg-[#101015] border border-[#2B2B31] focus:border-[#506385] px-3 py-2 text-xs text-[#F1F0E1] outline-hidden placeholder:text-[#55555F] disabled:opacity-40"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[#9A9A92] uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3 h-3 text-[#F1F0E1]" />
                    <span>CONTRASEÑA</span>
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={128}
                    disabled={isLockedOut || loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#101015] border border-[#2B2B31] focus:border-[#506385] px-3 py-2 text-xs text-[#F1F0E1] outline-hidden placeholder:text-[#55555F] disabled:opacity-40"
                  />
                </div>

                {/* Checklist visual de requisitos de contraseña */}
                <div className="p-2.5 bg-[#101015] border border-[#2B2B31] flex flex-col gap-1.5">
                  <span className="text-[9.5px] uppercase tracking-wider text-[#9A9A92]">
                    REGLAS DE SEGURIDAD DE CONTRASEÑA:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        hasMinLength ? "text-[#86EFAC]" : "text-[#9A9A92]"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded-full flex items-center justify-center border text-[8px] ${
                          hasMinLength
                            ? "bg-[#166534] border-[#22C55E]"
                            : "border-[#4A4A52] bg-transparent"
                        }`}
                      >
                        {hasMinLength && <Check className="w-2 h-2" strokeWidth={3} />}
                      </div>
                      <span>Mín. 6 caracteres</span>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 transition-colors ${
                        hasUppercase ? "text-[#86EFAC]" : "text-[#9A9A92]"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded-full flex items-center justify-center border text-[8px] ${
                          hasUppercase
                            ? "bg-[#166534] border-[#22C55E]"
                            : "border-[#4A4A52] bg-transparent"
                        }`}
                      >
                        {hasUppercase && <Check className="w-2 h-2" strokeWidth={3} />}
                      </div>
                      <span>Al menos 1 mayúscula (A-Z)</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLockedOut || loading || (mode === "signup" && !isPasswordValid)}
                  className="w-full mt-1 py-2.5 px-4 bg-[#F1F0E1] hover:bg-[#D5D4C5] text-[#101015] font-semibold text-xs uppercase tracking-[0.14em] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {isLockedOut
                      ? `BLOQUEADO (${formatSeconds(secondsRemaining)})`
                      : mode === "signin"
                      ? "INGRESAR A MISIÓN"
                      : "CREAR CUENTA SEGURA"}
                  </span>
                </button>
              </form>

              <div className="text-[9.5px] text-[#9A9A92] text-center pt-2 border-t border-[#2B2B31]/60">
                Máx. 4 intentos de login fallidos antes de bloqueo preventivo por 5 min.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

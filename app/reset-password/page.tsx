"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { validatePasswordSecurity, validateEmailSecurity } from "@/lib/auth/supabaseAuthService";
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Lock,
  Check,
  Loader2,
  User,
  Mail,
  Send,
} from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Formulario 1: Nueva contraseña
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  // Formulario 2: Solicitar correo (si entra sin token)
  const [requestEmail, setRequestEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Reglas de validación visual
  const hasMinLength = newPassword.length >= 6;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = hasMinLength && hasUppercase && passwordsMatch;

  // Derivación segura de estado inicial a partir de parámetros de URL
  const initialMode = useMemo<"verifying" | "enter-new-password" | "request-reset-email">(() => {
    if (typeof window === "undefined") return "verifying";
    const errorParam = searchParams.get("error") || searchParams.get("error_description");
    if (errorParam || window.location.hash.includes("error=")) {
      return "request-reset-email";
    }
    const hasCode = searchParams.get("code");
    const hasHashTokens =
      window.location.hash.includes("access_token=") ||
      window.location.hash.includes("type=recovery");
    if (hasCode || hasHashTokens) {
      return "enter-new-password";
    }
    return "verifying";
  }, [searchParams]);

  const initialStatusMessage = useMemo(() => {
    const errorDesc = searchParams.get("error_description");
    const errorParam = searchParams.get("error");
    if (errorDesc || errorParam) {
      return {
        type: "error" as const,
        text: errorDesc || "El enlace de recuperación ha expirado o ya fue utilizado. Puedes solicitar uno nuevo a continuación.",
      };
    }
    if (typeof window !== "undefined" && window.location.hash.includes("error=")) {
      return {
        type: "error" as const,
        text: "El enlace de recuperación ha expirado o no es válido. Puedes solicitar uno nuevo a continuación.",
      };
    }
    return null;
  }, [searchParams]);

  const [viewMode, setViewMode] = useState<"verifying" | "enter-new-password" | "request-reset-email">(initialMode);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(initialStatusMessage);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let isMounted = true;

    if (!supabase) {
      const timer = setTimeout(() => {
        if (isMounted) {
          setViewMode("request-reset-email");
          setStatusMessage({ type: "error", text: "Servicio de autenticación no disponible." });
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setViewMode("enter-new-password");
        if (session?.user?.email) setUserEmail(session.user.email);
      }
    });

    const initAuth = async () => {
      const code = searchParams.get("code");
      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!isMounted) return;
          if (error) {
            setViewMode("request-reset-email");
            setStatusMessage({
              type: "error",
              text: "El enlace de recuperación es inválido o ha expirado. Solicita un nuevo correo.",
            });
          } else {
            setViewMode("enter-new-password");
            if (data?.user?.email) setUserEmail(data.user.email);
          }
        } catch {
          if (isMounted) {
            setViewMode("request-reset-email");
            setStatusMessage({
              type: "error",
              text: "Error al validar el código de seguridad. Solicita un nuevo enlace.",
            });
          }
        }
        return;
      }

      const hasHashTokens =
        typeof window !== "undefined" &&
        (window.location.hash.includes("access_token=") || window.location.hash.includes("type=recovery"));

      if (hasHashTokens) {
        if (isMounted) setViewMode("enter-new-password");
      }

      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (user && !error) {
          setViewMode("enter-new-password");
          setUserEmail(user.email || null);
        } else if (!hasHashTokens && !code) {
          setViewMode("request-reset-email");
        }
      } catch {
        if (isMounted && !hasHashTokens && !code) {
          setViewMode("request-reset-email");
        }
      }
    };

    void initAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams]);

  // Manejo de guardado de nueva contraseña
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const validation = validatePasswordSecurity(newPassword);
    if (!validation.valid) {
      setStatusMessage({ type: "error", text: validation.reason || "Contraseña inválida." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Cliente de autenticación no configurado.");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);

      setPasswordUpdated(true);
      setTimeout(() => {
        router.push("/profile");
      }, 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al actualizar la contraseña.";
      setStatusMessage({ type: "error", text: msg });
      setIsSubmitting(false);
    }
  };

  // Manejo de envío de correo de restablecimiento (si entra sin token)
  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const emailVal = validateEmailSecurity(requestEmail);
    if (!emailVal.valid) {
      setStatusMessage({ type: "error", text: emailVal.reason || "Correo no válido." });
      return;
    }

    setIsSendingEmail(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Cliente de autenticación no configurado.");

      const { error } = await supabase.auth.resetPasswordForEmail(requestEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw new Error(error.message);

      setEmailSent(true);
      setStatusMessage({
        type: "success",
        text: `Enlace de restablecimiento enviado a ${requestEmail.trim()}. Revisa tu bandeja de entrada o spam.`,
      });
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Error al enviar correo de recuperación.";
      if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("rate_limit")) {
        msg = "Límite de envíos alcanzado en el servidor de correo (protección anti-spam de Supabase). Por favor, aguarda unos minutos antes de solicitar otro email.";
      }
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-[family-name:var(--font-sans)] select-none">
      {/* Top Header */}
      <header className="h-16 bg-[var(--surface-1)] border-b border-[var(--border)] px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 hover:opacity-85 transition-opacity"
            title="AetherScope"
          >
            <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center font-bold text-xs">
              A
            </div>
            <span className="text-sm font-semibold text-[var(--text)]">
              AetherScope
            </span>
          </Link>
          <span className="text-[var(--border-strong)]">/</span>
          <span className="text-xs text-[var(--text-muted)] font-medium">Seguridad de acceso</span>
        </div>

        <Link
          href="/"
          className="px-3.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-1)] text-[var(--text)] text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer min-h-[36px]"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Ir al mapa</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md solid-card rounded-[20px] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)] space-y-5">
          {/* Header Title */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[var(--accent)]" />
              <h1 className="text-sm font-semibold text-[var(--text)]">
                {viewMode === "enter-new-password"
                  ? "Establecer nueva contraseña"
                  : "Recuperación de contraseña"}
              </h1>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">SEGURIDAD</span>
          </div>

          {/* 1. Verificando */}
          {viewMode === "verifying" && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <div className="space-y-1">
                <p className="text-sm text-[var(--text)] font-medium">
                  Verificando enlace de recuperación...
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Validando el token criptográfico con el centro de autenticación.
                </p>
              </div>
            </div>
          )}

          {/* 2. Formulario: Establecer Nueva Contraseña (con token autenticado) */}
          {viewMode === "enter-new-password" && !passwordUpdated && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="p-3.5 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-xs text-[var(--text)] block">
                    Enlace autenticado
                  </span>
                  <span className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {userEmail ? (
                      <>Estableciendo nueva credencial para el operador <strong className="text-[var(--text)]">{userEmail}</strong>.</>
                    ) : (
                      "Ingresa tu nueva contraseña para actualizar tu cuenta de forma segura."
                    )}
                  </span>
                </div>
              </div>

              {/* Input Nueva Contraseña */}
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Nueva contraseña</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres, 1 mayúscula"
                  maxLength={128}
                  disabled={isSubmitting}
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] px-3.5 py-2.5 rounded-[12px] text-xs text-[var(--text)] outline-none font-mono"
                  required
                />
              </div>

              {/* Input Confirmar Contraseña */}
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Confirmar nueva contraseña</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña exactamente"
                  maxLength={128}
                  disabled={isSubmitting}
                  className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] px-3.5 py-2.5 rounded-[12px] text-xs text-[var(--text)] outline-none font-mono"
                  required
                />
              </div>

              {/* Reglas de contraseña */}
              <div className="p-3 rounded-[12px] bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5">
                <span className="text-[11px] text-[var(--text-muted)] font-medium block">
                  Requisitos de seguridad:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  <div
                    className={`flex items-center gap-1.5 transition-colors ${
                      hasMinLength ? "text-[var(--ok)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[9px] ${
                        hasMinLength
                          ? "bg-[var(--ok)] text-[var(--on-accent)] border-[var(--ok)]"
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
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[9px] ${
                        hasUppercase
                          ? "bg-[var(--ok)] text-[var(--on-accent)] border-[var(--ok)]"
                          : "border-[var(--border)] bg-transparent"
                      }`}
                    >
                      {hasUppercase && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </div>
                    <span>1 mayúscula (A-Z)</span>
                  </div>

                  <div
                    className={`col-span-1 sm:col-span-2 flex items-center gap-1.5 transition-colors ${
                      passwordsMatch ? "text-[var(--ok)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[9px] ${
                        passwordsMatch
                          ? "bg-[var(--ok)] text-[var(--on-accent)] border-[var(--ok)]"
                          : "border-[var(--border)] bg-transparent"
                      }`}
                    >
                      {passwordsMatch && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </div>
                    <span>Las contraseñas coinciden</span>
                  </div>
                </div>
              </div>

              {/* Mensaje de error al enviar */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-[12px] border text-xs flex items-start gap-2 ${
                    statusMessage.type === "success"
                      ? "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
                      : "bg-[var(--surface-2)] border-[var(--error)] text-[var(--error)]"
                  }`}
                >
                  {statusMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--ok)] shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Botón de envío */}
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted)] text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[40px] disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando contraseña...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Guardar nueva contraseña</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. Pantalla de Éxito al actualizar */}
          {viewMode === "enter-new-password" && passwordUpdated && (
            <div className="py-6 text-center space-y-4 animate-panel-enter">
              <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] border border-[var(--ok)] mx-auto flex items-center justify-center text-[var(--ok)]">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <p className="text-sm text-[var(--ok)] font-semibold">
                  Contraseña actualizada con éxito
                </p>
                <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
                  Tus nuevas credenciales han sido guardadas. Redirigiendo a tu perfil de operador...
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2 py-2 px-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold transition-colors min-h-[40px]"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Ir a mi perfil ahora</span>
                </Link>
              </div>
            </div>
          )}

          {/* 4. Formulario: Solicitar Enlace (si entró sin token o token expiró) */}
          {viewMode === "request-reset-email" && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Ingresa el correo electrónico asociado a tu cuenta de operador. Te enviaremos un enlace
                cifrado para definir tu nueva contraseña.
              </p>

              {statusMessage && (
                <div
                  className={`p-3 rounded-[12px] border text-xs flex items-start gap-2 ${
                    statusMessage.type === "success"
                      ? "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
                      : "bg-[var(--surface-2)] border-[var(--error)] text-[var(--error)]"
                  }`}
                >
                  {statusMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--ok)] shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {!emailSent ? (
                <form onSubmit={handleSendResetEmail} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Correo electrónico</span>
                    </label>
                    <input
                      type="email"
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      placeholder="operador@aetherscope.org"
                      maxLength={254}
                      disabled={isSendingEmail}
                      className="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--accent)] px-3.5 py-2.5 rounded-[12px] text-xs text-[var(--text)] outline-none font-mono"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingEmail || !requestEmail.trim()}
                    className="w-full py-2.5 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted)] text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[40px]"
                  >
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Enviando enlace...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar enlace de recuperación</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmailSent(false);
                      setRequestEmail("");
                    }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline text-center cursor-pointer"
                  >
                    ¿Enviar a otro correo?
                  </button>
                </div>
              )}

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                <Link
                  href="/profile"
                  className="text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Volver a mi perfil</span>
                </Link>
                <Link
                  href="/"
                  className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  Volver al mapa
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-screen bg-[var(--bg)] flex flex-col items-center justify-center text-[var(--text)] space-y-3 font-[family-name:var(--font-sans)]">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[var(--text-muted)]">
            Iniciando protocolo de recuperación...
          </span>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

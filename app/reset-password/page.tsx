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
    <div className="min-h-screen w-screen bg-[#101015] text-[#F1F0E1] flex flex-col font-[family-name:var(--font-proto)] select-none">
      {/* Top Header */}
      <header className="h-14 bg-[#17171C] border-b border-[#2B2B31] px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.ico" alt="AetherScope" className="w-5 h-5 object-contain" />
          <span className="text-xs uppercase tracking-[0.18em] text-[#F1F0E1] font-semibold">
            AETHERSCOPE <span className="text-[#9A9A92]">{"//"}</span> SEGURIDAD DE ACCESO
          </span>
        </div>

        <Link
          href="/"
          className="px-3 py-1.5 border border-[#3A3A42] hover:border-[#506385] bg-transparent hover:bg-[#1A1A1F] text-[#F1F0E1] text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#506385]" />
          <span>IR AL MAPA</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#17171C] border border-[#2B2B31] p-6 shadow-2xl space-y-5">
          {/* Header Title */}
          <div className="flex items-center justify-between pb-3 border-b border-[#2B2B31]">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#506385]" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F1F0E1]">
                {viewMode === "enter-new-password"
                  ? "ESTABLECER NUEVA CONTRASEÑA"
                  : "RECUPERACIÓN DE CONTRASEÑA"}
              </span>
            </div>
            <span className="text-[9.5px] uppercase font-mono text-[#9A9A92]">J2000-AUTH</span>
          </div>

          {/* 1. Verificando */}
          {viewMode === "verifying" && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-8 h-8 border-2 border-[#506385] border-t-transparent rounded-full animate-spin" />
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-[#F1F0E1] font-semibold">
                  VERIFICANDO ENLACE DE RECUPERACIÓN...
                </p>
                <p className="text-[10px] text-[#9A9A92]">
                  Validando el token criptográfico con el centro de autenticación.
                </p>
              </div>
            </div>
          )}

          {/* 2. Formulario: Establecer Nueva Contraseña (con token autenticado) */}
          {viewMode === "enter-new-password" && !passwordUpdated && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="p-3 bg-[#101015] border border-[#506385] text-xs text-[#F1F0E1] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#506385] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-[#506385] block">
                    ENLACE AUTENTICADO
                  </span>
                  <span className="text-[11px] text-[#9A9A92] font-sans normal-case">
                    {userEmail ? (
                      <>Estableciendo nueva credencial para el operador <strong className="text-[#F1F0E1]">{userEmail}</strong>.</>
                    ) : (
                      "Ingresa tu nueva contraseña para actualizar tu cuenta de forma segura."
                    )}
                  </span>
                </div>
              </div>

              {/* Input Nueva Contraseña */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#9A9A92] flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#506385]" />
                  <span>NUEVA CONTRASEÑA</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres, 1 mayúscula"
                  maxLength={128}
                  disabled={isSubmitting}
                  className="w-full bg-[#101015] border border-[#2B2B31] focus:border-[#506385] px-3 py-2.5 text-xs text-[#F1F0E1] outline-none font-mono"
                  required
                />
              </div>

              {/* Input Confirmar Contraseña */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-[#9A9A92] flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#506385]" />
                  <span>CONFIRMAR NUEVA CONTRASEÑA</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña exactamente"
                  maxLength={128}
                  disabled={isSubmitting}
                  className="w-full bg-[#101015] border border-[#2B2B31] focus:border-[#506385] px-3 py-2.5 text-xs text-[#F1F0E1] outline-none font-mono"
                  required
                />
              </div>

              {/* Reglas de contraseña */}
              <div className="p-3 bg-[#101015] border border-[#2B2B31] space-y-1.5">
                <span className="text-[9px] uppercase tracking-wider text-[#9A9A92] block">
                  REQUISITOS DE SEGURIDAD:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
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
                    <span>1 mayúscula (A-Z)</span>
                  </div>

                  <div
                    className={`col-span-1 sm:col-span-2 flex items-center gap-1.5 transition-colors ${
                      passwordsMatch ? "text-[#86EFAC]" : "text-[#9A9A92]"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full flex items-center justify-center border text-[8px] ${
                        passwordsMatch
                          ? "bg-[#166534] border-[#22C55E]"
                          : "border-[#4A4A52] bg-transparent"
                      }`}
                    >
                      {passwordsMatch && <Check className="w-2 h-2" strokeWidth={3} />}
                    </div>
                    <span>Las contraseñas coinciden</span>
                  </div>
                </div>
              </div>

              {/* Mensaje de error al enviar */}
              {statusMessage && (
                <div
                  className={`p-3 border text-[11px] flex items-start gap-2 ${
                    statusMessage.type === "success"
                      ? "bg-[#101015] border-[#506385] text-[#F1F0E1]"
                      : "bg-[#251515] border-[#5C2B2B] text-[#F1F0E1]"
                  }`}
                >
                  {statusMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-[#506385] shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Botón de envío */}
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="w-full py-2.5 px-4 bg-[#506385] hover:bg-[#5E749C] disabled:bg-[#1A1A1F] disabled:text-[#9A9A92] text-[#F1F0E1] text-xs uppercase tracking-[0.14em] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-[#506385] disabled:border-[#2B2B31] disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>GUARDANDO CONTRASEÑA...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>GUARDAR NUEVA CONTRASEÑA</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. Pantalla de Éxito al actualizar */}
          {viewMode === "enter-new-password" && passwordUpdated && (
            <div className="py-6 text-center space-y-4 animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-full bg-[#162D20] border border-[#22C55E] mx-auto flex items-center justify-center text-[#86EFAC]">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-[#86EFAC] font-semibold">
                  CONTRASEÑA ACTUALIZADA CON ÉXITO
                </p>
                <p className="text-[11px] text-[#9A9A92] max-w-xs mx-auto font-sans normal-case">
                  Tus nuevas credenciales han sido guardadas. Redirigiendo a tu perfil de operador...
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2 py-2 px-4 bg-[#506385] hover:bg-[#5E749C] text-[#F1F0E1] text-xs uppercase tracking-wider font-semibold transition-colors border border-[#506385]"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>IR A MI PERFIL AHORA</span>
                </Link>
              </div>
            </div>
          )}

          {/* 4. Formulario: Solicitar Enlace (si entró sin token o token expiró) */}
          {viewMode === "request-reset-email" && (
            <div className="space-y-4">
              <p className="text-[11px] text-[#9A9A92] leading-relaxed">
                Ingresa el correo electrónico asociado a tu cuenta de operador. Te enviaremos un enlace
                cifrado para definir tu nueva contraseña.
              </p>

              {statusMessage && (
                <div
                  className={`p-3 border text-[11px] flex items-start gap-2 ${
                    statusMessage.type === "success"
                      ? "bg-[#101015] border-[#506385] text-[#F1F0E1]"
                      : "bg-[#251515] border-[#5C2B2B] text-[#F1F0E1]"
                  }`}
                >
                  {statusMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-[#506385] shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {!emailSent ? (
                <form onSubmit={handleSendResetEmail} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-[#9A9A92] flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-[#506385]" />
                      <span>CORREO ELECTRÓNICO</span>
                    </label>
                    <input
                      type="email"
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      placeholder="operador@aetherscope.org"
                      maxLength={254}
                      disabled={isSendingEmail}
                      className="w-full bg-[#101015] border border-[#2B2B31] focus:border-[#506385] px-3 py-2.5 text-xs text-[#F1F0E1] outline-none font-mono"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingEmail || !requestEmail.trim()}
                    className="w-full py-2.5 px-4 bg-[#506385] hover:bg-[#5E749C] disabled:bg-[#1A1A1F] disabled:text-[#9A9A92] text-[#F1F0E1] text-xs uppercase tracking-[0.14em] font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer border border-[#506385] disabled:border-[#2B2B31]"
                  >
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>ENVIANDO ENLACE...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>ENVIAR ENLACE DE RECUPERACIÓN</span>
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
                    className="text-[10.5px] uppercase tracking-wider text-[#9A9A92] hover:text-[#F1F0E1] underline text-center cursor-pointer"
                  >
                    ¿Enviar a otro correo?
                  </button>
                </div>
              )}

              <div className="pt-2 border-t border-[#2B2B31] flex items-center justify-between text-[10px]">
                <Link
                  href="/profile"
                  className="text-[#9A9A92] hover:text-[#F1F0E1] uppercase tracking-wider flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>VOLVER A MI PERFIL</span>
                </Link>
                <Link
                  href="/"
                  className="text-[#9A9A92] hover:text-[#F1F0E1] uppercase tracking-wider"
                >
                  VOLVER AL MAPA
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
        <div className="min-h-screen w-screen bg-[#101015] flex flex-col items-center justify-center text-[#F1F0E1] space-y-3 font-[family-name:var(--font-proto)]">
          <div className="w-8 h-8 border-2 border-[#506385] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs uppercase tracking-widest text-[#9A9A92]">
            INICIANDO PROTOCOLO DE RECUPERACIÓN...
          </span>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

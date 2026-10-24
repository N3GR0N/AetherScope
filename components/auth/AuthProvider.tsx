"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { AuthUser, AuthService, AuthCredentials } from "@/lib/auth/types";
import { getAuthService } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (credentials?: AuthCredentials) => Promise<AuthUser | null>;
  signUp: (credentials: AuthCredentials) => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  authService,
}: {
  children: React.ReactNode;
  authService?: AuthService;
}) {
  const activeService = useMemo(() => authService ?? getAuthService(), [authService]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const checkUser = async () => {
      try {
        const currentUser = await activeService.getUser();
        if (!cancelled) {
          setUser(currentUser);
        }
      } catch (err) {
        console.warn("[AetherScope] Error verificando autenticación:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void checkUser();

    // Suscripción reactiva a cambios de sesión de Supabase
    let unsubscribe: (() => void) | undefined;
    if (typeof activeService.onAuthStateChange === "function") {
      unsubscribe = activeService.onAuthStateChange((updatedUser) => {
        if (!cancelled) {
          setUser(updatedUser);
        }
      });
    }

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [activeService]);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn: async (credentials?: AuthCredentials) => {
        const loggedUser = await activeService.signIn(credentials);
        setUser(loggedUser);
        return loggedUser;
      },
      signUp: async (credentials: AuthCredentials) => {
        if (!activeService.signUp) {
          throw new Error("Registro no implementado para este proveedor.");
        }
        const createdUser = await activeService.signUp(credentials);
        setUser(createdUser);
        return createdUser;
      },
      signOut: async () => {
        await activeService.signOut();
        setUser(null);
      },
    }),
    [user, loading, activeService]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de un AuthProvider");
  }
  return context;
}

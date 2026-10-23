"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import type { AuthUser, AuthService } from "@/lib/auth/types";
import { defaultAuthService } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  authService = defaultAuthService,
}: {
  children: React.ReactNode;
  authService?: AuthService;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const checkUser = async () => {
      try {
        const currentUser = await authService.getUser();
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

    return () => {
      cancelled = true;
    };
  }, [authService]);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn: async () => {
        await authService.signIn();
        const updated = await authService.getUser();
        setUser(updated);
      },
      signOut: async () => {
        await authService.signOut();
        setUser(null);
      },
    }),
    [user, loading, authService]
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

"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Hook canónico de React 19 / Next.js para renderizado condicional de cliente
 * evitando discrepancias de hidratación SSR (Hydration Mismatch).
 * Retorna false durante el SSR y la fase inicial de hidratación, y true una vez hidratado en el cliente.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

"use client";

import { useEffect, useState, useRef } from "react";

export type CdsState = "checking" | "ok" | "down";

export interface CdsStatus {
  simbad: boolean;
  hips: boolean;
  checkedAt: string;
}

type StatusListener = (status: CdsStatus, isDegraded: boolean, cdsState: CdsState) => void;
type RecoveryListener = () => void;

interface Subscriber {
  id: string;
  onStatusChange?: StatusListener;
  onRecovered?: RecoveryListener;
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Poller Manager por pestaña del navegador
// Maneja los 3 estados: 'checking' (inicial), 'ok', 'down'
// ─────────────────────────────────────────────────────────────────────────────
const subscribers = new Map<string, Subscriber>();
let currentStatus: CdsStatus | null = null;
let currentCdsState: CdsState = "checking";
let isCurrentlyDegraded = false;
let hasCheckedAtLeastOnce = false;
let isFetchInFlight = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let consecutiveFailures = 0;

export const POLL_INTERVAL_DEGRADED_MS = 30_000; // 30 s si está caído/degradado o en checking
export const POLL_INTERVAL_HEALTHY_MS = 120_000; // 2 min solo si está sano (ok)
export const CDS_STATUS_FETCH_TIMEOUT_MS = 6_000; // 6 s timeout para /api/cds-status

export function formatCheckedTime(isoOrDate?: string | Date): string {
  try {
    const d = isoOrDate ? new Date(isoOrDate) : new Date();
    if (isNaN(d.getTime())) {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return "00:00:00";
  }
}

/**
 * Determina si el estado 'ok' del CDS está forzado por variable de entorno de desarrollo.
 * Solo activo fuera de entornos de producción (NODE_ENV !== 'production').
 */
export function isCdsForcedOkInDev(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_FORCE_CDS_OK === "1"
  );
}

function scheduleNextPoll(delayMs: number): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (subscribers.size === 0) return;

  pollTimer = setTimeout(() => {
    void runPoll();
  }, delayMs);
}

export async function runPoll(): Promise<void> {
  if (isCdsForcedOkInDev()) {
    consecutiveFailures = 0;
    currentCdsState = "ok";
    isCurrentlyDegraded = false;
    currentStatus = {
      simbad: true,
      hips: true,
      checkedAt: new Date().toISOString(),
    };
    hasCheckedAtLeastOnce = true;
    for (const sub of subscribers.values()) {
      sub.onStatusChange?.(currentStatus, false, "ok");
    }
    return;
  }

  if (isFetchInFlight) return;
  isFetchInFlight = true;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CDS_STATUS_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch("/api/cds-status", {
      cache: "no-store",
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timer);

    if (!res || !res.ok) throw new Error("HTTP error or network failure");

    const data: CdsStatus | null = await res.json().catch(() => null);
    if (!data || typeof data.hips !== "boolean") throw new Error("Invalid payload");

    const isHipsDown = !data.hips;

    if (isHipsDown) {
      consecutiveFailures++;
      // Estado inicial checking: si la PRIMERA comprobación indica caído, pasar directo a down.
      // La regla de 2 fallos consecutivos aplica solo a la transición ok -> down en sesión abierta.
      if (currentCdsState === "checking" || consecutiveFailures >= 2) {
        currentCdsState = "down";
      }
      isCurrentlyDegraded = true;
    } else {
      consecutiveFailures = 0;
      const isRecoveryTransition = hasCheckedAtLeastOnce && currentCdsState === "down";
      currentCdsState = "ok";
      isCurrentlyDegraded = !data.simbad;

      if (isRecoveryTransition) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cds-recovered", { detail: data }));
        }
        for (const sub of subscribers.values()) {
          try {
            sub.onRecovered?.();
          } catch (err) {
            console.warn("[useCdsRecovery] Error en callback onRecovered:", err);
          }
        }
      }
    }

    currentStatus = data;
    hasCheckedAtLeastOnce = true;

    for (const sub of subscribers.values()) {
      sub.onStatusChange?.(data, isCurrentlyDegraded, currentCdsState);
    }
  } catch {
    clearTimeout(timer);
    consecutiveFailures++;
    // Si la primera comprobación falla o no responde en 6s (timeout), pasar directo a down
    if (currentCdsState === "checking" || consecutiveFailures >= 2) {
      currentCdsState = "down";
    }
    const fallbackStatus: CdsStatus = {
      simbad: false,
      hips: false,
      checkedAt: new Date().toISOString(),
    };
    currentStatus = fallbackStatus;
    isCurrentlyDegraded = true;
    hasCheckedAtLeastOnce = true;

    for (const sub of subscribers.values()) {
      sub.onStatusChange?.(fallbackStatus, true, currentCdsState);
    }
  } finally {
    clearTimeout(timer);
    isFetchInFlight = false;
    if (subscribers.size > 0) {
      // Polling: 30 s mientras sea checking o down; 2 min solo en ok
      const nextDelay = currentCdsState === "ok" ? POLL_INTERVAL_HEALTHY_MS : POLL_INTERVAL_DEGRADED_MS;
      scheduleNextPoll(nextDelay);
    }
  }
}

function registerSubscriber(sub: Subscriber): void {
  const isFirst = subscribers.size === 0;
  subscribers.set(sub.id, sub);

  if (currentStatus) {
    sub.onStatusChange?.(currentStatus, isCurrentlyDegraded, currentCdsState);
  }

  // Disparar inmediatamente al montar si es el primer suscriptor o no ha chequeado aún
  if (isFirst || (!hasCheckedAtLeastOnce && !isFetchInFlight)) {
    void runPoll();
  }
}

function unregisterSubscriber(id: string): void {
  subscribers.delete(id);
  if (subscribers.size === 0 && pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

export function onCdsRecovered(listener: () => void, autoPoll = false): () => void {
  const id = Math.random().toString(36).substring(2, 9);
  const sub: Subscriber = {
    id,
    onRecovered: listener,
  };
  subscribers.set(sub.id, sub);
  if (autoPoll) {
    void runPoll();
  }
  return () => unregisterSubscriber(id);
}

// Helpers para testing unitario
export function _resetRecoveryManagerForTests(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  subscribers.clear();
  currentStatus = null;
  currentCdsState = "checking";
  isCurrentlyDegraded = false;
  hasCheckedAtLeastOnce = false;
  isFetchInFlight = false;
  consecutiveFailures = 0;
}

export function _getCurrentCdsStateForTests(): CdsState {
  return currentCdsState;
}

export function _getConsecutiveFailuresForTests(): number {
  return consecutiveFailures;
}

export function _setCdsStateForTests(state: CdsState, status?: CdsStatus): void {
  currentCdsState = state;
  isCurrentlyDegraded = state === "down";
  consecutiveFailures = state === "down" ? 2 : 0;
  hasCheckedAtLeastOnce = true;
  if (status) {
    currentStatus = status;
  } else {
    currentStatus = {
      simbad: state === "ok",
      hips: state === "ok",
      checkedAt: new Date().toISOString(),
    };
  }
}

export function _setDegradedStateForTests(degraded: boolean): void {
  _setCdsStateForTests(degraded ? "down" : "ok");
}

export interface UseCdsRecoveryOptions {
  onRecovered?: () => void;
}

export function useCdsRecovery(options: UseCdsRecoveryOptions = {}) {
  const isForced = isCdsForcedOkInDev();
  const [status, setStatus] = useState<CdsStatus | null>(() =>
    isForced ? { simbad: true, hips: true, checkedAt: new Date().toISOString() } : currentStatus
  );
  const [isDegraded, setIsDegraded] = useState<boolean>(() => (isForced ? false : isCurrentlyDegraded));
  const [cdsState, setCdsState] = useState<CdsState>(() => (isForced ? "ok" : currentCdsState));

  const onRecoveredRef = useRef(options.onRecovered);
  useEffect(() => {
    onRecoveredRef.current = options.onRecovered;
  }, [options.onRecovered]);

  useEffect(() => {
    const subscriberId = Math.random().toString(36).substring(2, 9);

    const subscriber: Subscriber = {
      id: subscriberId,
      onRecovered: () => {
        onRecoveredRef.current?.();
      },
      onStatusChange: (newStatus, degraded, state) => {
        setStatus(newStatus);
        setIsDegraded(degraded);
        setCdsState(state);
      },
    };

    registerSubscriber(subscriber);

    return () => {
      unregisterSubscriber(subscriberId);
    };
  }, []);

  return {
    status,
    isDegraded,
    cdsState,
    isDown: cdsState === "down",
    isChecking: cdsState === "checking",
    isOk: cdsState === "ok",
    lastCheckedTime: formatCheckedTime(status?.checkedAt),
    checkNow: runPoll,
    triggerPoll: runPoll,
  };
}

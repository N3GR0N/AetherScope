"use client";

import { useEffect, useState, useRef } from "react";

export interface CdsStatus {
  simbad: boolean;
  hips: boolean;
  checkedAt: string;
}

type StatusListener = (status: CdsStatus, isDegraded: boolean) => void;
type RecoveryListener = () => void;

interface Subscriber {
  id: string;
  onStatusChange?: StatusListener;
  onRecovered?: RecoveryListener;
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Poller Manager por pestaña del navegador
// Garantiza: un solo temporizador activo, sin peticiones paralelas y limpieza al desmontar
// ─────────────────────────────────────────────────────────────────────────────
const subscribers = new Map<string, Subscriber>();
let currentStatus: CdsStatus | null = null;
let isCurrentlyDegraded = false;
let hasCheckedAtLeastOnce = false;
let isFetchInFlight = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

const POLL_INTERVAL_DEGRADED_MS = 30_000; // 30 s si está degradado
const POLL_INTERVAL_HEALTHY_MS = 120_000; // 2 min si está sano

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
  if (isFetchInFlight) return;
  isFetchInFlight = true;

  try {
    const res = await fetch("/api/cds-status", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: CdsStatus = await res.json();
    const nextDegraded = !data.simbad || !data.hips;
    const isRecoveryTransition = hasCheckedAtLeastOnce && isCurrentlyDegraded && !nextDegraded;

    currentStatus = data;
    isCurrentlyDegraded = nextDegraded;
    hasCheckedAtLeastOnce = true;

    // Notificar cambio de estado a todos los suscriptores
    for (const sub of subscribers.values()) {
      sub.onStatusChange?.(data, nextDegraded);
    }

    // Si transitó de degradado a sano, disparar callback y evento global una sola vez
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
  } catch {
    // Si la llamada al endpoint falla, consideramos estado degradado
    const fallbackStatus: CdsStatus = {
      simbad: false,
      hips: false,
      checkedAt: new Date().toISOString(),
    };
    currentStatus = fallbackStatus;
    isCurrentlyDegraded = true;
    hasCheckedAtLeastOnce = true;

    for (const sub of subscribers.values()) {
      sub.onStatusChange?.(fallbackStatus, true);
    }
  } finally {
    isFetchInFlight = false;
    if (subscribers.size > 0) {
      const nextDelay = isCurrentlyDegraded ? POLL_INTERVAL_DEGRADED_MS : POLL_INTERVAL_HEALTHY_MS;
      scheduleNextPoll(nextDelay);
    }
  }
}

function registerSubscriber(sub: Subscriber): void {
  const isFirst = subscribers.size === 0;
  subscribers.set(sub.id, sub);

  // Si ya tenemos un estado previo, notificar inmediatamente
  if (currentStatus) {
    sub.onStatusChange?.(currentStatus, isCurrentlyDegraded);
  }

  // Si es el primer suscriptor montado en la pestaña, iniciar sondeo
  if (isFirst) {
    void runPoll();
  }
}

function unregisterSubscriber(id: string): void {
  subscribers.delete(id);
  // Si no quedan suscriptores activos en la pestaña, limpiar temporizador
  if (subscribers.size === 0 && pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

// Helpers para testing unitario
export function _resetRecoveryManagerForTests(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  subscribers.clear();
  currentStatus = null;
  isCurrentlyDegraded = false;
  hasCheckedAtLeastOnce = false;
  isFetchInFlight = false;
}

export function _setDegradedStateForTests(degraded: boolean): void {
  isCurrentlyDegraded = degraded;
  hasCheckedAtLeastOnce = true;
}

export interface UseCdsRecoveryOptions {
  onRecovered?: () => void;
}

export function useCdsRecovery(options: UseCdsRecoveryOptions = {}) {
  const [status, setStatus] = useState<CdsStatus | null>(() => currentStatus);
  const [isDegraded, setIsDegraded] = useState<boolean>(() => isCurrentlyDegraded);

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
      onStatusChange: (newStatus, degraded) => {
        setStatus(newStatus);
        setIsDegraded(degraded);
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
    checkNow: runPoll,
  };
}

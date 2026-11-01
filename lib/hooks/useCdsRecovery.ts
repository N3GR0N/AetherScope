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

const POLL_INTERVAL_DEGRADED_MS = 30_000; // 30 s si está caído/degradado
const POLL_INTERVAL_HEALTHY_MS = 120_000; // 2 min si está sano

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
    const res = await fetch("/api/cds-status", { cache: "no-store" }).catch(() => null);
    if (!res || !res.ok) throw new Error("HTTP error or network failure");

    const data: CdsStatus | null = await res.json().catch(() => null);
    if (!data || typeof data.hips !== "boolean") throw new Error("Invalid payload");

    // Estado down: HiPS caído, o HiPS y SIMBAD caídos
    const isDown = !data.hips;
    const nextCdsState: CdsState = isDown ? "down" : "ok";
    const nextDegraded = !data.simbad || !data.hips;
    const isRecoveryTransition = hasCheckedAtLeastOnce && currentCdsState === "down" && nextCdsState === "ok";

    currentStatus = data;
    currentCdsState = nextCdsState;
    isCurrentlyDegraded = nextDegraded;
    hasCheckedAtLeastOnce = true;

    for (const sub of subscribers.values()) {
      sub.onStatusChange?.(data, nextDegraded, nextCdsState);
    }

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
    const fallbackStatus: CdsStatus = {
      simbad: false,
      hips: false,
      checkedAt: new Date().toISOString(),
    };
    currentStatus = fallbackStatus;
    currentCdsState = "down";
    isCurrentlyDegraded = true;
    hasCheckedAtLeastOnce = true;

    for (const sub of subscribers.values()) {
      sub.onStatusChange?.(fallbackStatus, true, "down");
    }
  } finally {
    isFetchInFlight = false;
    if (subscribers.size > 0) {
      const nextDelay = currentCdsState === "down" ? POLL_INTERVAL_DEGRADED_MS : POLL_INTERVAL_HEALTHY_MS;
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

  if (isFirst) {
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
}

export function _setCdsStateForTests(state: CdsState, status?: CdsStatus): void {
  currentCdsState = state;
  isCurrentlyDegraded = state === "down";
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
  const [status, setStatus] = useState<CdsStatus | null>(() => currentStatus);
  const [isDegraded, setIsDegraded] = useState<boolean>(() => isCurrentlyDegraded);
  const [cdsState, setCdsState] = useState<CdsState>(() => currentCdsState);

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

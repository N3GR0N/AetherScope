"use client";

import { useEffect } from "react";
import { initSquircle } from "@usespaceui/squircle";

export default function SquircleInitializer() {
  useEffect(() => {
    try {
      initSquircle();
    } catch (e) {
      console.warn("[AetherScope] Squircle worklet init:", e);
    }
  }, []);

  return null;
}

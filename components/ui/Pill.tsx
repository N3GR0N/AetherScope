"use client";

import React, { forwardRef } from "react";

export interface PillProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "active" | "ok" | "error" | "surface";
  size?: "sm" | "md";
}

export const Pill = forwardRef<HTMLDivElement, PillProps>(
  ({ variant = "default", size = "md", className = "", children, ...props }, ref) => {
    const variantStyles = {
      default: "bg-transparent text-[var(--text-muted)] border border-[var(--border)]",
      surface: "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]",
      active: "bg-[var(--accent)] text-[var(--on-accent)] font-semibold border-[var(--accent)]",
      ok: "bg-[var(--surface-2)] text-[var(--ok)] border border-[var(--border)]",
      error: "bg-[var(--surface-2)] text-[var(--error)] border border-[var(--border)]",
    }[variant];

    const sizeStyles = {
      sm: "text-[11px] px-2.5 py-1 min-h-[28px] gap-1.5",
      md: "text-[12px] sm:text-[13px] px-3.5 py-1.5 min-h-[34px] gap-2",
    }[size];

    return (
      <div
        ref={ref}
        className={`inline-flex items-center justify-center rounded-full font-medium select-none ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Pill.displayName = "Pill";

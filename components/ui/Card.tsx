"use client";

import React, { forwardRef } from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "solid" | "glass";
  elevation?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "solid", elevation = true, className = "", children, ...props }, ref) => {
    const variantStyles =
      variant === "glass"
        ? "glass-panel"
        : "bg-[var(--surface-1)] border border-[var(--border)]";

    const elevationStyles = elevation ? "shadow-[0_8px_24px_rgba(0,0,0,0.35)]" : "";

    return (
      <div
        ref={ref}
        className={`rounded-[20px] ${variantStyles} ${elevationStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

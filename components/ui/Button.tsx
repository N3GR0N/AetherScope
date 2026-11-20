"use client";

import React, { forwardRef } from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  shape?: "pill" | "rounded";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      shape = "pill",
      isLoading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none";

    const variantStyles = {
      primary:
        "bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90 active:scale-[0.98] border-none font-semibold",
      secondary:
        "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-1)] active:scale-[0.98]",
      outline:
        "bg-transparent text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--surface-2)] active:scale-[0.98]",
      ghost:
        "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] active:scale-[0.98]",
    }[variant];

    const sizeStyles = {
      sm: "text-[12px] min-h-[36px] px-3 gap-1.5",
      md: "text-[13px] min-h-[40px] px-4 gap-2",
      lg: "text-[14px] min-h-[44px] px-5 gap-2.5",
      icon: "w-10 h-10 min-h-[40px] p-0 flex items-center justify-center shrink-0",
    }[size];

    const shapeStyles = shape === "pill" ? "rounded-full" : "rounded-[12px]";

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles} ${sizeStyles} ${shapeStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

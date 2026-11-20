"use client";

import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ leftIcon, rightIcon, className = "", ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3 text-[var(--text-muted)] pointer-events-none flex items-center justify-center">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-muted)] border border-[var(--border)] rounded-[12px] text-[13px] min-h-[40px] transition-colors focus:border-[var(--border-strong)] focus-visible:outline-none ${
            leftIcon ? "pl-9" : "pl-3.5"
          } ${rightIcon ? "pr-9" : "pr-3.5"} ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 text-[var(--text-muted)] pointer-events-none flex items-center justify-center">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

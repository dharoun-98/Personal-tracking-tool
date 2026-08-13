"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "./button-styles";

export { buttonClasses } from "./button-styles";
export type { ButtonSize, ButtonVariant } from "./button-styles";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={buttonClasses({ variant, size, fullWidth, className })}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);

/** Square icon button — used for the mascot, nav actions and sheet dismissals. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & { label: string }
>(function IconButton({ className, label, size = "md", ...props }, ref) {
  const box = size === "sm" ? "size-11" : size === "lg" ? "size-13" : "size-11";
  return (
    <Button
      ref={ref}
      aria-label={label}
      size={size}
      className={cn(box, "px-0", className)}
      {...props}
    />
  );
});

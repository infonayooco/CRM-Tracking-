import type { ButtonHTMLAttributes } from "react";
import { ghostBtnClass, primaryBtnClass, tintedBtnClass } from "./primitives";

const VARIANTS = {
  primary: primaryBtnClass,
  ghost: ghostBtnClass,
  tinted: tintedBtnClass,
} as const;

/** Modernize button: no uppercase, no shadow, rounded-lg, periwinkle primary. */
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return <button type={type} className={`${VARIANTS[variant]} ${className}`} {...rest} />;
}

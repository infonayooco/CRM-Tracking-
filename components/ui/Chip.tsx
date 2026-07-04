import type { ReactNode } from "react";

export type ChipTone = "primary" | "secondary" | "success" | "warning" | "error" | "info" | "muted";

const TONE: Record<ChipTone, string> = {
  primary: "bg-primary-light text-primary-dark",
  secondary: "bg-secondary-light text-info-dark",
  success: "bg-success-light text-success-dark",
  warning: "bg-warning-light text-warning-dark",
  error: "bg-error-light text-error-dark",
  info: "bg-info-light text-info-dark",
  muted: "bg-slate-100 text-slate-600",
};

/** Modernize tinted status chip: pastel background + legible same-hue text. */
export function Chip({
  tone = "muted",
  children,
  className = "",
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-lg px-2 text-xs font-semibold ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

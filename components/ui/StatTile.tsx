import type { ReactNode } from "react";
import { cardClass } from "./primitives";

export type StatTone = "primary" | "secondary" | "success" | "warning" | "error" | "info";

const ICON_TONE: Record<StatTone, string> = {
  primary: "bg-primary-light text-primary-dark",
  secondary: "bg-secondary-light text-info-dark",
  success: "bg-success-light text-success-dark",
  warning: "bg-warning-light text-warning-dark",
  error: "bg-error-light text-error-dark",
  info: "bg-info-light text-info-dark",
};

/** Modernize metric widget: tinted icon chip + big value + label + optional trend pill. */
export function StatTile({
  icon,
  label,
  value,
  tone = "primary",
  trend,
  className = "",
}: {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  tone?: StatTone;
  trend?: { dir: "up" | "down"; text: ReactNode };
  className?: string;
}) {
  return (
    <div className={`${cardClass} p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        {icon ? (
          <span className={`grid size-10 place-items-center rounded-lg ${ICON_TONE[tone]}`}>{icon}</span>
        ) : (
          <span />
        )}
        {trend ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              trend.dir === "up" ? "bg-success-light text-success-dark" : "bg-error-light text-error-dark"
            }`}
          >
            {trend.text}
          </span>
        ) : null}
      </div>
      <p className="tnum mt-3 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
    </div>
  );
}

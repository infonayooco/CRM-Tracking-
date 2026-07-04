import type { HTMLAttributes, ReactNode } from "react";
import { cardClass } from "./primitives";

function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Bare Modernize surface (rounded, hairline border, soft card shadow). Bring your own padding. */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(cardClass, className)} {...rest}>
      {children}
    </div>
  );
}

/** Card with a Modernize header row: title (h5) + optional subtitle + right-aligned action slot. */
export function DashboardCard({
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const hasHeader = Boolean(title || action);
  return (
    <section className={cn(cardClass, "flex flex-col", className)}>
      {hasHeader ? (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title ? <h3 className="truncate text-base font-semibold text-ink">{title}</h3> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn(hasHeader ? "px-5 pb-5 pt-4" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

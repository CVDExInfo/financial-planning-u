import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  badge,
  icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-5 shadow-sm",
        "dark:from-slate-900/80 dark:via-slate-900 dark:to-slate-900/90",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            {icon && <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">{icon}</span>}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
                {badge && <Badge variant="secondary" className="bg-white/20 text-white">{badge}</Badge>}
              </div>
              {description && (
                <p className="text-sm text-slate-200/90 leading-relaxed max-w-3xl">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;

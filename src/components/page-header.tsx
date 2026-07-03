import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  action,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {Icon ? <Icon className="mt-0.5 size-7 shrink-0" /> : null}
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </header>
  );
}

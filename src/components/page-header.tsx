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
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? <Icon className="size-7 shrink-0" /> : null}
        <h1 className="min-w-0 truncate text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {subtitle ? (
          <p className="text-right text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
        {action}
      </div>
    </header>
  );
}

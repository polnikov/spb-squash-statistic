"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Search, Snail, X } from "lucide-react";
import type { PlayerOverview } from "@/lib/mock/league";
import { cn } from "@/lib/utils";
import { PlayerAvatar, usePlayerAvatar } from "@/components/player-avatar";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { avatarBackgroundStyle } from "@/lib/player-avatar-store";

const MOBILE_PAGE_SIZE = 16;
const DESKTOP_PAGE_SIZE = 24;

function DivBadges({ items }: { items: { div: number; place: number | null }[] }) {
  return (
    <>
      {items.map((it) => (
        <span key={it.div} className="rounded-full bg-brand-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-ink-2">
          Д{it.div}{it.place ? ` · #${it.place}` : ""}
        </span>
      ))}
    </>
  );
}

function splitPlayerName(name: string) {
  const [first = name, ...rest] = name.trim().split(/\s+/);
  return { first, rest: rest.join(" ") };
}

function playerHref(rid: string) {
  return `/players/${encodeURIComponent(rid)}`;
}

function SkillIndexMiniBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full border border-[#dff7a5]/45 bg-[#dff7a5]/92 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#26320b] backdrop-blur-md">
      <Snail className="size-3 shrink-0" />
      <span className="font-mono tabular">{value.toFixed(1)}</span>
    </span>
  );
}

function MobilePlayerCard({ player }: { player: PlayerOverview }) {
  const avatar = usePlayerAvatar(player.rid);
  const name = splitPlayerName(player.name);

  if (avatar) {
    return (
      <Link
        href={playerHref(player.rid)}
        className="relative flex min-h-[178px] overflow-hidden rounded-lg bg-card bg-cover bg-center text-center"
        style={avatarBackgroundStyle(avatar)}
      >
        <SkillIndexMiniBadge value={player.skillIndex} />
        <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#161616] to-transparent" />
        <div className="relative z-10 mt-auto flex w-full items-end justify-between gap-2 px-3.5 pb-4 text-left">
          <div className="min-w-0 text-[13.5px] font-semibold leading-tight text-white">
            <span className="block truncate">{name.first}</span>
            {name.rest ? <span className="block truncate">{name.rest}</span> : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <DivBadges items={player.divisionPlaces} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={playerHref(player.rid)}
      className="relative flex flex-col items-center gap-[11px] rounded-lg bg-card px-3.5 pb-4 pt-5 text-center"
    >
      <SkillIndexMiniBadge value={player.skillIndex} />
      <PlayerAvatar rid={player.rid} initials={player.initials} color={player.color} className="size-[60px] text-xl" />
      <div className="w-full text-balance break-words text-[13.5px] font-semibold leading-tight">{player.name}</div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <DivBadges items={player.divisionPlaces} />
      </div>
    </Link>
  );
}

function DesktopPlayerCard({ player }: { player: PlayerOverview }) {
  const avatar = usePlayerAvatar(player.rid);
  const name = splitPlayerName(player.name);

  if (avatar) {
    return (
      <Link
        href={playerHref(player.rid)}
        className="group relative flex min-h-[168px] overflow-hidden rounded-lg bg-card bg-cover bg-center transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5"
        style={avatarBackgroundStyle(avatar)}
      >
        <SkillIndexMiniBadge value={player.skillIndex} />
        <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[#161616] to-transparent" />
        <div className="relative z-10 mt-auto flex w-full items-end justify-between gap-3 px-4 pb-4">
          <div className="min-w-0 text-sm font-semibold leading-tight text-white">
            <span className="block truncate">{name.first}</span>
            {name.rest ? <span className="block truncate">{name.rest}</span> : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <DivBadges items={player.divisionPlaces} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={playerHref(player.rid)}
      className="group relative flex min-h-[168px] flex-col items-center justify-center gap-3 rounded-lg bg-card p-4 text-center transition-transform duration-300 ease-m3-emphasized-decel hover:-translate-y-0.5"
    >
      <SkillIndexMiniBadge value={player.skillIndex} />
      <PlayerAvatar rid={player.rid} initials={player.initials} color={player.color} className="size-16 text-xl" />
      <div className="w-full truncate text-sm font-semibold">{player.name}</div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <DivBadges items={player.divisionPlaces} />
      </div>
    </Link>
  );
}

const DIV_SCOPES: { key: "all" | 1 | 2 | 3; label: string }[] = [
  { key: "all", label: "Все" },
  { key: 1, label: "Дивизион 1" },
  { key: 2, label: "Дивизион 2" },
  { key: 3, label: "Дивизион 3" },
];

/** Mobile scope filter — accordion-expand dropdown mirroring the desktop tabs. */
function ScopeDropdown({
  value,
  onChange,
  className,
}: {
  value: "all" | 1 | 2 | 3;
  onChange: (value: "all" | 1 | 2 | 3) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  const cur = DIV_SCOPES.find((s) => s.key === value);
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[46px] w-full items-center justify-between gap-2 rounded-2xl border border-border bg-brand-surface px-3.5 text-sm font-medium text-foreground outline-none"
      >
        <span className="truncate">{cur?.label}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-m3-emphasized-decel", open && "rotate-180")} />
      </button>
      {/* Accordion expand (transitions.dev): grid-template-rows 0fr -> 1fr. */}
      <div
        className={cn(
          "absolute right-0 top-[calc(100%+6px)] z-30 grid w-full min-w-[150px] transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel",
          open ? "grid-rows-[1fr]" : "pointer-events-none grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden rounded-2xl shadow-e2">
          <div className="rounded-2xl border border-border bg-brand-surface p-1.5">
            {DIV_SCOPES.map((s) => (
              <button
                key={String(s.key)}
                type="button"
                onClick={() => {
                  onChange(s.key);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full rounded-[10px] px-3 py-2 text-left text-[13px] transition-colors duration-150 ease-m3-standard hover:bg-brand-surface-2",
                  s.key === value ? "font-semibold text-primary" : "text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayersList({ players }: { players: PlayerOverview[] }) {
  const [query, setQuery] = React.useState("");
  const [scope, setScope] = React.useState<"all" | 1 | 2 | 3>("all");
  const [expanded, setExpanded] = React.useState(false);
  const { setRef, ind } = useTabSlider(String(scope));
  const q = query.trim().toLowerCase();
  const sorted = React.useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [players],
  );
  const filtered = sorted.filter(
    (p) =>
      (scope === "all" || p.divisions.includes(scope)) &&
      (!q || p.name.toLowerCase().includes(q)),
  );
  const mobileFirst = filtered.slice(0, MOBILE_PAGE_SIZE);
  const mobileRest = filtered.slice(MOBILE_PAGE_SIZE);
  const desktopFirst = filtered.slice(0, DESKTOP_PAGE_SIZE);
  const desktopRest = filtered.slice(DESKTOP_PAGE_SIZE);

  React.useEffect(() => setExpanded(false), [query, scope]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        {/* desktop: division filter tabs (left) */}
        <div className="relative hidden gap-1 rounded-[16px] border border-border bg-brand-surface p-1 md:inline-flex">
          <TabSliderPill ind={ind} className="bg-brand-surface-2" />
          {DIV_SCOPES.map((s) => (
            <button
              key={String(s.key)}
              ref={setRef(String(s.key))}
              onClick={() => setScope(s.key)}
              className={cn(
                "relative z-10 h-9 rounded-[12px] px-5 text-xs font-semibold transition-colors duration-200 ease-m3-standard",
                scope === s.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex h-[46px] flex-1 items-center gap-2.5 rounded-2xl border border-border bg-brand-surface px-3.5 focus-within:ring-2 focus-within:ring-ring/40 md:ml-auto md:max-w-md md:flex-none">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск..."
            className="h-full w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-m3-standard hover:bg-surface-container-high hover:text-on-surface"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <ScopeDropdown value={scope} onChange={setScope} className="w-[132px] shrink-0 md:hidden" />
      </div>

      {/* mobile: 2-col centered cards */}
      <div className="md:hidden">
        <div className="grid grid-cols-2 gap-2">
          {mobileFirst.map((p) => (
            <MobilePlayerCard key={p.rid} player={p} />
          ))}
        </div>
        {mobileRest.length > 0 ? (
          <>
            {/* extra cards reveal via accordion expand (grid-rows 0fr -> 1fr) */}
            <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="min-h-0 overflow-hidden">
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {mobileRest.map((p) => (
                    <MobilePlayerCard key={p.rid} player={p} />
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
            >
              {expanded ? "Свернуть" : `Показать еще ${mobileRest.length}`}
            </button>
          </>
        ) : null}
      </div>

      {/* desktop: 4-col cards */}
      <div className="hidden md:block">
        <div className="grid grid-cols-4 gap-3">
          {desktopFirst.map((p) => (
            <DesktopPlayerCard key={p.rid} player={p} />
          ))}
        </div>
        {desktopRest.length > 0 ? (
          <>
            {/* extra cards reveal via accordion expand (grid-rows 0fr -> 1fr) */}
            <div className={cn("grid transition-[grid-template-rows] duration-300 ease-m3-emphasized-decel", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="min-h-0 overflow-hidden">
                <div className="grid grid-cols-4 gap-3 pt-3">
                  {desktopRest.map((p) => (
                    <DesktopPlayerCard key={p.rid} player={p} />
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 w-full rounded-lg bg-surface-container-high py-[13px] text-[12.5px] font-semibold text-primary transition-colors duration-200 ease-m3-standard hover:bg-surface-container-highest"
            >
              {expanded ? "Свернуть" : `Показать еще ${desktopRest.length}`}
            </button>
          </>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg bg-card p-8 text-center text-sm text-muted-foreground">
          Игроки не найдены
        </div>
      ) : null}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import type { RatingRow } from "@/lib/mock/league";
import { cn } from "@/lib/utils";
import { RatingPositionDelta } from "@/components/rating-position-delta";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";

export type DivTopCard = {
  division: number;
  label: string;
  players: { idx: number; name: string; points: number; pos: number; rid: string }[];
};

const DIVS = [1, 2, 3] as const;

function ChangeBadge({ delta }: { delta: number }) {
  return <RatingPositionDelta delta={delta} />;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-surface-container-high px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular text-on-surface">
      {children}
    </span>
  );
}

export function RatingMobile({
  listByDivision,
  stagesByDivision,
  totalStages,
}: {
  listByDivision: Record<1 | 2 | 3, RatingRow[]>;
  stagesByDivision: Record<1 | 2 | 3, number>;
  totalStages: number;
}) {
  const [div, setDiv] = React.useState<1 | 2 | 3>(1);
  const list = listByDivision[div];

  const { setRef, ind } = useTabSlider(String(div));

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center gap-2.5">
        <Star className="size-7 shrink-0" />
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Рейтинг сезона</h1>
      </div>

      {/* division tabs */}
      <div className="relative mb-2 flex gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1">
        <TabSliderPill ind={ind} />
        {DIVS.map((d) => (
          <button
            key={d}
            ref={setRef(String(d))}
            onClick={() => setDiv(d)}
            className={cn(
              "relative z-10 h-9 flex-1 rounded-[12px] text-xs font-semibold transition-colors duration-200 ease-m3-standard",
              div === d ? "text-on-surface" : "text-on-surface-variant",
            )}
          >
            Див {d}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg bg-surface-container px-4 py-8 text-center text-sm font-semibold text-on-surface">
          Данных пока нет
        </div>
      ) : (
        <>
          {/* stage progress: 9 circles, played stages accent-filled; full width */}
          <div className="mb-4 flex items-center gap-1 rounded-[16px] border border-outline-variant bg-surface-container-low p-1">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <span
                key={n}
                className={cn(
                  "grid aspect-square flex-1 place-items-center rounded-full font-mono text-[12px] font-semibold tabular",
                  n <= stagesByDivision[div] ? "bg-[#20c7d991] text-on-primary" : "bg-surface-container-high text-on-surface-variant",
                )}
              >
                {n}
              </span>
            ))}
          </div>

          {/* player cards */}
          <div className="flex flex-col gap-2">
            {list.map((r) => (
              <Link
                key={r.rid}
                href={`/players/${encodeURIComponent(r.rid)}`}
                className="flex flex-col gap-1.5 rounded-lg bg-surface-container px-4 py-3"
              >
                <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
                  <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-surface-container-high px-1.5 font-mono text-xs font-semibold tabular text-on-surface-variant">
                    {r.place}
                  </span>
                  <span className="shrink-0">
                    <ChangeBadge delta={r.positionDelta} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-[550]">{r.name}</span>
                  <span className="shrink-0 font-mono text-[17px] font-semibold tabular">{r.points}</span>
                </div>
                <div className="flex items-center gap-x-2 overflow-x-auto whitespace-nowrap pt-1 text-[11.5px] text-on-surface-variant [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <span className="inline-flex shrink-0 items-center gap-1">
                    Этапов<Badge>{r.stages}/{totalStages}</Badge>
                  </span>
                  <span className="shrink-0">·</span>
                  <span className="inline-flex shrink-0 items-center gap-1">
                    Матчи<Badge>{r.matches}</Badge>
                  </span>
                  <span className="shrink-0">·</span>
                  <span className="inline-flex shrink-0 items-center gap-1">
                    Последний этап<Badge>{r.lastStagePoints > 0 ? `+${r.lastStagePoints}` : "x"}</Badge>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

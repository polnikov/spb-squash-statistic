"use client";

import * as React from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import type { RatingRow } from "@/lib/league";
import { cn } from "@/lib/utils";
import { RatingPositionDelta } from "@/components/rating-position-delta";
import { RatingStageSelector } from "@/components/rating-stage-selector";
import { NumberPop } from "@/components/ui/number-pop";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { useFlipList } from "@/components/ui/use-flip-list";

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
  rowsByDivisionStage,
  stagesByDivision,
  totalStages,
  ratingMaxStage,
}: {
  listByDivision: Record<1 | 2 | 3, RatingRow[]>;
  rowsByDivisionStage: Record<1 | 2 | 3, Record<number, RatingRow[]>>;
  stagesByDivision: Record<1 | 2 | 3, number>;
  totalStages: number;
  ratingMaxStage: number;
}) {
  const [div, setDiv] = React.useState<1 | 2 | 3>(1);
  const initialStage = React.useCallback(
    (division: 1 | 2 | 3) => Math.max(1, Math.min(stagesByDivision[division], ratingMaxStage)),
    [ratingMaxStage, stagesByDivision],
  );
  const [selectedStageByDivision, setSelectedStageByDivision] = React.useState<Record<1 | 2 | 3, number>>(() => ({
    1: initialStage(1),
    2: initialStage(2),
    3: initialStage(3),
  }));
  const selectedStage = selectedStageByDivision[div];
  const list = rowsByDivisionStage[div]?.[selectedStage] ?? listByDivision[div] ?? [];
  const hasDivisionData = (listByDivision[div]?.length ?? 0) > 0;
  const flip = useFlipList();
  const orderKey = list.map((r) => `${r.rid}:${r.place}:${r.points}:${r.matches}:${r.stages}`).join("|");

  const { setRef, ind } = useTabSlider(String(div));

  React.useLayoutEffect(() => {
    flip.play();
  }, [flip, orderKey]);

  function selectStage(stage: number) {
    if (stage === selectedStage) return;
    flip.snapshot();
    setSelectedStageByDivision((prev) => ({ ...prev, [div]: stage }));
  }

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

      {!hasDivisionData ? (
        <div className="rounded-lg border border-outline-variant bg-surface-container px-4 py-8 text-center text-sm font-semibold text-on-surface">
          Данных пока нет
        </div>
      ) : (
        <>
          {/* stage progress: 9 circles, played stages accent-filled; full width */}
          <RatingStageSelector
            totalStages={totalStages}
            playedStage={stagesByDivision[div]}
            selectedStage={selectedStage}
            ratingMaxStage={ratingMaxStage}
            onSelect={selectStage}
            className="mb-4"
            itemClassName="aspect-square flex-1"
          />

          {/* player cards */}
          <div className="flex flex-col gap-2">
            {list.length === 0 ? (
              <div className="rounded-lg border border-outline-variant bg-surface-container px-4 py-8 text-center text-sm font-semibold text-on-surface">
                Данных пока нет
              </div>
            ) : list.map((r) => (
              <Link
                key={r.rid}
                ref={flip.setNode(r.rid)}
                href={`/players/${encodeURIComponent(r.rid)}`}
                className="flex flex-col gap-1.5 rounded-lg border border-outline-variant bg-surface-container px-4 py-3"
              >
                <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
                  <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-surface-container-high px-1.5 font-mono text-xs font-semibold tabular text-on-surface-variant">
                    <NumberPop>{r.place}</NumberPop>
                  </span>
                  <span className="shrink-0">
                    <ChangeBadge delta={r.positionDelta} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-[550]">{r.name}</span>
                  <span className="shrink-0 font-mono text-[17px] font-semibold tabular">
                    <NumberPop>{r.points}</NumberPop>
                  </span>
                </div>
                <div className="flex items-center gap-x-2 overflow-x-auto whitespace-nowrap pt-1 text-[11.5px] text-on-surface-variant [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <span className="inline-flex shrink-0 items-center gap-1">
                    Этапы<Badge><NumberPop>{`${r.stages}/${totalStages}`}</NumberPop></Badge>
                  </span>
                  <span className="shrink-0">·</span>
                  <span className="inline-flex shrink-0 items-center gap-1">
                    Матчи<Badge><NumberPop>{r.matches}</NumberPop></Badge>
                  </span>
                  <span className="shrink-0">·</span>
                  <span className="inline-flex shrink-0 items-center gap-1">
                    Последний этап<Badge><NumberPop>{r.lastStagePoints > 0 ? `+${r.lastStagePoints}` : "x"}</NumberPop></Badge>
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

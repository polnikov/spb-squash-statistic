"use client";

import * as React from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import type { RatingRow } from "@/lib/league";
import { cn } from "@/lib/utils";
import { RatingPinButton } from "@/components/rating-pin-button";
import { RatingPinnedBar, findRowNode } from "@/components/rating-pinned-bar";
import { RatingPositionDelta } from "@/components/rating-position-delta";
import { RatingStageSelector } from "@/components/rating-stage-selector";
import { NumberPop } from "@/components/ui/number-pop";
import { SearchBox } from "@/components/ui/search-box";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { SlideSwitch, useSlideDirection } from "@/components/ui/slide-switch";
import { usePinnedPlayer } from "@/components/ui/use-pinned-player";
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
    <span className="inline-flex items-center rounded border border-outline-variant bg-surface-container-high px-1.5 py-0.5 font-mono text-[10.5px] font-semibold leading-none tabular text-on-surface">
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
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const visibleList = q ? list.filter((r) => r.name.toLowerCase().includes(q)) : list;
  const flip = useFlipList();
  const orderKey = visibleList.map((r) => `${r.rid}:${r.place}:${r.points}:${r.matches}:${r.stages}`).join("|");

  const { pinnedRid, isPinned, toggle } = usePinnedPlayer();
  // The pinned row is looked up in the unfiltered stage list so the tracker bar
  // survives an active search that hides the row.
  const pinnedRow = pinnedRid ? list.find((r) => r.rid === pinnedRid) : undefined;

  const { setRef, ind } = useTabSlider(String(div));
  const slideDir = useSlideDirection(div);

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

          {/* search: after the stage element, full width */}
          <SearchBox value={query} onChange={setQuery} className="mb-4 w-full" />

          {/* player cards, directional slide on division switch */}
          <div className="overflow-hidden">
          <SlideSwitch tabKey={div} direction={slideDir} className="flex flex-col gap-2">
            {visibleList.length === 0 ? (
              <div className="rounded-lg border border-outline-variant bg-surface-container px-4 py-8 text-center text-sm font-semibold text-on-surface">
                {q ? "Ничего не найдено" : "Данных пока нет"}
              </div>
            ) : visibleList.map((r) => (
              <Link
                key={r.rid}
                ref={flip.setNode(r.rid)}
                data-rating-rid={r.rid}
                href={`/players/${encodeURIComponent(r.rid)}`}
                className="flex flex-col gap-1.5 rounded-lg border border-outline-variant bg-surface-container px-4 py-3"
              >
                <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
                  <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface-container-high px-1.5 font-mono text-xs font-semibold tabular text-primary">
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
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex min-w-0 flex-1 items-center gap-x-2 overflow-x-auto whitespace-nowrap text-[11.5px] text-on-surface-variant [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <span className="inline-flex shrink-0 items-center gap-1">
                      Этапы<Badge>{`${r.stages}/${totalStages}`}</Badge>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1">
                      Матчи<Badge>{r.matches}</Badge>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1">
                      Последний этап<Badge>{r.lastStagePoints > 0 ? `+${r.lastStagePoints}` : "x"}</Badge>
                    </span>
                  </div>
                  <RatingPinButton
                    pinned={isPinned(r.rid)}
                    className="shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(r.rid);
                    }}
                  />
                </div>
              </Link>
            ))}
          </SlideSwitch>
          </div>
        </>
      )}

      {pinnedRow ? (
        <RatingPinnedBar
          row={pinnedRow}
          onUnpin={() => toggle(pinnedRow.rid)}
          onJump={(node) => {
            // An active search may hide the row; clear it, then scroll once the
            // full list has re-rendered.
            if (q) {
              setQuery("");
              requestAnimationFrame(() => {
                findRowNode(pinnedRow.rid)?.scrollIntoView({ behavior: "smooth", block: "center" });
              });
            } else {
              node?.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }}
        />
      ) : null}
    </div>
  );
}

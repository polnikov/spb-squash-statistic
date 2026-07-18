"use client";

import * as React from "react";
import Link from "next/link";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { RatingRow } from "@/lib/league";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/player-avatar";
import { RatingPinButton } from "@/components/rating-pin-button";
import { RatingPinnedBar, findRowNode } from "@/components/rating-pinned-bar";
import { RatingPositionDelta } from "@/components/rating-position-delta";
import { RatingStageSelector } from "@/components/rating-stage-selector";
import { NumberPop } from "@/components/ui/number-pop";
import { SearchBox } from "@/components/ui/search-box";
import { TabSliderPill, useTabSlider } from "@/components/ui/sliding-tabs";
import { TabTransition } from "@/components/ui/tab-transition";
import { usePinnedPlayer } from "@/components/ui/use-pinned-player";
import { useFlipList } from "@/components/ui/use-flip-list";

type RatingDivision = 1 | 2 | 3;

const SCOPES: { key: RatingDivision; label: string }[] = [
  { key: 1, label: "Дивизион 1" },
  { key: 2, label: "Дивизион 2" },
  { key: 3, label: "Дивизион 3" },
];

function makeColumns(
  leaderPoints: number,
  totalStages: number,
  pinnedRid: string | null,
  onTogglePin: (rid: string) => void,
): ColumnDef<RatingRow>[] {
  return [
    {
      accessorKey: "place",
      header: () => <span>#</span>,
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular text-on-surface-variant">
          <NumberPop>{row.original.place}</NumberPop>
        </span>
      ),
    },
    {
      id: "change",
      header: () => (
        <span className="inline-flex items-center justify-center gap-0.5">
          <ArrowUp className="size-3" />
          <ArrowDown className="size-3" />
        </span>
      ),
      enableSorting: false,
      cell: ({ row }) => <RatingPositionDelta delta={row.original.positionDelta} />,
    },
    {
      accessorKey: "name",
      header: "Игрок",
      cell: ({ row }) => (
        <Link href={`/players/${encodeURIComponent(row.original.rid)}`} className="inline-flex items-center gap-2.5">
          <PlayerAvatar rid={row.original.rid} initials={row.original.initials} color={row.original.color} className="size-8 text-xs" />
          <span className="text-sm font-medium text-on-surface transition-colors group-hover:text-primary">{row.original.name}</span>
        </Link>
      ),
    },
    {
      accessorKey: "points",
      header: "Очки",
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular text-on-surface-variant">
          <NumberPop>{row.original.points}</NumberPop>
        </span>
      ),
    },
    {
      accessorKey: "stages",
      header: "Этапов",
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular text-on-surface-variant">
          <NumberPop>{`${row.original.stages}/${totalStages}`}</NumberPop>
        </span>
      ),
    },
    {
      accessorKey: "matches",
      header: "Матчи",
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular text-on-surface-variant">
          <NumberPop>{row.original.matches}</NumberPop>
        </span>
      ),
    },
    {
      accessorKey: "wins",
      header: "Победы",
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular text-on-surface-variant">
          <NumberPop>{row.original.wins}</NumberPop>
        </span>
      ),
    },
    {
      accessorKey: "lastStagePoints",
      header: "Последний этап",
      cell: ({ row }) =>
        row.original.lastStagePoints > 0 ? (
          <span className="font-mono text-sm tabular text-brand-accent-ink">
            <NumberPop>{`+${row.original.lastStagePoints}`}</NumberPop>
          </span>
        ) : (
          <span className="font-mono tabular text-on-surface-variant"><NumberPop>x</NumberPop></span>
        ),
    },
    {
      id: "gap",
      header: "Отставание",
      enableSorting: false,
      cell: ({ row }) => {
        const gap = leaderPoints - row.original.points;
        return gap > 0 ? (
          <span className="font-mono text-sm tabular text-on-surface-variant">
            <NumberPop>{`−${gap}`}</NumberPop>
          </span>
        ) : (
          <span className="font-mono tabular text-on-surface-variant"><NumberPop>x</NumberPop></span>
        );
      },
    },
    {
      id: "pin",
      header: () => <span className="sr-only">Закрепить</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <RatingPinButton
          pinned={pinnedRid === row.original.rid}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePin(row.original.rid);
          }}
        />
      ),
    },
  ];
}

export function RatingTable({
  rowsByScope,
  rowsByDivisionStage,
  stagesByDivision,
  totalStages,
  ratingMaxStage,
}: {
  rowsByScope: Record<RatingDivision, RatingRow[]>;
  rowsByDivisionStage: Record<RatingDivision, Record<number, RatingRow[]>>;
  stagesByDivision: Record<RatingDivision, number>;
  totalStages: number;
  ratingMaxStage: number;
}) {
  const [scope, setScope] = React.useState<RatingDivision>(1);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const initialStage = React.useCallback(
    (division: RatingDivision) => Math.max(1, Math.min(stagesByDivision[division], ratingMaxStage)),
    [ratingMaxStage, stagesByDivision],
  );
  const [selectedStageByDivision, setSelectedStageByDivision] = React.useState<Record<RatingDivision, number>>(() => ({
    1: initialStage(1),
    2: initialStage(2),
    3: initialStage(3),
  }));
  const selectedStage = selectedStageByDivision[scope];

  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();

  const data = rowsByDivisionStage[scope]?.[selectedStage] ?? rowsByScope[scope] ?? [];
  // Filter the rows by name; the leaderboard bar scale still keys off the full
  // set so a search does not rescale the remaining bars.
  const visibleData = q ? data.filter((r) => r.name.toLowerCase().includes(q)) : data;
  const hasScopeData = (rowsByScope[scope]?.length ?? 0) > 0;
  const leaderPoints = data.reduce((max, r) => Math.max(max, r.points), 0);

  const { pinnedRid, toggle } = usePinnedPlayer();
  // Look the pinned row up in the unfiltered set so the tracker survives search.
  const pinnedRow = pinnedRid ? data.find((r) => r.rid === pinnedRid) : undefined;
  const columns = React.useMemo(
    () => makeColumns(leaderPoints, totalStages, pinnedRid, toggle),
    [leaderPoints, totalStages, pinnedRid, toggle],
  );
  const table = useReactTable({
    data: visibleData,
    columns,
    enableSorting: false,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.rid,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { setRef, ind } = useTabSlider(String(scope));
  const flip = useFlipList();
  const orderKey = visibleData.map((r) => `${r.rid}:${r.place}:${r.points}:${r.matches}:${r.stages}`).join("|");

  React.useLayoutEffect(() => {
    flip.play();
  }, [flip, orderKey]);

  function selectStage(stage: number) {
    if (stage === selectedStage) return;
    flip.snapshot();
    setSelectedStageByDivision((prev) => ({ ...prev, [scope]: stage }));
  }

  return (
    <div className="flex flex-col gap-4">
      {hasScopeData ? (
        <div className="hidden justify-end md:flex">
          <SearchBox value={query} onChange={setQuery} className="w-[280px]" />
        </div>
      ) : null}

      <div className="flex items-end gap-4">
        <div className="relative inline-flex shrink-0 gap-1 rounded-[16px] border border-border bg-brand-surface p-1">
          <TabSliderPill ind={ind} className="bg-brand-surface-2" />
          {SCOPES.map((s) => (
            <button
              key={String(s.key)}
              ref={setRef(String(s.key))}
              onClick={() => {
                flip.snapshot();
                setScope(s.key);
              }}
              className={cn(
                "relative z-10 h-9 rounded-[12px] px-5 text-xs font-semibold transition-colors duration-200 ease-m3-standard",
                scope === s.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {hasScopeData ? (
          <RatingStageSelector
            totalStages={totalStages}
            playedStage={stagesByDivision[scope]}
            selectedStage={selectedStage}
            ratingMaxStage={ratingMaxStage}
            onSelect={selectStage}
            className="ml-auto shrink-0 border-border bg-brand-surface"
          />
        ) : null}
      </div>

      {!hasScopeData || data.length === 0 ? (
        <div className="rounded-2xl bg-card px-5 py-8 text-center">
          <div className="text-sm font-semibold text-on-surface">Данных пока нет</div>
        </div>
      ) : (
      <TabTransition tabKey={scope} rise={false}>
      <div className="overflow-hidden rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-brand-surface-2/60 text-center text-xs text-muted-foreground">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <th key={header.id} className={cn("px-4 py-3 text-center font-medium", header.column.id === "change" && "w-px whitespace-nowrap")}>
                      {canSort ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center justify-center gap-1 hover:text-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDown className="size-3 opacity-60" />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                ref={flip.setNode(row.original.rid)}
                data-rating-rid={row.original.rid}
                className="group border-t border-border transition-colors hover:bg-brand-surface-2/40 md:h-[60px]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-4 py-3",
                      cell.column.id === "name" ? "text-left" : "text-center",
                      cell.column.id === "change" && "w-px whitespace-nowrap",
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </TabTransition>
      )}

      {pinnedRow ? (
        <RatingPinnedBar
          row={pinnedRow}
          onUnpin={() => toggle(pinnedRow.rid)}
          onJump={(node) => {
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

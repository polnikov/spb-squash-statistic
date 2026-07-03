import { Suspense } from "react";
import { Layers } from "lucide-react";
import {
  getDivisionSummary,
  getRatingRows,
  normalizeSeason,
  type DivisionSummary,
  type RatingRow,
} from "@/lib/mock/league";
import { loadLeague } from "@/lib/db/league";
import { DivisionsTable } from "@/components/divisions-table";
import { PageHeader } from "@/components/page-header";

export default async function DivisionsPage({ searchParams }: { searchParams?: { season?: string } }) {
  const season = normalizeSeason(searchParams?.season);
  const league = await loadLeague(season);
  const rowsByDivision = {
    1: getRatingRows(league, 1),
    2: getRatingRows(league, 2),
    3: getRatingRows(league, 3),
  } satisfies Record<1 | 2 | 3, RatingRow[]>;
  const summaries = {
    1: getDivisionSummary(league, 1),
    2: getDivisionSummary(league, 2),
    3: getDivisionSummary(league, 3),
  } satisfies Record<1 | 2 | 3, DivisionSummary>;

  return (
    <div className="flex flex-col gap-3 md:gap-8">
      <PageHeader title="Дивизионы" icon={Layers} />
      <Suspense fallback={null}>
        <DivisionsTable rowsByDivision={rowsByDivision} summaries={summaries} />
      </Suspense>
    </div>
  );
}

import { getRatingRows, normalizeSeason, type DivisionScope, type RatingRow } from "@/lib/mock/league";
import { loadLeague } from "@/lib/db/league";
import { RatingTable } from "@/components/rating-table";
import { RatingMobile } from "@/components/mobile/rating-mobile";
import { PageHeader } from "@/components/page-header";

export default async function RatingPage({ searchParams }: { searchParams?: { season?: string } }) {
  const season = normalizeSeason(searchParams?.season);
  const league = await loadLeague(season);
  const listByDivision = {
    1: getRatingRows(league, 1),
    2: getRatingRows(league, 2),
    3: getRatingRows(league, 3),
  } satisfies Record<1 | 2 | 3, RatingRow[]>;
  const rowsByScope = {
    all: getRatingRows(league, "all"),
    ...listByDivision,
  } satisfies Record<DivisionScope, RatingRow[]>;

  const stagesByDivision = {
    1: new Set(league.results.filter((r) => r.div === 1).map((r) => r.stage)).size,
    2: new Set(league.results.filter((r) => r.div === 2).map((r) => r.stage)).size,
    3: new Set(league.results.filter((r) => r.div === 3).map((r) => r.stage)).size,
  } satisfies Record<1 | 2 | 3, number>;

  return (
    <>
      {/* mobile */}
      <div className="md:hidden">
        <RatingMobile listByDivision={listByDivision} stagesByDivision={stagesByDivision} totalStages={league.stages.length} />
      </div>

      {/* desktop */}
      <div className="hidden flex-col gap-8 md:flex">
        <PageHeader title="Рейтинг сезона" />
        <RatingTable rowsByScope={rowsByScope} stagesByDivision={stagesByDivision} totalStages={league.stages.length} />
      </div>
    </>
  );
}

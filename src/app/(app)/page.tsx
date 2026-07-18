import { RATING_MAX_STAGE, getRatingRows, getRatingRowsThroughStage, type RatingRow } from "@/lib/league";
import { loadLeague, resolveSeason } from "@/lib/db/league";
import { RatingTable } from "@/components/rating-table";
import { RatingMobile } from "@/components/mobile/rating-mobile";

type RatingRowsByDivisionStage = Record<1 | 2 | 3, Record<number, RatingRow[]>>;

function latestStageForDivision(results: { div: number; stage: number }[], division: 1 | 2 | 3) {
  return results
    .filter((r) => r.div === division)
    .reduce((latest, r) => Math.max(latest, r.stage), 0);
}

function buildRowsByStage(league: Awaited<ReturnType<typeof loadLeague>>): RatingRowsByDivisionStage {
  return {
    1: Object.fromEntries(Array.from({ length: RATING_MAX_STAGE }, (_, i) => [i + 1, getRatingRowsThroughStage(league, 1, i + 1)])),
    2: Object.fromEntries(Array.from({ length: RATING_MAX_STAGE }, (_, i) => [i + 1, getRatingRowsThroughStage(league, 2, i + 1)])),
    3: Object.fromEntries(Array.from({ length: RATING_MAX_STAGE }, (_, i) => [i + 1, getRatingRowsThroughStage(league, 3, i + 1)])),
  } as RatingRowsByDivisionStage;
}

export default async function RatingPage({ searchParams }: { searchParams?: { season?: string } }) {
  const season = await resolveSeason(searchParams?.season);
  const league = await loadLeague(season);
  const listByDivision = {
    1: getRatingRows(league, 1),
    2: getRatingRows(league, 2),
    3: getRatingRows(league, 3),
  } satisfies Record<1 | 2 | 3, RatingRow[]>;
  const rowsByDivisionStage = buildRowsByStage(league);

  const stagesByDivision = {
    1: latestStageForDivision(league.results, 1),
    2: latestStageForDivision(league.results, 2),
    3: latestStageForDivision(league.results, 3),
  } satisfies Record<1 | 2 | 3, number>;

  return (
    <>
      {/* mobile */}
      <div className="md:hidden">
        <RatingMobile
          listByDivision={listByDivision}
          rowsByDivisionStage={rowsByDivisionStage}
          stagesByDivision={stagesByDivision}
          totalStages={league.stages.length}
          ratingMaxStage={RATING_MAX_STAGE}
        />
      </div>

      {/* desktop */}
      <div className="hidden flex-col gap-8 md:flex">
        <RatingTable
          rowsByScope={listByDivision}
          rowsByDivisionStage={rowsByDivisionStage}
          stagesByDivision={stagesByDivision}
          totalStages={league.stages.length}
          ratingMaxStage={RATING_MAX_STAGE}
        />
      </div>
    </>
  );
}

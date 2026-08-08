import { divisionFormat, getRatingRows, getRatingRowsThroughStage, type RatingRow } from "@/lib/league";
import { loadLeague, resolveSeason } from "@/lib/db/league";
import { RatingTable } from "@/components/rating-table";
import { RatingMobile } from "@/components/mobile/rating-mobile";

type RatingRowsByDivisionStage = Record<1 | 2 | 3, Record<number, RatingRow[]>>;

function latestStageForDivision(results: { div: number; stage: number }[], division: 1 | 2 | 3) {
  return results
    .filter((r) => r.div === division)
    .reduce((latest, r) => Math.max(latest, r.stage), 0);
}

/** One standings snapshot per counting stage, per division: the stage strip
 *  flips between them without a refetch. Divisions can run different formats
 *  from 26/27, so the depth of each map follows its own division. */
function buildRowsByStage(league: Awaited<ReturnType<typeof loadLeague>>): RatingRowsByDivisionStage {
  const forDivision = (division: 1 | 2 | 3) =>
    Object.fromEntries(
      Array.from({ length: divisionFormat(league.season, division).ratingMaxStage }, (_, i) => [
        i + 1,
        getRatingRowsThroughStage(league, division, i + 1),
      ]),
    );
  return { 1: forDivision(1), 2: forDivision(2), 3: forDivision(3) } as RatingRowsByDivisionStage;
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
          season={league.season}
        />
      </div>

      {/* desktop */}
      <div className="hidden flex-col gap-8 md:flex">
        <RatingTable
          rowsByScope={listByDivision}
          rowsByDivisionStage={rowsByDivisionStage}
          stagesByDivision={stagesByDivision}
          season={league.season}
        />
      </div>
    </>
  );
}

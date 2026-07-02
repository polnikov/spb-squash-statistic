import { StageSummary } from "@/components/stage-summary";
import { PageHeader } from "@/components/page-header";
import { normalizeSeason } from "@/lib/mock/league";
import { loadLeague } from "@/lib/db/league";

export default async function StagesPage({ searchParams }: { searchParams?: { season?: string } }) {
  const season = normalizeSeason(searchParams?.season);
  const league = await loadLeague(season);
  return (
    <div className="flex flex-col gap-3 md:gap-8">
      <PageHeader title="Этапы" />
      <StageSummary league={league} />
    </div>
  );
}

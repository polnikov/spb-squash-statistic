import { Blocks } from "lucide-react";
import { StageSummary } from "@/components/stage-summary";
import { PageHeader } from "@/components/page-header";
import { loadLeague, resolveSeason } from "@/lib/db/league";

export default async function StagesPage({ searchParams }: { searchParams?: { season?: string } }) {
  const season = await resolveSeason(searchParams?.season);
  const league = await loadLeague(season);
  return (
    <div className="flex flex-col gap-3 md:gap-8">
      <PageHeader title="Этапы" icon={Blocks} />
      <StageSummary league={league} />
    </div>
  );
}

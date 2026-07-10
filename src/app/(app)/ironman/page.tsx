import { Bot } from "lucide-react";
import { loadLeague, resolveSeason } from "@/lib/db/league";
import { IronManView } from "@/components/iron-man-view";
import { PageHeader } from "@/components/page-header";

export default async function IronManPage({ searchParams }: { searchParams?: { season?: string } }) {
  const season = await resolveSeason(searchParams?.season);
  const league = await loadLeague(season);

  return (
    <div className="flex flex-col gap-3 md:gap-8">
      <PageHeader title="Iron Man" icon={Bot} />
      <IronManView league={league} />
    </div>
  );
}

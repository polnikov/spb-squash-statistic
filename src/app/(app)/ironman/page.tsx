import { normalizeSeason } from "@/lib/mock/league";
import { loadLeague } from "@/lib/db/league";
import { IronManView } from "@/components/iron-man-view";
import { PageHeader } from "@/components/page-header";

export default async function IronManPage({ searchParams }: { searchParams?: { season?: string } }) {
  const season = normalizeSeason(searchParams?.season);
  const league = await loadLeague(season);

  return (
    <div className="flex flex-col gap-3 md:gap-8">
      <PageHeader title="Iron Man" />
      <IronManView league={league} />
    </div>
  );
}

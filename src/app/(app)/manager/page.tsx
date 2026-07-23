import { ManagerView } from "@/components/manager-view";
import { AdminLogin } from "@/components/admin-login";
import { listManagedPlayers, loadLeague, resolveSeason } from "@/lib/db/league";
import { loadSeasonStrengthSummary } from "@/lib/db/season-summary";
import { isAdmin } from "@/lib/auth";

// Session is read per request from cookies; never cache this page.
export const dynamic = "force-dynamic";

export default async function ManagerPage({ searchParams }: { searchParams?: { season?: string } }) {
  if (!isAdmin()) return <AdminLogin />;
  // Dashboard / Дайджест / Итоги follow the header season dropdown (?season=…).
  const season = await resolveSeason(searchParams?.season);
  const league = await loadLeague(season);
  // Admin manages the full roster, not just players with results this season.
  const players = await listManagedPlayers(league);
  // Season rating movement for the "Итоги сезона" tab (Map is not serializable
  // across the RSC boundary, hence the array).
  const seasonStrength = [...(await loadSeasonStrengthSummary(season)).values()];
  return <ManagerView league={{ ...league, players }} seasonStrength={seasonStrength} />;
}

import { ManagerView } from "@/components/manager-view";
import { AdminLogin } from "@/components/admin-login";
import { CURRENT_SEASON } from "@/lib/mock/league";
import { listManagedPlayers, loadLeague } from "@/lib/db/league";
import { isAdmin } from "@/lib/auth";

// Session is read per request from cookies; never cache this page.
export const dynamic = "force-dynamic";

export default async function ManagerPage() {
  if (!isAdmin()) return <AdminLogin />;
  const league = await loadLeague(CURRENT_SEASON);
  // Admin manages the full roster, not just players with results this season.
  const players = await listManagedPlayers(league);
  return <ManagerView league={{ ...league, players }} />;
}

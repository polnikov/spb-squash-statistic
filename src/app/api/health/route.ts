import { NextResponse } from "next/server";

// Lightweight liveness probe used by the container/compose healthcheck and the
// deploy workflow. Intentionally does not touch the DB/Redis so it stays fast
// and reflects only that the Next.js server is up.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

/**
 * Create or update the admin user. Password from ADMIN_PASSWORD (default
 * "admin" for dev — change in production).
 *
 *   ADMIN_PASSWORD=secret npx tsx src/scripts/seed-admin.ts
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

async function main() {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin";
  const passwordHash = await bcrypt.hash(password, 10);

  const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing) {
    await db.update(users).set({ passwordHash, role: "admin" }).where(eq(users.id, existing.id));
    console.log(`admin updated: ${username}`);
  } else {
    await db.insert(users).values({ username, passwordHash, role: "admin" });
    console.log(`admin created: ${username}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

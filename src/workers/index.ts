import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stageDivisions } from "@/lib/db/schema";
import { createRedisConnection } from "@/lib/redis";
import { parseStageDivision } from "@/lib/parsing/rankedin";
import { STAGE_PARSE_QUEUE, type StageParseJob } from "@/lib/queue/stage-parse";

/**
 * BullMQ worker entrypoint. Run as a separate process: `npm run worker`.
 */
const worker = new Worker<StageParseJob>(
  STAGE_PARSE_QUEUE,
  async (job) => {
    const { stageDivisionId } = job.data;
    console.log(`[stage-parse] start stage_division=${stageDivisionId} job=${job.id}`);
    await parseStageDivision(stageDivisionId);
    console.log(`[stage-parse] done stage_division=${stageDivisionId}`);
  },
  { connection: createRedisConnection(), concurrency: 2 },
);

worker.on("failed", async (job, err) => {
  console.error(`[stage-parse] failed job=${job?.id}:`, err.message);
  if (job?.data.stageDivisionId) {
    await db
      .update(stageDivisions)
      .set({ parseStatus: "failed", error: err.message })
      .where(eq(stageDivisions.id, job.data.stageDivisionId))
      .catch(() => {});
  }
});

worker.on("ready", () => console.log(`[stage-parse] worker ready on "${STAGE_PARSE_QUEUE}"`));

async function shutdown() {
  console.log("[stage-parse] shutting down…");
  await worker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

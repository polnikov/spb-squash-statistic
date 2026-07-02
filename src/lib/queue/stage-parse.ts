import { Queue } from "bullmq";
import { z } from "zod";
import { createRedisConnection } from "@/lib/redis";

export const STAGE_PARSE_QUEUE = "stage-parse";

/** Payload for a stage-division import job. */
export const stageParseJobSchema = z.object({
  stageDivisionId: z.number().int().positive(),
});
export type StageParseJob = z.infer<typeof stageParseJobSchema>;

// Reuse the queue instance across hot reloads.
const globalForQueue = globalThis as unknown as {
  __bbrStageQueue?: Queue<StageParseJob>;
};

function createStageParseQueue(): Queue<StageParseJob> {
  return new Queue<StageParseJob>(STAGE_PARSE_QUEUE, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
}

export const stageParseQueue: Queue<StageParseJob> =
  globalForQueue.__bbrStageQueue ?? createStageParseQueue();

if (process.env.NODE_ENV !== "production") {
  globalForQueue.__bbrStageQueue = stageParseQueue;
}

export async function enqueueStageParse(data: StageParseJob) {
  const payload = stageParseJobSchema.parse(data);
  return stageParseQueue.add("parse", payload, {
    jobId: `stage-division:${payload.stageDivisionId}`,
  });
}

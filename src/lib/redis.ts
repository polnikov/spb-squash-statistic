import { Redis } from "ioredis";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// BullMQ requires `maxRetriesPerRequest: null` on its connection.
export function createRedisConnection() {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null });
}

// Shared connection for app-side use (enqueueing, cache), reused across reloads.
const globalForRedis = globalThis as unknown as { __bbrRedis?: Redis };

export const redis = globalForRedis.__bbrRedis ?? createRedisConnection();
if (process.env.NODE_ENV !== "production") globalForRedis.__bbrRedis = redis;

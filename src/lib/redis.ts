import Redis from "ioredis";

let client: Redis | null = null;

export function hasRedis() {
  return Boolean(process.env.REDIS_URL);
}

export function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }
  return client;
}

export async function redisSetJson(key: string, value: unknown, ttlSec = 3600) {
  const r = getRedis();
  if (!r) return;
  if (r.status !== "ready") await r.connect().catch(() => undefined);
  await r.set(key, JSON.stringify(value), "EX", ttlSec);
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  if (r.status !== "ready") await r.connect().catch(() => undefined);
  const raw = await r.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

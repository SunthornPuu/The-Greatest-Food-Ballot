import "server-only";

// Best-effort, per-instance limiter. Good enough for a demo; serverless instances don't share it.
const hits = new Map<string, number[]>();

export function rateLimited(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > limit;
}

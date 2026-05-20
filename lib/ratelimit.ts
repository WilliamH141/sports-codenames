/**
 * In-memory per-key rate limiter. Each Vercel function instance has its own
 * Map, so this isn't bulletproof against a coordinated multi-instance attack —
 * but it stops casual spam (a script hammering one endpoint from one IP),
 * which is the realistic threat.
 *
 * Buckets auto-expire when their window passes. We also opportunistically
 * sweep stale entries on every check so the Map can't grow unbounded.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k);
  }
}

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (bucket.count >= max) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count++;
  return { allowed: true, retryAfterMs: 0 };
}

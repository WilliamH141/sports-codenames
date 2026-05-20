import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware — broad per-IP POST rate limit. Catches obvious flood
 * attacks (a script hammering the site) before they hit the server actions.
 * Specific per-action limits (e.g. createRoom) live in actions.ts on top of
 * this, since middleware can't differentiate which server action is being
 * invoked (they all POST to the same route).
 *
 * 60 POSTs/minute is loose enough that real play during an active game
 * (clicking cards, tagging, ending turns) won't trip it but a spam script
 * will.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX = 60;

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();

  const ip = getIp(req);
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }
  if (bucket.count >= MAX) {
    return new NextResponse("Too many requests. Slow down.", {
      status: 429,
      headers: {
        "Retry-After": Math.ceil((bucket.resetAt - now) / 1000).toString(),
      },
    });
  }
  bucket.count++;
  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};

import { NextRequest, NextResponse } from "next/server";

/**
 * Image proxy for official chain product photos. Taco Bell's CDN blocks
 * cross-origin/hotlink loads, so the server fetches with a browser UA and
 * serves the bytes itself. Only allowlisted official hosts.
 */
const ALLOWED_HOSTS = new Set(["www.tacobell.com", "tacobell.com", "www.chick-fil-a.com"]);

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return new NextResponse("missing u", { status: 400 });
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return new NextResponse("bad url", { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) return new NextResponse("host not allowed", { status: 403 });

  const upstream = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      referer: "https://www.tacobell.com/",
    },
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) return new NextResponse(`upstream ${upstream.status}`, { status: 502 });

  return new NextResponse(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
      "cache-control": "public, max-age=86400",
    },
  });
}

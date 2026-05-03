import type { Context } from "@netlify/functions";

const UPSTREAM_BASE =
  "https://69f54b337755e5d176e2cef9--thenextfilmlead.netlify.app";
const MAX_VOTES_PER_REQUEST = 1000;

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: { id?: string; count?: number; voterEmail?: string } = {};
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = payload.id;
  const voterEmail = typeof payload.voterEmail === "string" ? payload.voterEmail : "";
  const requested = Number(payload.count);
  const count = Math.max(
    1,
    Math.min(Number.isFinite(requested) ? Math.floor(requested) : 1, MAX_VOTES_PER_REQUEST),
  );

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // The upstream /api/vote endpoint loses writes under concurrent load,
  // so each vote must be issued sequentially. Failed attempts are retried
  // a few times so the final count matches the button the user clicked.
  for (let i = 0; i < count; i++) {
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const r = await fetch(`${UPSTREAM_BASE}/api/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, voterEmail }),
        });
        ok = r.ok;
      } catch {
        ok = false;
      }
      if (!ok) await new Promise((res) => setTimeout(res, 150));
    }
  }

  return new Response(null, { status: 202 });
};

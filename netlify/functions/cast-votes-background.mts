const UPSTREAM_VOTE_URL =
  "https://69f54b337755e5d176e2cef9--thenextfilmlead.netlify.app/api/vote";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const id = typeof payload?.id === "string" ? payload.id.trim() : "";
  const voterEmail =
    typeof payload?.voterEmail === "string" ? payload.voterEmail.trim() : "";
  const requested = Number(payload?.count);
  const count = Number.isFinite(requested)
    ? Math.max(1, Math.min(500, Math.floor(requested)))
    : 1;

  if (!id) {
    return new Response("missing id", { status: 400 });
  }

  for (let i = 0; i < count; i++) {
    try {
      await fetch(UPSTREAM_VOTE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, voterEmail }),
      });
    } catch {
      // Ignore individual failures so one bad call doesn't kill the loop.
    }
  }

  return new Response("ok", { status: 200 });
};

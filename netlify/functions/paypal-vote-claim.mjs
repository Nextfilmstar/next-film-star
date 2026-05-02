const UPSTREAM_BASE = "https://69f54b337755e5d176e2cef9--thenextfilmlead.netlify.app";
const ALLOWED_AMOUNTS = new Set([5, 10, 25, 50, 100, 250]);

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const contestantId = typeof body?.contestantId === "string" ? body.contestantId.trim() : "";
  const amount = Number(body?.amount);

  if (!contestantId) {
    return jsonResponse(400, { error: "Missing contestant." });
  }
  if (!Number.isInteger(amount) || !ALLOWED_AMOUNTS.has(amount)) {
    return jsonResponse(400, { error: "Invalid vote tier." });
  }

  console.log(
    `[paypal-vote-claim] contestant=${contestantId} amount=${amount}`
  );

  let upstream;
  try {
    upstream = await fetch(`${UPSTREAM_BASE}/api/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: contestantId, voterEmail: "", votes: amount }),
    });
  } catch (err) {
    console.error("[paypal-vote-claim] upstream fetch failed", err);
    return jsonResponse(502, { error: "Could not reach the voting server. Please try again." });
  }

  let data = null;
  try {
    data = await upstream.json();
  } catch {}

  if (!upstream.ok) {
    const errMsg = (data && typeof data.error === "string")
      ? data.error
      : `Voting server returned ${upstream.status}.`;
    return jsonResponse(upstream.status === 404 ? 404 : 502, { error: errMsg });
  }

  const added = Number(data && data.added);
  const votes = (data && typeof data.votes === "number") ? data.votes : null;

  if (!Number.isInteger(added) || added <= 0) {
    return jsonResponse(502, { error: "Voting server did not confirm the vote count." });
  }

  return jsonResponse(200, { success: true, added, votes });
};

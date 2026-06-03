import { getStore } from "@netlify/blobs";

// Local "3X Votes" toggle. Mirrors the upstream /api/double-votes setting but
// is owned entirely by this site, because the upstream back-end only knows
// about the 2X toggle. The contestant profile page reads this flag to triple
// the displayed/credited votes, and the admin panel writes it.
const STORE_NAME = "triple-votes";
const KEY = "enabled";

function votesStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export default async (req: Request) => {
  if (req.method === "GET") {
    try {
      const store = votesStore();
      const value = await store.get(KEY, { type: "text" });
      return Response.json({ enabled: value === "true" });
    } catch {
      return Response.json({ enabled: false });
    }
  }

  if (req.method === "POST") {
    let body: { enabled?: boolean };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const enabled = body.enabled === true;

    try {
      const store = votesStore();
      await store.set(KEY, enabled ? "true" : "false");
      return Response.json({ enabled });
    } catch {
      return Response.json(
        { error: "Failed to save setting" },
        { status: 500 },
      );
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};

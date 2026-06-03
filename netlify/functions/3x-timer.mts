import { getStore } from "@netlify/blobs";

const STORE_NAME = "3x-timer";
const KEY = "endTime";

function timerStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export default async (req: Request) => {
  if (req.method === "GET") {
    try {
      const store = timerStore();
      const endTime = await store.get(KEY, { type: "text" });
      return Response.json({ endTime: endTime || null });
    } catch {
      return Response.json({ endTime: null });
    }
  }

  if (req.method === "POST") {
    let body: { days?: number; hours?: number; minutes?: number };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const days = Number(body.days) || 0;
    const hours = Number(body.hours) || 0;
    const minutes = Number(body.minutes) || 0;

    if (days === 0 && hours === 0 && minutes === 0) {
      return Response.json(
        { error: "Please set a time greater than zero" },
        { status: 400 },
      );
    }

    const ms = (days * 86400 + hours * 3600 + minutes * 60) * 1000;
    const endTime = new Date(Date.now() + ms).toISOString();

    try {
      const store = timerStore();
      await store.set(KEY, endTime);
      return Response.json({ endTime });
    } catch {
      return Response.json(
        { error: "Failed to save timer" },
        { status: 500 },
      );
    }
  }

  if (req.method === "DELETE") {
    try {
      const store = timerStore();
      await store.delete(KEY);
      return Response.json({ ok: true });
    } catch {
      return Response.json(
        { error: "Failed to clear timer" },
        { status: 500 },
      );
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};

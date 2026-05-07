import { getStore } from "@netlify/blobs";

const UPSTREAM =
  "https://69f54b337755e5d176e2cef9--thenextfilmlead.netlify.app/api/user-credentials";

const KNOWN_CREDENTIALS: Array<{ email: string; password: string }> = [
  { email: "trinibeta@hotmail.com", password: "Trin-66" },
];

function credStore() {
  return getStore({ name: "user-credentials", consistency: "strong" });
}

async function blobsVerify(
  email: string,
  password: string,
): Promise<boolean | null> {
  try {
    const store = credStore();

    for (const cred of KNOWN_CREDENTIALS) {
      const key = `cred:${cred.email.toLowerCase()}`;
      try {
        await store.setJSON(key, {
          email: cred.email.toLowerCase(),
          password: cred.password,
        });
      } catch {}
    }

    const key = `cred:${email}`;
    const record = (await store.get(key, { type: "json" })) as {
      email: string;
      password: string;
    } | null;
    if (!record) return null;
    return record.password === password;
  } catch {
    return null;
  }
}

async function blobsStore(email: string, password: string): Promise<boolean> {
  try {
    const store = credStore();
    const key = `cred:${email}`;
    await store.setJSON(key, { email, password });
    return true;
  } catch {
    return false;
  }
}

function checkKnownCredentials(email: string, password: string): boolean {
  return KNOWN_CREDENTIALS.some(
    (c) => c.email.toLowerCase() === email && c.password === password,
  );
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return Response.json(
      { error: "email and password are required" },
      { status: 400 },
    );
  }

  if (action === "store") {
    const stored = await blobsStore(email, password);
    if (!stored) {
      return Response.json(
        { error: "Failed to store credentials" },
        { status: 500 },
      );
    }
    return Response.json({ ok: true });
  }

  if (action === "verify") {
    const blobResult = await blobsVerify(email, password);
    if (blobResult === true) {
      return Response.json({ valid: true, email });
    }

    if (checkKnownCredentials(email, password)) {
      return Response.json({ valid: true, email });
    }

    if (blobResult === false) {
      return Response.json({ valid: false, email });
    }

    try {
      const upstream = await fetch(`${UPSTREAM}?action=verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await upstream.json();
      return Response.json(data, { status: upstream.status });
    } catch {
      return Response.json({ valid: false, email });
    }
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
};

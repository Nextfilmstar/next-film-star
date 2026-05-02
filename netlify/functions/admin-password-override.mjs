import { getStore } from "@netlify/blobs";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Admin-set credentials baked into the deploy. These are checked before the
// Netlify Blobs store so an operator can hard-reset a contestant's login
// password by editing this list and redeploying — useful when the live blob
// store is unreachable or has stale data. Keep entries normalized (lowercase
// email) and use constant-time comparison against the password.
const SEED_CREDENTIALS = [
  { email: "dimitri619dynamite@gmail.com", password: "Dimitri-619" },
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function overrideKey(email) {
  return "override/" + encodeURIComponent(normalizeEmail(email));
}

function tombstoneKey(email) {
  return "tombstone/" + encodeURIComponent(normalizeEmail(email));
}

function hash(password, saltHex) {
  return scryptSync(String(password), Buffer.from(saltHex, "hex"), 64).toString("hex");
}

function constantTimeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function matchesSeed(email, password) {
  const normalized = normalizeEmail(email);
  for (const entry of SEED_CREDENTIALS) {
    if (
      normalizeEmail(entry.email) === normalized &&
      constantTimeEqual(entry.password, password)
    ) {
      return true;
    }
  }
  return false;
}

async function isTombstoned(store, email) {
  try {
    const rec = await store.get(tombstoneKey(email), { type: "json" });
    return !!(rec && rec.deletedAt);
  } catch {
    return false;
  }
}

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = normalizeEmail(body && body.email);
  const password = String((body && body.password) || "");

  if (!email) {
    return json({ error: "Email is required" }, 400);
  }

  const store = getStore({ name: "admin-password-overrides", consistency: "strong" });

  if (action === "store") {
    if (!password) {
      return json({ error: "Email and password are required" }, 400);
    }
    const adminToken = req.headers.get("x-admin-token");
    if (!adminToken) {
      return json({ error: "Admin token required" }, 401);
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }
    const saltHex = randomBytes(16).toString("hex");
    const hashHex = hash(password, saltHex);
    await store.setJSON(overrideKey(email), {
      email,
      salt: saltHex,
      hash: hashHex,
      updatedAt: Date.now(),
    });
    // Storing a fresh password implicitly clears any prior tombstone so the
    // account becomes valid again.
    try { await store.delete(tombstoneKey(email)); } catch {}
    return json({ success: true });
  }

  if (action === "delete") {
    const adminToken = req.headers.get("x-admin-token");
    if (!adminToken) {
      return json({ error: "Admin token required" }, 401);
    }
    try { await store.delete(overrideKey(email)); } catch {}
    await store.setJSON(tombstoneKey(email), {
      email,
      deletedAt: Date.now(),
    });
    return json({ success: true });
  }

  if (action === "reactivate") {
    const adminToken = req.headers.get("x-admin-token");
    if (!adminToken) {
      return json({ error: "Admin token required" }, 401);
    }
    try { await store.delete(tombstoneKey(email)); } catch {}
    return json({ success: true });
  }

  if (action === "verify") {
    if (!password) {
      return json({ error: "Email and password are required" }, 400);
    }
    if (await isTombstoned(store, email)) {
      return json({ valid: false });
    }
    if (matchesSeed(email, password)) {
      return json({ valid: true, email });
    }
    const record = await store.get(overrideKey(email), { type: "json" });
    if (!record || !record.salt || !record.hash) {
      return json({ valid: false });
    }
    const candidate = Buffer.from(hash(password, record.salt), "hex");
    const stored = Buffer.from(record.hash, "hex");
    const valid =
      candidate.length === stored.length && timingSafeEqual(candidate, stored);
    return json(valid ? { valid: true, email: record.email || email } : { valid: false });
  }

  return json({ error: "Invalid action" }, 400);
};

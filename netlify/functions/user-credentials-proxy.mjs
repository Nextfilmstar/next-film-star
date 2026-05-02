import { getStore } from "@netlify/blobs";
import { scryptSync, timingSafeEqual } from "node:crypto";

// The /apply React page logs users in by first calling Netlify Identity and
// then, on failure, falling back to POST /api/user-credentials?action=verify.
// The site's `/api/*` redirect proxies that call straight to the upstream
// deploy, so the local seed credentials and admin-set password overrides
// never get a chance to authenticate the user.
//
// This function sits in front of /api/user-credentials and:
//   - For POST ?action=verify: refuses tombstoned (admin-removed) emails,
//     then checks the seed credentials and the local override blob store;
//     on a match it returns {valid:true, email}. Otherwise it forwards the
//     request to the upstream so existing users keep logging in as before.
//   - For POST ?action=store (signup): clears any tombstone for the email
//     before forwarding upstream, so a contestant who was previously
//     removed by an admin can sign up again with a clean slate.
//   - For everything else (GET, other actions): forwards transparently to
//     the upstream so unrelated behavior is untouched.

const UPSTREAM_BASE =
  "https://69f54b337755e5d176e2cef9--thenextfilmlead.netlify.app";

const SEED_CREDENTIALS = [
  { email: "dimitri619dynamite@gmail.com", password: "Dimitri-619" },
];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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

function getOverrideStore() {
  return getStore({
    name: "admin-password-overrides",
    consistency: "strong",
  });
}

function tombstoneKey(email) {
  return "tombstone/" + encodeURIComponent(normalizeEmail(email));
}

async function isTombstoned(email) {
  try {
    const store = getOverrideStore();
    const rec = await store.get(tombstoneKey(email), { type: "json" });
    return !!(rec && rec.deletedAt);
  } catch {
    return false;
  }
}

async function clearTombstone(email) {
  try {
    const store = getOverrideStore();
    await store.delete(tombstoneKey(email));
  } catch {}
}

async function matchesOverrideStore(email, password) {
  try {
    const store = getOverrideStore();
    const key = "override/" + encodeURIComponent(normalizeEmail(email));
    const record = await store.get(key, { type: "json" });
    if (!record || !record.salt || !record.hash) return false;
    const candidate = Buffer.from(
      scryptSync(String(password), Buffer.from(record.salt, "hex"), 64).toString("hex"),
      "hex",
    );
    const stored = Buffer.from(record.hash, "hex");
    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  } catch {
    return false;
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function proxyToUpstream(req, rawBody) {
  const incoming = new URL(req.url);
  const upstreamUrl = UPSTREAM_BASE + "/api/user-credentials" + incoming.search;
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");
  const init = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = rawBody;
  }
  const upstream = await fetch(upstreamUrl, init);
  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete("content-encoding");
  respHeaders.delete("content-length");
  respHeaders.delete("transfer-encoding");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // Read body once so we can both inspect and proxy it.
  let rawBody = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      rawBody = await req.text();
    } catch {
      rawBody = null;
    }
  }

  if (req.method === "POST" && action === "verify" && rawBody) {
    let parsed = null;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = null;
    }
    if (parsed && parsed.email && parsed.password) {
      const email = normalizeEmail(parsed.email);
      const password = String(parsed.password);
      if (await isTombstoned(email)) {
        return jsonResponse({ valid: false });
      }
      if (matchesSeed(email, password)) {
        return jsonResponse({ valid: true, email });
      }
      if (await matchesOverrideStore(email, password)) {
        return jsonResponse({ valid: true, email });
      }
    }
  }

  // On signup, a fresh account replaces any prior admin-deletion tombstone.
  if (req.method === "POST" && action === "store" && rawBody) {
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && parsed.email) {
        await clearTombstone(parsed.email);
      }
    } catch {}
  }

  return proxyToUpstream(req, rawBody);
};

export const config = {
  path: "/api/user-credentials",
};

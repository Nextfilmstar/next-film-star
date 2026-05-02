// Auth shim consumed by the /apply page (apply-Ds_XmVhS.js) and the
// homepage login modal (index-BaN5_p3E.js). The bundle dynamically
// imports `./index-CoxOr2WD.js` and treats the resolved namespace as a
// Netlify Identity-style auth client, calling `signup`, `login`,
// `logout`, `getUser`, and `handleAuthCallback` on it. The original
// build asset was never published, so the import 404'd and `m.current`
// stayed null, which surfaced as "Cannot read properties of null
// (reading 'signup')" the moment a contestant clicked Sign Up.
//
// Credentials are already persisted via `/api/user-credentials?action=store`
// (the form posts to it directly before calling `signup`) and verified via
// `?action=verify` (the local user-credentials-proxy function honors seed
// credentials and admin-set overrides before falling through to upstream).
// This shim just wires the auth-client surface to those existing endpoints.

const SESSION_KEY = "auth_user_email";

function readSessionEmail() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || null;
  } catch {
    return null;
  }
}

function writeSessionEmail(email) {
  try {
    if (email) sessionStorage.setItem(SESSION_KEY, email);
  } catch {}
}

function clearSessionEmail() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

export async function signup(email, password) {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail || !password) {
    throw new Error("Please enter email and password.");
  }
  // The /apply form already POSTs to /api/user-credentials?action=store
  // and surfaces the 409 case before reaching here, so the credential is
  // already persisted by the time signup() is invoked. Returning a
  // resolved user object lets the form treat the account as created.
  writeSessionEmail(normalizedEmail);
  return { email: normalizedEmail, emailVerified: true };
}

export async function login(email, password) {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail || !password) {
    throw new Error("Please enter email and password.");
  }

  let res;
  try {
    res = await fetch("/api/user-credentials?action=verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });
  } catch {
    throw new Error("Invalid email or password.");
  }

  if (!res || !res.ok) {
    throw new Error("Invalid email or password.");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!data || !data.valid) {
    throw new Error("Invalid email or password.");
  }

  const resolvedEmail = data.email || normalizedEmail;
  writeSessionEmail(resolvedEmail);
  return { email: resolvedEmail, emailVerified: true };
}

export async function logout() {
  clearSessionEmail();
}

export async function getUser() {
  const email = readSessionEmail();
  if (!email) return null;
  return { email, emailVerified: true };
}

export async function handleAuthCallback() {
  return null;
}

export default {
  signup,
  login,
  logout,
  getUser,
  handleAuthCallback,
};

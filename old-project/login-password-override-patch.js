(function () {
  "use strict";

  // The Edit Contestant modal stores admin-supplied passwords in our local
  // override store at /.netlify/functions/admin-password-override. Netlify
  // Identity still has the contestant's previous password, and the upstream
  // /api/user-credentials store refuses to overwrite an existing entry, so
  // neither of those will recognize the new password.
  //
  // To make the new password work for login regardless of how the upstream
  // login flow is wired, we intercept in two places:
  //
  //   1. window.NetlifyIdentity.login is wrapped so the override store is
  //      consulted *before* gotrue ever sees the request. A match returns
  //      a synthetic user object so the rest of the login flow proceeds as
  //      if Identity had authenticated successfully.
  //
  //   2. window.fetch is wrapped so the upstream's
  //      /api/user-credentials?action=verify fallback also short-circuits
  //      to the override store. This covers any login path that bypasses
  //      NetlifyIdentity (e.g. when Identity is unavailable on the deploy).

  var OVERRIDE_VERIFY_URL = "/.netlify/functions/admin-password-override?action=verify";

  function normalizeEmail(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function checkOverride(email, password) {
    var normalized = normalizeEmail(email);
    if (!normalized || !password) return Promise.resolve(null);
    return fetch(OVERRIDE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalized, password: String(password) }),
    })
      .then(function (res) {
        if (!res || !res.ok) return null;
        return res.json().catch(function () { return null; });
      })
      .then(function (data) {
        if (data && data.valid) {
          return { email: data.email || normalized };
        }
        return null;
      })
      .catch(function () { return null; });
  }

  // 1) Wrap NetlifyIdentity.login so the override store is checked first.
  function wrapIdentity() {
    var identity = window.NetlifyIdentity;
    if (!identity || typeof identity.login !== "function") return false;
    if (identity.__overrideWrapped) return true;
    var origLogin = identity.login.bind(identity);
    identity.login = function (email, password, persistSession) {
      return checkOverride(email, password).then(function (overrideUser) {
        if (overrideUser) return overrideUser;
        return origLogin(email, password, persistSession);
      });
    };
    identity.__overrideWrapped = true;
    return true;
  }

  if (!wrapIdentity()) {
    // Identity bundle may not have run yet — keep retrying for a short
    // window so the wrapper is in place before any login button is clicked.
    var attempts = 0;
    var iv = setInterval(function () {
      attempts += 1;
      if (wrapIdentity() || attempts > 50) clearInterval(iv);
    }, 50);
  }

  // 2) Wrap fetch as a backup for any login path that hits the credential
  //    store directly instead of going through NetlifyIdentity.
  if (!window.fetch) return;
  var origFetch = window.fetch.bind(window);

  function getUrl(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    try { return String(input); } catch (e) { return ""; }
  }

  function getMethod(input, init) {
    var m = (init && init.method) || (input && input.method) || "GET";
    return String(m).toUpperCase();
  }

  function isVerifyCall(url, method) {
    if (method !== "POST") return false;
    if (url.indexOf("/api/user-credentials") === -1) return false;
    return /[?&]action=verify(?:&|$)/.test(url);
  }

  function readBody(input, init) {
    if (init && typeof init.body === "string") return init.body;
    if (input && typeof input.body === "string") return input.body;
    return null;
  }

  function jsonResponse(payload, status) {
    return new Response(JSON.stringify(payload), {
      status: status || 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  window.fetch = function (input, init) {
    var url = getUrl(input);
    var method = getMethod(input, init);

    if (!isVerifyCall(url, method)) {
      return origFetch(input, init);
    }

    var rawBody = readBody(input, init);
    if (!rawBody) return origFetch(input, init);

    var parsed;
    try { parsed = JSON.parse(rawBody); } catch (e) { return origFetch(input, init); }
    if (!parsed || !parsed.email || !parsed.password) {
      return origFetch(input, init);
    }

    return checkOverride(parsed.email, parsed.password).then(function (overrideUser) {
      if (overrideUser) {
        return jsonResponse({ valid: true, email: overrideUser.email });
      }
      return origFetch(input, init);
    });
  };
})();

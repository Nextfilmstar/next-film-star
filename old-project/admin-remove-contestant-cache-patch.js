(function () {
  "use strict";

  // When an admin removes a contestant via the "Remove" button in the
  // All Contestants section, the upstream code only calls
  // DELETE /api/contestants/{id}. That leaves behind state which then
  // prevents the same email from signing up again or causes login glitches:
  //
  //   - The upstream /api/admin/emails listing still remembers the email,
  //     so the signup gate refuses to let the same address re-register.
  //   - The local admin-set password override blob (in
  //     /.netlify/functions/admin-password-override) still has the old hash.
  //   - Any browser-side cached login state (Netlify Identity tokens,
  //     localStorage entries, cookies) keeps the contestant "logged in"
  //     long after the admin record is gone.
  //
  // After a successful contestant delete, the patch fans out to:
  //   1. DELETE /api/admin/emails — releases the upstream registry so the
  //      same email can sign up again (upstream documents this as removing
  //      "applications, contestant records, credentials, and IP records so
  //      they can reapply").
  //   2. POST /.netlify/functions/admin-password-override?action=delete —
  //      drops any admin-set password override and writes a tombstone so the
  //      seed credential and any stale upstream cache cannot authenticate
  //      the removed email until they sign up again.
  //   3. Clears any same-origin cookies / localStorage / sessionStorage
  //      entries that mention the contestant's email or id, so this browser
  //      tab is in a clean state if the admin (or the contestant on the
  //      same device) immediately tries to sign up.

  var contestantById = Object.create(null);
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (!origFetch) return;

  function getUrl(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    try { return String(input); } catch (e) { return ""; }
  }

  function getMethod(input, init) {
    var m = (init && init.method) || (input && input.method) || "GET";
    return String(m).toUpperCase();
  }

  function adminToken() {
    try { return sessionStorage.getItem("adminToken") || ""; } catch (e) { return ""; }
  }

  function rememberContestants(data) {
    if (!Array.isArray(data)) return;
    for (var i = 0; i < data.length; i++) {
      var c = data[i];
      if (c && c.id != null) contestantById[String(c.id)] = c;
    }
  }

  function cleanupEmailRegistry(email) {
    if (!email) return Promise.resolve();
    var token = adminToken();
    return origFetch("/api/admin/emails", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": token
      },
      body: JSON.stringify({ email: email })
    })
      .then(function () {
        try {
          if (typeof window.loadAdminEmails === "function") window.loadAdminEmails();
        } catch (e) {}
      })
      .catch(function () {});
  }

  function cleanupPasswordOverride(email) {
    if (!email) return Promise.resolve();
    var token = adminToken();
    return origFetch("/.netlify/functions/admin-password-override?action=delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": token
      },
      body: JSON.stringify({ email: email })
    }).catch(function () {});
  }

  function clearLocalCacheFor(contestant) {
    var email = (contestant && contestant.email) || "";
    var id = contestant && contestant.id != null ? String(contestant.id) : "";
    var needles = [];
    if (email) needles.push(email.toLowerCase());
    if (id) needles.push(id);

    function valueMatches(value) {
      if (value == null) return false;
      var s = String(value).toLowerCase();
      for (var i = 0; i < needles.length; i++) {
        if (s.indexOf(needles[i]) !== -1) return true;
      }
      return false;
    }

    function purgeStorage(storage) {
      if (!storage) return;
      var toRemove = [];
      try {
        for (var i = 0; i < storage.length; i++) {
          var key = storage.key(i);
          if (!key) continue;
          var val = "";
          try { val = storage.getItem(key) || ""; } catch (e) { val = ""; }
          if (valueMatches(key) || valueMatches(val)) toRemove.push(key);
        }
      } catch (e) {}
      for (var j = 0; j < toRemove.length; j++) {
        try { storage.removeItem(toRemove[j]); } catch (e) {}
      }
    }

    try { purgeStorage(window.localStorage); } catch (e) {}
    try { purgeStorage(window.sessionStorage); } catch (e) {}

    // Clear same-origin cookies whose name or value mentions the contestant.
    // Setting an expired Max-Age across plausible paths covers the cases the
    // browser actually accepts; cookies on other paths/domains stay put.
    try {
      var cookies = document.cookie ? document.cookie.split(";") : [];
      for (var k = 0; k < cookies.length; k++) {
        var pair = cookies[k].split("=");
        var name = (pair[0] || "").trim();
        var value = pair.slice(1).join("=") || "";
        if (!name) continue;
        if (valueMatches(name) || valueMatches(decodeURIComponent(value))) {
          var paths = ["/", "/apply", "/old-project", "/vote"];
          for (var p = 0; p < paths.length; p++) {
            document.cookie =
              name + "=; Max-Age=0; path=" + paths[p] + "; SameSite=Lax";
          }
        }
      }
    } catch (e) {}

    // If the Netlify Identity widget is loaded, ask it to drop any cached
    // session for this contestant. This is best-effort: the widget only
    // exposes the currently-logged-in user, so it is a no-op unless the
    // admin happens to be logged in as the contestant being removed.
    try {
      var ni = window.netlifyIdentity || window.NetlifyIdentity;
      if (ni && typeof ni.currentUser === "function") {
        var u = ni.currentUser();
        if (u && u.email && needles.indexOf(String(u.email).toLowerCase()) !== -1) {
          if (typeof ni.logout === "function") ni.logout();
        }
      }
    } catch (e) {}
  }

  window.fetch = function (input, init) {
    var url = getUrl(input);
    var method = getMethod(input, init);

    var deleteMatch =
      method === "DELETE" && /\/api\/contestants\/([^/?#]+)(?:[?#]|$)/.exec(url);
    var deletedId =
      deleteMatch && deleteMatch[1] !== "delete-all" ? deleteMatch[1] : null;
    var pendingContestant = deletedId
      ? contestantById[String(deletedId)] || null
      : null;
    var pendingEmail = pendingContestant ? pendingContestant.email || "" : "";

    var promise = origFetch(input, init);

    if (
      method === "GET" &&
      /\/api\/contestants(?:\?|#|$)/.test(url) &&
      !/\/api\/contestants\//.test(url)
    ) {
      promise
        .then(function (res) {
          if (!res || !res.ok) return;
          res
            .clone()
            .json()
            .then(rememberContestants)
            .catch(function () {});
        })
        .catch(function () {});
    }

    if (deletedId) {
      promise
        .then(function (res) {
          if (!res || !res.ok) return;
          if (pendingEmail) {
            cleanupEmailRegistry(pendingEmail);
            cleanupPasswordOverride(pendingEmail);
          }
          if (pendingContestant) clearLocalCacheFor(pendingContestant);
          delete contestantById[String(deletedId)];
        })
        .catch(function () {});
    }

    return promise;
  };
})();

(function () {
  "use strict";

  // Emails on this list always bypass the "already registered" gate so they
  // can sign up even if the upstream registry still remembers the address.
  var SIGNUP_ALLOWLIST = ["dimitri619dynamite@gmail.com"];

  function normalize(value) {
    return (value || "").trim().toLowerCase();
  }

  function isAllowlisted(email) {
    var target = normalize(email);
    if (!target) return false;
    for (var i = 0; i < SIGNUP_ALLOWLIST.length; i++) {
      if (normalize(SIGNUP_ALLOWLIST[i]) === target) return true;
    }
    return false;
  }

  function emailIsRegistered(email, data) {
    var target = normalize(email);
    if (!target) return false;
    var lists = [data && data.emails, data && data.emailsWithoutApplication];
    for (var i = 0; i < lists.length; i++) {
      var arr = lists[i];
      if (!arr || !arr.length) continue;
      for (var j = 0; j < arr.length; j++) {
        if (normalize(arr[j]) === target) return true;
      }
    }
    return false;
  }

  function wireSignupGate() {
    var btn = document.getElementById("auth-signup-btn");
    var emailInput = document.getElementById("auth-signup-email");
    var errorEl = document.getElementById("auth-signup-error");
    if (!btn || !emailInput || btn.dataset.emailGateWired === "1") return;
    btn.dataset.emailGateWired = "1";

    var allowNext = false;

    btn.addEventListener(
      "click",
      function (e) {
        if (allowNext) {
          allowNext = false;
          return;
        }

        var email = normalize(emailInput.value);
        if (!email) {
          // Let the upstream handler surface its own "enter email" error.
          return;
        }

        if (isAllowlisted(email)) {
          // Skip the registry lookup entirely so this address can sign up
          // even if it is still cached in the upstream emails list.
          return;
        }

        e.stopImmediatePropagation();
        e.preventDefault();

        if (errorEl) errorEl.classList.add("hidden");
        var originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Checking...";

        fetch("/api/admin/emails", { cache: "no-store" })
          .then(function (res) {
            if (!res || !res.ok) throw new Error("emails lookup failed");
            return res.json();
          })
          .then(function (data) {
            if (emailIsRegistered(email, data)) {
              if (errorEl) {
                errorEl.textContent =
                  "An account with this email already exists. Please log in instead.";
                errorEl.classList.remove("hidden");
              } else if (typeof window.showToast === "function") {
                window.showToast("Email already registered", true);
              }
              btn.disabled = false;
              btn.textContent = originalText;
              return;
            }
            btn.disabled = false;
            btn.textContent = originalText;
            allowNext = true;
            btn.click();
          })
          .catch(function () {
            // If the lookup fails, fall back to the upstream signup flow
            // rather than locking users out entirely.
            btn.disabled = false;
            btn.textContent = originalText;
            allowNext = true;
            btn.click();
          });
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireSignupGate);
  } else {
    wireSignupGate();
  }
})();

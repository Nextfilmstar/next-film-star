(function () {
  // --- Stripe Payment Links ---
  var paymentLinks = {
    5: "https://buy.stripe.com/4gM9AT3F6feK59k6IWdAk07",
    10: "https://buy.stripe.com/3cIfZha3u3w21X8c3gdAk08",
    25: "https://buy.stripe.com/28E5kDdfG5EaatEd7kdAk09",
    50: "https://buy.stripe.com/7sY9AT1wY4A61X87N0dAk0a",
    100: "https://buy.stripe.com/6oU8wP3F68Qm59kaZcdAk0b",
    250: "https://buy.stripe.com/4gMcN52B27MiatE9V8dAk0c"
  };

  // --- Vote Analytics: record a vote event to the local Netlify Function. ---
  function recordVoteEvent(contestantId, votesAdded, source) {
    if (!contestantId) return;
    var contestant = (typeof currentContestants !== "undefined" && currentContestants)
      ? currentContestants.find(function (c) { return c && c.id === contestantId; })
      : null;
    var voterEmail = "";
    if (source === "admin") {
      voterEmail = "admin@nextfilmlead";
    } else if (typeof loggedInUser !== "undefined" && loggedInUser && loggedInUser.email) {
      voterEmail = loggedInUser.email;
    } else {
      voterEmail = "anonymous@nextfilmlead";
    }
    var body = {
      contestantId: contestantId,
      contestantName: contestant ? contestant.name : null,
      voterEmail: voterEmail,
      votesAdded: votesAdded || 1
    };
    try {
      fetch("/api/vote-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  // --- DOM ---
  var appDiv = document.getElementById("app");
  var adminToggle = document.getElementById("admin-toggle");
  var adminModal = document.getElementById("admin-modal");
  var adminPassword = document.getElementById("admin-password");
  var adminLoginBtn = document.getElementById("admin-login-btn");
  var adminCancelBtn = document.getElementById("admin-cancel-btn");
  var adminError = document.getElementById("admin-error");
  var adminPanel = document.getElementById("admin-panel");
  var adminLogoutBtn = document.getElementById("admin-logout-btn");
  var adminContestantList = document.getElementById("admin-contestant-list");

  var nameInput = document.getElementById("name-input");
  var bioInput = document.getElementById("bio-input");
  var picInput = document.getElementById("pic-input");
  var picPreview = document.getElementById("pic-preview");
  var monologueInput = document.getElementById("monologue-input");
  var emailInput = null;
  var passwordInput = null;
  var submitBtn = document.getElementById("submit-btn");
  var formError = document.getElementById("form-error");
  var formSuccess = document.getElementById("form-success");

  var voteModal = document.getElementById("vote-modal");
  var voteModalName = document.getElementById("vote-modal-name");
  var voteModalClose = document.getElementById("vote-modal-close");

  // New DOM elements
  var searchInput = document.getElementById("search-input");
  var searchBar = document.getElementById("search-bar");
  var leaderboardView = document.getElementById("leaderboard-view");
  var leaderboardList = document.getElementById("leaderboard-list");
  var contactView = document.getElementById("contact-view");
  var contactForm = document.getElementById("contact-form");
  var contactSuccess = document.getElementById("contact-success");
  var contactError = document.getElementById("contact-error");
  var shareModal = document.getElementById("share-modal");
  var shareModalName = document.getElementById("share-modal-name");
  var shareModalClose = document.getElementById("share-modal-close");

  // Apply form DOM
  var applyView = document.getElementById("apply-view");
  var applyForm = document.getElementById("apply-form");
  var applySuccess = document.getElementById("apply-success");
  var applyError = document.getElementById("apply-error");
  var applyPicInput = document.getElementById("apply-pic");
  var applyPicPreview = document.getElementById("apply-pic-preview");

  // Timer DOM
  var countdownBanner = document.getElementById("countdown-banner");
  var cdDays = document.getElementById("cd-days");
  var cdHours = document.getElementById("cd-hours");
  var cdMins = document.getElementById("cd-mins");
  var cdSecs = document.getElementById("cd-secs");
  var setTimerBtn = document.getElementById("set-timer-btn");
  var clearTimerBtn = document.getElementById("clear-timer-btn");
  var timerStatus = document.getElementById("timer-status");
  var timerDaysInput = document.getElementById("timer-days");
  var timerHoursInput = document.getElementById("timer-hours");
  var timerMinutesInput = document.getElementById("timer-minutes");

  var currentContestants = [];
  var selectedContestantId = null;
  var shareContestantId = null;
  var adminToken = sessionStorage.getItem("adminToken") || "";
  var currentView = "contestants";
  var timerEndTime = null;
  var timerInterval = null;
  var loggedInUser = null;
  var loggedInContestant = null;
  var loggedInUserGroups = [];
  var allGroups = [];
  var contestantSearchCache = {};
  var highlightedProfileContestantId = normalizeId(sessionStorage.getItem("highlightedProfileContestantId"));
  var CONTESTANT_SESSION_ACTIVE_KEY = "nfsContestantSessionActive";
  var CONTESTANT_TAB_SESSION_KEY = "nfsContestantTabSession";

  function normalizeId(value) {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  function idsEqual(a, b) {
    return normalizeId(a) === normalizeId(b);
  }

  function groupHasContestant(group, contestantId) {
    if (!group || !Array.isArray(group.contestantIds)) return false;
    return group.contestantIds.some(function (id) {
      return idsEqual(id, contestantId);
    });
  }

  function refreshLoggedInUserGroups() {
    if (!loggedInContestant || allGroups.length === 0) {
      loggedInUserGroups = [];
      return;
    }
    loggedInUserGroups = allGroups.filter(function (g) {
      return groupHasContestant(g, loggedInContestant.id);
    });
  }

  function getGroupScopedContestants() {
    if (!loggedInUser || isAdmin()) {
      return currentContestants;
    }

    refreshLoggedInUserGroups();
    if (loggedInUserGroups.length === 0) {
      return [];
    }

    var groupContestantIds = [];
    loggedInUserGroups.forEach(function (g) {
      if (!g || !Array.isArray(g.contestantIds)) return;
      g.contestantIds.forEach(function (id) {
        var normalizedId = normalizeId(id);
        if (groupContestantIds.indexOf(normalizedId) === -1) {
          groupContestantIds.push(normalizedId);
        }
      });
    });

    return currentContestants.filter(function (c) {
      return groupContestantIds.indexOf(normalizeId(c.id)) !== -1;
    });
  }

  function clearContestantSearchCache() {
    contestantSearchCache = {};
  }

  function setHighlightedContestant(contestantId) {
    highlightedProfileContestantId = normalizeId(contestantId);
    if (highlightedProfileContestantId) {
      sessionStorage.setItem("highlightedProfileContestantId", highlightedProfileContestantId);
    } else {
      sessionStorage.removeItem("highlightedProfileContestantId");
    }
    applyHighlightedContestantStyles();
  }

  function applyHighlightedContestantStyles() {
    var selector = ".card[data-contestant-id], .admin-contestant-item[data-contestant-id]";
    document.querySelectorAll(selector).forEach(function (el) {
      var elId = normalizeId(el.getAttribute("data-contestant-id"));
      el.classList.toggle("profile-highlighted", !!highlightedProfileContestantId && elId === highlightedProfileContestantId);
    });
  }

  function clearAdminSession() {
    adminToken = "";
    sessionStorage.removeItem("adminToken");
  }

  function markContestantSessionActive() {
    try {
      localStorage.setItem(CONTESTANT_SESSION_ACTIVE_KEY, "1");
      sessionStorage.setItem(CONTESTANT_TAB_SESSION_KEY, "1");
    } catch (e) {}
  }

  function clearContestantSessionMarkers() {
    try {
      localStorage.removeItem(CONTESTANT_SESSION_ACTIVE_KEY);
      sessionStorage.removeItem(CONTESTANT_TAB_SESSION_KEY);
    } catch (e) {}
  }

  async function logoutIfPreviousContestantTabClosed() {
    if (!identity) return false;

    var hadActiveSession = false;
    var hasTabSession = false;
    try {
      hadActiveSession = localStorage.getItem(CONTESTANT_SESSION_ACTIVE_KEY) === "1";
      hasTabSession = sessionStorage.getItem(CONTESTANT_TAB_SESSION_KEY) === "1";
    } catch (e) {
      return false;
    }

    if (!hadActiveSession || hasTabSession) {
      return false;
    }

    try {
      await identity.logout();
    } catch (e) {}
    clearContestantSessionMarkers();
    return true;
  }

  function goToContestantProfile(contestantId) {
    var normalizedId = normalizeId(contestantId);
    if (!normalizedId) return;
    setHighlightedContestant(normalizedId);
    if (loggedInUser) {
      try { sessionStorage.setItem("nfsLoggedInForProfile", "1"); } catch (e) {}
    }
    window.location.assign("/contestant-details.html?id=" + encodeURIComponent(normalizedId));
  }

  function activateAuthTab(tabName) {
    var tab = document.querySelector('.auth-tab[data-auth-tab="' + tabName + '"]');
    if (tab) tab.click();
  }

  // --- Navigation ---
  var navBtns = document.querySelectorAll(".nav-btn");
  navBtns.forEach(function (btn) {
    btn.addEventListener("click", async function () {
      // If the header login/logout button was clicked
      if (btn.id === "header-login-btn") {
        if (loggedInUser || isAdmin()) {
          // Perform logout
          try {
            if (identity) await identity.logout();
          } catch (e) {}
          loggedInUser = null;
          loggedInContestant = null;
          loggedInUserGroups = [];
          if (contestantUserBar) contestantUserBar.classList.add("hidden");
          showAuthGate();
          updateNavForAuth();
          window.location.href = "/";
          return;
        } else {
          // Go to apply view with login tab
          switchView("apply");
          activateAuthTab("login");
          return;
        }
      }
      var view = btn.getAttribute("data-view");
      if (!view) return;
      // Redirect logged-in contestants to the group vote page for Contestant/Leaderboard
      if (loggedInUser && !isAdmin() && (view === "contestants" || view === "leaderboard")) {
        window.location.href = "/vote";
        return;
      }
      switchView(view);
    });
  });

  function switchView(view) {
    if (view === "leaderboard" && !loggedInUser && !isAdmin()) {
      view = "contact";
    }

    currentView = view;

    // Clear search when entering contestants view
    if (view === "contestants" && searchInput) {
      searchInput.value = "";
      clearContestantSearchCache();
    }

    navBtns.forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === view);
    });

    if (adminToggle) {
      adminToggle.style.opacity = "";
      adminToggle.style.cursor = "";
    }

    appDiv.classList.toggle("hidden", view !== "contestants" && view !== "admin");
    searchBar.classList.toggle("hidden", view !== "contestants" && view !== "admin");
    leaderboardView.classList.toggle("hidden", view !== "leaderboard");
    contactView.classList.toggle("hidden", view !== "contact");
    applyView.classList.toggle("hidden", view !== "apply");
    if (adminPanel) adminPanel.classList.toggle("hidden", view !== "admin" || !isAdmin());

    if (view === "leaderboard") {
      renderLeaderboard();
      if (loggedInUser) {
        loadGroups();
        matchUserToContestant().then(function () {
          refreshLoggedInUserGroups();
          if (currentView === "leaderboard") renderLeaderboard();
        });
      }
    }

    if (view === "contestants" || view === "admin") {
      if (currentContestants.length > 0) {
        render(getGroupScopedContestants());
      } else {
        loadContestants();
      }
    }

    // Update timer visibility (only shown on contestants and admin views)
    updateCountdown();
  }

  // --- Toast ---
  function showToast(msg, isError) {
    var existing = document.querySelector(".toast");
    if (existing) existing.remove();
    var el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
  }

  // --- Search ---
  searchInput.addEventListener("input", function () {
    clearContestantSearchCache();
    var query = searchInput.value.trim().toLowerCase();
    var scopedContestants = getGroupScopedContestants();
    if (!query) {
      render(scopedContestants);
      return;
    }
    var filtered = contestantSearchCache[query];
    if (!filtered) {
      filtered = scopedContestants.filter(function (c) {
        return c.name.toLowerCase().indexOf(query) !== -1;
      });
      contestantSearchCache[query] = filtered;
    }
    render(filtered);
  });

  // --- Admin Auth ---
  function isAdmin() {
    return true;
  }

  function updateAdminUI() {
    if (isAdmin()) {
      adminPanel.classList.toggle("hidden", currentView !== "admin");
      adminToggle.textContent = "Admin";
      ensureParticipantSearchUI();
      ensureVoterEmailSearchUI();
      ensureContestantEmailField();
      ensureContestantPasswordField();
      renderAdminList();
      loadParticipants();
      populateSiteContentForm();
      loadGroups();
    } else {
      adminPanel.classList.add("hidden");
      adminToggle.textContent = "Admin";
    }
  }

  // --- Admin: Search Contestant by Voter Email (Vote Analytics lookup) ---
  // Adds a search bar at the very top of the Admin Panel. Given a voter's
  // email, queries /api/vote-events?voterEmail=... to find which contestant(s)
  // that email has voted for, then opens the Vote Analytics page for the match.
  function ensureVoterEmailSearchUI() {
    if (!adminPanel || document.getElementById("voter-email-search-box")) return;
    var wrap = document.createElement("div");
    wrap.id = "voter-email-search-box";
    wrap.style.cssText = "display:flex;gap:8px;align-items:center;margin:0 0 12px 0;padding:12px;background:#f0f7ff;border:1px solid #cfe1ff;border-radius:8px;flex-wrap:wrap;";
    wrap.innerHTML =
      '<label for="voter-email-search-input" style="font-weight:600;color:#1a3a6b;font-size:14px;">Find contestant by voter email:</label>' +
      '<input id="voter-email-search-input" type="email" placeholder="voter@example.com" autocomplete="off" ' +
      'style="flex:1;min-width:200px;padding:8px 12px;border:1px solid #b8cce6;border-radius:6px;font-size:14px;" />' +
      '<button id="voter-email-search-btn" type="button" class="btn btn-primary" style="white-space:nowrap;">Open Vote Analytics</button>' +
      '<button id="voter-email-search-clear-btn" type="button" class="btn btn-secondary" style="white-space:nowrap;">Clear</button>' +
      '<div id="voter-email-search-status" style="flex-basis:100%;color:#1a3a6b;font-size:13px;min-height:0;"></div>' +
      '<div id="voter-email-search-result" style="flex-basis:100%;"></div>';
    adminPanel.insertBefore(wrap, adminPanel.firstChild);

    var input = wrap.querySelector("#voter-email-search-input");
    var btn = wrap.querySelector("#voter-email-search-btn");
    var clearBtn = wrap.querySelector("#voter-email-search-clear-btn");
    var status = wrap.querySelector("#voter-email-search-status");
    var result = wrap.querySelector("#voter-email-search-result");

    function escapeHtmlLocal(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
      });
    }

    function openAnalytics(contestantId, contestantName, highlightEmail) {
      var qs = "?id=" + encodeURIComponent(contestantId) +
               "&name=" + encodeURIComponent(contestantName || "") +
               "&highlight=" + encodeURIComponent(highlightEmail || "");
      window.location.href = "/vote-analytics/" + qs;
    }

    function runSearch() {
      result.innerHTML = "";
      status.textContent = "";
      status.style.color = "#1a3a6b";

      var raw = (input.value || "").trim();
      if (!raw) {
        status.style.color = "#b00020";
        status.textContent = "Please enter an email to search.";
        return;
      }
      var target = raw.toLowerCase();

      status.textContent = "Searching vote analytics…";
      btn.disabled = true;

      fetch("/api/vote-events?voterEmail=" + encodeURIComponent(target), {
        headers: { "Accept": "application/json" }
      })
        .then(function (res) {
          if (!res.ok) {
            return res.text().then(function (t) {
              throw new Error("Server returned " + res.status + (t ? ": " + t : ""));
            });
          }
          return res.json();
        })
        .then(function (data) {
          var matches = (data && data.matches) || [];
          if (matches.length === 0) {
            status.style.color = "#b00020";
            status.textContent = 'No contestant found for "' + raw + '".';
            return;
          }
          if (matches.length === 1) {
            var only = matches[0];
            status.textContent = "Opening Vote Analytics for " + (only.contestant_name || only.contestant_id) + "…";
            openAnalytics(only.contestant_id, only.contestant_name || "", target);
            return;
          }
          status.textContent = "Found in " + matches.length + " contestants' vote analytics. Pick one:";
          var items = matches.map(function (m) {
            var label = (m.contestant_name || m.contestant_id) +
              " — " + (m.total_votes || 0) + " votes (" + (m.event_count || 0) + " events)";
            return '<button type="button" class="voter-email-search-match" data-id="' +
              escapeHtmlLocal(m.contestant_id) + '" data-name="' + escapeHtmlLocal(m.contestant_name || "") +
              '" style="display:block;width:100%;text-align:left;background:#fff;border:1px solid #b8cce6;border-radius:6px;padding:10px 12px;margin:6px 0;color:#1a3a6b;cursor:pointer;font:inherit;">' +
              escapeHtmlLocal(label) + '</button>';
          }).join("");
          result.innerHTML = items;
          var buttons = result.querySelectorAll(".voter-email-search-match");
          for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener("click", function () {
              openAnalytics(this.getAttribute("data-id"), this.getAttribute("data-name"), target);
            });
          }
        })
        .catch(function (err) {
          status.style.color = "#b00020";
          status.textContent = "Search failed. " + (err && err.message ? err.message : "");
        })
        .then(function () {
          btn.disabled = false;
        });
    }

    btn.addEventListener("click", runSearch);
    clearBtn.addEventListener("click", function () {
      input.value = "";
      result.innerHTML = "";
      status.textContent = "";
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); runSearch(); }
    });
  }

  // --- Admin: Search Contestant by Name ---
  function ensureParticipantSearchUI() {
    if (!adminPanel || document.getElementById("participant-search-box")) return;
    var wrap = document.createElement("div");
    wrap.id = "participant-search-box";
    wrap.style.cssText = "display:flex;gap:8px;align-items:center;margin:0 0 16px 0;padding:12px;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:8px;flex-wrap:wrap;";
    wrap.innerHTML =
      '<label for="participant-search-input" style="font-weight:600;color:#333;font-size:14px;">Search contestant:</label>' +
      '<input id="participant-search-input" type="text" placeholder="Type a name..." ' +
      'style="flex:1;min-width:160px;padding:8px 12px;border:1px solid #ccc;border-radius:6px;font-size:14px;" />' +
      '<button id="participant-search-btn" type="button" class="btn btn-primary" style="white-space:nowrap;">Search</button>' +
      '<div id="participant-search-status" style="flex-basis:100%;color:#b00020;font-size:13px;min-height:0;"></div>';
    adminPanel.insertBefore(wrap, adminPanel.firstChild);

    var input = wrap.querySelector("#participant-search-input");
    var btn = wrap.querySelector("#participant-search-btn");
    var status = wrap.querySelector("#participant-search-status");

    function runSearch() {
      status.textContent = "";
      var q = (input.value || "").trim().toLowerCase();
      if (!q) {
        status.textContent = "Please enter a name to search.";
        return;
      }
      var cards = document.querySelectorAll("#participants-list .participant-card");
      var found = null;
      for (var i = 0; i < cards.length; i++) {
        var h = cards[i].querySelector("h4");
        var name = h ? (h.textContent || "").trim().toLowerCase() : "";
        if (name.indexOf(q) !== -1) { found = cards[i]; break; }
      }
      if (!found) {
        status.textContent = 'No contestant found matching "' + input.value.trim() + '".';
        return;
      }
      found.scrollIntoView({ behavior: "smooth", block: "center" });
      var prevBoxShadow = found.style.boxShadow;
      var prevTransition = found.style.transition;
      found.style.transition = "box-shadow 0.6s ease";
      found.style.boxShadow = "0 0 0 3px #ffd54f";
      setTimeout(function () {
        found.style.boxShadow = prevBoxShadow;
        setTimeout(function () { found.style.transition = prevTransition; }, 600);
      }, 1800);
    }

    btn.addEventListener("click", runSearch);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); runSearch(); }
    });
  }

  // --- Admin: Add Contestant email field ---
  function ensureContestantEmailField() {
    if (emailInput && document.body.contains(emailInput)) return;
    var existing = document.getElementById("email-input");
    if (existing) { emailInput = existing; return; }
    if (!monologueInput || !monologueInput.parentNode) return;
    var label = document.createElement("label");
    label.setAttribute("for", "email-input");
    label.textContent = "Email";
    var input = document.createElement("input");
    input.type = "email";
    input.id = "email-input";
    input.placeholder = "contestant@example.com";
    input.autocomplete = "email";
    var anchor = monologueInput.nextSibling;
    monologueInput.parentNode.insertBefore(label, anchor);
    monologueInput.parentNode.insertBefore(input, anchor);
    emailInput = input;
  }

  // --- Admin: Add Contestant login password field ---
  function ensureContestantPasswordField() {
    if (passwordInput && document.body.contains(passwordInput)) return;
    var existing = document.getElementById("contestant-password-input");
    if (existing) { passwordInput = existing; return; }
    if (!emailInput || !emailInput.parentNode) {
      ensureContestantEmailField();
      if (!emailInput || !emailInput.parentNode) return;
    }
    var label = document.createElement("label");
    label.setAttribute("for", "contestant-password-input");
    label.textContent = "Login Password";
    var input = document.createElement("input");
    input.type = "password";
    input.id = "contestant-password-input";
    input.placeholder = "Set a password for contestant login";
    input.autocomplete = "new-password";
    var anchor = emailInput.nextSibling;
    emailInput.parentNode.insertBefore(label, anchor);
    emailInput.parentNode.insertBefore(input, anchor);
    passwordInput = input;
  }

  adminToggle.addEventListener("click", function () {
    switchView("admin");
    adminPanel.scrollIntoView({ behavior: "smooth" });
  });

  adminCancelBtn.addEventListener("click", function () {
    adminModal.classList.add("hidden");
  });

  adminPassword.addEventListener("keydown", function (e) {
    if (e.key === "Enter") adminLoginBtn.click();
  });

  var adminShowPassword = document.getElementById("admin-show-password");
  if (adminShowPassword) {
    adminShowPassword.addEventListener("change", function () {
      adminPassword.type = adminShowPassword.checked ? "text" : "password";
    });
  }

  adminLoginBtn.addEventListener("click", async function () {
    var pw = adminPassword.value;
    if (!pw) {
      adminError.textContent = "Please enter the password.";
      adminError.classList.remove("hidden");
      return;
    }

    try {
      var res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw })
      });
      var data = await res.json();
      if (res.ok && data.token) {
        adminToken = data.token;
        sessionStorage.setItem("adminToken", adminToken);
        adminModal.classList.add("hidden");
        updateAdminUI();
        updateNavForAuth();
        switchView("contestants");
        showToast("Logged in as admin");
      } else {
        adminError.textContent = data.error || "Invalid password";
        adminError.classList.remove("hidden");
      }
    } catch (err) {
      adminError.textContent = "Login failed. Try again.";
      adminError.classList.remove("hidden");
    } finally {
    }
  });

  adminLogoutBtn.addEventListener("click", function () {
    adminToken = "";
    sessionStorage.removeItem("adminToken");
    updateAdminUI();
    updateNavForAuth();
    loadContestants();
    showToast("Logged out");
    window.location.href = "/";
  });

  // Delete All Contestants button
  var deleteAllBtn = document.getElementById("delete-all-contestants-btn");
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener("click", async function () {
      if (!confirm("Are you sure you want to delete ALL contestants, applications, groups, login credentials, and IP records? This will remove everything as if they never signed up. This cannot be undone.")) return;
      deleteAllBtn.textContent = "Deleting...";
      try {
        var res = await fetch("/api/contestants/delete-all", { method: "DELETE" });
        if (!res.ok) throw new Error("Failed");
        await loadContestants();
        showToast("All contestant data deleted (contestants, applications, groups, credentials, IPs)");
      } catch (e) {
        showToast("Failed to delete all contestants");
      } finally {
        deleteAllBtn.textContent = "Delete All Contestants";
      }
    });
  }

  // Stripe Sync button — manually trigger reconciliation of paid Stripe sessions to votes
  var stripeSyncBtn = document.getElementById("stripe-sync-btn");
  var stripeSyncStatus = document.getElementById("stripe-sync-status");
  if (stripeSyncBtn) {
    stripeSyncBtn.addEventListener("click", async function () {
      stripeSyncBtn.disabled = true;
      var originalLabel = stripeSyncBtn.textContent;
      stripeSyncBtn.textContent = "Syncing...";
      if (stripeSyncStatus) stripeSyncStatus.textContent = "";
      try {
        var res = await fetch("/.netlify/functions/vote-reconcile", { method: "POST" });
        var data = await res.json();
        if (data && data.ok) {
          if (stripeSyncStatus) {
            stripeSyncStatus.textContent = "Synced. Scanned " + (data.scanned || 0) + " sessions, applied " + (data.applied || 0) + " new vote payments.";
          }
          if (data.applied > 0) {
            try { await loadContestants(); } catch (e) {}
          }
        } else {
          if (stripeSyncStatus) {
            stripeSyncStatus.textContent = "Sync failed: " + ((data && data.error) || "Unknown error") + ". Make sure STRIPE_SECRET_KEY is set in Netlify environment variables.";
          }
        }
      } catch (e) {
        if (stripeSyncStatus) stripeSyncStatus.textContent = "Sync failed: " + (e && e.message ? e.message : "Network error");
      } finally {
        stripeSyncBtn.disabled = false;
        stripeSyncBtn.textContent = originalLabel;
      }
    });
  }

  // --- Change Password ---
  var changePasswordBtn = document.getElementById("change-password-btn");
  var changePasswordModal = document.getElementById("change-password-modal");
  var cpCurrentPassword = document.getElementById("cp-current-password");
  var cpNewPassword = document.getElementById("cp-new-password");
  var cpConfirmPassword = document.getElementById("cp-confirm-password");
  var cpShowPasswords = document.getElementById("cp-show-passwords");
  var cpSaveBtn = document.getElementById("cp-save-btn");
  var cpCancelBtn = document.getElementById("cp-cancel-btn");
  var cpError = document.getElementById("cp-error");
  var cpSuccess = document.getElementById("cp-success");

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", function () {
      cpCurrentPassword.value = "";
      cpNewPassword.value = "";
      cpConfirmPassword.value = "";
      cpError.classList.add("hidden");
      cpSuccess.classList.add("hidden");
      if (cpShowPasswords) cpShowPasswords.checked = false;
      cpCurrentPassword.type = "password";
      cpNewPassword.type = "password";
      cpConfirmPassword.type = "password";
      changePasswordModal.classList.remove("hidden");
    });
  }

  if (cpCancelBtn) {
    cpCancelBtn.addEventListener("click", function () {
      changePasswordModal.classList.add("hidden");
    });
  }

  if (cpShowPasswords) {
    cpShowPasswords.addEventListener("change", function () {
      var t = cpShowPasswords.checked ? "text" : "password";
      cpCurrentPassword.type = t;
      cpNewPassword.type = t;
      cpConfirmPassword.type = t;
    });
  }

  if (cpSaveBtn) {
    cpSaveBtn.addEventListener("click", async function () {
      cpError.classList.add("hidden");
      cpSuccess.classList.add("hidden");
      var cur = cpCurrentPassword.value;
      var np = cpNewPassword.value;
      var cp = cpConfirmPassword.value;
      if (!cur || !np || !cp) {
        cpError.textContent = "Please fill in all fields.";
        cpError.classList.remove("hidden");
        return;
      }
      if (np.length < 4) {
        cpError.textContent = "New password must be at least 4 characters.";
        cpError.classList.remove("hidden");
        return;
      }
      if (np !== cp) {
        cpError.textContent = "New passwords do not match.";
        cpError.classList.remove("hidden");
        return;
      }
      try {
        var res = await fetch("/api/admin/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword: cur, newPassword: np })
        });
        var data = await res.json();
        if (res.ok && data.success) {
          cpSuccess.textContent = "Password changed successfully!";
          cpSuccess.classList.remove("hidden");
          setTimeout(function () { changePasswordModal.classList.add("hidden"); }, 1500);
        } else {
          cpError.textContent = data.error || "Failed to change password.";
          cpError.classList.remove("hidden");
        }
      } catch (err) {
        cpError.textContent = "Failed to change password. Try again.";
        cpError.classList.remove("hidden");
      } finally {
      }
    });
  }

  // --- Admin: Add Contestant ---
  if (picInput) {
  picInput.addEventListener("change", function () {
    var file = picInput.files[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        picPreview.src = e.target.result;
        picPreview.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    }
  });
  }

  if (submitBtn) {
  submitBtn.addEventListener("click", async function () {
    ensureContestantEmailField();
    ensureContestantPasswordField();
    var name = nameInput.value.trim();
    var bio = bioInput.value.trim();
    var file = picInput.files[0];
    var email = emailInput ? emailInput.value.trim() : "";
    var password = passwordInput ? passwordInput.value : "";

    formError.classList.add("hidden");
    formSuccess.classList.add("hidden");

    if (!name) {
      formError.textContent = "Please enter a contestant name.";
      formError.classList.remove("hidden");
      return;
    }
    if (!file) {
      formError.textContent = "Please select a photo.";
      formError.classList.remove("hidden");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      formError.textContent = "Please enter a valid email address.";
      formError.classList.remove("hidden");
      return;
    }
    if (password && password.length < 4) {
      formError.textContent = "Login password must be at least 4 characters.";
      formError.classList.remove("hidden");
      return;
    }
    if (password && !email) {
      formError.textContent = "Please enter an email address to go with the login password.";
      formError.classList.remove("hidden");
      return;
    }

    submitBtn.textContent = "Adding...";

    try {
      var base64 = await new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            var canvas = document.createElement("canvas");
            var maxW = 800, maxH = 800;
            var w = img.width, h = img.height;
            if (w > maxW || h > maxH) {
              var ratio = Math.min(maxW / w, maxH / h);
              w = Math.round(w * ratio);
              h = Math.round(h * ratio);
            }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          };
          img.onerror = function () { reject(new Error("Failed to load image")); };
          img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      var res = await fetch("/api/contestants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        },
        body: JSON.stringify({
          name: name,
          bio: bio,
          email: email,
          password: password,
          login_password: password,
          photoData: base64,
          monologue_link: monologueInput ? monologueInput.value.trim() : ""
        })
      });

      if (!res.ok) {
        var errText = await res.text();
        var errMsg = "Failed to add contestant";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch (e) {}
        throw new Error(errMsg);
      }

      nameInput.value = "";
      bioInput.value = "";
      picInput.value = "";
      if (monologueInput) monologueInput.value = "";
      if (emailInput) emailInput.value = "";
      if (passwordInput) passwordInput.value = "";
      picPreview.classList.add("hidden");
      formSuccess.textContent = name + " added successfully!";
      formSuccess.classList.remove("hidden");
      loadContestants();
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.remove("hidden");
    } finally {
      submitBtn.textContent = "Add Contestant";
    }
  });
  }

  // --- Admin: Delete Contestant ---
  async function deleteContestant(id, name) {
    if (!confirm("Remove " + name + " from the competition?")) return;

    try {
      var res = await fetch("/api/contestants/" + id, {
        method: "DELETE",
        headers: { "X-Admin-Token": adminToken }
      });
      if (!res.ok) {
        var errText = await res.text();
        var errMsg = "Delete failed";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch (e) {}
        showToast(errMsg, true);
        return;
      }
      showToast(name + " removed");
      loadContestants();
    } catch (err) {
      showToast("Delete failed", true);
    }
  }

  function renderAdminList() {
    adminContestantList.innerHTML = "";
    if (currentContestants.length === 0) {
      adminContestantList.innerHTML = '<p style="color:#666;text-align:center;padding:12px;">No contestants yet.</p>';
      return;
    }
    var sortedContestants = currentContestants.slice().sort(function (a, b) {
      return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
    });
    sortedContestants.forEach(function (c) {
      var item = document.createElement("div");
      item.className = "admin-contestant-item";
      item.setAttribute("data-contestant-id", c.id);
      item.innerHTML =
        '<img src="' + (c.image || "") + '" alt="' + c.name + '" />' +
        '<div class="admin-contestant-info">' +
          '<h4>' + c.name + '</h4>' +
          '<span>' + (c.votes || 0) + ' votes</span>' +
          (c.monologue_link ? '<div style="font-size:0.75rem;color:#e94560;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;" title="' + c.monologue_link + '">Link: ' + c.monologue_link + '</div>' : '<div style="font-size:0.75rem;color:#666;margin-top:2px;">No monologue link</div>') +
        '</div>';
      var btnWrap = document.createElement("div");
      btnWrap.style.cssText = "display:flex;flex-direction:column;gap:4px;";

      var editBtn = document.createElement("button");
      editBtn.className = "btn btn-primary btn-sm";
      editBtn.textContent = "Edit";
      editBtn.onclick = function () { openEditContestant(c); };
      btnWrap.appendChild(editBtn);

      var editLinkBtn = document.createElement("button");
      editLinkBtn.className = "btn btn-secondary btn-sm";
      editLinkBtn.textContent = c.monologue_link ? "Edit Link" : "Add Link";
      editLinkBtn.onclick = function () { showEditLinkForm(c, item); };
      btnWrap.appendChild(editLinkBtn);

      var profileBtn = document.createElement("button");
      profileBtn.className = "btn btn-secondary btn-sm";
      profileBtn.textContent = "Profile";
      profileBtn.onclick = function () {
        setHighlightedContestant(c.id);
        if (loggedInUser) {
          try { sessionStorage.setItem("nfsLoggedInForProfile", "1"); } catch (e) {}
        }
        window.location.href = "/contestant-details.html?id=" + encodeURIComponent(c.id);
      };
      btnWrap.appendChild(profileBtn);

      var analyticsBtn = document.createElement("button");
      analyticsBtn.className = "btn btn-secondary btn-sm";
      analyticsBtn.textContent = "Vote Analytics";
      analyticsBtn.onclick = function () {
        var qs = "?id=" + encodeURIComponent(c.id) +
                 "&name=" + encodeURIComponent(c.name || "");
        window.location.href = "/vote-analytics/" + qs;
      };
      btnWrap.appendChild(analyticsBtn);

      var delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.textContent = "Remove";
      delBtn.onclick = function () { deleteContestant(c.id, c.name); };
      btnWrap.appendChild(delBtn);

      item.appendChild(btnWrap);
      adminContestantList.appendChild(item);
    });
    applyHighlightedContestantStyles();
  }

  function showEditLinkForm(c, parentItem) {
    var existing = parentItem.querySelector(".edit-link-form");
    if (existing) { existing.remove(); return; }

    var form = document.createElement("div");
    form.className = "edit-link-form";
    form.style.cssText = "width:100%;display:flex;gap:6px;margin-top:8px;align-items:center;";
    var input = document.createElement("input");
    input.type = "url";
    input.value = c.monologue_link || "";
    input.placeholder = "Enter monologue link URL";
    input.style.cssText = "flex:1;padding:6px 10px;border:1px solid #333;border-radius:6px;background:#1a1a2e;color:#fff;font-size:0.85rem;";
    var saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-primary btn-sm";
    saveBtn.textContent = "Save";
    saveBtn.onclick = async function () {
      saveBtn.textContent = "Saving...";
      try {
        var res = await fetch("/api/contestants/" + c.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
          body: JSON.stringify({ monologue_link: input.value.trim() })
        });
        if (!res.ok) throw new Error("Failed");
        showToast("Monologue link updated for " + c.name);
        loadContestants();
      } catch (err) {
        showToast("Failed to update link", true);
        saveBtn.textContent = "Save";
      }
    };
    form.appendChild(input);
    form.appendChild(saveBtn);
    parentItem.appendChild(form);
  }

  // --- Vote Modal ---
  function openVoteModal(id) {
    var c = currentContestants.find(function (x) { return x.id === id; });
    if (!c) return;
    selectedContestantId = id;
    voteModalName.textContent = c.name;
    voteModal.classList.remove("hidden");
  }

  voteModalClose.addEventListener("click", function () {
    voteModal.classList.add("hidden");
    selectedContestantId = null;
  });

  voteModal.addEventListener("click", function (e) {
    if (e.target === voteModal) {
      voteModal.classList.add("hidden");
      selectedContestantId = null;
    }
  });

  // Free vote
  document.querySelector(".free-vote").addEventListener("click", function () {
    if (!selectedContestantId) return;
    castFreeVote(selectedContestantId);
  });

  // Paid votes — redirect to Stripe checkout. Votes are only added to the
  // contestant after Stripe confirms the payment via the webhook
  // (see netlify/functions/stripe-webhook.mts). This prevents votes from
  // being credited to a contestant if the user abandons the checkout.
  document.querySelectorAll(".paid-vote").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!selectedContestantId) return;
      var amount = parseInt(btn.getAttribute("data-amount"));
      if (!amount || amount <= 0) return;
      var contestantId = selectedContestantId;
      var link = paymentLinks[amount];

      btn.disabled = true;

      if (link) {
        window.location.href = link + "?client_reference_id=" + contestantId;
      } else {
        voteModal.classList.add("hidden");
        btn.disabled = false;
      }
    });
  });

  // --- Free Vote ---
  async function castFreeVote(id) {
    var admin = isAdmin();
    var last = localStorage.getItem("lastFreeVoteDate");
    var today = new Date().toDateString();

    if (!admin && last === today) {
      showToast("You already used your free vote today! Come back tomorrow.", true);
      voteModal.classList.add("hidden");
      return;
    }

    try {
      var res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id, voterEmail: (loggedInUser && loggedInUser.email) || "" })
      });

      if (!res.ok) {
        var errText = await res.text();
        var errMsg = "Vote failed";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch (e) {}
        showToast(errMsg, true);
        return;
      }

      if (!admin) {
        localStorage.setItem("lastFreeVoteDate", today);
        voteModal.classList.add("hidden");
      }
      showToast(admin ? "Admin free vote cast!" : "Vote cast successfully!");
      try { recordVoteEvent(id, 1, admin ? "admin" : undefined); } catch (e) {}
      loadContestants();
    } catch (err) {
      showToast("Vote failed. Please try again.", true);
    }
  }

  // --- Share ---
  function openShareModal(id) {
    var c = currentContestants.find(function (x) { return x.id === id; });
    if (!c) return;
    shareContestantId = id;
    shareModalName.textContent = c.name;
    shareModal.classList.remove("hidden");
  }

  shareModalClose.addEventListener("click", function () {
    shareModal.classList.add("hidden");
    shareContestantId = null;
  });

  shareModal.addEventListener("click", function (e) {
    if (e.target === shareModal) {
      shareModal.classList.add("hidden");
      shareContestantId = null;
    }
  });

  function getShareText() {
    var c = currentContestants.find(function (x) { return x.id === shareContestantId; });
    if (!c) return "";
    var profileUrl = window.location.origin + "/contestant-details.html?id=" + encodeURIComponent(normalizeId(c.id));
    return "Please vote for " + c.name + " " + profileUrl;
  }

  document.getElementById("share-twitter").addEventListener("click", function () {
    var text = getShareText();
    window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(text), "_blank");
  });

  function getShareUrl() {
    var c = currentContestants.find(function (x) { return x.id === shareContestantId; });
    if (!c) return window.location.href;
    return window.location.origin + "/contestant-details.html?id=" + encodeURIComponent(normalizeId(c.id));
  }

  document.getElementById("share-facebook").addEventListener("click", function () {
    window.open("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(getShareUrl()) + "&quote=" + encodeURIComponent(getShareText()), "_blank");
  });

  document.getElementById("share-whatsapp").addEventListener("click", function () {
    var text = getShareText();
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
  });

  document.getElementById("share-instagram").addEventListener("click", function () {
    var text = getShareText();
    var c = currentContestants.find(function (x) { return x.id === shareContestantId; });
    var photoUrl = c
      ? window.location.origin + "/api/contestant-photo?id=" + encodeURIComponent(normalizeId(c.id))
      : null;
    function openPhotoAndInstagram() {
      if (photoUrl) window.open(photoUrl, "_blank");
      window.open("https://www.instagram.com/", "_blank");
    }
    navigator.clipboard.writeText(text).then(function () {
      showToast("Share text copied. Save the contestant photo that just opened and attach it to your Instagram post.");
      openPhotoAndInstagram();
    }).catch(function () {
      openPhotoAndInstagram();
      showToast("Open Instagram and paste your share text.", true);
    });
  });

  document.getElementById("share-copy").addEventListener("click", function () {
    var text = getShareText();
    navigator.clipboard.writeText(text).then(function () {
      showToast("Link copied to clipboard!");
      shareModal.classList.add("hidden");
    }).catch(function () {
      showToast("Failed to copy link", true);
    });
  });

  document.getElementById("share-tiktok").addEventListener("click", function () {
    var text = getShareText();
    navigator.clipboard.writeText(text).then(function () {
      showToast("Share text copied! Paste it on TikTok.");
      window.open("https://www.tiktok.com/", "_blank");
    }).catch(function () {
      window.open("https://www.tiktok.com/", "_blank");
      showToast("Open TikTok and paste your share text.", true);
    });
  });

  document.getElementById("share-email").addEventListener("click", function () {
    var c = currentContestants.find(function (x) { return x.id === shareContestantId; });
    var name = c ? c.name : "this contestant";
    var url = getShareUrl();
    var subject = "Vote for " + name;
    var body = "Vote for " + name + "\n\n" + url;
    var to = c && c.email ? encodeURIComponent(c.email) : "";
    window.location.href = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  });

  // --- Leaderboard ---
  function renderLeaderboardGroup(container, contestants, maxVotes) {
    contestants.forEach(function (c, index) {
      var rank = index + 1;
      var votes = c.votes || 0;
      var pct = Math.round((votes / maxVotes) * 100);

      var topClass = "";
      if (rank === 1) topClass = " top-1";
      else if (rank === 2) topClass = " top-2";
      else if (rank === 3) topClass = " top-3";

      var imgSrc = c.image || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' fill='%23333'%3E%3Crect width='48' height='48'/%3E%3C/svg%3E";

      var adminVotesHtml = isAdmin() ? '<span style="display:inline-block;background:#e94560;color:#fff;font-size:0.7rem;font-weight:700;padding:1px 6px;border-radius:8px;margin-left:6px;">' + votes + ' votes</span>' : '';

      var item = document.createElement("div");
      item.className = "leaderboard-item" + topClass;
      item.style.position = "relative";
      item.style.overflow = "hidden";
      item.style.cursor = "pointer";
      item.setAttribute("role", "link");
      item.setAttribute("tabindex", "0");
      item.setAttribute("aria-label", "Open profile for " + c.name);
      item.innerHTML =
        '<span class="leaderboard-rank">#' + rank + '</span>' +
        '<img src="' + imgSrc + '" alt="' + c.name + '" />' +
        '<div class="leaderboard-info">' +
          '<h4>' + c.name + adminVotesHtml + '</h4>' +
          '<p>' + (c.bio || "No bio") + '</p>' +
        '</div>' +
        '<div class="leaderboard-bar-wrap"><div class="leaderboard-bar" style="width:' + pct + '%"></div></div>';

      item.addEventListener("click", function () {
        goToContestantProfile(c.id);
      });
      item.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToContestantProfile(c.id);
        }
      });

      container.appendChild(item);
    });
  }

  function renderLeaderboard() {
    leaderboardList.innerHTML = "";
    var leaderboardContestants = getGroupScopedContestants();

    if (leaderboardContestants.length === 0) {
      leaderboardList.innerHTML = '<p class="no-results">No contestants in your group yet. Check back soon!</p>';
      return;
    }

    var grouped = getContestantsByGroup(leaderboardContestants);

    if (grouped.length <= 1 && grouped[0] && !grouped[0].group) {
      // No groups — flat list
      var maxVotes = (grouped[0].contestants[0] && grouped[0].contestants[0].votes) || 1;
      if (maxVotes === 0) maxVotes = 1;
      renderLeaderboardGroup(leaderboardList, grouped[0].contestants, maxVotes);
    } else {
      grouped.forEach(function (entry) {
        var header = document.createElement("div");
        header.style.cssText = "padding:14px 0 6px;border-bottom:2px solid #e94560;margin-bottom:8px;margin-top:20px;";
        header.innerHTML = '<h3 style="color:#e94560;font-size:1.2rem;margin:0;">' + (entry.group ? entry.group.name : "Other Contestants") + '</h3>';
        leaderboardList.appendChild(header);

        var groupMax = (entry.contestants[0] && entry.contestants[0].votes) || 1;
        if (groupMax === 0) groupMax = 1;
        renderLeaderboardGroup(leaderboardList, entry.contestants, groupMax);
      });
    }
  }

  // --- Contact Form ---
  contactForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    contactSuccess.classList.add("hidden");
    contactError.classList.add("hidden");

    var submitButton = contactForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    try {
      var response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(contactForm)).toString()
      });

      if (response.ok) {
        contactSuccess.classList.remove("hidden");
        contactForm.reset();
      } else {
        contactError.classList.remove("hidden");
      }
    } catch (err) {
      contactError.classList.remove("hidden");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send Message";
    }
  });

  // --- Apply Form ---
  var applyBlurbInput = document.getElementById("apply-blurb");
  var applyBlurbCount = document.getElementById("apply-blurb-count");
  if (applyBlurbInput && applyBlurbCount) {
    applyBlurbInput.addEventListener("input", function () {
      var len = applyBlurbInput.value.length;
      applyBlurbCount.textContent = len + " / 500";
      applyBlurbCount.style.color = len >= 500 ? "#e94560" : "#888";
    });
  }

  if (applyPicInput) {
    applyPicInput.addEventListener("change", function () {
      var file = applyPicInput.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
          applyPicPreview.src = e.target.result;
          applyPicPreview.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
      }
    });
  }

  var applyResumeInput = document.getElementById("apply-resume");
  var applyResumeName = document.getElementById("apply-resume-name");
  if (applyResumeInput) {
    applyResumeInput.addEventListener("change", function () {
      var file = applyResumeInput.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          alert("Resume file must be under 5MB.");
          applyResumeInput.value = "";
          return;
        }
        applyResumeName.textContent = file.name;
        applyResumeName.classList.remove("hidden");
      } else {
        applyResumeName.classList.add("hidden");
      }
    });
  }

  if (applyForm) {
    applyForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      applySuccess.classList.add("hidden");
      applyError.classList.add("hidden");

      var submitButton = applyForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";

      try {
        // Also submit to Netlify Forms
        var formData = new FormData(applyForm);
        fetch("/", { method: "POST", body: formData }).catch(function () {});

        // Convert photo to base64 for Blobs storage
        var photoData = "";
        var photoFile = applyPicInput.files[0];
        if (photoFile) {
          photoData = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
              var img = new Image();
              img.onload = function () {
                var canvas = document.createElement("canvas");
                var maxW = 800, maxH = 800;
                var w = img.width, h = img.height;
                if (w > maxW || h > maxH) {
                  var ratio = Math.min(maxW / w, maxH / h);
                  w = Math.round(w * ratio);
                  h = Math.round(h * ratio);
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL("image/jpeg", 0.8));
              };
              img.onerror = function () { reject(new Error("Failed to load image")); };
              img.src = reader.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(photoFile);
          });
        }

        // Convert resume to base64 for Blobs storage
        var resumeData = "";
        var resumeFile = applyResumeInput ? applyResumeInput.files[0] : null;
        if (resumeFile) {
          resumeData = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(resumeFile);
          });
        }

        // Save to Blobs via API
        var response = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name"),
            phone: formData.get("phone"),
            email: formData.get("email"),
            bio: formData.get("bio"),
            blurb: formData.get("blurb"),
            photoData: photoData,
            resumeData: resumeData,
            monologue_link: formData.get("monologue_link")
          })
        });

        if (response.ok) {
          applySuccess.classList.remove("hidden");
          applyForm.reset();
          applyPicPreview.classList.add("hidden");
          if (applyResumeName) applyResumeName.classList.add("hidden");
          // Hide the form so user cannot apply again
          applyForm.classList.add("hidden");
        } else if (response.status === 409) {
          // Duplicate application
          applyError.textContent = "You have already submitted an application.";
          applyError.classList.remove("hidden");
          applyForm.classList.add("hidden");
        } else {
          applyError.classList.remove("hidden");
        }
      } catch (err) {
        applyError.classList.remove("hidden");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Application";
      }
    });
  }

  // --- Helper: get groups for a specific contestant ---
  function getContestantGroups(contestantId) {
    var cId = normalizeId(contestantId);
    return allGroups.filter(function (g) {
      return groupHasContestant(g, cId);
    });
  }

  // --- Helper: get contestants in same groups, sorted by votes ---
  function getGroupMatesForContestant(contestantId) {
    var groups = getContestantGroups(contestantId);
    if (groups.length === 0) return currentContestants;

    var groupContestantIds = [];
    groups.forEach(function (g) {
      if (!g || !Array.isArray(g.contestantIds)) return;
      g.contestantIds.forEach(function (id) {
        var nId = normalizeId(id);
        if (groupContestantIds.indexOf(nId) === -1) groupContestantIds.push(nId);
      });
    });

    return currentContestants.filter(function (c) {
      return groupContestantIds.indexOf(normalizeId(c.id)) !== -1;
    });
  }

  // --- Helper: organize contestants by groups ---
  function getContestantsByGroup(contestants) {
    var grouped = [];
    var usedIds = {};

    allGroups.forEach(function (group) {
      if (!group || !Array.isArray(group.contestantIds) || group.contestantIds.length === 0) return;
      var groupMembers = contestants.filter(function (c) {
        return groupHasContestant(group, c.id);
      });
      if (groupMembers.length === 0) return;
      // Sort within group by votes descending
      groupMembers.sort(function (a, b) { return (b.votes || 0) - (a.votes || 0); });
      grouped.push({ group: group, contestants: groupMembers });
      groupMembers.forEach(function (c) { usedIds[normalizeId(c.id)] = true; });
    });

    return grouped;
  }

  // --- Render a single contestant card ---
  function renderContestantCard(c, rank) {
    var div = document.createElement("div");
    div.className = "card";
    div.setAttribute("data-contestant-id", c.id);

    var rankClass = "card-rank";
    if (rank === 1) rankClass += " rank-1";
    else if (rank === 2) rankClass += " rank-2";
    else if (rank === 3) rankClass += " rank-3";

    var bioText = c.bio || "";
    var imgSrc = c.image || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='260' fill='%23333'%3E%3Crect width='280' height='260'/%3E%3Ctext x='140' y='130' text-anchor='middle' fill='%23666' font-size='14'%3ENo Photo%3C/text%3E%3C/svg%3E";
    var profileUrl = "/contestant-details.html?id=" + encodeURIComponent(normalizeId(c.id));

    var adminVotesHtml = isAdmin() ? '<span class="admin-vote-count" style="display:inline-block;background:#e94560;color:#fff;font-size:0.75rem;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:8px;">' + (c.votes || 0) + ' votes</span>' : '';

    div.innerHTML =
      '<div class="' + rankClass + '">#' + rank + '</div>' +
      '<a href="' + profileUrl + '" style="display:block;" class="card-profile-image-link"><img src="' + imgSrc + '" alt="' + c.name + '" style="cursor:pointer;" /></a>' +
      '<div class="card-body">' +
        '<h2>' + c.name + adminVotesHtml + '</h2>' +
        (bioText ? '<p class="card-bio">' + bioText + '</p>' : '') +
        (c.monologue_link ? '<div class="card-monologue-link"><strong>Monologue:</strong> <a href="' + c.monologue_link + '" target="_blank" rel="noopener noreferrer">' + c.monologue_link + '</a></div>' : '') +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="vote-btn-inline">Vote Now</button>' +
        '<a href="' + profileUrl + '" class="profile-link-inline">Profile</a>' +
        '<button class="share-btn-inline">Share</button>' +
      '</div>';

    div.querySelector(".vote-btn-inline").addEventListener("click", function (e) {
      e.stopPropagation();
      openVoteModal(c.id);
    });

    div.querySelector(".share-btn-inline").addEventListener("click", function (e) {
      e.stopPropagation();
      openShareModal(c.id);
    });

    div.querySelector(".card-profile-image-link").addEventListener("click", function (e) {
      e.preventDefault();
      goToContestantProfile(c.id);
    });

    div.querySelector(".profile-link-inline").addEventListener("click", function (e) {
      e.preventDefault();
      goToContestantProfile(c.id);
    });

    div.addEventListener("click", function (e) {
      if (e.target.closest(".card-actions")) return;
      if (e.target.closest("a, button")) return;
      goToContestantProfile(c.id);
    });

    return div;
  }

  // --- Render Contestants ---
  function render(contestants) {
    appDiv.innerHTML = "";

    if (contestants.length === 0) {
      var query = searchInput.value.trim();
      if (query) {
        appDiv.innerHTML = '<p class="no-results">No contestants match "' + query + '"</p>';
      } else {
        appDiv.innerHTML = '<p class="loading">No contestants yet. Check back soon!</p>';
      }
      return;
    }

    // Group contestants by their groups and rank within each group
    var grouped = getContestantsByGroup(contestants);

    if (grouped.length <= 1 && grouped[0] && !grouped[0].group) {
      // No groups defined or all ungrouped — render flat list ranked by position
      grouped[0].contestants.forEach(function (c, index) {
        appDiv.appendChild(renderContestantCard(c, index + 1));
      });
    } else {
      grouped.forEach(function (entry) {
        var header = document.createElement("div");
        header.className = "group-header";
        header.style.cssText = "width:100%;padding:16px 0 8px;border-bottom:2px solid #e94560;margin-bottom:12px;margin-top:24px;";
        header.innerHTML = '<h3 style="color:#e94560;font-size:1.3rem;margin:0;">' + (entry.group ? entry.group.name : "Other Contestants") + '</h3>';
        appDiv.appendChild(header);

        entry.contestants.forEach(function (c, index) {
          appDiv.appendChild(renderContestantCard(c, index + 1));
        });
      });
    }

    applyHighlightedContestantStyles();
  }

  // --- Load Contestants ---
  async function loadContestants() {
    try {
      var res = await fetch("/api/contestants", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Server returned " + res.status);
      }
      var data = await res.json();
      data.sort(function (a, b) { return (b.votes || 0) - (a.votes || 0); });
      currentContestants = data;
      clearContestantSearchCache();
      render(getGroupScopedContestants());
      if (isAdmin()) renderAdminList();
      if (currentView === "leaderboard") renderLeaderboard();
    } catch (err) {
      console.error("Failed to load contestants:", err);
      if (currentContestants.length > 0) {
        render(currentContestants);
      } else {
        appDiv.innerHTML = '<p class="loading">Failed to load contestants. Please refresh the page.</p>';
      }
    }
  }

  // --- Timer ---
  async function loadTimer() {
    try {
      var res = await fetch("/api/timer");
      var data = await res.json();
      timerEndTime = data.endTime ? new Date(data.endTime).getTime() : null;
      if (timerEndTime !== null && !isFinite(timerEndTime)) timerEndTime = null;
      updateCountdown();
      if (timerInterval) clearInterval(timerInterval);
      if (timerEndTime) {
        timerInterval = setInterval(updateCountdown, 1000);
      }
    } catch (err) {
      console.error("Failed to load timer:", err);
    }
  }

  function updateCountdown() {
    // Only show timer on Contestants page or Admin view
    var timerAllowed = (currentView === "contestants" || currentView === "admin");

    if (!timerEndTime) {
      countdownBanner.classList.add("hidden");
      if (timerStatus) timerStatus.textContent = "No timer set";
      return;
    }

    if (!timerAllowed) {
      countdownBanner.classList.add("hidden");
      return;
    }

    var now = Date.now();
    var diff = timerEndTime - now;

    if (diff <= 0) {
      countdownBanner.classList.remove("hidden");
      cdDays.textContent = "00";
      cdHours.textContent = "00";
      cdMins.textContent = "00";
      cdSecs.textContent = "00";
      if (timerStatus) timerStatus.textContent = "Competition has ended!";
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      return;
    }

    countdownBanner.classList.remove("hidden");

    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);

    cdDays.textContent = d < 10 ? "0" + d : d;
    cdHours.textContent = h < 10 ? "0" + h : h;
    cdMins.textContent = m < 10 ? "0" + m : m;
    cdSecs.textContent = s < 10 ? "0" + s : s;

    if (timerStatus) {
      var endDate = new Date(timerEndTime);
      timerStatus.textContent = "Ends: " + endDate.toLocaleString();
    }
  }

  if (setTimerBtn) {
    setTimerBtn.addEventListener("click", async function () {
      var days = parseInt(timerDaysInput.value) || 0;
      var hours = parseInt(timerHoursInput.value) || 0;
      var minutes = parseInt(timerMinutesInput.value) || 0;

      if (days === 0 && hours === 0 && minutes === 0) {
        showToast("Please set a time greater than zero", true);
        return;
      }

      setTimerBtn.textContent = "Setting...";

      try {
        var res = await fetch("/api/timer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": adminToken
          },
          body: JSON.stringify({ days: days, hours: hours, minutes: minutes })
        });

        if (!res.ok) {
          var errData = await res.json();
          showToast(errData.error || "Failed to set timer", true);
          return;
        }

        var data = await res.json();
        timerEndTime = data.endTime ? new Date(data.endTime).getTime() : null;
        if (timerEndTime !== null && !isFinite(timerEndTime)) timerEndTime = null;
        updateCountdown();
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(updateCountdown, 1000);
        showToast("Timer set successfully!");
      } catch (err) {
        showToast("Failed to set timer", true);
      } finally {
        setTimerBtn.textContent = "Set Timer";
      }
    });
  }

  if (clearTimerBtn) {
    clearTimerBtn.addEventListener("click", async function () {
      if (!confirm("Clear the competition timer?")) return;

      try {
        var res = await fetch("/api/timer", {
          method: "DELETE",
          headers: { "X-Admin-Token": adminToken }
        });
        if (res.ok) {
          timerEndTime = null;
          if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
          }
          updateCountdown();
          showToast("Timer cleared");
        }
      } catch (err) {
        showToast("Failed to clear timer", true);
      }
    });
  }

  // --- Double Votes Toggle ---
  var doubleVotesToggle = document.getElementById("double-votes-toggle");
  var doubleVotesLabel = document.getElementById("double-votes-label");
  var doubleVotesStatus = document.getElementById("double-votes-status");
  var doubleVotesEnabled = false;

  function updateVoteModalText(enabled) {
    doubleVotesEnabled = enabled;
    // Update free vote button text
    var freeVoteBtn = voteModal ? voteModal.querySelector(".free-vote") : null;
    if (freeVoteBtn) {
      var freeCount = freeVoteBtn.querySelector(".vote-count");
      if (freeCount) freeCount.textContent = enabled ? "2 Votes" : "1 Vote";
    }
    // Update paid vote button text
    var paidBtns = voteModal ? voteModal.querySelectorAll(".paid-vote") : [];
    paidBtns.forEach(function (btn) {
      var amount = parseInt(btn.getAttribute("data-amount"), 10);
      var countEl = btn.querySelector(".vote-count");
      if (countEl) {
        var baseVotes = amount; // $5 = 5 votes, $10 = 10 votes, etc.
        countEl.textContent = (enabled ? baseVotes * 2 : baseVotes) + " Votes";
      }
    });
  }

  async function loadDoubleVotes() {
    try {
      var res = await fetch("/api/double-votes");
      var data = await res.json();
      updateVoteModalText(data.enabled);
      if (doubleVotesToggle) {
        doubleVotesToggle.checked = data.enabled;
        doubleVotesLabel.textContent = data.enabled ? "On" : "Off";
        doubleVotesLabel.style.color = data.enabled ? "#f5c518" : "#888";
        if (doubleVotesStatus) {
          doubleVotesStatus.textContent = data.enabled ? "All votes are currently doubled!" : "";
        }
      }
    } catch (err) {
      console.error("Failed to load double votes setting:", err);
    }
  }

  if (doubleVotesToggle) {
    doubleVotesToggle.addEventListener("change", async function () {
      var enabled = doubleVotesToggle.checked;

      try {
        var res = await fetch("/api/double-votes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": adminToken
          },
          body: JSON.stringify({ enabled: enabled })
        });

        if (!res.ok) {
          var errData = await res.json();
          showToast(errData.error || "Failed to update setting", true);
          doubleVotesToggle.checked = !enabled;
          return;
        }

        doubleVotesLabel.textContent = enabled ? "On" : "Off";
        doubleVotesLabel.style.color = enabled ? "#f5c518" : "#888";
        if (doubleVotesStatus) {
          doubleVotesStatus.textContent = enabled ? "All votes are currently doubled!" : "";
        }
        updateVoteModalText(enabled);
        showToast(enabled ? "2x Votes enabled!" : "2x Votes disabled");
      } catch (err) {
        showToast("Failed to update setting", true);
        doubleVotesToggle.checked = !enabled;
      } finally {
      }
    });
  }

  // --- 2X Timer ---
  var twoXTimerEndTime = null;
  var twoXTimerInterval = null;

  function ensureTwoXTimerUI() {
    if (!adminPanel || document.getElementById("two-x-timer-section")) return;
    var doubleVotesStatusEl = document.getElementById("double-votes-status");
    var anchor = doubleVotesStatusEl
      ? doubleVotesStatusEl.closest("div, section, fieldset") || doubleVotesStatusEl.parentNode
      : null;

    var section = document.createElement("div");
    section.id = "two-x-timer-section";
    section.style.cssText = "margin:18px 0 0;padding:14px;background:#1a1a2e;border:1px solid #d4a84b33;border-radius:8px;";
    section.innerHTML =
      '<h3 style="color:#d4a84b;font-size:1rem;margin:0 0 10px;letter-spacing:1px;">2X TIMER</h3>' +
      '<div id="two-x-timer-countdown" style="display:none;text-align:center;margin-bottom:10px;">' +
        '<div style="color:#ccc;font-size:0.75rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">2X Time Remaining</div>' +
        '<div style="display:flex;justify-content:center;gap:6px;align-items:center;">' +
          '<div style="text-align:center;"><span id="two-x-cd-days" style="font-size:1.5rem;font-weight:700;color:#d4a84b;">00</span><br><small style="color:#888;font-size:0.65rem;text-transform:uppercase;">Days</small></div>' +
          '<span style="font-size:1.2rem;color:#d4a84b33;margin-top:-10px;">:</span>' +
          '<div style="text-align:center;"><span id="two-x-cd-hours" style="font-size:1.5rem;font-weight:700;color:#d4a84b;">00</span><br><small style="color:#888;font-size:0.65rem;text-transform:uppercase;">Hours</small></div>' +
          '<span style="font-size:1.2rem;color:#d4a84b33;margin-top:-10px;">:</span>' +
          '<div style="text-align:center;"><span id="two-x-cd-mins" style="font-size:1.5rem;font-weight:700;color:#d4a84b;">00</span><br><small style="color:#888;font-size:0.65rem;text-transform:uppercase;">Mins</small></div>' +
          '<span style="font-size:1.2rem;color:#d4a84b33;margin-top:-10px;">:</span>' +
          '<div style="text-align:center;"><span id="two-x-cd-secs" style="font-size:1.5rem;font-weight:700;color:#d4a84b;">00</span><br><small style="color:#888;font-size:0.65rem;text-transform:uppercase;">Secs</small></div>' +
        '</div>' +
      '</div>' +
      '<div id="two-x-timer-status" style="color:#888;font-size:0.85rem;margin-bottom:8px;">No 2X timer set</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
        '<input id="two-x-timer-days" type="number" min="0" placeholder="Days" style="width:60px;padding:6px;border:1px solid #555;border-radius:4px;background:#111;color:#fff;font-size:0.85rem;" />' +
        '<input id="two-x-timer-hours" type="number" min="0" max="23" placeholder="Hrs" style="width:60px;padding:6px;border:1px solid #555;border-radius:4px;background:#111;color:#fff;font-size:0.85rem;" />' +
        '<input id="two-x-timer-mins" type="number" min="0" max="59" placeholder="Min" style="width:60px;padding:6px;border:1px solid #555;border-radius:4px;background:#111;color:#fff;font-size:0.85rem;" />' +
        '<button id="two-x-set-timer-btn" type="button" class="btn btn-primary" style="font-size:0.85rem;padding:6px 14px;">Set 2X Timer</button>' +
        '<button id="two-x-clear-timer-btn" type="button" class="btn btn-secondary" style="font-size:0.85rem;padding:6px 14px;">Clear</button>' +
      '</div>';

    if (anchor && anchor.nextSibling) {
      anchor.parentNode.insertBefore(section, anchor.nextSibling);
    } else if (anchor) {
      anchor.parentNode.appendChild(section);
    } else {
      adminPanel.appendChild(section);
    }

    var setBtn = document.getElementById("two-x-set-timer-btn");
    var clearBtn = document.getElementById("two-x-clear-timer-btn");

    if (setBtn) {
      setBtn.addEventListener("click", async function () {
        var d = parseInt(document.getElementById("two-x-timer-days").value) || 0;
        var h = parseInt(document.getElementById("two-x-timer-hours").value) || 0;
        var mn = parseInt(document.getElementById("two-x-timer-mins").value) || 0;
        if (d === 0 && h === 0 && mn === 0) {
          showToast("Please set a time greater than zero", true);
          return;
        }
        setBtn.textContent = "Setting...";
        try {
          var res = await fetch("/api/2x-timer", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
            body: JSON.stringify({ days: d, hours: h, minutes: mn })
          });
          if (!res.ok) {
            var errData = await res.json();
            showToast(errData.error || "Failed to set 2X timer", true);
            return;
          }
          var data = await res.json();
          twoXTimerEndTime = data.endTime ? new Date(data.endTime).getTime() : null;
          if (twoXTimerEndTime !== null && !isFinite(twoXTimerEndTime)) twoXTimerEndTime = null;
          updateTwoXCountdown();
          if (twoXTimerInterval) clearInterval(twoXTimerInterval);
          if (twoXTimerEndTime) twoXTimerInterval = setInterval(updateTwoXCountdown, 1000);
          showToast("2X Timer set successfully!");
        } catch (err) {
          showToast("Failed to set 2X timer", true);
        } finally {
          setBtn.textContent = "Set 2X Timer";
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", async function () {
        if (!confirm("Clear the 2X timer?")) return;
        try {
          var res = await fetch("/api/2x-timer", {
            method: "DELETE",
            headers: { "X-Admin-Token": adminToken }
          });
          if (res.ok) {
            twoXTimerEndTime = null;
            if (twoXTimerInterval) { clearInterval(twoXTimerInterval); twoXTimerInterval = null; }
            updateTwoXCountdown();
            showToast("2X Timer cleared");
          }
        } catch (err) {
          showToast("Failed to clear 2X timer", true);
        }
      });
    }
  }

  function updateTwoXCountdown() {
    var countdownDiv = document.getElementById("two-x-timer-countdown");
    var statusDiv = document.getElementById("two-x-timer-status");
    var daysEl = document.getElementById("two-x-cd-days");
    var hoursEl = document.getElementById("two-x-cd-hours");
    var minsEl = document.getElementById("two-x-cd-mins");
    var secsEl = document.getElementById("two-x-cd-secs");
    if (!countdownDiv) return;

    if (!twoXTimerEndTime) {
      countdownDiv.style.display = "none";
      if (statusDiv) statusDiv.textContent = "No 2X timer set";
      return;
    }

    var diff = twoXTimerEndTime - Date.now();
    if (diff <= 0) {
      if (daysEl) daysEl.textContent = "00";
      if (hoursEl) hoursEl.textContent = "00";
      if (minsEl) minsEl.textContent = "00";
      if (secsEl) secsEl.textContent = "00";
      countdownDiv.style.display = "";
      if (statusDiv) statusDiv.textContent = "2X Timer has ended!";
      if (twoXTimerInterval) { clearInterval(twoXTimerInterval); twoXTimerInterval = null; }
      return;
    }

    countdownDiv.style.display = "";
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    if (daysEl) daysEl.textContent = d < 10 ? "0" + d : d;
    if (hoursEl) hoursEl.textContent = h < 10 ? "0" + h : h;
    if (minsEl) minsEl.textContent = m < 10 ? "0" + m : m;
    if (secsEl) secsEl.textContent = s < 10 ? "0" + s : s;

    if (statusDiv) {
      var endDate = new Date(twoXTimerEndTime);
      statusDiv.textContent = "2X Ends: " + endDate.toLocaleString();
    }
  }

  async function loadTwoXTimer() {
    try {
      var res = await fetch("/api/2x-timer");
      var data = await res.json();
      twoXTimerEndTime = data.endTime ? new Date(data.endTime).getTime() : null;
      if (twoXTimerEndTime !== null && !isFinite(twoXTimerEndTime)) twoXTimerEndTime = null;
      updateTwoXCountdown();
      if (twoXTimerInterval) clearInterval(twoXTimerInterval);
      if (twoXTimerEndTime && twoXTimerEndTime > Date.now()) {
        twoXTimerInterval = setInterval(updateTwoXCountdown, 1000);
      }
    } catch (err) {
      console.error("Failed to load 2X timer:", err);
    }
  }

  // --- Emails Management ---
  var emailsDropdown = document.getElementById("emails-dropdown");
  var removeEmailBtn = document.getElementById("remove-email-btn");
  var removeEmailAllBtn = document.getElementById("remove-email-all-btn");
  var emailsStatus = document.getElementById("emails-status");
  var emailsSelected = document.getElementById("emails-selected");
  var emailsCount = document.getElementById("emails-count");
  var emailsNoAppDropdown = document.getElementById("emails-no-app-dropdown");
  var removeEmailNoAppBtn = document.getElementById("remove-email-no-app-btn");
  var removeEmailNoAppAllBtn = document.getElementById("remove-email-no-app-all-btn");
  var emailsNoAppStatus = document.getElementById("emails-no-app-status");
  var emailsNoAppSelected = document.getElementById("emails-no-app-selected");
  var emailsNoAppCount = document.getElementById("emails-no-app-count");

  function getEmailAtCaret(dropdown) {
    if (!dropdown) return "";
    var text = dropdown.value || "";
    if (!text) return "";
    var hasFocusSelection = typeof dropdown.selectionStart === "number";
    var pos = hasFocusSelection ? dropdown.selectionStart : 0;
    var before = text.substring(0, pos);
    var lineStart = before.lastIndexOf("\n") + 1;
    var lineEnd = text.indexOf("\n", pos);
    if (lineEnd === -1) lineEnd = text.length;
    return text.substring(lineStart, lineEnd).trim();
  }

  function getHighlightedEmails(dropdown) {
    if (!dropdown) return [];
    var text = dropdown.value || "";
    if (!text) return [];
    var start = typeof dropdown.selectionStart === "number" ? dropdown.selectionStart : 0;
    var end = typeof dropdown.selectionEnd === "number" ? dropdown.selectionEnd : 0;
    if (end <= start) return [];
    var lineStart = text.lastIndexOf("\n", start - 1) + 1;
    var lineEnd = text.indexOf("\n", end - 1);
    if (lineEnd === -1) lineEnd = text.length;
    var block = text.substring(lineStart, lineEnd);
    var lines = block.split("\n");
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var email = lines[i].trim();
      if (email) out.push(email);
    }
    // De-duplicate
    var seen = {};
    var unique = [];
    for (var j = 0; j < out.length; j++) {
      if (!seen[out[j]]) {
        seen[out[j]] = true;
        unique.push(out[j]);
      }
    }
    return unique;
  }

  function getAllEmails(dropdown) {
    if (!dropdown) return [];
    var text = dropdown.value || "";
    if (!text) return [];
    var lines = text.split("\n");
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var email = lines[i].trim();
      if (email) out.push(email);
    }
    return out;
  }

  function updateSelectedDisplay(dropdown, selectedEl) {
    if (!selectedEl) return;
    var highlighted = getHighlightedEmails(dropdown);
    if (highlighted.length > 1) {
      selectedEl.textContent = "Selected " + highlighted.length + " emails: " + highlighted.slice(0, 3).join(", ") + (highlighted.length > 3 ? ", ..." : "");
      return;
    }
    if (highlighted.length === 1) {
      selectedEl.textContent = "Selected: " + highlighted[0];
      return;
    }
    var email = getEmailAtCaret(dropdown);
    selectedEl.textContent = email ? "Selected: " + email : "";
  }

  function populateEmailsDropdown(dropdown, emails, countEl) {
    if (!dropdown) return;
    var list = emails && emails.length > 0 ? emails : [];
    dropdown.value = list.join("\n");
    dropdown.placeholder = list.length > 0
      ? list.length + " email(s) — click a line to pick one, highlight lines to pick many, or Ctrl/Cmd+A for all"
      : "No emails found";
    if (countEl) {
      countEl.textContent = "(" + list.length + ")";
    }
  }

  function wireEmailSelectionTracking(dropdown, selectedEl) {
    if (!dropdown) return;
    ["click", "keyup", "focus", "input"].forEach(function (evt) {
      dropdown.addEventListener(evt, function () {
        updateSelectedDisplay(dropdown, selectedEl);
      });
    });
  }

  wireEmailSelectionTracking(emailsDropdown, emailsSelected);
  wireEmailSelectionTracking(emailsNoAppDropdown, emailsNoAppSelected);

  async function loadEmails() {
    if (!emailsDropdown && !emailsNoAppDropdown) return;
    try {
      var res = await fetch("/api/admin/emails", {
        headers: { "X-Admin-Token": adminToken }
      });
      var data = await res.json();
      populateEmailsDropdown(emailsDropdown, data.emails || [], emailsCount);
      populateEmailsDropdown(emailsNoAppDropdown, data.emailsWithoutApplication || [], emailsNoAppCount);
      if (emailsStatus) emailsStatus.textContent = "";
      if (emailsNoAppStatus) emailsNoAppStatus.textContent = "";
      if (emailsSelected) emailsSelected.textContent = "";
      if (emailsNoAppSelected) emailsNoAppSelected.textContent = "";
    } catch (err) {
      console.error("Failed to load emails:", err);
      if (emailsDropdown) {
        emailsDropdown.value = "";
        emailsDropdown.placeholder = "Failed to load emails";
      }
      if (emailsNoAppDropdown) {
        emailsNoAppDropdown.value = "";
        emailsNoAppDropdown.placeholder = "Failed to load emails";
      }
      if (emailsCount) emailsCount.textContent = "";
      if (emailsNoAppCount) emailsNoAppCount.textContent = "";
    }
  }

  function wireRemoveEmailButton(btn, dropdown, statusEl) {
    if (!btn) return;
    btn.addEventListener("click", async function () {
      var highlighted = getHighlightedEmails(dropdown);
      var targets = highlighted.length > 0 ? highlighted : [getEmailAtCaret(dropdown)].filter(Boolean);
      if (targets.length === 0) {
        showToast("Click a line or highlight one or more emails to pick them first", true);
        return;
      }

      var confirmMsg;
      if (targets.length === 1) {
        confirmMsg = "Are you sure you want to remove \"" + targets[0] + "\"? This will delete their application, contestant record, credentials, and IP records so they can reapply.";
      } else {
        var preview = targets.slice(0, 5).join(", ") + (targets.length > 5 ? ", ..." : "");
        confirmMsg = "Are you sure you want to remove " + targets.length + " emails?\n\n" + preview + "\n\nThis will delete their applications, contestant records, credentials, and IP records so they can reapply.";
      }
      if (!confirm(confirmMsg)) return;

      try {
        btn.disabled = true;
        btn.textContent = targets.length > 1 ? "Removing " + targets.length + "..." : "Removing...";
        var res = await fetch("/api/admin/emails", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": adminToken
          },
          body: JSON.stringify(targets.length === 1 ? { email: targets[0] } : { emails: targets })
        });
        if (!res.ok) {
          var errData = await res.json();
          showToast(errData.error || "Failed to remove email(s)", true);
          return;
        }
        var msg = targets.length === 1
          ? "Email \"" + targets[0] + "\" removed successfully!"
          : targets.length + " emails removed successfully!";
        showToast(msg);
        if (statusEl) {
          statusEl.textContent = targets.length === 1
            ? "Removed: " + targets[0]
            : "Removed " + targets.length + " emails";
        }
        await loadEmails();
        await loadContestants();
        await loadParticipants();
      } catch (err) {
        showToast("Failed to remove email(s)", true);
      } finally {
        btn.disabled = false;
        btn.textContent = "Remove";
      }
    });
  }

  function wireRemoveAllEmailsButton(btn, dropdown, statusEl, label) {
    if (!btn) return;
    btn.addEventListener("click", async function () {
      var targets = getAllEmails(dropdown);
      if (targets.length === 0) {
        showToast("There are no emails to remove", true);
        return;
      }
      if (!confirm("Are you sure you want to remove ALL " + targets.length + " emails in the \"" + label + "\" list?\n\nThis will delete their applications, contestant records, credentials, and IP records so they can reapply.")) {
        return;
      }
      try {
        btn.disabled = true;
        btn.textContent = "Removing " + targets.length + "...";
        var res = await fetch("/api/admin/emails", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": adminToken
          },
          body: JSON.stringify({ emails: targets })
        });
        if (!res.ok) {
          var errData = await res.json();
          showToast(errData.error || "Failed to remove emails", true);
          return;
        }
        showToast(targets.length + " emails removed successfully!");
        if (statusEl) statusEl.textContent = "Removed " + targets.length + " emails";
        await loadEmails();
        await loadContestants();
        await loadParticipants();
      } catch (err) {
        showToast("Failed to remove emails", true);
      } finally {
        btn.disabled = false;
        btn.textContent = "Remove all";
      }
    });
  }

  wireRemoveEmailButton(removeEmailBtn, emailsDropdown, emailsStatus);
  wireRemoveEmailButton(removeEmailNoAppBtn, emailsNoAppDropdown, emailsNoAppStatus);
  wireRemoveAllEmailsButton(removeEmailAllBtn, emailsDropdown, emailsStatus, "EMAILS");
  wireRemoveAllEmailsButton(removeEmailNoAppAllBtn, emailsNoAppDropdown, emailsNoAppStatus, "Emails without an application");

  // --- Contest Live Toggle ---
  var contestLiveToggle = document.getElementById("contest-live-toggle");
  var contestLiveLabel = document.getElementById("contest-live-label");
  var contestLiveStatus = document.getElementById("contest-live-status");

  async function loadContestLive() {
    try {
      var res = await fetch("/api/contest-live");
      var data = await res.json();
      if (contestLiveToggle) {
        contestLiveToggle.checked = data.live;
        contestLiveLabel.textContent = data.live ? "On" : "Off";
        contestLiveLabel.style.color = data.live ? "#4caf50" : "#888";
        if (contestLiveStatus) {
          contestLiveStatus.textContent = data.live ? "Contest is currently live!" : "Contest is off — users will see a 'not live' message.";
        }
      }
    } catch (err) {
      console.error("Failed to load contest live setting:", err);
    }
  }

  if (contestLiveToggle) {
    contestLiveToggle.addEventListener("change", async function () {
      var live = contestLiveToggle.checked;

      try {
        var res = await fetch("/api/contest-live", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": adminToken
          },
          body: JSON.stringify({ live: live })
        });

        if (!res.ok) {
          var errData = await res.json();
          showToast(errData.error || "Failed to update setting", true);
          contestLiveToggle.checked = !live;
          return;
        }

        contestLiveLabel.textContent = live ? "On" : "Off";
        contestLiveLabel.style.color = live ? "#4caf50" : "#888";
        if (contestLiveStatus) {
          contestLiveStatus.textContent = live ? "Contest is currently live!" : "Contest is off — users will see a 'not live' message.";
        }
        showToast(live ? "Contest is now LIVE!" : "Contest is now OFF");
      } catch (err) {
        showToast("Failed to update setting", true);
        contestLiveToggle.checked = !live;
      } finally {
      }
    });
  }

  // --- Participants (Applications) ---
  var participantsList = document.getElementById("participants-list");
  var currentApplications = [];

  async function loadParticipants() {
    if (!participantsList || !isAdmin()) return;

    try {
      var res = await fetch("/api/applications", {
        headers: { "X-Admin-Token": adminToken }
      });
      if (!res.ok) throw new Error("Failed to load");
      var applications = await res.json();
      currentApplications = Array.isArray(applications) ? applications : [];
      renderParticipants(applications);
    } catch (err) {
      participantsList.innerHTML = '<p style="color:#666;text-align:center;padding:12px;">Failed to load applications.</p>';
    }
  }

  // --- Mass Email ---
  var massEmailBtn = document.getElementById("mass-email-btn");
  var massEmailModal = document.getElementById("mass-email-modal");
  var massEmailSubject = document.getElementById("mass-email-subject");
  var massEmailBody = document.getElementById("mass-email-body");
  var massEmailSendBtn = document.getElementById("mass-email-send-btn");
  var massEmailCancelBtn = document.getElementById("mass-email-cancel-btn");
  var massEmailError = document.getElementById("mass-email-error");
  var massEmailSuccess = document.getElementById("mass-email-success");
  var massEmailInfo = document.getElementById("mass-email-recipients-info");

  function getMassEmailRecipients() {
    var groupedIds = {};
    allGroups.forEach(function (g) {
      if (!g || !Array.isArray(g.contestantIds)) return;
      g.contestantIds.forEach(function (id) {
        groupedIds[normalizeId(id)] = true;
      });
    });

    var seen = Object.create(null);
    var recipients = [];
    (currentApplications || []).forEach(function (app) {
      if (!app || !app.contestantId) return;
      if (!groupedIds[normalizeId(app.contestantId)]) return;
      var email = (app.email == null ? "" : String(app.email)).trim();
      if (!email) return;
      var key = email.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      recipients.push(email);
    });

    return recipients;
  }

  function setMassEmailFeedback(message, isError) {
    if (massEmailError) {
      massEmailError.textContent = isError ? (message || "") : "";
      massEmailError.classList.toggle("hidden", !isError || !message);
    }
    if (massEmailSuccess) {
      massEmailSuccess.textContent = !isError ? (message || "") : "";
      massEmailSuccess.classList.toggle("hidden", isError || !message);
    }
  }

  function openMassEmailModal() {
    if (!massEmailModal) return;
    var recipients = getMassEmailRecipients();
    if (massEmailInfo) {
      if (recipients.length === 0) {
        massEmailInfo.textContent = "No contestants in active leaderboard groups have an email address.";
      } else {
        massEmailInfo.textContent = "Sends to " + recipients.length + " contestant" + (recipients.length === 1 ? "" : "s") + " in active leaderboard groups.";
      }
    }
    setMassEmailFeedback("", false);
    massEmailModal.classList.remove("hidden");
    if (massEmailSubject) {
      try { massEmailSubject.focus(); } catch (e) {}
    }
  }

  function closeMassEmailModal() {
    if (!massEmailModal) return;
    massEmailModal.classList.add("hidden");
  }

  function buildMailtoFallback(recipients, subject, body) {
    var href = "mailto:?bcc=" + recipients.map(encodeURIComponent).join(",")
      + "&subject=" + encodeURIComponent(subject || "")
      + "&body=" + encodeURIComponent(body || "");
    try {
      var a = document.createElement("a");
      a.href = href;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      window.location.href = href;
    }
  }

  async function sendMassEmail() {
    if (!isAdmin()) return;
    var recipients = getMassEmailRecipients();
    var subject = (massEmailSubject && massEmailSubject.value || "").trim();
    var body = (massEmailBody && massEmailBody.value || "").trim();

    if (recipients.length === 0) {
      setMassEmailFeedback("No contestants in active leaderboard groups have an email address.", true);
      return;
    }
    if (!subject) {
      setMassEmailFeedback("Please enter a subject.", true);
      return;
    }
    if (!body) {
      setMassEmailFeedback("Please enter a message.", true);
      return;
    }

    if (!confirm("Send this email to " + recipients.length + " contestant" + (recipients.length === 1 ? "" : "s") + "?")) {
      return;
    }

    if (massEmailSendBtn) {
      massEmailSendBtn.disabled = true;
      massEmailSendBtn.textContent = "Sending...";
    }
    setMassEmailFeedback("", false);

    try {
      var res = await fetch("/api/send-mass-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        },
        body: JSON.stringify({ recipients: recipients, subject: subject, body: body })
      });
      if (res.ok) {
        var data = await res.json().catch(function () { return {}; });
        var sent = (data && typeof data.sent === "number") ? data.sent : recipients.length;
        setMassEmailFeedback("Email sent to " + sent + " recipient" + (sent === 1 ? "" : "s") + ".", false);
        showToast("Mass email sent to " + sent + " recipient" + (sent === 1 ? "" : "s"));
        if (massEmailSubject) massEmailSubject.value = "";
        if (massEmailBody) massEmailBody.value = "";
        setTimeout(closeMassEmailModal, 1200);
        return;
      }

      // Server couldn't send — fall back to opening a mailto with all recipients as BCC.
      buildMailtoFallback(recipients, subject, body);
      setMassEmailFeedback("Server couldn't send directly. Your email app was opened with " + recipients.length + " BCC recipient" + (recipients.length === 1 ? "" : "s") + ".", false);
      showToast("Opening your email app with " + recipients.length + " BCC recipient" + (recipients.length === 1 ? "" : "s"));
    } catch (err) {
      buildMailtoFallback(recipients, subject, body);
      setMassEmailFeedback("Couldn't reach the email service. Your email app was opened with " + recipients.length + " BCC recipient" + (recipients.length === 1 ? "" : "s") + ".", false);
    } finally {
      if (massEmailSendBtn) {
        massEmailSendBtn.disabled = false;
        massEmailSendBtn.textContent = "Send";
      }
    }
  }

  if (massEmailBtn) {
    massEmailBtn.addEventListener("click", openMassEmailModal);
  }
  if (massEmailCancelBtn) {
    massEmailCancelBtn.addEventListener("click", closeMassEmailModal);
  }
  if (massEmailSendBtn) {
    massEmailSendBtn.addEventListener("click", sendMassEmail);
  }
  if (massEmailModal) {
    massEmailModal.addEventListener("click", function (event) {
      if (event.target === massEmailModal) closeMassEmailModal();
    });
  }

  // --- Individual Mass Email (one mailto draft per contestant) ---
  var individualMassEmailBtn = document.getElementById("individual-mass-email-btn");

  function getContestantRankInGroup(contestant, group) {
    if (!contestant || !group || !Array.isArray(group.contestantIds)) return null;
    var members = currentContestants.filter(function (c) {
      return groupHasContestant(group, c.id);
    });
    if (members.length === 0) return null;
    members.sort(function (a, b) { return (b.votes || 0) - (a.votes || 0); });
    var idx = members.findIndex(function (c) { return idsEqual(c.id, contestant.id); });
    return idx === -1 ? null : (idx + 1);
  }

  function buildIndividualEmailRecipients() {
    var origin = (window.location && window.location.origin) || "";
    var seen = Object.create(null);
    var out = [];
    (currentApplications || []).forEach(function (app) {
      var email = (app && app.email ? String(app.email) : "").trim();
      if (!email) return;
      var key = email.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;

      var contestant = app.contestantId
        ? currentContestants.find(function (c) { return idsEqual(c.id, app.contestantId); })
        : null;

      var groups = contestant ? getContestantGroups(contestant.id) : [];
      var groupLabel = "Unassigned";
      var rank = null;
      if (groups.length > 0) {
        var primary = groups[0];
        groupLabel = (primary.groupNumber ? "Group " + primary.groupNumber + ": " : "") + (primary.name || "");
        rank = getContestantRankInGroup(contestant, primary);
      }

      var picUrl = "";
      if (app.photoData && /^https?:|^data:/.test(app.photoData)) {
        picUrl = app.photoData;
      } else if (app.hasPhoto) {
        picUrl = origin + "/api/application-photo?id=" + encodeURIComponent(app.id || app.userId || app._blobKey || "");
      } else if (contestant && contestant.image) {
        picUrl = /^https?:|^data:/.test(contestant.image) ? contestant.image : (origin + contestant.image);
      }

      out.push({
        email: email,
        name: (app.name || (contestant && contestant.name) || "").trim(),
        pic: picUrl,
        group: groupLabel,
        rank: rank
      });
    });
    return out;
  }

  function buildIndividualEmailBody(item) {
    var lines = [
      "Name: " + (item.name || ""),
      "Pic: " + (item.pic || "(no photo on file)"),
      "Group: " + (item.group || "Unassigned"),
      "Rank: " + (item.rank ? "#" + item.rank : "Unranked"),
      "",
      "NEXT FILM LEAD, Your doing great! Keep it up. Its completely up to you. MAKE IT HAPPEN! We are rooting for you."
    ];
    return lines.join("\r\n");
  }

  function openMailtoDraft(item) {
    var subject = "NEXT FILM LEAD";
    var body = buildIndividualEmailBody(item);
    var href = "mailto:" + encodeURIComponent(item.email).replace(/%40/g, "@")
      + "?subject=" + encodeURIComponent(subject)
      + "&body=" + encodeURIComponent(body);
    try {
      var a = document.createElement("a");
      a.href = href;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      try { window.location.href = href; } catch (e2) {}
    }
  }

  function openIndividualMassEmails() {
    if (!isAdmin()) return;
    var items = buildIndividualEmailRecipients();
    if (items.length === 0) {
      showToast("No contestants with an email address are available to message.", true);
      return;
    }
    if (!confirm("This will open " + items.length + " separate email draft" + (items.length === 1 ? "" : "s") + " — one for each contestant. Your browser may ask permission. Continue?")) {
      return;
    }
    showToast("Opening " + items.length + " email draft" + (items.length === 1 ? "" : "s") + "...");
    items.forEach(function (item, idx) {
      setTimeout(function () { openMailtoDraft(item); }, idx * 600);
    });
  }

  if (individualMassEmailBtn) {
    individualMassEmailBtn.addEventListener("click", openIndividualMassEmails);
  }

  // --- All Vote Analytics button (sits beside the Mail buttons in
  // Participants (Applications)). Renders every contestant's analytics on
  // the Vote Analytics page in "all" mode.
  (function injectAllVoteAnalyticsButton() {
    if (document.getElementById("all-vote-analytics-btn")) return;
    var anchorBtn = individualMassEmailBtn || massEmailBtn;
    if (!anchorBtn || !anchorBtn.parentNode) return;
    var allAnalyticsBtn = document.createElement("button");
    allAnalyticsBtn.id = "all-vote-analytics-btn";
    allAnalyticsBtn.type = "button";
    allAnalyticsBtn.className = anchorBtn.className || "btn btn-secondary";
    allAnalyticsBtn.textContent = "All Vote Analytics";
    allAnalyticsBtn.title = "View vote analytics for every contestant on one page";
    allAnalyticsBtn.addEventListener("click", function () {
      window.location.href = "/vote-analytics/?all=1";
    });
    anchorBtn.parentNode.insertBefore(allAnalyticsBtn, anchorBtn.nextSibling);
  })();

  async function acceptApplicant(app, btn) {
    if (app.accepted) {
      btn.textContent = "accepted";
      btn.classList.add("accepted");
      return;
    }
    if (!confirm("Accept " + app.name + " into the contest?")) return;

    btn.textContent = "Accepting...";

    try {
      // Fetch full application including photoData/resumeData (stripped from list response)
      var fullApp = app;
      if (!app.photoData && (app.hasPhoto || app.hasResume)) {
        try {
          var appId = app.id || app.userId || app._blobKey;
          var fullRes = await fetch("/api/applications?id=" + encodeURIComponent(appId), {
            headers: { "X-Admin-Token": adminToken }
          });
          if (fullRes.ok) {
            fullApp = await fullRes.json();
          }
        } catch (e) {}
      }

      var res = await fetch("/api/contestants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        },
        body: JSON.stringify({
          name: fullApp.name,
          bio: fullApp.bio || "",
          blurb: fullApp.blurb || "",
          photoData: fullApp.photoData || "",
          resumeData: fullApp.resumeData || "",
          monologue_link: fullApp.monologue_link || "",
          email: fullApp.email || ""
        })
      });

      if (!res.ok) {
        var errText = await res.text();
        var errMsg = "Failed to accept applicant";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch (e) {}
        throw new Error(errMsg);
      }

      var newContestant = await res.json();
      app.accepted = true;
      btn.textContent = "accepted";
      btn.classList.add("accepted");
      await markApplicationAccepted(app.id || app.userId || app._blobKey, newContestant.id);
      showToast(app.name + " accepted into the contest!");
      sendAcceptanceEmail(fullApp.email || app.email, app.name);
      loadContestants();
    } catch (err) {
      btn.textContent = "Accept";
      showToast(err.message, true);
    }
  }

  async function markApplicationAccepted(applicationId, contestantId) {
    if (!applicationId || !isAdmin()) return;
    try {
      var patchBody = { accepted: true };
      if (contestantId) patchBody.contestantId = contestantId;
      await fetch("/api/applications?id=" + encodeURIComponent(applicationId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        },
        body: JSON.stringify(patchBody)
      });
    } catch (err) {}
  }

  async function sendAcceptanceEmail(email, name) {
    if (!email) return;

    // First try the server-side transactional email (requires RESEND_API_KEY +
    // ACCEPTANCE_EMAIL_FROM env vars on the site). If those aren't configured,
    // fall back to opening the admin's default email client with the message
    // pre-filled so the email can still be sent without any extra setup.
    try {
      var res = await fetch("/api/send-acceptance-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        },
        body: JSON.stringify({ email: email, name: name || "" })
      });
      if (res.ok) {
        showToast("Acceptance email sent to " + email);
        return;
      }
      // Server couldn't send (most often: email service not configured).
      openAcceptanceMailto(email, name);
    } catch (err) {
      openAcceptanceMailto(email, name);
    }
  }

  function buildAcceptanceEmailBody(name) {
    var safeName = name || "";
    return [
      "This Is Your Moment",
      "",
      "Congratulations, " + safeName + " —",
      "",
      "You're officially in the running for The Next Film Lead.",
      "",
      "Starting May 1st, the spotlight is yours.",
      "",
      "Your personal voting page is on the way. When it arrives, share it everywhere — family, friends, social media, press. Build your audience. Drive your votes. Make noise.",
      "",
      "This is your opportunity to step into the lead role and be seen.",
      "",
      "Own it. Promote it. Win it.",
      "",
      "Good luck,",
      "ADMIN"
    ].join("\r\n");
  }

  function openAcceptanceMailto(email, name) {
    var subject = "This Is Your Moment";
    var body = buildAcceptanceEmailBody(name);
    var href = "mailto:" + encodeURIComponent(email)
      + "?subject=" + encodeURIComponent(subject)
      + "&body=" + encodeURIComponent(body);
    // Use a hidden anchor click so popup-blockers don't swallow it and the
    // current admin page stays put.
    try {
      var a = document.createElement("a");
      a.href = href;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Opening your email app to send the acceptance message to " + email);
    } catch (e) {
      window.location.href = href;
    }
  }

  async function sendSolEmail(app, btn) {
    var email = (app.email || "").trim();
    if (!email) {
      showToast("This applicant has no email on file.", true);
      return;
    }
    if (!app.contestantId) {
      showToast("Accept this applicant first so a profile page exists.", true);
      return;
    }

    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending...";

    var photoUrl = "";
    if (app.photoData) {
      photoUrl = app.photoData;
    } else if (app.hasPhoto) {
      var origin = (window.location && window.location.origin) || "";
      photoUrl = origin + "/api/application-photo?id=" + encodeURIComponent(app.id || app.userId || app._blobKey);
    }

    try {
      var res = await fetch("/api/send-sol-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        },
        body: JSON.stringify({
          email: email,
          name: app.name || "",
          contestantId: app.contestantId,
          photoUrl: photoUrl
        })
      });
      if (res.ok) {
        showToast("Email sent to " + email);
        btn.textContent = "Email sent";
        return;
      }
      // Server couldn't send (most often: email service not configured).
      openSolMailto(app);
      btn.textContent = originalText;
    } catch (err) {
      openSolMailto(app);
      btn.textContent = originalText;
    } finally {
      btn.disabled = false;
    }
  }

  function buildSolEmailBody(name, profileUrl) {
    return [
      "This is it, share this link with family, friends and all media",
      "",
      "Please vote for " + (name || ""),
      profileUrl,
      "",
      "Good Luck, ADMIN"
    ].join("\r\n");
  }

  function openSolMailto(app) {
    var origin = (window.location && window.location.origin) || "";
    var profileUrl = app.contestantId
      ? origin + "/contestant-details.html?id=" + encodeURIComponent(app.contestantId)
      : "";
    var subject = "Now is your time!";
    var body = buildSolEmailBody(app.name, profileUrl);
    var href = "mailto:" + encodeURIComponent(app.email).replace(/%40/g, "@")
      + "?subject=" + encodeURIComponent(subject)
      + "&body=" + encodeURIComponent(body);
    try {
      var a = document.createElement("a");
      a.href = href;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Opening your email app to send the message to " + app.email);
    } catch (e) {
      window.location.href = href;
    }
  }

  async function removeApplicant(app, btn) {
    if (!confirm("Remove application from " + app.name + "?")) return;

    btn.textContent = "Removing...";

    try {
      var res = await fetch("/api/applications?id=" + encodeURIComponent(app.id || app.userId || app._blobKey), {
        method: "DELETE",
        headers: { "X-Admin-Token": adminToken }
      });

      if (!res.ok) {
        throw new Error("Failed to remove application");
      }

      showToast(app.name + "'s application removed.");
      loadParticipants();
    } catch (err) {
      btn.textContent = "Remove";
      showToast(err.message, true);
    }
  }

  async function resetContestantVotes(app, btn) {
    if (!app.contestantId) {
      showToast("Accept this applicant first.", true);
      return;
    }
    if (!confirm("Reset all votes for " + app.name + " to 0? This cannot be undone.")) return;

    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Resetting...";

    try {
      var res = await fetch("/api/contestants/" + encodeURIComponent(app.contestantId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        },
        body: JSON.stringify({ votes: 0 })
      });
      if (!res.ok) throw new Error("Failed to reset contestant votes");

      try {
        await fetch("/api/vote-events?contestantId=" + encodeURIComponent(app.contestantId), {
          method: "DELETE",
          headers: { "X-Admin-Token": adminToken }
        });
      } catch (e) {}

      showToast("Votes for " + app.name + " have been reset to 0.");
      btn.textContent = "Reset Votes";
      try { await loadContestants(); } catch (e) {}
    } catch (err) {
      showToast((err && err.message) || "Failed to reset votes.", true);
      btn.textContent = originalText;
    } finally {
      btn.disabled = false;
    }
  }

  function renderParticipants(applications) {
    if (!participantsList) return;
    participantsList.innerHTML = "";

    if (applications.length === 0) {
      participantsList.innerHTML = '<p style="color:#666;text-align:center;padding:12px;">No applications yet.</p>';
      return;
    }

    applications = applications.slice().sort(function (a, b) {
      var nameA = (a.name || "").toLowerCase();
      var nameB = (b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    applications.forEach(function (app) {
      var card = document.createElement("div");
      card.className = "participant-card";

      var photoHtml = (app.photoData || app.hasPhoto)
        ? '<img src="' + (app.photoData || ('/api/application-photo?id=' + encodeURIComponent(app.id || app.userId || app._blobKey))) + '" alt="' + app.name + '" class="participant-photo" />'
        : '<div class="participant-photo-placeholder">No Photo</div>';

      var monologueHtml = app.monologue_link
        ? '<div class="participant-field"><strong>Monologue:</strong> <a href="' + app.monologue_link + '" target="_blank" rel="noopener noreferrer">' + app.monologue_link + '</a></div>'
        : '';

      var dateStr = app.submittedAt ? new Date(app.submittedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Unknown";

      card.innerHTML =
        '<div class="participant-header">' +
          photoHtml +
          '<div class="participant-name-section">' +
            '<h4>' + app.name + '</h4>' +
            '<span class="participant-date">Applied: ' + dateStr + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="participant-details">' +
          '<div class="participant-field"><strong>Email:</strong> <a href="mailto:' + encodeURIComponent(app.email).replace(/%40/g, '@') + '">' + app.email + '</a></div>' +
          '<div class="participant-field"><strong>Phone:</strong> ' + (app.phone || "N/A") + '</div>' +
          '<div class="participant-field"><strong>Bio:</strong> ' + (app.bio || "N/A") + '</div>' +
          monologueHtml +
        '</div>' +
        '<div class="participant-actions"></div>';

      var acceptBtn = document.createElement("button");
      acceptBtn.className = "btn btn-accept";
      acceptBtn.textContent = app.accepted ? "accepted" : "Accept";
      if (app.accepted) {
        acceptBtn.classList.add("accepted");
      }
      acceptBtn.onclick = function () { acceptApplicant(app, acceptBtn); };
      card.querySelector(".participant-actions").appendChild(acceptBtn);

      var solBtn = document.createElement("button");
      solBtn.className = "btn btn-sol";
      solBtn.textContent = "Send Email";
      solBtn.title = app.contestantId
        ? "Send the 'Now is your time!' email with this contestant's profile link"
        : "Accept this applicant first to enable Send Email";
      if (!app.contestantId) {
        solBtn.disabled = true;
      }
      solBtn.onclick = function () { sendSolEmail(app, solBtn); };
      card.querySelector(".participant-actions").appendChild(solBtn);

      var resetVotesBtn = document.createElement("button");
      resetVotesBtn.className = "btn btn-danger btn-sm";
      resetVotesBtn.textContent = "Reset Votes";
      resetVotesBtn.title = app.contestantId
        ? "Reset all votes for " + app.name + " to 0"
        : "Accept this applicant first to reset votes";
      if (!app.contestantId) {
        resetVotesBtn.disabled = true;
      }
      resetVotesBtn.onclick = function () { resetContestantVotes(app, resetVotesBtn); };
      card.querySelector(".participant-actions").appendChild(resetVotesBtn);

      var analyticsBtn = document.createElement("button");
      analyticsBtn.className = "btn btn-secondary btn-sm";
      analyticsBtn.textContent = "Vote Analytics";
      analyticsBtn.title = app.contestantId
        ? "View who voted for " + app.name + " and how many votes each person added"
        : "Accept this applicant first to view vote analytics";
      if (!app.contestantId) {
        analyticsBtn.disabled = true;
      }
      analyticsBtn.onclick = function () {
        if (!app.contestantId) return;
        var qs = "?id=" + encodeURIComponent(app.contestantId) +
                 "&name=" + encodeURIComponent(app.name || "");
        window.location.href = "/vote-analytics/" + qs;
      };
      card.querySelector(".participant-actions").appendChild(analyticsBtn);

      var removeBtn = document.createElement("button");
      removeBtn.className = "btn btn-danger btn-sm";
      removeBtn.textContent = "Remove";
      removeBtn.onclick = function () { removeApplicant(app, removeBtn); };
      card.querySelector(".participant-actions").appendChild(removeBtn);

      participantsList.appendChild(card);
    });
  }

  // --- Site Content Management ---
  var siteContent = {};

  async function loadSiteContent() {
    try {
      var res = await fetch("/api/site-content");
      if (res.ok) {
        siteContent = await res.json();
        applySiteContent();
        if (isAdmin()) populateSiteContentForm();
      }
    } catch (err) {
      console.error("Failed to load site content:", err);
    }
  }

  function applySiteContent() {
    // Vote page header
    var h1 = document.querySelector("header h1");
    var tagline = document.querySelector("header .tagline");
    if (siteContent.voteTitle && h1) h1.textContent = siteContent.voteTitle;
    if (siteContent.voteTagline && tagline) tagline.textContent = siteContent.voteTagline;

    // Apply section
    var applyTitle = document.querySelector(".apply-title");
    var applySubtitle = document.querySelector(".apply-subtitle");
    if (siteContent.applyTitle && applyTitle) applyTitle.textContent = siteContent.applyTitle;
    if (siteContent.applySubtitle && applySubtitle) applySubtitle.textContent = siteContent.applySubtitle;

    // Contact section
    var contactTitle = document.querySelector(".contact-title");
    var contactSubtitle = document.querySelector(".contact-subtitle");
    if (siteContent.contactTitle && contactTitle) contactTitle.textContent = siteContent.contactTitle;
    if (siteContent.contactSubtitle && contactSubtitle) contactSubtitle.textContent = siteContent.contactSubtitle;

    // Footer
    var footer = document.querySelector(".site-footer p");
    if (siteContent.footerText && footer) footer.textContent = siteContent.footerText;
  }

  function populateSiteContentForm() {
    var fields = {
      "sc-landing-title": "landingTitle",
      "sc-landing-headline": "landingHeadline",
      "sc-landing-desc": "landingDesc",
      "sc-landing-awards": "landingAwards",
      "sc-landing-cta": "landingCta",
      "sc-vote-title": "voteTitle",
      "sc-vote-tagline": "voteTagline",
      "sc-apply-title": "applyTitle",
      "sc-apply-subtitle": "applySubtitle",
      "sc-contact-title": "contactTitle",
      "sc-contact-subtitle": "contactSubtitle",
      "sc-footer-text": "footerText"
    };
    Object.keys(fields).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && siteContent[fields[id]]) el.value = siteContent[fields[id]];
    });
  }

  var saveSiteContentBtn = document.getElementById("save-site-content-btn");
  if (saveSiteContentBtn) {
    saveSiteContentBtn.addEventListener("click", async function () {
      var scSuccess = document.getElementById("sc-success");
      var scError = document.getElementById("sc-error");
      scSuccess.classList.add("hidden");
      scError.classList.add("hidden");

      var payload = {};
      var fields = {
        "sc-landing-title": "landingTitle",
        "sc-landing-headline": "landingHeadline",
        "sc-landing-desc": "landingDesc",
        "sc-landing-awards": "landingAwards",
        "sc-landing-cta": "landingCta",
        "sc-vote-title": "voteTitle",
        "sc-vote-tagline": "voteTagline",
        "sc-apply-title": "applyTitle",
        "sc-apply-subtitle": "applySubtitle",
        "sc-contact-title": "contactTitle",
        "sc-contact-subtitle": "contactSubtitle",
        "sc-footer-text": "footerText"
      };

      Object.keys(fields).forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.value.trim()) payload[fields[id]] = el.value.trim();
      });

      saveSiteContentBtn.textContent = "Saving...";

      try {
        var res = await fetch("/api/site-content", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": adminToken
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed");
        siteContent = await res.json();
        applySiteContent();
        scSuccess.classList.remove("hidden");
        showToast("Site content saved!");
      } catch (err) {
        scError.classList.remove("hidden");
        showToast("Failed to save content", true);
      } finally {
        saveSiteContentBtn.textContent = "Save All Content";
      }
    });
  }

  // --- Edit Contestant Modal ---
  function openEditContestant(c) {
    var existing = document.querySelector(".edit-contestant-overlay");
    if (existing) existing.remove();

    function attr(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function text(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

    var currentImage = c.image || c.photoData || "";
    var hasResume = !!c.resumeData;
    var resumeName = (c.name || "contestant") + "-resume.pdf";

    var overlay = document.createElement("div");
    overlay.className = "edit-contestant-overlay";
    overlay.innerHTML =
      '<div class="edit-contestant-modal">' +
        '<h3>Edit Contestant</h3>' +
        '<label>Name</label>' +
        '<input type="text" id="edit-c-name" value="' + attr(c.name) + '" />' +
        '<label>Email</label>' +
        '<input type="email" id="edit-c-email" value="' + attr(c.email) + '" placeholder="contestant@example.com" />' +
        '<label>Login Password <span style="font-weight:normal;color:#888;font-size:0.85rem;">(leave blank to keep unchanged)</span></label>' +
        '<div style="position:relative;">' +
          '<input type="password" id="edit-c-password" value="" placeholder="Enter new password" autocomplete="new-password" style="padding-right:60px;" />' +
          '<button type="button" id="edit-c-toggle-pw" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#e94560;cursor:pointer;font-size:0.8rem;padding:2px 6px;">Show</button>' +
        '</div>' +
        '<label>Blurb (short tagline)</label>' +
        '<textarea id="edit-c-blurb" rows="2" placeholder="One-line tagline shown above the bio">' + text(c.blurb) + '</textarea>' +
        '<label>Bio</label>' +
        '<textarea id="edit-c-bio" rows="4">' + text(c.bio) + '</textarea>' +
        '<label>Monologue Link or Acting Reel</label>' +
        '<input type="url" id="edit-c-monologue" value="' + attr(c.monologue_link) + '" />' +
        '<label>Votes</label>' +
        '<input type="number" id="edit-c-votes" min="0" step="1" value="' + attr(c.votes || 0) + '" />' +
        '<label>Replace Photo</label>' +
        (currentImage ? '<img id="edit-c-current-photo" src="' + attr(currentImage) + '" alt="Current photo" style="width:120px;height:120px;object-fit:cover;border-radius:8px;margin-top:4px;display:block;" />' : '') +
        '<input type="file" id="edit-c-photo" accept="image/*" style="color:#ccc;margin-top:4px;" />' +
        '<img id="edit-c-preview" class="pic-preview hidden" alt="Preview" />' +
        '<label>Replace Resume (PDF)</label>' +
        (hasResume ? '<div style="margin-top:4px;margin-bottom:6px;"><a id="edit-c-current-resume" href="' + attr(c.resumeData) + '" download="' + attr(resumeName) + '" target="_blank" style="color:#e94560;font-size:0.85rem;">View current resume</a></div>' : '<div style="margin-top:4px;margin-bottom:6px;color:#888;font-size:0.85rem;">No resume uploaded</div>') +
        '<input type="file" id="edit-c-resume" accept="application/pdf,.pdf" style="color:#ccc;margin-top:4px;" />' +
        '<p id="edit-c-resume-name" style="color:#aaa;font-size:0.8rem;margin-top:4px;"></p>' +
        '<div class="form-actions">' +
          '<button id="edit-c-save" class="btn btn-primary">Save Changes</button>' +
          '<button id="edit-c-cancel" class="btn btn-secondary">Cancel</button>' +
        '</div>' +
        '<p id="edit-c-error" class="form-error hidden" style="margin-top:8px;"></p>' +
      '</div>';

    document.body.appendChild(overlay);

    // Photo preview
    document.getElementById("edit-c-photo").addEventListener("change", function () {
      var file = this.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var prev = document.getElementById("edit-c-preview");
          prev.src = e.target.result;
          prev.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
      }
    });

    // Resume filename display
    document.getElementById("edit-c-resume").addEventListener("change", function () {
      var file = this.files[0];
      var label = document.getElementById("edit-c-resume-name");
      label.textContent = file ? "Selected: " + file.name : "";
    });

    // Password show/hide toggle
    document.getElementById("edit-c-toggle-pw").addEventListener("click", function () {
      var pwInput = document.getElementById("edit-c-password");
      var isHidden = pwInput.type === "password";
      pwInput.type = isHidden ? "text" : "password";
      this.textContent = isHidden ? "Hide" : "Show";
    });

    // Cancel
    document.getElementById("edit-c-cancel").addEventListener("click", function () {
      overlay.remove();
    });

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });

    // Save
    document.getElementById("edit-c-save").addEventListener("click", async function () {
      var saveBtn = this;
      var errorEl = document.getElementById("edit-c-error");
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      var emailVal = document.getElementById("edit-c-email").value.trim();
      var votesVal = parseInt(document.getElementById("edit-c-votes").value, 10);
      if (isNaN(votesVal) || votesVal < 0) votesVal = 0;

      var patchBody = {
        name: document.getElementById("edit-c-name").value.trim(),
        email: emailVal,
        bio: document.getElementById("edit-c-bio").value.trim(),
        blurb: document.getElementById("edit-c-blurb").value.trim(),
        monologue_link: document.getElementById("edit-c-monologue").value.trim(),
        votes: votesVal
      };

      // Handle photo replacement
      var photoFile = document.getElementById("edit-c-photo").files[0];
      if (photoFile) {
        try {
          patchBody.photoData = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
              var img = new Image();
              img.onload = function () {
                var canvas = document.createElement("canvas");
                var maxW = 800, maxH = 800;
                var w = img.width, h = img.height;
                if (w > maxW || h > maxH) {
                  var ratio = Math.min(maxW / w, maxH / h);
                  w = Math.round(w * ratio);
                  h = Math.round(h * ratio);
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL("image/jpeg", 0.8));
              };
              img.onerror = function () { reject(new Error("Failed to load image")); };
              img.src = reader.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(photoFile);
          });
        } catch (err) {
          errorEl.textContent = "Failed to process image";
          errorEl.classList.remove("hidden");
          showToast("Failed to process image", true);
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Changes";
          return;
        }
      }

      // Handle resume replacement
      var resumeFile = document.getElementById("edit-c-resume").files[0];
      if (resumeFile) {
        try {
          patchBody.resumeData = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(new Error("Failed to read resume")); };
            reader.readAsDataURL(resumeFile);
          });
        } catch (err) {
          errorEl.textContent = "Failed to read resume file";
          errorEl.classList.remove("hidden");
          showToast("Failed to read resume", true);
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Changes";
          return;
        }
      }

      try {
        var res = await fetch("/api/contestants/" + c.id, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": adminToken
          },
          body: JSON.stringify(patchBody)
        });
        if (!res.ok) {
          var errData = null;
          try { errData = await res.json(); } catch (e) {}
          throw new Error((errData && errData.error) || "Failed");
        }

        var passwordVal = document.getElementById("edit-c-password").value;
        if (passwordVal) {
          var credEmail = emailVal || c.email;
          try {
            var credRes = await fetch("/api/user-credentials?action=store", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: credEmail, password: passwordVal })
            });
            if (!credRes.ok) {
              showToast("Contestant saved but password update failed", true);
            }
          } catch (credErr) {
            showToast("Contestant saved but password update failed", true);
          }
        }

        overlay.remove();
        showToast(patchBody.name + " updated!");
        loadContestants();
      } catch (err) {
        errorEl.textContent = err && err.message ? err.message : "Failed to update contestant";
        errorEl.classList.remove("hidden");
        showToast("Failed to update contestant", true);
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
      }
    });
  }

  // --- Apply Form (auth required via @netlify/identity) ---
  var identity = window.NetlifyIdentity || null;

  // Contestant user bar
  var contestantUserBar = document.getElementById("contestant-user-bar");
  var contestantUserEmail = document.getElementById("contestant-user-email");
  var contestantLogoutBtn = document.getElementById("contestant-logout-btn");

  if (contestantLogoutBtn) {
    contestantLogoutBtn.addEventListener("click", async function () {
      try {
        if (identity) await identity.logout();
      } catch (e) {}
      clearContestantSessionMarkers();
      loggedInUser = null;
      loggedInContestant = null;
      loggedInUserGroups = [];
      if (contestantUserBar) contestantUserBar.classList.add("hidden");
      updateNavForAuth();
      window.location.href = "/";
    });
  }

  var authGate = document.getElementById("apply-auth-gate");
  var authUserBar = document.getElementById("apply-user-bar");
  var authUserEmail = document.getElementById("apply-user-email");
  var authLogoutBtn = document.getElementById("apply-logout-btn");

  var authTabs = document.querySelectorAll(".auth-tab");
  var authSignupPanel = document.getElementById("auth-signup-form");
  var authLoginPanel = document.getElementById("auth-login-form");

  var authSignupBtn = document.getElementById("auth-signup-btn");
  var authSignupEmail = document.getElementById("auth-signup-email");
  var authSignupPassword = document.getElementById("auth-signup-password");
  var authSignupShowPassword = document.getElementById("auth-signup-show-password");
  var authSignupError = document.getElementById("auth-signup-error");

  var authLoginBtn = document.getElementById("auth-login-btn");
  var authLoginEmail = document.getElementById("auth-login-email");
  var authLoginPassword = document.getElementById("auth-login-password");
  var authLoginShowPassword = document.getElementById("auth-login-show-password");
  var authLoginError = document.getElementById("auth-login-error");

  async function isApplicationAccepted(user) {
    if (!user || !user.email) return false;
    try {
      var res = await fetch("/api/my-application?email=" + encodeURIComponent(user.email));
      if (!res.ok) return false;
      var data = await res.json();
      return !!(data && data.accepted);
    } catch (e) {
      return false;
    }
  }

  async function verifyAccountAccess(user) {
    if (!user || !user.email) {
      return { allowed: false, message: "Login failed. Missing account email." };
    }

    try {
      var res = await fetch("/api/my-application?email=" + encodeURIComponent(user.email));
      if (!res.ok) {
        return { allowed: true };
      }
      var data = await res.json();
      if (data && data.blocked) {
        return {
          allowed: false,
          message: "This account was removed by admin and can no longer log in."
        };
      }
      return { allowed: true };
    } catch (err) {
      return { allowed: true };
    }
  }

  function showApplyFormForUser(user) {
    if (authGate) authGate.classList.add("hidden");
    if (authUserBar) {
      authUserBar.classList.remove("hidden");
      authUserEmail.textContent = (user && user.email) || "Logged in";
    }

    // Check if user already applied — if so, hide form and show message
    if (user && user.email) {
      fetch("/api/my-application?email=" + encodeURIComponent(user.email))
        .then(function (res) {
          if (res.ok) return res.json();
          return null;
        })
        .then(function (data) {
          if (data && !data.error) {
            // User already applied
            if (applyForm) applyForm.classList.add("hidden");
            if (applySuccess) {
              applySuccess.textContent = "You have already submitted your application. We'll be in touch soon!";
              applySuccess.classList.remove("hidden");
            }
          } else {
            if (applyForm) applyForm.classList.remove("hidden");
          }
        })
        .catch(function () {
          if (applyForm) applyForm.classList.remove("hidden");
        });
    } else {
      if (applyForm) applyForm.classList.remove("hidden");
    }
    markContestantSessionActive();

    // Contestant auth takes precedence over any stale admin session in this browser tab.
    if (user && isAdmin()) {
      clearAdminSession();
      updateAdminUI();
    }

    // Update global auth state
    if (user && !loggedInUser) {
      loggedInUser = user;
      matchUserToContestant().then(function () {
        updateNavForAuth();
      });
    }
  }

  function showAuthGate() {
    if (authGate) authGate.classList.remove("hidden");
    if (authUserBar) authUserBar.classList.add("hidden");
    if (applyForm) applyForm.classList.add("hidden");
    clearContestantSessionMarkers();
    loggedInUser = null;
    loggedInContestant = null;
    loggedInUserGroups = [];
    updateNavForAuth();
  }

  function normalizeIdentityErrorMessage(err, fallbackMessage) {
    var msg = (err && err.message) || fallbackMessage;
    return msg;
  }

  // Tab switching
  if (authTabs) {
    authTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var target = tab.getAttribute("data-auth-tab");
        authTabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
        if (authSignupPanel) authSignupPanel.classList.toggle("hidden", target !== "signup");
        if (authLoginPanel) authLoginPanel.classList.toggle("hidden", target !== "login");
      });
    });
  }

  // Signup
  if (authSignupBtn) {
    authSignupBtn.addEventListener("click", async function () {
      authSignupError.classList.add("hidden");
      var email = authSignupEmail.value.trim();
      var password = authSignupPassword.value;
      if (!email || !password) {
        authSignupError.textContent = "Please enter email and password.";
        authSignupError.classList.remove("hidden");
        return;
      }
      if (password.length < 6) {
        authSignupError.textContent = "Password must be at least 6 characters.";
        authSignupError.classList.remove("hidden");
        return;
      }
      authSignupBtn.disabled = true;
      authSignupBtn.textContent = "Signing up...";
      try {
        var user = await identity.signup(email, password);

        // Store credentials in our own store so login always works
        try {
          await fetch("/api/user-credentials?action=store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, password: password }),
          });
        } catch (storeErr) {}

        if (user && user.emailVerified) {
          showApplyFormForUser(user);
          switchView("apply");
          showToast("Account created! You can now apply.");
        } else if (user) {
          // Autoconfirm may be off — try logging in directly
          try {
            var loggedIn = await identity.login(email, password);
            showApplyFormForUser(loggedIn);
            switchView("apply");
            showToast("Account created! You can now apply.");
          } catch (loginErr) {
            // Login failed, accept signup user as-is
            showApplyFormForUser(user);
            switchView("apply");
            showToast("Account created! You can now apply.");
          }
        }
      } catch (err) {
        authSignupError.textContent = normalizeIdentityErrorMessage(err, "Signup failed. Please try again.");
        authSignupError.classList.remove("hidden");
      } finally {
        authSignupBtn.disabled = false;
        authSignupBtn.textContent = "Sign Up";
      }
    });
  }

  // Login
  if (authLoginBtn) {
    authLoginBtn.addEventListener("click", async function () {
      authLoginError.classList.add("hidden");
      var email = authLoginEmail.value.trim();
      var password = authLoginPassword.value;
      if (!email || !password) {
        authLoginError.textContent = "Please enter email and password.";
        authLoginError.classList.remove("hidden");
        return;
      }
      authLoginBtn.disabled = true;
      authLoginBtn.textContent = "Logging in...";
      try {
        var user;
        // Try Netlify Identity login first
        try {
          user = await identity.login(email, password);
        } catch (identityErr) {
          // Identity login failed — fall back to our credential store
          try {
            var credRes = await fetch("/api/user-credentials?action=verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: email, password: password }),
            });
            if (credRes.ok) {
              var credData = await credRes.json();
              if (credData.valid) {
                user = { email: credData.email || email };
              }
            }
          } catch (credErr) {}
          if (!user) {
            throw new Error("Invalid email or password.");
          }
        }
        var access = await verifyAccountAccess(user);
        if (!access.allowed) {
          try { await identity.logout(); } catch (logoutErr) {}
          throw new Error(access.message);
        }
        showApplyFormForUser(user);
        switchView("leaderboard");
        showToast("Welcome!");
      } catch (err) {
        var msg = normalizeIdentityErrorMessage(err, "Invalid email or password.");
        authLoginError.textContent = msg;
        authLoginError.classList.remove("hidden");
      } finally {
        authLoginBtn.disabled = false;
        authLoginBtn.textContent = "Login";
      }
    });
  }

  // Logout
  if (authLogoutBtn) {
    authLogoutBtn.addEventListener("click", async function () {
      try {
        await identity.logout();
      } catch (err) {
        // Continue with local logout fallback.
      }
      clearContestantSessionMarkers();
      showAuthGate();
      window.location.href = "/";
    });
  }

  // Enter key support for auth forms
  if (authSignupPassword) {
    authSignupPassword.addEventListener("keydown", function (e) {
      if (e.key === "Enter") authSignupBtn.click();
    });
  }
  if (authSignupShowPassword && authSignupPassword) {
    authSignupShowPassword.addEventListener("change", function () {
      authSignupPassword.type = authSignupShowPassword.checked ? "text" : "password";
    });
  }
  if (authLoginPassword) {
    authLoginPassword.addEventListener("keydown", function (e) {
      if (e.key === "Enter") authLoginBtn.click();
    });
  }
  if (authLoginShowPassword && authLoginPassword) {
    authLoginShowPassword.addEventListener("change", function () {
      authLoginPassword.type = authLoginShowPassword.checked ? "text" : "password";
    });
  }

  async function initApplyAuth() {
    if (identity) {
      // Handle auth callbacks (email confirmation, recovery, etc.)
      try {
        if (identity.handleAuthCallback) {
          var callbackResult = await identity.handleAuthCallback();
          if (callbackResult && callbackResult.type === "confirmation") {
            var callbackAccess = await verifyAccountAccess(callbackResult.user);
            if (!callbackAccess.allowed) {
              try { await identity.logout(); } catch (logoutErr) {}
              showAuthGate();
              showToast(callbackAccess.message, true);
              return;
            }
            showApplyFormForUser(callbackResult.user);
            switchView("apply");
            showToast("Account verified! You can now apply.");
            return;
          }
        }
      } catch (cbErr) {
        // Callback processing failed, continue with normal flow
      }

      try {
        var currentUser = await identity.getUser();
        if (currentUser) {
          var sessionAccess = await verifyAccountAccess(currentUser);
          if (!sessionAccess.allowed) {
            try { await identity.logout(); } catch (logoutErr) {}
            showAuthGate();
            showToast(sessionAccess.message, true);
            return;
          }
          showApplyFormForUser(currentUser);
        } else {
          showAuthGate();
        }
      } catch (err) {
        showAuthGate();
      }
    } else {
      // Identity not available, show auth gate (don't show form directly)
      showAuthGate();
    }
  }

  // --- Groups Management ---
  var currentGroups = [];
  var groupsList = document.getElementById("groups-list");
  var createGroupBtn = document.getElementById("create-group-btn");
  var newGroupNameInput = document.getElementById("new-group-name");

  async function loadGroups() {
    try {
      var res = await fetch("/api/groups", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      currentGroups = await res.json();
      allGroups = currentGroups;
      if (isAdmin()) renderGroups();
      // Update logged-in user's groups
      if (loggedInContestant) {
        refreshLoggedInUserGroups();
      }
      if (currentView === "leaderboard") renderLeaderboard();
    } catch (err) {
      currentGroups = [];
      allGroups = [];
    }
  }

  function renderGroups() {
    if (!groupsList) return;
    groupsList.innerHTML = "";

    if (currentGroups.length === 0) {
      groupsList.innerHTML = '<p style="color:#666;text-align:center;padding:12px;">No groups yet. Create one above.</p>';
      return;
    }

    var assignedAnywhereIds = [];
    currentGroups.forEach(function (g) {
      if (g.contestantIds && g.contestantIds.length) {
        g.contestantIds.forEach(function (id) { assignedAnywhereIds.push(id); });
      }
    });

    currentGroups.forEach(function (group) {
      var card = document.createElement("div");
      card.style.cssText = "background:#1a1a2e;border:1px solid #333;border-radius:10px;padding:14px;";

      var header = document.createElement("div");
      header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;";

      var title = document.createElement("h4");
      title.style.cssText = "color:#e94560;font-size:1rem;margin:0;";
      var actualCount = group.contestantIds ? group.contestantIds.filter(function (cId) { return currentContestants.find(function (c) { return idsEqual(c.id, cId); }); }).length : 0;
      title.textContent = (group.groupNumber ? "Group " + group.groupNumber + ": " : "") + group.name + " (" + actualCount + " contestants)";
      header.appendChild(title);

      var headerBtns = document.createElement("div");
      headerBtns.style.cssText = "display:flex;gap:6px;";

      var renameBtn = document.createElement("button");
      renameBtn.className = "btn btn-secondary btn-sm";
      renameBtn.textContent = "Rename";
      renameBtn.onclick = function () { renameGroup(group); };
      headerBtns.appendChild(renameBtn);

      var delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.textContent = "Delete";
      delBtn.onclick = function () { deleteGroup(group); };
      headerBtns.appendChild(delBtn);

      header.appendChild(headerBtns);
      card.appendChild(header);

      // Show assigned contestants
      var membersList = document.createElement("div");
      membersList.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;";

      if (group.contestantIds && group.contestantIds.length > 0) {
        group.contestantIds.forEach(function (cId) {
          var contestant = currentContestants.find(function (c) { return idsEqual(c.id, cId); });
          if (contestant) {
            var tag = document.createElement("span");
            tag.style.cssText = "background:rgba(233,69,96,0.15);color:#e94560;padding:4px 10px;border-radius:12px;font-size:0.8rem;display:flex;align-items:center;gap:4px;";
            tag.innerHTML = contestant.name + ' <span style="cursor:pointer;font-weight:bold;margin-left:2px;" title="Remove from group">&times;</span>';
            tag.querySelector("span").onclick = function () {
              removeContestantFromGroup(group, cId);
            };
            membersList.appendChild(tag);
          }
        });
      } else {
        var emptyMsg = document.createElement("span");
        emptyMsg.style.cssText = "color:#666;font-size:0.8rem;";
        emptyMsg.textContent = "No contestants assigned yet";
        membersList.appendChild(emptyMsg);
      }
      card.appendChild(membersList);

      // Add contestant dropdown
      var addRow = document.createElement("div");
      addRow.style.cssText = "display:flex;gap:6px;align-items:center;";

      var select = document.createElement("select");
      select.style.cssText = "flex:1;padding:6px 10px;border:1px solid #333;border-radius:6px;background:#0d1117;color:#fff;font-size:0.85rem;";
      var defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "-- Add contestant --";
      select.appendChild(defaultOpt);

      currentContestants.forEach(function (c) {
        if (!assignedAnywhereIds.some(function (assignedId) { return idsEqual(assignedId, c.id); })) {
          var opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.name;
          select.appendChild(opt);
        }
      });
      addRow.appendChild(select);

      var addBtn = document.createElement("button");
      addBtn.className = "btn btn-primary btn-sm";
      addBtn.textContent = "Add";
      addBtn.onclick = function () {
        if (select.value) {
          addContestantToGroup(group, select.value);
        }
      };
      addRow.appendChild(addBtn);
      card.appendChild(addRow);

      groupsList.appendChild(card);
    });
  }

  if (createGroupBtn) {
    createGroupBtn.addEventListener("click", async function () {
      var name = newGroupNameInput.value.trim();
      if (!name) {
        showToast("Please enter a group name", true);
        return;
      }

      createGroupBtn.textContent = "Creating...";

      try {
        var res = await fetch("/api/groups", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": adminToken
          },
          body: JSON.stringify({ name: name })
        });
        if (!res.ok) {
          var errData = await res.json();
          throw new Error(errData.error || "Failed to create group");
        }
        newGroupNameInput.value = "";
        showToast("Group '" + name + "' created!");
        loadGroups();
      } catch (err) {
        showToast(err.message, true);
      } finally {
        createGroupBtn.textContent = "Create Group";
      }
    });
  }

  async function addContestantToGroup(group, contestantId) {
    var ids = (group.contestantIds || []).slice();
    if (ids.some(function (id) { return idsEqual(id, contestantId); })) return;
    ids.push(contestantId);

    try {
      var res = await fetch("/api/groups/" + group.id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        },
        body: JSON.stringify({ contestantIds: ids })
      });
      if (!res.ok) throw new Error("Failed");
      var contestant = currentContestants.find(function (c) { return idsEqual(c.id, contestantId); });
      showToast((contestant ? contestant.name : "Contestant") + " added to " + group.name);
      loadGroups();
    } catch (err) {
      showToast("Failed to add contestant to group", true);
    }
  }

  async function removeContestantFromGroup(group, contestantId) {
    var ids = (group.contestantIds || []).filter(function (id) { return !idsEqual(id, contestantId); });

    try {
      var res = await fetch("/api/groups/" + group.id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        },
        body: JSON.stringify({ contestantIds: ids })
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Contestant removed from " + group.name);
      loadGroups();
    } catch (err) {
      showToast("Failed to remove contestant", true);
    }
  }

  async function deleteGroup(group) {
    if (!confirm("Delete group '" + group.name + "'?")) return;

    try {
      var res = await fetch("/api/groups/" + group.id, {
        method: "DELETE",
        headers: { "X-Admin-Token": adminToken }
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Group '" + group.name + "' deleted");
      loadGroups();
    } catch (err) {
      showToast("Failed to delete group", true);
    }
  }

  async function renameGroup(group) {
    var newName = prompt("Enter new name for '" + group.name + "':", group.name);
    if (!newName || newName.trim() === group.name) return;

    try {
      var res = await fetch("/api/groups/" + group.id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        },
        body: JSON.stringify({ name: newName.trim() })
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Group renamed to '" + newName.trim() + "'");
      loadGroups();
    } catch (err) {
      showToast("Failed to rename group", true);
    }
  }

  // --- Nav Access Control ---
  function updateNavForAuth() {
    var headerLoginBtn = document.getElementById("header-login-btn");
    var isLoggedIn = !!(loggedInUser || isAdmin());
    navBtns.forEach(function (btn) {
      var view = btn.getAttribute("data-view");
      if (view === "contestants") {
        btn.style.display = "";
        if (isAdmin()) {
          if (btn.tagName === "BUTTON") {
            btn.disabled = false;
          }
          btn.classList.remove("nav-btn-disabled");
        } else {
          if (btn.tagName === "BUTTON") {
            btn.disabled = true;
          }
          btn.classList.add("nav-btn-disabled");
        }
      }
      if (view === "leaderboard") {
        // Logged-in users and admin only
        btn.style.display = (loggedInUser || isAdmin()) ? "" : "none";
      }
      // Disable Apply and Contact buttons when user is logged in (but not admin)
      if (view === "apply" || view === "contact") {
        if (btn.id !== "header-login-btn") {
          if (isAdmin()) {
            if (btn.tagName === "BUTTON") {
              btn.disabled = false;
            }
            btn.classList.remove("nav-btn-disabled");
            btn.style.opacity = "";
            btn.style.cursor = "";
          } else if (isLoggedIn) {
            if (btn.tagName === "BUTTON") {
              btn.disabled = true;
            }
            btn.classList.add("nav-btn-disabled");
            btn.style.opacity = "0.4";
            btn.style.cursor = "not-allowed";
          } else {
            if (btn.tagName === "BUTTON") {
              btn.disabled = false;
            }
            btn.classList.remove("nav-btn-disabled");
            btn.style.opacity = "";
            btn.style.cursor = "";
          }
        }
      }
    });
    // Toggle Login/Logout button based on auth state
    if (headerLoginBtn) {
      if (loggedInUser || isAdmin()) {
        headerLoginBtn.textContent = "Logout";
        headerLoginBtn.style.display = "";
        headerLoginBtn.classList.add("active");
      } else {
        headerLoginBtn.textContent = "Login";
        headerLoginBtn.style.display = "";
        headerLoginBtn.classList.remove("active");
      }
    }
    // Show contestant user bar for logged-in non-admin users
    if (loggedInUser && !isAdmin() && contestantUserBar) {
      contestantUserBar.classList.remove("hidden");
      if (contestantUserEmail) {
        contestantUserEmail.textContent = loggedInUser.email || "Logged in";
      }
    }
  }


  // --- Match logged-in user to contestant ---
  async function matchUserToContestant() {
    if (!loggedInUser || !loggedInUser.email) return;
    var email = loggedInUser.email.toLowerCase();

    // Look up the user's application by email (public endpoint)
    // This endpoint also returns contestantId and groups from the server
    try {
      var appRes = await fetch("/api/my-application?email=" + encodeURIComponent(email));
      if (appRes.ok) {
        var appData = await appRes.json();

        // Use server-matched contestant ID if available
        if (appData.contestantId) {
          loggedInContestant = currentContestants.find(function (c) {
            return idsEqual(c.id, appData.contestantId);
          });
        }

        // Fallback: match by application name
        if (!loggedInContestant && appData.name) {
          loggedInContestant = currentContestants.find(function (c) {
            return c.name.toLowerCase() === appData.name.toLowerCase();
          });
        }

        // Use server-provided groups directly if available
        if (appData.groups && appData.groups.length > 0) {
          loggedInUserGroups = appData.groups;
          return;
        }
      }
    } catch (e) {
      // Endpoint not available, fall through to name matching
    }

    // Fallback: check if any contestant's name matches the user's full name
    if (!loggedInContestant && loggedInUser.user_metadata && loggedInUser.user_metadata.full_name) {
      loggedInContestant = currentContestants.find(function (c) {
        return c.name.toLowerCase() === loggedInUser.user_metadata.full_name.toLowerCase();
      });
    }

    // Update groups for this contestant from local data
    if (loggedInContestant && allGroups.length > 0) {
      refreshLoggedInUserGroups();
    }
  }

  // --- Init ---
  async function initApp() {
    // Check identity auth state
    if (identity) {
      try {
        if (identity.handleAuthCallback) {
          var callbackResult = await identity.handleAuthCallback();
          if (callbackResult && callbackResult.user) {
            loggedInUser = callbackResult.user;
          }
        }
      } catch (cbErr) {}

      if (!loggedInUser) {
        var didAutoLogout = await logoutIfPreviousContestantTabClosed();
        if (didAutoLogout) {
          showToast("You were logged out after the app was closed.");
        }
        try {
          loggedInUser = await identity.getUser();
        } catch (err) {}
      }

      if (loggedInUser) {
        var access = await verifyAccountAccess(loggedInUser);
        if (!access.allowed) {
          try { await identity.logout(); } catch (logoutErr) {}
          loggedInUser = null;
          showToast(access.message, true);
        }
      }
    }

    updateAdminUI();
    await loadContestants();
    await loadGroups();
    await matchUserToContestant();
    updateNavForAuth();
    loadTimer();
    loadDoubleVotes();
    ensureTwoXTimerUI();
    loadTwoXTimer();
    loadEmails();
    loadContestLive();
    loadParticipants();
    loadSiteContent();
    initApplyAuth();

    // Determine initial view based on auth state and URL params
    var urlParams = new URLSearchParams(window.location.search);
    var viewParam = urlParams.get("view");
    var authParam = urlParams.get("auth");
    var groupParam = urlParams.get("group");

    var msgParam = urlParams.get("msg");

    if (viewParam === "admin" && isAdmin()) {
      switchView("admin");
    } else if (viewParam === "apply") {
      switchView("apply");
      if (authParam === "login") {
        activateAuthTab("login");
        if (msgParam === "login_required") {
          var loginErr = document.getElementById("auth-login-error");
          if (loginErr) {
            loginErr.textContent = "Must be logged in to view your group";
            loginErr.classList.remove("hidden");
          }
        }
      }
    } else if (viewParam === "leaderboard" && (loggedInUser || isAdmin())) {
      switchView("leaderboard");
    } else if (isAdmin()) {
      switchView("contestants");
    } else if (loggedInUser) {
      var accepted = await isApplicationAccepted(loggedInUser);
      if (accepted) {
        switchView("leaderboard");
      } else {
        switchView("apply");
      }
    } else {
      // Public users land on contestants by default.
      switchView("contestants");
    }
  }

  // --- Auto-logout when contestant leaves or closes the app ---
  // Admin sessions rely on sessionStorage which is automatically cleared
  // when the tab/browser closes — no manual clearing needed for admin.
  function performAutoLogout() {
    if (!loggedInUser) return;
    try {
      // Synchronously clear GoTrue session from localStorage so the user
      // is fully logged out when they return (identity.logout() is async
      // and cannot complete during beforeunload).
      localStorage.removeItem("gotrue.user");
      // Clear auth cookies
      document.cookie = "nf_jwt=; path=/; secure; samesite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "nf_jwt_refresh=; path=/; secure; samesite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      clearContestantSessionMarkers();
    } catch (e) {}
    loggedInUser = null;
    loggedInContestant = null;
    loggedInUserGroups = [];
  }

  // Log out when the tab/window is being closed or navigated away
  window.addEventListener("beforeunload", function () {
    if (loggedInUser) {
      performAutoLogout();
    }
  });

  // --- Admin: Find Contestant by Email ---
  var findByEmailInput = document.getElementById("find-by-email-input");
  var findByEmailBtn = document.getElementById("find-by-email-btn");
  var findByEmailClearBtn = document.getElementById("find-by-email-clear-btn");
  var findByEmailResult = document.getElementById("find-by-email-result");
  var findByEmailStatus = document.getElementById("find-by-email-status");

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function goToVoteAnalytics(contestantId, contestantName, highlightEmail) {
    var qs = "?id=" + encodeURIComponent(contestantId) +
             "&name=" + encodeURIComponent(contestantName || "") +
             "&highlight=" + encodeURIComponent(highlightEmail || "");
    window.location.href = "/vote-analytics/" + qs;
  }

  function findContestantByEmail() {
    if (!isAdmin()) return;
    if (!findByEmailResult || !findByEmailStatus || !findByEmailInput) return;

    var raw = (findByEmailInput.value || "").trim();
    findByEmailResult.innerHTML = "";
    findByEmailStatus.textContent = "";

    if (!raw) {
      findByEmailStatus.textContent = "Enter an email to search.";
      return;
    }
    var target = raw.toLowerCase();

    findByEmailStatus.textContent = "Searching vote analytics…";
    if (findByEmailBtn) findByEmailBtn.disabled = true;

    fetch("/api/vote-events?voterEmail=" + encodeURIComponent(target), {
      headers: { "Accept": "application/json" }
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error("Server returned " + res.status + (t ? ": " + t : ""));
          });
        }
        return res.json();
      })
      .then(function (data) {
        var matches = (data && data.matches) || [];
        if (matches.length === 0) {
          findByEmailStatus.textContent = "No vote analytics activity found for that email.";
          return;
        }
        if (matches.length === 1) {
          var only = matches[0];
          findByEmailStatus.textContent = "Opening Vote Analytics for " + (only.contestant_name || only.contestant_id) + "…";
          goToVoteAnalytics(only.contestant_id, only.contestant_name || "", target);
          return;
        }

        findByEmailStatus.textContent = "Found in " + matches.length + " contestants' vote analytics. Pick one:";
        var items = matches.map(function (m) {
          var label = (m.contestant_name || m.contestant_id) +
            " — " + (m.total_votes || 0) + " votes (" + (m.event_count || 0) + " events)";
          return '<button type="button" class="find-by-email-match" data-id="' +
            escapeHtml(m.contestant_id) + '" data-name="' + escapeHtml(m.contestant_name || "") +
            '" style="display:block; width:100%; text-align:left; background:#2d2116; border:1px solid rgba(255,255,255,0.15); border-radius:6px; padding:10px 12px; margin:6px 0; color:#eee; cursor:pointer; font:inherit;">' +
            escapeHtml(label) + '</button>';
        }).join("");
        findByEmailResult.innerHTML = items;
        var buttons = findByEmailResult.querySelectorAll(".find-by-email-match");
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].addEventListener("click", function () {
            goToVoteAnalytics(this.getAttribute("data-id"), this.getAttribute("data-name"), target);
          });
        }
      })
      .catch(function (err) {
        findByEmailStatus.textContent = "Search failed. " + (err && err.message ? err.message : "");
      })
      .then(function () {
        if (findByEmailBtn) findByEmailBtn.disabled = false;
      });
  }

  if (findByEmailBtn) {
    findByEmailBtn.addEventListener("click", findContestantByEmail);
  }
  if (findByEmailInput) {
    findByEmailInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        findContestantByEmail();
      }
    });
  }
  if (findByEmailClearBtn) {
    findByEmailClearBtn.addEventListener("click", function () {
      if (findByEmailInput) findByEmailInput.value = "";
      if (findByEmailResult) findByEmailResult.innerHTML = "";
      if (findByEmailStatus) findByEmailStatus.textContent = "";
    });
  }

  // --- Admin: Add Votes ---
  var addVotesBtn = document.getElementById("add-votes-btn");
  var addVotesModal = document.getElementById("add-votes-modal");
  var addVotesSearch = document.getElementById("add-votes-search");
  var addVotesSelect = document.getElementById("add-votes-select");
  var addVotesAmount = document.getElementById("add-votes-amount");
  var addVotesSubmitBtn = document.getElementById("add-votes-submit-btn");
  var addVotesCancelBtn = document.getElementById("add-votes-cancel-btn");
  var addVotesError = document.getElementById("add-votes-error");
  var addVotesSuccess = document.getElementById("add-votes-success");

  function setAddVotesFeedback(message, isError) {
    if (addVotesError) {
      addVotesError.textContent = isError ? (message || "") : "";
      addVotesError.classList.toggle("hidden", !isError || !message);
    }
    if (addVotesSuccess) {
      addVotesSuccess.textContent = !isError ? (message || "") : "";
      addVotesSuccess.classList.toggle("hidden", isError || !message);
    }
  }

  function renderAddVotesOptions() {
    if (!addVotesSelect) return;
    var query = ((addVotesSearch && addVotesSearch.value) || "").trim().toLowerCase();
    var list = (currentContestants || []).slice().sort(function (a, b) {
      return (a.name || "").localeCompare(b.name || "");
    });
    if (query) {
      list = list.filter(function (c) {
        var name = (c.name || "").toLowerCase();
        var email = (c.email || "").toLowerCase();
        return name.indexOf(query) !== -1 || email.indexOf(query) !== -1;
      });
    }
    var previousValue = addVotesSelect.value;
    addVotesSelect.innerHTML = "";
    if (list.length === 0) {
      var emptyOpt = document.createElement("option");
      emptyOpt.disabled = true;
      emptyOpt.textContent = "No contestants found";
      addVotesSelect.appendChild(emptyOpt);
      return;
    }
    list.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      var label = (c.name || "(no name)") + " — " + (c.votes || 0) + " votes";
      if (c.email) label += " (" + c.email + ")";
      opt.textContent = label;
      addVotesSelect.appendChild(opt);
    });
    if (previousValue && list.some(function (c) { return c.id === previousValue; })) {
      addVotesSelect.value = previousValue;
    } else {
      addVotesSelect.selectedIndex = 0;
    }
  }

  function openAddVotesModal() {
    if (!isAdmin() || !addVotesModal) return;
    setAddVotesFeedback("", false);
    if (addVotesSearch) addVotesSearch.value = "";
    if (addVotesAmount) addVotesAmount.value = "1";
    renderAddVotesOptions();
    addVotesModal.classList.remove("hidden");
  }

  function closeAddVotesModal() {
    if (!addVotesModal) return;
    addVotesModal.classList.add("hidden");
  }

  async function submitAddVotes() {
    if (!isAdmin()) return;
    setAddVotesFeedback("", false);
    var contestantId = addVotesSelect ? addVotesSelect.value : "";
    var amount = parseInt(addVotesAmount && addVotesAmount.value, 10);
    if (!contestantId) {
      setAddVotesFeedback("Pick a contestant first.", true);
      return;
    }
    if (!Number.isFinite(amount) || amount < 1) {
      setAddVotesFeedback("Enter a vote count of 1 or more.", true);
      return;
    }
    var contestant = (currentContestants || []).find(function (c) { return c.id === contestantId; });
    if (!contestant) {
      setAddVotesFeedback("Contestant not found in local cache. Reload the page.", true);
      return;
    }
    var newTotal = (contestant.votes || 0) + amount;
    if (addVotesSubmitBtn) {
      addVotesSubmitBtn.disabled = true;
      addVotesSubmitBtn.textContent = "Adding...";
    }
    try {
      var res = await fetch("/api/contestants/" + encodeURIComponent(contestantId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        },
        body: JSON.stringify({ votes: newTotal })
      });
      if (!res.ok) {
        throw new Error("Server returned " + res.status);
      }
      var updated = await res.json();
      contestant.votes = updated && typeof updated.votes === "number" ? updated.votes : newTotal;
      setAddVotesFeedback("Added " + amount + " vote" + (amount === 1 ? "" : "s") + " to " + (contestant.name || "contestant") + ". New total: " + contestant.votes + ".", false);
      renderAddVotesOptions();
      try { recordVoteEvent(contestantId, amount, "admin"); } catch (e) {}
      try { await loadContestants(); } catch (e) {}
      showToast("Added " + amount + " vote" + (amount === 1 ? "" : "s") + " to " + (contestant.name || "contestant") + ".");
    } catch (err) {
      setAddVotesFeedback((err && err.message) || "Failed to add votes.", true);
    } finally {
      if (addVotesSubmitBtn) {
        addVotesSubmitBtn.disabled = false;
        addVotesSubmitBtn.textContent = "Add";
      }
    }
  }

  if (addVotesBtn) addVotesBtn.addEventListener("click", openAddVotesModal);
  if (addVotesCancelBtn) addVotesCancelBtn.addEventListener("click", closeAddVotesModal);
  if (addVotesSubmitBtn) addVotesSubmitBtn.addEventListener("click", submitAddVotes);
  if (addVotesSearch) addVotesSearch.addEventListener("input", renderAddVotesOptions);
  if (addVotesModal) {
    addVotesModal.addEventListener("click", function (event) {
      if (event.target === addVotesModal) closeAddVotesModal();
    });
  }

  initApp();
})();

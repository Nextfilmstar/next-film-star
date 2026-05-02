(function () {
  "use strict";

  function enhanceEditModal(overlay) {
    var modal = overlay.querySelector(".edit-contestant-modal");
    if (!modal) return;
    if (modal.querySelector("#edit-c-new-password")) return;

    var emailInput = modal.querySelector("#edit-c-email");
    var formActions = modal.querySelector(".form-actions");
    var saveBtn = modal.querySelector("#edit-c-save");
    var errorEl = modal.querySelector("#edit-c-error");
    if (!formActions || !saveBtn) return;

    var pwLabel = document.createElement("label");
    pwLabel.textContent = "New Password (leave blank to keep current)";

    var pwInput = document.createElement("input");
    pwInput.type = "password";
    pwInput.id = "edit-c-new-password";
    pwInput.placeholder = "New password (min 6 chars)";
    pwInput.autocomplete = "new-password";

    var pw2Label = document.createElement("label");
    pw2Label.textContent = "Confirm New Password";

    var pw2Input = document.createElement("input");
    pw2Input.type = "password";
    pw2Input.id = "edit-c-new-password-confirm";
    pw2Input.placeholder = "Confirm new password";
    pw2Input.autocomplete = "new-password";

    var showLabel = document.createElement("label");
    showLabel.className = "show-password-toggle";
    showLabel.htmlFor = "edit-c-show-password";
    var showCb = document.createElement("input");
    showCb.type = "checkbox";
    showCb.id = "edit-c-show-password";
    showCb.addEventListener("change", function () {
      var t = showCb.checked ? "text" : "password";
      pwInput.type = t;
      pw2Input.type = t;
    });
    showLabel.appendChild(showCb);
    showLabel.appendChild(document.createTextNode(" Show password"));

    var parent = formActions.parentNode;
    parent.insertBefore(pwLabel, formActions);
    parent.insertBefore(pwInput, formActions);
    parent.insertBefore(pw2Label, formActions);
    parent.insertBefore(pw2Input, formActions);
    parent.insertBefore(showLabel, formActions);

    function showError(msg) {
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove("hidden");
      }
    }

    saveBtn.addEventListener(
      "click",
      function (e) {
        var pw = pwInput.value;
        var pw2 = pw2Input.value;
        if (!pw && !pw2) return;
        if (pw !== pw2) {
          showError("Passwords do not match.");
          e.stopImmediatePropagation();
          return;
        }
        if (pw.length < 6) {
          showError("Password must be at least 6 characters.");
          e.stopImmediatePropagation();
          return;
        }
      },
      true
    );

    saveBtn.addEventListener("click", function () {
      var pw = pwInput.value;
      if (!pw || pw.length < 6) return;
      var emailVal = emailInput ? emailInput.value.trim() : "";
      if (!emailVal) return;

      var token = "";
      try { token = sessionStorage.getItem("adminToken") || ""; } catch (err) {}

      fetch("/.netlify/functions/admin-password-override?action=store", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        body: JSON.stringify({ email: emailVal, password: pw })
      }).then(function (res) {
        if (res && res.ok) {
          if (typeof window.showToast === "function") {
            window.showToast("Password updated for " + emailVal);
          }
        } else {
          if (typeof window.showToast === "function") {
            window.showToast("Failed to update password", true);
          }
        }
      }).catch(function () {
        if (typeof window.showToast === "function") {
          window.showToast("Failed to update password", true);
        }
      });
    });
  }

  function start() {
    var existing = document.querySelector(".edit-contestant-overlay");
    if (existing) enhanceEditModal(existing);

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.classList && node.classList.contains("edit-contestant-overlay")) {
            enhanceEditModal(node);
          } else if (node.querySelector) {
            var inner = node.querySelector(".edit-contestant-overlay");
            if (inner) enhanceEditModal(inner);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

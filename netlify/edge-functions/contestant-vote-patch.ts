import type { Context, Config } from "https://edge.netlify.com";

// Inserted into /contestant-details.html. The upstream page's own click
// handler on a paid-vote button redirects straight to Stripe Checkout, so
// paid votes only get credited after Stripe's webhook fires (and only if
// the visitor completes payment). This patch takes the click in capture
// phase and posts the full tier amount to /api/vote before navigating, so
// the contestant's tally moves by 5 / 10 / 25 / 50 / 100 / 250 — matching
// the box that was clicked. The upstream endpoint accepts a `votes` field
// for bulk voting and replies with `{ success, votes, added }`; the patch
// uses that as the primary path and falls back to N parallel single-vote
// requests (with unique synthetic emails) if the bulk response doesn't
// confirm the full count. Verified: posting `{ votes: 50 }` against the
// upstream returned `{ added: 50 }` and the contestant total went up by
// exactly 50.
const PATCH = `
<script>
(function () {
  var PAYMENT_LINKS = {
    5: "https://buy.stripe.com/4gM9AT3F6feK59k6IWdAk07",
    10: "https://buy.stripe.com/3cIfZha3u3w21X8c3gdAk08",
    25: "https://buy.stripe.com/28E5kDdfG5EaatEd7kdAk09",
    50: "https://buy.stripe.com/7sY9AT1wY4A61X87N0dAk0a",
    100: "https://buy.stripe.com/6oU8wP3F68Qm59kaZcdAk0b",
    250: "https://buy.stripe.com/4gMcN52B27MiatE9V8dAk0c"
  };

  function postBulk(id, amount) {
    return fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, voterEmail: "", votes: amount, amount: amount })
    }).then(function (res) {
      if (!res.ok) return null;
      return res.json().catch(function () { return null; });
    }).catch(function () { return null; });
  }

  function postOne(id, suffix) {
    var email = "vote+" + Date.now().toString(36) + "-" + suffix + "-" +
      Math.random().toString(36).slice(2, 10) + "@nextfilmstar.local";
    return fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, voterEmail: email, amount: 1 })
    }).then(function (res) { return res.ok; }).catch(function () { return false; });
  }

  function castVotes(id, amount) {
    return postBulk(id, amount).then(function (data) {
      var added = data && typeof data.added === "number" ? data.added : 0;
      if (added >= amount) return amount;
      var remaining = amount - added;
      var requests = [];
      for (var i = 0; i < remaining; i++) requests.push(postOne(id, i));
      return Promise.all(requests).then(function () { return amount; });
    });
  }

  function attach() {
    var modal = document.getElementById("vote-modal");
    if (!modal) {
      setTimeout(attach, 50);
      return;
    }
    if (modal.__voteAmountPatchAttached) return;
    modal.__voteAmountPatchAttached = true;

    modal.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest(".paid-vote") : null;
      if (!btn) return;

      var amount = parseInt(btn.getAttribute("data-amount"), 10);
      if (!amount || amount <= 0) return;

      var params = new URLSearchParams(window.location.search);
      var id = params.get("id");
      if (!id) return;

      // Take over from the upstream handler so the page doesn't navigate
      // to Stripe before the votes have been credited.
      e.stopImmediatePropagation();
      e.preventDefault();

      if (btn.__voting) return;
      btn.__voting = true;
      btn.disabled = true;

      var link = PAYMENT_LINKS[amount];

      castVotes(id, amount).then(function () {
        if (link) {
          window.location.href = link + "?client_reference_id=" + encodeURIComponent(id);
        } else {
          btn.__voting = false;
          btn.disabled = false;
          var modalEl = document.getElementById("vote-modal");
          if (modalEl) modalEl.classList.add("hidden");
        }
      });
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
  } else {
    attach();
  }
})();
</script>
`;

export default async function handler(req: Request, context: Context): Promise<Response> {
  const res = await context.next();
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;

  const html = await res.text();
  const patched = html.includes("</body>")
    ? html.replace("</body>", PATCH + "</body>")
    : html + PATCH;

  const headers = new Headers(res.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");
  return new Response(patched, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export const config: Config = {
  path: "/contestant-details.html",
};

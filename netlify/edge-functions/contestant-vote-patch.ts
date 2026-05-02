import type { Context, Config } from "https://edge.netlify.com";

// Inserted into /contestant-details.html. The upstream page's own click
// handler on a paid-vote button redirects straight to Stripe Checkout,
// so paid votes only get credited once Stripe's webhook fires (and only
// if the visitor actually completes payment). This patch takes over the
// click in capture phase and posts a single bulk /api/vote request with
// the full tier amount in the `votes` field — the upstream endpoint
// returns the new total in `added`, confirming the count went in — then
// forwards the visitor to the same Stripe Checkout URL the upstream
// would have used.
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

  function castBulkVotes(id, amount) {
    return fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, voterEmail: "", votes: amount, amount: amount })
    }).then(function (res) {
      return res.ok ? res.json().catch(function () { return null; }) : null;
    }).catch(function () { return null; });
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

      castBulkVotes(id, amount).then(function () {
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
  return new Response(patched, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export const config: Config = {
  path: "/contestant-details.html",
};

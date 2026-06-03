// Fixed-price Stripe Payment Links that mirror the preset vote buttons on the
// contestant details page. Used as a last-resort fallback when neither
// STRIPE_SECRET_KEY nor STRIPE_CUSTOM_AMOUNT_PAYMENT_LINK is configured on the
// server, so that the "Any Amount" → "Continue to Stripe" button always lands
// the supporter on a live Stripe checkout page instead of failing with a
// server error.
const PRESET_PAYMENT_LINKS: Record<number, string> = {
  5: "https://buy.stripe.com/4gM9AT3F6feK59k6IWdAk07",
  10: "https://buy.stripe.com/3cIfZha3u3w21X8c3gdAk08",
  25: "https://buy.stripe.com/28E5kDdfG5EaatEd7kdAk09",
  50: "https://buy.stripe.com/7sY9AT1wY4A61X87N0dAk0a",
  100: "https://buy.stripe.com/6oU8wP3F68Qm59kaZcdAk0b",
  250: "https://buy.stripe.com/4gMcN52B27MiatE9V8dAk0c",
};

function pickClosestPreset(amount: number): { tier: number; url: string } {
  const tiers = Object.keys(PRESET_PAYMENT_LINKS)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  let closest = tiers[0];
  let bestDiff = Math.abs(amount - closest);
  for (const t of tiers) {
    const diff = Math.abs(amount - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = t;
    }
  }
  return { tier: closest, url: PRESET_PAYMENT_LINKS[closest] };
}

function buildPresetRedirect(
  amount: number,
  contestantId: string,
): { url: string; tier: number } {
  const { tier, url } = pickClosestPreset(amount);
  const sep = url.indexOf("?") === -1 ? "?" : "&";
  let redirect = `${url}${sep}prefilled_amount=${amount * 100}`;
  if (contestantId) {
    redirect += `&client_reference_id=${encodeURIComponent(contestantId)}`;
  }
  return { url: redirect, tier };
}

// Build a redirect to a "customer chooses price" Stripe Payment Link, with
// the entered amount prefilled. Stripe honors `prefilled_amount` (in cents)
// only on payment links configured to let the customer choose the price, so
// the link supplied via STRIPE_CUSTOM_AMOUNT_PAYMENT_LINK must be that kind
// of link. When it is, Stripe loads showing the entered dollar value.
function buildCustomLinkRedirect(
  baseUrl: string,
  amount: number,
  contestantId: string,
): string {
  const sep = baseUrl.indexOf("?") === -1 ? "?" : "&";
  let redirect = `${baseUrl}${sep}prefilled_amount=${amount * 100}`;
  if (contestantId) {
    redirect += `&client_reference_id=${encodeURIComponent(contestantId)}`;
  }
  return redirect;
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amountDollarsRaw = Number(payload?.amount);
  if (!Number.isFinite(amountDollarsRaw) || amountDollarsRaw <= 0) {
    return Response.json(
      { error: "amount must be a positive number (USD)." },
      { status: 400 },
    );
  }
  const amountDollars = Math.round(amountDollarsRaw);
  const unitAmountCents = Math.round(amountDollarsRaw * 100);

  const contestantId =
    typeof payload?.contestantId === "string" ? payload.contestantId.trim() : "";
  const contestantName =
    typeof payload?.contestantName === "string"
      ? payload.contestantName.trim()
      : "";

  // Number of votes this purchase credits (already multiplied for 2X/3X by the
  // caller). When provided, the Stripe checkout product is named after it so
  // the hosted Stripe page shows e.g. "15 Votes" for the "15 votes $5" button
  // instead of the base "5 Votes" product name.
  const votesRaw = Number(payload?.votes);
  const votes =
    Number.isFinite(votesRaw) && votesRaw > 0 ? Math.round(votesRaw) : 0;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const customAmountLink = (
    process.env.STRIPE_CUSTOM_AMOUNT_PAYMENT_LINK || ""
  ).trim();

  // Path 1: secret key configured. Create a one-off Stripe Checkout Session
  // priced at exactly the entered amount.
  if (secretKey) {
    const origin =
      req.headers.get("origin") ||
      (() => {
        try {
          return new URL(req.url).origin;
        } catch {
          return "";
        }
      })();

    const productName = votes
      ? `${votes} Votes`
      : contestantName
        ? `Votes for ${contestantName}`
        : "Contestant votes";

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "usd");
    params.append(
      "line_items[0][price_data][unit_amount]",
      String(unitAmountCents),
    );
    params.append("line_items[0][price_data][product_data][name]", productName);
    if (contestantId) {
      params.append("client_reference_id", contestantId);
      params.append("metadata[contestant_id]", contestantId);
    }
    if (contestantName) {
      params.append("metadata[contestant_name]", contestantName);
    }
    if (origin) {
      const successPath = contestantId
        ? `/contestant-details.html?id=${encodeURIComponent(contestantId)}&payment=success`
        : `/?payment=success`;
      const cancelPath = contestantId
        ? `/contestant-details.html?id=${encodeURIComponent(contestantId)}&payment=cancel`
        : `/?payment=cancel`;
      params.append("success_url", `${origin}${successPath}`);
      params.append("cancel_url", `${origin}${cancelPath}`);
    }

    let stripeRes: Response | null = null;
    try {
      stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
    } catch {
      stripeRes = null;
    }

    if (stripeRes) {
      const data: any = await stripeRes.json().catch(() => ({}));
      if (stripeRes.ok && data?.url) {
        return Response.json({ url: data.url, id: data.id });
      }
    }
    // Secret key path failed — fall through to the next option.
  }

  // Path 2: a "customer chooses price" Stripe Payment Link is configured.
  // Redirect to it with the entered amount prefilled, so Stripe shows the
  // entered dollar value. This works without server-side Stripe API access.
  if (customAmountLink) {
    const url = buildCustomLinkRedirect(
      customAmountLink,
      amountDollars,
      contestantId,
    );
    return Response.json({
      url,
      mode: "custom-amount-payment-link",
      enteredAmount: amountDollars,
    });
  }

  // Path 3: nothing configured. Fall back to the closest preset Payment Link
  // so the supporter still reaches Stripe, and tell the client which tier
  // was used so it can surface a clear notice.
  const { url, tier } = buildPresetRedirect(amountDollars, contestantId);
  return Response.json({
    url,
    fallback: "preset-payment-link",
    tier,
    enteredAmount: amountDollars,
  });
};

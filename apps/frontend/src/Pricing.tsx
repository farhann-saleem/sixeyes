import { FormEvent, useEffect, useMemo, useState } from "react";
import { json } from "./studio";
import type { User } from "./auth";
import { LoadingScreen } from "./LoadingScreen";
import { SkeletonGrid } from "./Skeleton";

type QuotaKind = "avatars" | "images" | "videos" | "documentaries" | "audio";

type TierInfo = {
  id: "free" | "pro" | "premium";
  name: string;
  price_usd: number;
  price_pkr: number;
  rate_per_min: number;
  quotas: Record<QuotaKind, number>;
  badge: string | null;
};

type PlanState = {
  tier: TierInfo["id"];
  tier_name: string;
  tier_expires_at: string | null;
  usage: Record<QuotaKind, number>;
  quotas: Record<QuotaKind, number>;
  rate_per_min: number;
  month_key: string;
  tiers: TierInfo[];
  signed_in?: boolean;
};

const QUOTA_ROWS: Array<{ kind: QuotaKind; label: string }> = [
  { kind: "avatars", label: "Avatars" },
  { kind: "images", label: "Image recreations" },
  { kind: "videos", label: "Videos" },
  { kind: "documentaries", label: "Documentaries" },
  { kind: "audio", label: "Audio credits" },
];

const PLAN_DESCRIPTION: Record<TierInfo["id"], string> = {
  free: "Your free monthly allowance",
  pro: "More room to create",
  premium: "Our largest monthly allowance",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function Pricing({ user }: { user: User | null }) {
  const signedIn = Boolean(user?.email);
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<TierInfo["id"] | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [paid] = useState(
    () => new URLSearchParams(window.location.search).get("paid") === "1",
  );

  const [retry, setRetry] = useState(0);
  const [orderId] = useState(() => new URLSearchParams(window.location.search).get("order"));
  const [order, setOrder] = useState<{ status: "pending" | "success" | "failed"; tier: TierInfo["id"]; granted: boolean } | null>(null);

  const load = () => {
    const path = signedIn ? "/api/billing/plan" : "/api/billing/plans";
    json<PlanState>(path)
      .then((body) => {
        setPlan(body);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    load();
  }, [signedIn]);

  useEffect(() => {
    if (!paid || !signedIn || !orderId) return;
    let cancelled = false;
    let timer: number | undefined;
    const check = async () => {
      try {
        const result = await json<NonNullable<typeof order>>(`/api/billing/order/${encodeURIComponent(orderId)}`);
        if (cancelled) return;
        setOrder(result);
        if (result.status === "success" && result.granted) load();
        else if (result.status === "pending") timer = window.setTimeout(check, 4000);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void check();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [paid, signedIn, orderId, retry]);

  const current = useMemo(
    () => plan?.tiers.find((t) => t.id === plan.tier) ?? null,
    [plan],
  );

  async function checkout(e: FormEvent, tier: TierInfo) {
    e.preventDefault();
    if (!signedIn) {
      window.location.assign("/login");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = await json<{ order_id: string; url: string }>("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tier.id, msisdn: phone.trim() }),
      });
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="pricing-page">
      <header className="page-head">
        <div>
          <p className="kicker">Plans</p>
          <h1>Pricing</h1>
          <p className="lede">
            Start free. No credit card required. Try the creative workflow before choosing a paid plan.
          </p>
        </div>
      </header>

      {paid && signedIn && (
        <div className="pricing-banner">
          <strong>{order?.status === "failed" ? "Payment was not completed." : order?.status === "success" && order.granted ? `Your ${order.tier === "pro" ? "Pro" : "Premium"} upgrade is active.` : "Confirming your payment…"}</strong>
          <span>
            {order?.status === "failed"
              ? " Your plan has not changed. You can try checkout again."
              : order?.status === "success" && order.granted
                ? " Payment has been verified. Your new plan is ready to use."
                : " Please allow up to 24 hours for your upgrade. Your plan changes only after payment has been processed and verified."}
          </span>
        </div>
      )}

      {error && <p role="alert" className="notice pricing-notice">{error} <button type="button" className="btn ghost" onClick={() => { load(); setRetry((value) => value + 1); }}>Retry</button></p>}
      {!plan && !error && <SkeletonGrid count={3} />}

      {plan && current && signedIn && (
        <section className="plan-usage">
          <div className="plan-usage-head">
            <strong>Current plan: {current.name}</strong>
            <span>
              {plan.tier === "free"
                ? "Resets each calendar month."
                : plan.tier_expires_at
                  ? `Active through ${fmtDate(plan.tier_expires_at)}.`
                  : ""}
            </span>
          </div>
          <div className="plan-usage-grid">
            {QUOTA_ROWS.map((row) => {
              const used = Math.min(plan.usage[row.kind] ?? 0, plan.quotas[row.kind]);
              const pct = Math.round((used / plan.quotas[row.kind]) * 100);
              return (
                <div key={row.kind} className="plan-usage-row">
                  <div className="plan-usage-meta">
                    <span>{row.label}</span>
                    <span className="plan-usage-count">
                      {plan.usage[row.kind] ?? 0} / {plan.quotas[row.kind]}
                    </span>
                  </div>
                  <div className="plan-usage-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="plan-usage-note">
            {plan.rate_per_min} requests per minute on this plan.
          </p>
        </section>
      )}

      <section className="pricing-grid">
        {plan?.tiers.map((tier) => {
          const isCurrent = signedIn && plan.tier === tier.id;
          return (
            <article
              key={tier.id}
              className={`price-card${tier.badge ? " is-featured" : ""}`}
            >
              {tier.badge && <span className="price-badge">{tier.badge}</span>}
              <h2>{tier.name}</h2>
              <p className="price-line">
                <span className="price-usd">
                  {tier.price_usd === 0 ? "$0" : `$${tier.price_usd}`}
                </span>
                <span className="price-per">/ month</span>
              </p>
              <p className="price-mult">{PLAN_DESCRIPTION[tier.id]}</p>
              <ul className="price-quotas">
                {QUOTA_ROWS.map((row) => (
                  <li key={row.kind}>
                    <span>{row.label}</span>
                    <strong>{tier.quotas[row.kind].toLocaleString()}</strong>
                  </li>
                ))}
                <li className="price-rate">
                  <span>Requests / minute</span>
                  <strong>{tier.rate_per_min}</strong>
                </li>
                {tier.id !== "free" && (
                  <li><span>Bulk requests for all tools</span><strong>Coming soon</strong></li>
                )}
              </ul>
              {isCurrent ? (
                <button type="button" className="btn lime price-btn" disabled>
                  Current plan
                </button>
              ) : tier.id === "free" ? (
                <p className="price-free-note">
                  {signedIn
                    ? "You are currently on the Free plan."
                    : "Start free. No credit card required."}
                </p>
              ) : !signedIn ? (
                <a className="btn lime price-btn" href="/login">
                  Sign in to get {tier.name}
                </a>
              ) : buying === tier.id ? (
                <form className="price-form" onSubmit={(e) => void checkout(e, tier)}>
                  <label>
                    Mobile number for payment
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="03xxxxxxxxx"
                      pattern="03[0-9]{9}"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.trim())}
                    />
                  </label>
                  <p className="price-form-note">
                    Paying as {user?.name || user?.email}. Swich sends the receipt
                    to your number. Allow up to 24 hours for your upgrade after payment
                    is processed and verified.
                  </p>
                  <button type="submit" className="btn lime price-btn" disabled={busy}>
                    {busy ? "Opening checkout…" : `Pay $${tier.price_usd} USD (PKR ${tier.price_pkr.toLocaleString()})`}
                  </button>
                  <button
                    type="button"
                    className="price-cancel"
                    onClick={() => {
                      setBuying(null);
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn lime price-btn"
                  onClick={() => {
                    setBuying(tier.id);
                    setError(null);
                  }}
                >
                  Get {tier.name}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <p className="plan-usage-note">Paid upgrades can take up to 24 hours. Your plan changes only after payment is processed and verified.</p>
      <p className="pricing-policies">
        <a href="/terms">Terms and Conditions</a> · <a href="/refund">Refund Policy</a> ·{" "}
        <a href="/cancellation">Cancellation Policy</a>
      </p>
    </div>
  );
}

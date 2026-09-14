import { FormEvent, useEffect, useMemo, useState } from "react";
import { json } from "./studio";
import type { User } from "./auth";

type QuotaKind = "avatars" | "images" | "videos" | "documentaries";

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
};

const QUOTA_ROWS: Array<{ kind: QuotaKind; label: string }> = [
  { kind: "avatars", label: "Avatars" },
  { kind: "images", label: "Image recreations" },
  { kind: "videos", label: "Videos" },
  { kind: "documentaries", label: "Documentaries" },
];

const MULTIPLIER: Record<TierInfo["id"], string> = {
  free: "1×",
  pro: "10× Free",
  premium: "10× Pro · 100× Free",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function Pricing({ user }: { user: User }) {
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<TierInfo["id"] | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(
    () => new URLSearchParams(window.location.search).get("paid") === "1",
  );

  const load = () => {
    json<PlanState>("/api/billing/plan")
      .then(setPlan)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!paid) return;
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, [paid]);

  const current = useMemo(
    () => plan?.tiers.find((t) => t.id === plan.tier) ?? null,
    [plan],
  );

  async function checkout(e: FormEvent, tier: TierInfo) {
    e.preventDefault();
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
            Start free. Upgrade when your films need more room — every plan runs
            the same studio, the same models, the same quality.
          </p>
        </div>
      </header>

      {paid && (
        <div className="pricing-banner">
          <strong>{plan ? `You're on ${plan.tier_name}.` : "Payment received."}</strong>
          <span>
            {plan && plan.tier_expires_at
              ? ` Enjoy it through ${fmtDate(plan.tier_expires_at)}.`
              : " Confirming your plan…"}
          </span>
        </div>
      )}

      {error && <p className="notice pricing-notice">{error}</p>}

      {plan && current && (
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
          const isCurrent = plan.tier === tier.id;
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
              {tier.price_pkr > 0 && (
                <p className="price-pkr">PKR {tier.price_pkr.toLocaleString()} per month</p>
              )}
              <p className="price-mult">{MULTIPLIER[tier.id]}</p>
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
              </ul>
              {isCurrent ? (
                <button type="button" className="btn lime price-btn" disabled>
                  Current plan
                </button>
              ) : tier.id === "free" ? (
                <p className="price-free-note">You're already on Free — go make a film.</p>
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
                    Paying as {user.name || user.email}. Swich sends the receipt
                    to your number.
                  </p>
                  <button type="submit" className="btn lime price-btn" disabled={busy}>
                    {busy ? "Opening checkout…" : `Pay PKR ${tier.price_pkr.toLocaleString()}`}
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

      <p className="pricing-policies">
        <a href="/terms">Terms and Conditions</a> · <a href="/refund">Refund Policy</a> ·{" "}
        <a href="/cancellation">Cancellation Policy</a>
      </p>
    </div>
  );
}

import type { NextFunction, Request, Response } from "express";
import { currentUser } from "./google-auth.js";
import { effectiveTier, quotaOk } from "./billing-store.js";
import { QUOTA_LABELS, TIERS, type QuotaKind } from "./plans.js";
import { getMediaTemplate } from "./templates.js";

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function emailOf(req: Request): string {
  return currentUser(req)?.email || "anonymous";
}

/** Pure sliding-window check: `allowed` false once `limit` hits fall in the window. */
export function allowHit(email: string, limit: number, now = Date.now()): { allowed: boolean; retry_after: number } {
  const list = (hits.get(email) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= limit) {
    return { allowed: false, retry_after: Math.max(1, Math.ceil((list[0] + WINDOW_MS - now) / 1000)) };
  }
  list.push(now);
  hits.set(email, list);
  return { allowed: true, retry_after: 0 };
}

/** Sliding 60s window on POST requests only. GET/polling is never throttled. */
export function rateLimitPost(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "POST") {
    next();
    return;
  }
  const email = emailOf(req);
  const tier = TIERS[effectiveTier(email)];
  const verdict = allowHit(email, tier.rate_per_min);
  if (!verdict.allowed) {
    res.setHeader("Retry-After", String(verdict.retry_after));
    res.status(429).json({
      error: `Rate limit reached — ${tier.name} allows ${tier.rate_per_min} requests per minute. Try again shortly.`,
    });
    return;
  }
  next();
}

/** Refuses a request when the caller's monthly quota for `kind` is spent. */
export function quotaGuard(kind: QuotaKind) {
  return (req: Request, res: Response, next: NextFunction) => {
    const email = emailOf(req);
    if (quotaOk(email, kind)) {
      next();
      return;
    }
    const tier = TIERS[effectiveTier(email)];
    res.status(429).json({
      error: `${tier.name} allows ${tier.quotas[kind]} ${QUOTA_LABELS[kind].toLowerCase()} per month. Upgrade on the Pricing page.`,
    });
  };
}

/** POST-only quota guard that resolves the kind from the request body. */
export function postQuota(resolve: (req: Request) => QuotaKind | null) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST") {
      next();
      return;
    }
    const kind = resolve(req);
    if (!kind) {
      next();
      return;
    }
    quotaGuard(kind)(req, res, next);
  };
}

/** Faceswaps: image recreate vs video recreate comes from the template's kind. */
export function faceswapQuotaKind(req: Request): QuotaKind | null {
  const templateId = String(req.body?.template_id || "");
  if (!templateId) return null;
  const template = getMediaTemplate(templateId);
  if (!template) return null;
  return template.kind === "video" ? "videos" : "images";
}

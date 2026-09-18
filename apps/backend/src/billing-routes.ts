import { db, dbEnabled } from "./db.js";
import { randomUUID } from "node:crypto";
import express from "express";
import { currentUser } from "./google-auth.js";
import {
  completeOrder,
  createOrder,
  effectiveTier,
  getBillingUser,
  getOrder,
  monthKey,
  setTier,
  usageForMonth,
  type BillingOrder,
} from "./billing-store.js";
import { TIERS, getTier, type TierId } from "./plans.js";
import { checkoutUrl, swichConfigured, verifyCallback } from "./swichnow.js";

export const billingRouter = express.Router();

function tierCatalog() {
  return (Object.values(TIERS) as Array<(typeof TIERS)[TierId]>).map((t) => ({
    id: t.id,
    name: t.name,
    price_usd: t.price_usd,
    price_pkr: t.price_pkr,
    rate_per_min: t.rate_per_min,
    quotas: t.quotas,
    badge: t.badge ?? null,
  }));
}

/** Public catalog — no auth. Used by the Pricing page for signed-out visitors. */
billingRouter.get("/plans", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  res.json({
    tier: "free",
    tier_name: TIERS.free.name,
    tier_expires_at: null,
    usage: {
      avatars: 0,
      images: 0,
      videos: 0,
      documentaries: 0,
      audio: 0,
    },
    quotas: TIERS.free.quotas,
    rate_per_min: TIERS.free.rate_per_min,
    month_key: monthKey(),
    tiers: tierCatalog(),
    signed_in: false,
  });
});

billingRouter.get("/plan", async (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: "sign in with Google first" });
    return;
  }
  const email = user.email;
  const tier = await effectiveTier(email);
  const row = await getBillingUser(email);
  res.json({
    tier,
    tier_name: TIERS[tier].name,
    tier_expires_at: tier === "free" ? null : row.tier_expires_at,
    usage: await usageForMonth(email),
    quotas: TIERS[tier].quotas,
    rate_per_min: TIERS[tier].rate_per_min,
    month_key: monthKey(),
    tiers: tierCatalog(),
    signed_in: true,
  });
});

billingRouter.post("/checkout", async (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: "sign in with Google first" });
    return;
  }
  const tier = getTier(String(req.body?.tier || ""));
  if (!tier || tier.id === "free") {
    res.status(400).json({ error: "tier must be pro or premium" });
    return;
  }
  if (!swichConfigured()) {
    res.status(503).json({
      error: "Payments are not configured yet (SWICHNOW_API_KEY / SWICHNOW_SECRET).",
    });
    return;
  }
  const msisdn = String(req.body?.msisdn || "").trim();
  if (!/^03\d{9}$/.test(msisdn)) {
    res.status(400).json({
      error: "A valid mobile number (03xxxxxxxxx) is required for checkout.",
    });
    return;
  }
  const order = await createOrder({
    id: randomUUID(),
    email: user.email,
    tier: tier.id,
    amount_pkr: tier.price_pkr,
  });
  const url = checkoutUrl({
    order,
    item: `MarketingStudio${tier.name}`,
    payeeName: user.name || user.email,
    email: user.email,
    msisdn,
  });
  res.json({ order_id: order.id, url });
});

billingRouter.get("/order/:id", async (req, res) => {
  const user = currentUser(req);
  const order = await getOrder(req.params.id);
  if (!order || order.email !== user?.email) {
    res.status(404).json({ error: "order not found" });
    return;
  }
  res.json({
    id: order.id,
    tier: order.tier,
    status: order.status,
    amount_pkr: order.amount_pkr,
    created_at: order.created_at,
    granted: order.granted,
  });
});

/** Public Swich callback (doc §16). Verify, grant, answer `{"status":"success"}`. */
export async function swichWebhook(req: express.Request, res: express.Response) {
  const query = req.query as Record<string, string | undefined>;
  const check = verifyCallback(query);
  if (!check.ok) {
    res.status(400).json({ status: "failed" });
    return;
  }
  const order: BillingOrder | undefined = await getOrder(check.customerTransactionId!);
  if (order) {
    if (check.status === "success") {
      if (Number(check.amount) !== order.amount_pkr) {
        res.status(400).json({ status: "failed" });
        return;
      }
      if (dbEnabled()) await db.rpc("grant_paid_order", { p_id: order.id, p_order_id: check.orderId! });
      else if (!order.granted) {
        await setTier(order.email, order.tier, 30);
        await completeOrder(order.id, check.orderId!);
      }
    } else if (check.status !== "pending" && !order.granted) {
      await completeOrder(order.id, check.orderId!, "failed");
    }
  }
  res.json({ status: "success" });
}

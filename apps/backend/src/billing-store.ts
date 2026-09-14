import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import { TIERS, type QuotaKind, type TierId } from "./plans.js";

const USERS_PATH = path.join(DATA_DIR, "billing-users.json");
const ORDERS_PATH = path.join(DATA_DIR, "billing-orders.json");

const EMPTY_USAGE: Record<QuotaKind, number> = {
  avatars: 0,
  images: 0,
  videos: 0,
  documentaries: 0,
};

export type BillingUser = {
  email: string;
  tier: TierId;
  tier_expires_at: string | null;
  month_key: string;
  usage: Record<QuotaKind, number>;
};

export type BillingOrder = {
  id: string;
  email: string;
  tier: TierId;
  amount_pkr: number;
  status: "pending" | "success" | "failed";
  order_id: string | null;
  created_at: string;
  granted: boolean;
};

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n");
  renameSync(`${file}.tmp`, file);
}

export function monthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getBillingUser(email: string): BillingUser {
  const rows = readJson<BillingUser[]>(USERS_PATH, []);
  const found = rows.find((r) => r.email === email);
  return {
    email,
    tier: found?.tier ?? "free",
    tier_expires_at: found?.tier_expires_at ?? null,
    month_key: found?.month_key ?? monthKey(),
    usage: { ...EMPTY_USAGE, ...(found?.usage ?? {}) },
  };
}

export function effectiveTier(email: string): TierId {
  const user = getBillingUser(email);
  if (user.tier === "free") return "free";
  if (!user.tier_expires_at || new Date(user.tier_expires_at).getTime() < Date.now()) {
    return "free";
  }
  return user.tier;
}

export function setTier(email: string, tier: TierId, days: number): BillingUser {
  const rows = readJson<BillingUser[]>(USERS_PATH, []);
  const now = Date.now();
  const i = rows.findIndex((r) => r.email === email);
  const current = rows[i];
  const row: BillingUser = {
    email,
    tier,
    tier_expires_at: tier === "free" ? null : new Date(now + days * 24 * 60 * 60 * 1000).toISOString(),
    month_key: current?.month_key ?? monthKey(),
    usage: current?.usage ?? { ...EMPTY_USAGE },
  };
  if (i >= 0) rows[i] = row;
  else rows.push(row);
  writeJson(USERS_PATH, rows);
  return row;
}

export function usageForMonth(email: string): Record<QuotaKind, number> {
  const rows = readJson<BillingUser[]>(USERS_PATH, []);
  const key = monthKey();
  const i = rows.findIndex((r) => r.email === email);
  const row = rows[i];
  if (!row || row.month_key !== key) {
    return { ...EMPTY_USAGE };
  }
  return { ...EMPTY_USAGE, ...row.usage };
}

export function recordUsage(email: string, kind: QuotaKind): void {
  const rows = readJson<BillingUser[]>(USERS_PATH, []);
  const key = monthKey();
  const i = rows.findIndex((r) => r.email === email);
  if (i < 0) {
    rows.push({
      email,
      tier: "free",
      tier_expires_at: null,
      month_key: key,
      usage: { ...EMPTY_USAGE, [kind]: 1 },
    });
  } else {
    const usage = rows[i].month_key === key ? rows[i].usage : { ...EMPTY_USAGE };
    rows[i] = {
      ...rows[i],
      month_key: key,
      usage: { ...usage, [kind]: (usage[kind] ?? 0) + 1 },
    };
  }
  writeJson(USERS_PATH, rows);
}

export function quotaOk(email: string, kind: QuotaKind): boolean {
  const tier = effectiveTier(email);
  return usageForMonth(email)[kind] < TIERS[tier].quotas[kind];
}

export function createOrder(input: {
  id: string;
  email: string;
  tier: TierId;
  amount_pkr: number;
}): BillingOrder {
  const rows = readJson<BillingOrder[]>(ORDERS_PATH, []);
  const order: BillingOrder = {
    id: input.id,
    email: input.email,
    tier: input.tier,
    amount_pkr: input.amount_pkr,
    status: "pending",
    order_id: null,
    created_at: new Date().toISOString(),
    granted: false,
  };
  rows.push(order);
  writeJson(ORDERS_PATH, rows);
  return order;
}

export function getOrder(id: string): BillingOrder | undefined {
  return readJson<BillingOrder[]>(ORDERS_PATH, []).find((o) => o.id === id);
}

export function completeOrder(
  id: string,
  orderId: string,
  status: "success" | "failed" = "success",
): BillingOrder | undefined {
  const rows = readJson<BillingOrder[]>(ORDERS_PATH, []);
  const order = rows.find((o) => o.id === id);
  if (!order) return undefined;
  order.status = status;
  order.order_id = orderId;
  if (status === "success") order.granted = true;
  writeJson(ORDERS_PATH, rows);
  return order;
}

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import { db, dbEnabled, eq, ownerOf } from "./db.js";
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
  id?: string;
  name?: string;
  picture?: string;
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
  profile_id?: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  tier: string;
  tier_expires_at: string | null;
  month_key: string;
  usage_avatars: number;
  usage_images: number;
  usage_videos: number;
  usage_documentaries: number;
};

type OrderRow = {
  id: string;
  email: string;
  tier: string;
  amount_pkr: number;
  status: "pending" | "success" | "failed";
  order_id: string | null;
  created_at: string;
  granted: boolean;
  profile_id?: string | null;
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

function rowFromProfile(p: ProfileRow): BillingUser {
  return {
    id: p.id,
    email: p.email,
    name: p.name || "",
    picture: p.picture || "",
    tier: (p.tier as TierId) || "free",
    tier_expires_at: p.tier_expires_at,
    month_key: p.month_key || monthKey(),
    usage: {
      avatars: p.usage_avatars ?? 0,
      images: p.usage_images ?? 0,
      videos: p.usage_videos ?? 0,
      documentaries: p.usage_documentaries ?? 0,
    },
  };
}

function orderFromRow(data: OrderRow): BillingOrder {
  return {
    id: data.id,
    email: data.email,
    tier: data.tier as TierId,
    amount_pkr: data.amount_pkr,
    status: data.status,
    order_id: data.order_id,
    created_at: data.created_at,
    granted: data.granted,
    profile_id: data.profile_id,
  };
}

export async function upsertProfile(input: {
  email: string;
  name: string;
  picture: string;
}): Promise<BillingUser> {
  const email = ownerOf(input.email);
  if (dbEnabled()) {
    const existing = await db.selectOne<ProfileRow>("profiles", `${eq("email", email)}&select=*`);
    if (existing) {
      const rows = await db.update<ProfileRow>(
        "profiles",
        eq("email", email),
        {
          name: input.name || existing.name,
          picture: input.picture || existing.picture,
          updated_at: new Date().toISOString(),
        },
      );
      const data = rows[0];
      if (!data) throw new Error("profile update failed");
      return rowFromProfile(data);
    }
    const rows = await db.insert<ProfileRow>("profiles", {
      email,
      name: input.name,
      picture: input.picture,
      tier: "free",
      month_key: monthKey(),
    });
    const data = rows[0];
    if (!data) throw new Error("profile insert failed");
    return rowFromProfile(data);
  }
  const rows = readJson<BillingUser[]>(USERS_PATH, []);
  const i = rows.findIndex((r) => r.email === email);
  const row: BillingUser = {
    email,
    name: input.name,
    picture: input.picture,
    tier: rows[i]?.tier ?? "free",
    tier_expires_at: rows[i]?.tier_expires_at ?? null,
    month_key: rows[i]?.month_key ?? monthKey(),
    usage: rows[i]?.usage ?? { ...EMPTY_USAGE },
  };
  if (i >= 0) rows[i] = { ...rows[i], ...row };
  else rows.push(row);
  writeJson(USERS_PATH, rows);
  return row;
}

export async function getBillingUser(email: string): Promise<BillingUser> {
  const key = ownerOf(email);
  if (dbEnabled()) {
    const data = await db.selectOne<ProfileRow>("profiles", `${eq("email", key)}&select=*`);
    if (!data) {
      return {
        email: key,
        tier: "free",
        tier_expires_at: null,
        month_key: monthKey(),
        usage: { ...EMPTY_USAGE },
      };
    }
    return rowFromProfile(data);
  }
  const rows = readJson<BillingUser[]>(USERS_PATH, []);
  const found = rows.find((r) => r.email === key);
  return {
    email: key,
    tier: found?.tier ?? "free",
    tier_expires_at: found?.tier_expires_at ?? null,
    month_key: found?.month_key ?? monthKey(),
    usage: { ...EMPTY_USAGE, ...(found?.usage ?? {}) },
    name: found?.name,
    picture: found?.picture,
    id: found?.id,
  };
}

export async function effectiveTier(email: string): Promise<TierId> {
  const user = await getBillingUser(email);
  if (user.tier === "free") return "free";
  if (!user.tier_expires_at || new Date(user.tier_expires_at).getTime() < Date.now()) {
    return "free";
  }
  return user.tier;
}

export async function setTier(email: string, tier: TierId, days: number): Promise<BillingUser> {
  const key = ownerOf(email);
  const expires =
    tier === "free" ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  if (dbEnabled()) {
    const current = await getBillingUser(key);
    const rows = await db.upsert<ProfileRow>(
      "profiles",
      {
        email: key,
        name: current.name || key,
        picture: current.picture || "",
        tier,
        tier_expires_at: expires,
        month_key: current.month_key || monthKey(),
        usage_avatars: current.usage.avatars,
        usage_images: current.usage.images,
        usage_videos: current.usage.videos,
        usage_documentaries: current.usage.documentaries,
        updated_at: new Date().toISOString(),
      },
      "email",
    );
    const data = rows[0];
    if (!data) throw new Error("profile upsert failed");
    return rowFromProfile(data);
  }
  const rows = readJson<BillingUser[]>(USERS_PATH, []);
  const i = rows.findIndex((r) => r.email === key);
  const current = rows[i];
  const row: BillingUser = {
    email: key,
    tier,
    tier_expires_at: expires,
    month_key: current?.month_key ?? monthKey(),
    usage: current?.usage ?? { ...EMPTY_USAGE },
    name: current?.name,
    picture: current?.picture,
  };
  if (i >= 0) rows[i] = row;
  else rows.push(row);
  writeJson(USERS_PATH, rows);
  return row;
}

export async function usageForMonth(email: string): Promise<Record<QuotaKind, number>> {
  const user = await getBillingUser(email);
  const key = monthKey();
  if (user.month_key !== key) return { ...EMPTY_USAGE };
  return { ...EMPTY_USAGE, ...user.usage };
}

export async function recordUsage(email: string, kind: QuotaKind): Promise<void> {
  const key = ownerOf(email);
  const mk = monthKey();
  if (dbEnabled()) {
    await db.rpc("record_usage", { p_email: key, p_kind: kind, p_month: mk });
    return;
  }
  const rows = readJson<BillingUser[]>(USERS_PATH, []);
  const i = rows.findIndex((r) => r.email === key);
  if (i < 0) {
    rows.push({
      email: key,
      tier: "free",
      tier_expires_at: null,
      month_key: mk,
      usage: { ...EMPTY_USAGE, [kind]: 1 },
    });
  } else {
    const usage = rows[i].month_key === mk ? rows[i].usage : { ...EMPTY_USAGE };
    rows[i] = {
      ...rows[i],
      month_key: mk,
      usage: { ...usage, [kind]: (usage[kind] ?? 0) + 1 },
    };
  }
  writeJson(USERS_PATH, rows);
}

export async function quotaOk(email: string, kind: QuotaKind): Promise<boolean> {
  const tier = await effectiveTier(email);
  const usage = await usageForMonth(email);
  return usage[kind] < TIERS[tier].quotas[kind];
}

export async function createOrder(input: {
  id: string;
  email: string;
  tier: TierId;
  amount_pkr: number;
}): Promise<BillingOrder> {
  const email = ownerOf(input.email);
  const order: BillingOrder = {
    id: input.id,
    email,
    tier: input.tier,
    amount_pkr: input.amount_pkr,
    status: "pending",
    order_id: null,
    created_at: new Date().toISOString(),
    granted: false,
  };
  if (dbEnabled()) {
    const profile = await getBillingUser(email);
    await db.insert("billing_orders", {
      id: order.id,
      profile_id: profile.id || null,
      email,
      tier: order.tier,
      amount_pkr: order.amount_pkr,
      status: order.status,
      order_id: null,
      granted: false,
      created_at: order.created_at,
    });
    return order;
  }
  const rows = readJson<BillingOrder[]>(ORDERS_PATH, []);
  rows.push(order);
  writeJson(ORDERS_PATH, rows);
  return order;
}

export async function getOrder(id: string): Promise<BillingOrder | undefined> {
  if (dbEnabled()) {
    const data = await db.selectOne<OrderRow>("billing_orders", `${eq("id", id)}&select=*`);
    if (!data) return undefined;
    return orderFromRow(data);
  }
  return readJson<BillingOrder[]>(ORDERS_PATH, []).find((o) => o.id === id);
}

export async function completeOrder(
  id: string,
  orderId: string,
  status: "success" | "failed" = "success",
): Promise<BillingOrder | undefined> {
  if (dbEnabled()) {
    const existing = await getOrder(id);
    if (!existing) return undefined;
    const granted = status === "success" ? true : existing.granted;
    const rows = await db.update<OrderRow>("billing_orders", eq("id", id), {
      status,
      order_id: orderId,
      granted,
    });
    const data = rows[0];
    if (!data) throw new Error("order update failed");
    return orderFromRow(data);
  }
  const rows = readJson<BillingOrder[]>(ORDERS_PATH, []);
  const order = rows.find((o) => o.id === id);
  if (!order) return undefined;
  order.status = status;
  order.order_id = orderId;
  if (status === "success") order.granted = true;
  writeJson(ORDERS_PATH, rows);
  return order;
}

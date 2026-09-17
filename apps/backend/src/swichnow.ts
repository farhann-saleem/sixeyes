import { createHmac } from "node:crypto";
import { FRONTEND_URL } from "./env.js";
import type { BillingOrder } from "./billing-store.js";

export const SWICHNOW_CLIENT_ID = process.env.SWICHNOW_API_KEY || "";
const SWICHNOW_BASE_URL = (process.env.SWICHNOW_BASE_URL || "https://sandbox-api.swichnow.com").replace(/\/+$/, "");

export const SWICHNOW_PWA_URL = (
  process.env.SWICHNOW_PWA_URL ||
  (SWICHNOW_BASE_URL.includes("sandbox")
    ? "https://sandbox-payin-pwa.swichnow.com"
    : "https://payin-pwa.swichnow.com")
).replace(/\/+$/, "");

function secretKey(): string {
  return process.env.SWICHNOW_SECRET || "";
}

export function swichConfigured(): boolean {
  return Boolean(SWICHNOW_CLIENT_ID && secretKey());
}

/** HMAC-SHA256 over `Swich:{customerTransactionId}:{item}:{amount}` (doc §5.2). */
export function checkoutChecksum(customerTransactionId: string, item: string, amount: number | string): string {
  return createHmac("sha256", secretKey())
    .update(`Swich:${customerTransactionId}:${item}:${amount}`)
    .digest("hex");
}

/** HMAC-SHA256 over `SWCallback:{CustomerTransactionId}:{OrderId}:{Amount}:{Status}` (doc §16). */
export function callbackChecksum(
  customerTransactionId: string,
  orderId: string,
  amount: string,
  status: string,
): string {
  return createHmac("sha256", secretKey())
    .update(`SWCallback:${customerTransactionId}:${orderId}:${amount}:${status}`)
    .digest("hex");
}

export function checkoutUrl(input: {
  order: BillingOrder;
  item: string;
  payeeName: string;
  email: string;
  msisdn: string;
}): string {
  const { order, item, payeeName, email, msisdn } = input;
  const params = new URLSearchParams({
    clientId: SWICHNOW_CLIENT_ID,
    customerTransactionId: order.id,
    item,
    amount: String(order.amount_pkr),
    channel: "0",
    description: "Marketing Studio subscription",
    payeeName,
    email,
    msisdn,
    currency: "PKR",
    successRedirectUrl: `${FRONTEND_URL}/pricing?paid=1&order=${encodeURIComponent(order.id)}`,
  });
  params.set("checksum", checkoutChecksum(order.id, item, order.amount_pkr));
  return `${SWICHNOW_PWA_URL}/?${params.toString()}`;
}

export function verifyCallback(query: Record<string, string | undefined>): {
  ok: boolean;
  error?: string;
  customerTransactionId?: string;
  orderId?: string;
  amount?: string;
  status?: string;
} {
  const customerTransactionId = String(query.CustomerTransactionId ?? "");
  const orderId = String(query.OrderId ?? "");
  const amount = String(query.Amount ?? "");
  const status = String(query.Status ?? "");
  const checksum = String(query.Checksum ?? "");
  if (!customerTransactionId || !orderId || !amount || !status || !checksum) {
    return { ok: false, error: "missing callback parameters" };
  }
  const expected = callbackChecksum(customerTransactionId, orderId, amount, status);
  if (expected !== checksum) {
    return { ok: false, error: "checksum mismatch" };
  }
  return { ok: true, customerTransactionId, orderId, amount, status };
}

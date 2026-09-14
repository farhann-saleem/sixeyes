import { existsSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./env.js";
import { db, dbEnabled } from "./db.js";
import { artifactsEnabled } from "./artifacts.js";
export async function assertProductionReady() {
  if (process.env.NODE_ENV !== "production") return;
  if (!dbEnabled() || !artifactsEnabled()) throw new Error("Production requires Supabase and a configured R2 media bucket");
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.FRONTEND_URL?.startsWith("https://")) throw new Error("Production requires Google auth and an HTTPS FRONTEND_URL");
  if (process.env.SERVE_FRONTEND !== "false" && !existsSync(path.join(REPO_ROOT, "apps/frontend/dist/index.html"))) throw new Error("Build apps/frontend before starting production");
  // This table is created in the same transaction as the RLS and billing RPC hardening.
  await db.select("user_resources", "select=id&limit=0");
}

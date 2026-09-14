import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import express from "express";
import { DATA_DIR, FRONTEND_URL } from "./env.js";
import { db, dbEnabled, eq, ownerOf } from "./db.js";
import { effectiveTier, upsertProfile } from "./billing-store.js";

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || `${FRONTEND_URL}/callback`;

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;

export type SessionUser = {
  id?: string;
  email: string;
  name: string;
  picture: string;
  tier?: string;
  expires_at: number;
};

type SessionProfile = {
  id: string;
  email: string;
  name: string;
  picture: string;
  tier: string;
  tier_expires_at: string | null;
};

type SessionRow = {
  id: string;
  expires_at: string;
  profile: SessionProfile | SessionProfile[] | null;
};

const sessions = new Map<string, SessionUser>();
const pendingStates = new Map<string, { next: string; created_at: number }>();

const SESSION_FILE = path.join(DATA_DIR, "auth-sessions.json");

function loadSessions() {
  if (dbEnabled()) return;
  try {
    if (existsSync(SESSION_FILE)) {
      const rows = JSON.parse(readFileSync(SESSION_FILE, "utf8")) as Record<string, SessionUser>;
      for (const [id, s] of Object.entries(rows)) {
        if (s.expires_at > Date.now()) sessions.set(id, s);
      }
    }
  } catch {
    /* corrupt session file = start empty */
  }
}

function saveSessions() {
  if (dbEnabled()) return;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(SESSION_FILE, JSON.stringify(Object.fromEntries(sessions)));
  } catch {
    /* best effort */
  }
}

loadSessions();

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const sep = part.indexOf("=");
    if (sep < 0) continue;
    try { out[part.slice(0, sep).trim()] = decodeURIComponent(part.slice(sep + 1).trim()); } catch { /* ignore malformed cookies */ }
  }
  return out;
}

function embedProfile(profile: SessionRow["profile"]): SessionProfile | null {
  if (!profile) return null;
  return Array.isArray(profile) ? profile[0] ?? null : profile;
}

async function loadSession(id: string): Promise<SessionUser | null> {
  if (dbEnabled()) {
    const data = await db.selectOne<SessionRow>(
      "sessions",
      `${eq("id", id)}&select=id,expires_at,profile:profiles(id,email,name,picture,tier,tier_expires_at)`,
    );
    const profile = embedProfile(data?.profile ?? null);
    if (!data || !profile) return null;
    const expires = new Date(data.expires_at).getTime();
    if (expires < Date.now()) {
      await db.delete("sessions", eq("id", id));
      return null;
    }
    const tier =
      profile.tier !== "free" &&
      profile.tier_expires_at &&
      new Date(profile.tier_expires_at).getTime() > Date.now()
        ? profile.tier
        : "free";
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      tier,
      expires_at: expires,
    };
  }
  const s = sessions.get(id);
  if (!s || s.expires_at < Date.now()) {
    sessions.delete(id);
    saveSessions();
    return null;
  }
  return s;
}

/** Sync helper for middleware that already resolved the user onto the request. */
export function currentUser(req: express.Request): SessionUser | null {
  return (req as express.Request & { msUser?: SessionUser | null }).msUser ?? null;
}

export async function resolveUser(req: express.Request): Promise<SessionUser | null> {
  const id = parseCookies(req.headers.cookie).ms_session;
  if (!id) {
    (req as express.Request & { msUser?: SessionUser | null }).msUser = null;
    return null;
  }
  const user = await loadSession(id);
  (req as express.Request & { msUser?: SessionUser | null }).msUser = user;
  return user;
}

function authEnabled(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

export const authRouter = express.Router();

authRouter.get("/login", (req, res) => {
  if (!authEnabled()) {
    res.status(503).json({ error: "Google auth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)" });
    return;
  }
  const state = randomUUID();
  const rawNext = String(req.query.next || "/");
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : "/";
  for (const [id, value] of pendingStates) if (Date.now() - value.created_at > STATE_TTL_MS) pendingStates.delete(id);
  res.cookie("ms_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: FRONTEND_URL.startsWith("https://"), maxAge: STATE_TTL_MS, path: "/api/auth" });
  pendingStates.set(state, { next, created_at: Date.now() });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/auth?${params.toString()}`);
});

authRouter.get("/callback", async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const error = String(req.query.error || "");
  const pending = pendingStates.get(state);
  const browserState = parseCookies(req.headers.cookie).ms_oauth_state;
  res.clearCookie("ms_oauth_state", { path: "/api/auth" });
  if (browserState === state) pendingStates.delete(state);
  const stale = pending && Date.now() - pending.created_at > STATE_TTL_MS;
  const next = pending && !stale ? pending.next : "/";

  if (error) {
    res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent(error)}`);
    return;
  }
  if (!authEnabled() || !code) {
    res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent("missing_code")}`);
    return;
  }
  if (!pending || !state || browserState !== state) {
    res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent("bad_state")}`);
    return;
  }
  if (stale) {
    res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent("state_expired")}`);
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!tokenRes.ok) {
      console.log("google token exchange failed", tokenRes.status, await tokenRes.text());
      res.redirect(`${FRONTEND_URL}/?auth_error=token_exchange`);
      return;
    }
    const tokens = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) {
      res.redirect(`${FRONTEND_URL}/?auth_error=userinfo`);
      return;
    }
    const profile = (await userRes.json()) as {
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };
    if (!profile.email || profile.email_verified !== true) {
      res.redirect(`${FRONTEND_URL}/?auth_error=no_email`);
      return;
    }

    const email = ownerOf(profile.email);
    const name = profile.name || email;
    const picture = profile.picture || "";
    const billing = await upsertProfile({ email, name, picture });
    const tier = await effectiveTier(email);
    const id = randomUUID();
    const expiresAt = Date.now() + SESSION_TTL_MS;

    if (dbEnabled()) {
      if (!billing.id) throw new Error("profile missing id after upsert");
      await db.insert("sessions", {
        id,
        profile_id: billing.id,
        expires_at: new Date(expiresAt).toISOString(),
      });
    } else {
      sessions.set(id, {
        id: billing.id,
        email,
        name,
        picture,
        tier,
        expires_at: expiresAt,
      });
      saveSessions();
    }

    res.setHeader(
      "Set-Cookie",
      `ms_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${FRONTEND_URL.startsWith("https://") ? "; Secure" : ""}`,
    );
    res.redirect(`${FRONTEND_URL}${next.startsWith("/") ? next : "/"}`);
  } catch (err) {
    console.log("google auth callback failed", err);
    res.redirect(`${FRONTEND_URL}/?auth_error=callback_failed`);
  }
});

authRouter.get("/me", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const user = await resolveUser(req);
  if (!user) {
    res.status(401).json({ user: null });
    return;
  }
  const tier = user.tier || (await effectiveTier(user.email));
  res.json({
    user: {
      id: user.id || null,
      email: user.email,
      name: user.name,
      picture: user.picture,
      tier,
    },
  });
});

authRouter.post("/logout", async (req, res) => {
  const id = parseCookies(req.headers.cookie).ms_session;
  if (id) {
    if (dbEnabled()) {
      await db.delete("sessions", eq("id", id));
    } else {
      sessions.delete(id);
      saveSessions();
    }
  }
  res.setHeader("Set-Cookie", "ms_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ ok: true });
});

export async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const user = await resolveUser(req);
  if (user) {
    next();
    return;
  }
  res.status(401).json({ error: "sign in with Google first" });
}

/** Attach resolved user for downstream sync helpers (billing guard, etc.). */
export async function attachUser(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
) {
  try { await resolveUser(req); next(); } catch (err) { next(err); }
}

import { randomUUID } from "node:crypto";
import express from "express";
import { FRONTEND_URL } from "./env.js";

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || `${FRONTEND_URL}/callback`;

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;

type Session = {
  email: string;
  name: string;
  picture: string;
  expires_at: number;
};

const sessions = new Map<string, Session>();
const pendingStates = new Map<string, { next: string; created_at: number }>();

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function currentUser(req: express.Request): Session | null {
  const id = parseCookies(req.headers.cookie).ms_session;
  if (!id) return null;
  const s = sessions.get(id);
  if (!s || s.expires_at < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return s;
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
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
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
  pendingStates.delete(state);
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
  if (!pending) {
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
    if (!profile.email) {
      res.redirect(`${FRONTEND_URL}/?auth_error=no_email`);
      return;
    }

    const id = randomUUID();
    sessions.set(id, {
      email: profile.email,
      name: profile.name || profile.email,
      picture: profile.picture || "",
      expires_at: Date.now() + SESSION_TTL_MS,
    });
    res.setHeader(
      "Set-Cookie",
      `ms_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`,
    );
    res.redirect(`${FRONTEND_URL}${next.startsWith("/") ? next : "/"}`);
  } catch (err) {
    console.log("google auth callback failed", err);
    res.redirect(`${FRONTEND_URL}/?auth_error=callback_failed`);
  }
});

authRouter.get("/me", (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ user: null });
    return;
  }
  res.json({ user: { email: user.email, name: user.name, picture: user.picture } });
});

authRouter.post("/logout", (req, res) => {
  const id = parseCookies(req.headers.cookie).ms_session;
  if (id) sessions.delete(id);
  res.setHeader("Set-Cookie", "ms_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ ok: true });
});

export function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (currentUser(req)) {
    next();
    return;
  }
  res.status(401).json({ error: "sign in with Google first" });
}

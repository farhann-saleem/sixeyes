import express, { type RequestHandler, type ErrorRequestHandler } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { FRONTEND_URL } from "./env.js";
import { currentUser, requireAuth } from "./google-auth.js";

// Public means catalog only. Missing identity must never become an unscoped store query.
const PUBLIC = /^\/(?:mcp|models\/avatar|image-templates(?:\/[^/]+\/image)?|video-templates(?:\/[^/]+\/(?:video|poster))?|effects(?:\/[^/]+\/(?:video|poster))?|billing\/plans|audio\/(?:health|voices|voice-library)|studio\/health)\/?$/;
export const privateApi: RequestHandler = (req, res, next) => {
  if ((req.method === "GET" || req.method === "HEAD") && PUBLIC.test(req.path)) return next();
  if (req.path === "/mcp" || req.path.startsWith("/mcp")) return next();
  res.setHeader("Cache-Control", "private, no-store");
  res.vary("Cookie");
  if (currentUser(req)) return next();
  return requireAuth(req, res, next);
};
export const sameOriginWrites: RequestHandler = (req, res, next) => {
  if (req.path.startsWith("/api/webhooks/") || req.path === "/mcp" || req.path === "/api/mcp") {
    return next();
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("Origin");
    if (req.get("Sec-Fetch-Site") === "cross-site" || (origin && origin !== new URL(FRONTEND_URL).origin)) {
      res.status(403).json({ error: "Cross-origin write rejected" }); return;
    }
  }
  next();
};
export function installSpa(app: express.Express, dist: string) {
  app.use((req, res, next) => {
    // /mcp is also the browser setup page; its POST is handled before this middleware.
    if (/^\/(?:api(?:\/|$)|mcp\/|health(?:\/|$))/.test(req.path)) {
      res.status(404).json({ error: "not found" }); return;
    }
    next();
  });
  if (!existsSync(path.join(dist, "index.html"))) return;
  app.use(express.static(dist));
  app.get("*", (req, res, next) => {
    if (path.extname(req.path) || !req.accepts("html")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(dist, "index.html"));
  });
}
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err?.code === "LIMIT_FILE_SIZE" ? 413 : Number(err?.status) || 500;
  console.error("Request failed", err instanceof Error ? err.message : "unknown error");
  res.status(status >= 400 && status < 600 ? status : 500).json({ error: status === 413 ? "File too large" : status < 500 ? "Invalid request" : "Request failed; please retry" });
};

// One process is the deployment lock. Serialize each user's HTTP mutations so quota
// checks + job creation and concurrent edits cannot race within that process.
const mutationQueues = new Map<string, Promise<void>>();
export const serializeUserWrites: RequestHandler = async (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !currentUser(req)) return next();
  const key = currentUser(req)!.email;
  const previous = mutationQueues.get(key) || Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>(resolve => { release = resolve; });
  mutationQueues.set(key, mine);
  await previous;
  let done = false;
  const finish = () => {
    if (done) return; done = true; release();
    if (mutationQueues.get(key) === mine) mutationQueues.delete(key);
  };
  res.once("finish", finish); res.once("close", finish);
  if (res.destroyed) { finish(); return; }
  next();
};

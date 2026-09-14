import multer from "multer";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import type { RequestHandler } from "express";

/** Spool concurrent HTTP bodies to scratch, never to a 200 MB memoryStorage buffer. */
export function diskUpload(limit: number, field: string): RequestHandler {
  const dir = path.join(DATA_DIR, "studio-work", "http-uploads");
  mkdirSync(dir, { recursive: true });
  const parser = multer({ dest: dir, limits: { fileSize: limit, files: 1, fields: 40, fieldSize: 1024 * 1024 } }).single(field);
  return (req, res, next) => parser(req, res, err => {
    if (req.file) {
      const file = req.file.path;
      const clean = () => { void unlink(file).catch(() => {}); };
      res.once("finish", clean); res.once("close", clean);
    }
    next(err);
  });
}

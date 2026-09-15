/**
 * Monthly audio credit ledger (1 generate job = 1 credit).
 * Kept on disk so production does not need a Supabase column to enforce the cap.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./env.js";
import { ownerOf } from "./db.js";

const PATH = path.join(DATA_DIR, "audio-usage.json");

type Ledger = Record<string, Record<string, number>>;

function monthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function read(): Ledger {
  if (!existsSync(PATH)) return {};
  try {
    return JSON.parse(readFileSync(PATH, "utf8")) as Ledger;
  } catch {
    return {};
  }
}

function write(value: Ledger) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(`${PATH}.tmp`, JSON.stringify(value, null, 2) + "\n");
  renameSync(`${PATH}.tmp`, PATH);
}

export function audioUsageForMonth(email: string, now = new Date()): number {
  const key = ownerOf(email);
  const mk = monthKey(now);
  return read()[key]?.[mk] ?? 0;
}

export function recordAudioUsage(email: string, amount = 1, now = new Date()): number {
  const key = ownerOf(email);
  const mk = monthKey(now);
  const ledger = read();
  const row = ledger[key] ?? {};
  const next = (row[mk] ?? 0) + Math.max(1, Math.floor(amount));
  ledger[key] = { ...row, [mk]: next };
  write(ledger);
  return next;
}

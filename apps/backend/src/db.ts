/**
 * Thin PostgREST client (service role). No @supabase/supabase-js dependency.
 * Schema: supabase/migrations/20260914120000_multi_user.sql
 */

export type DbRow = Record<string, unknown>;

function baseUrl(): string {
  return (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
}

function serviceKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

/** True when Supabase is configured and we are not in the file-backed test harness. */
export function dbEnabled(): boolean {
  if (process.env.NODE_ENV === "test" && process.env.STUDIO_TEST_DATA_DIR) return false;
  const enabled = Boolean(baseUrl() && serviceKey());
  if (process.env.NODE_ENV === "production" && !enabled) throw new Error("Production requires Supabase; file fallback is disabled");
  return enabled;
}

export function ownerOf(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase() || "anonymous";
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: serviceKey(),
    Authorization: `Bearer ${serviceKey()}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...extra,
  };
}

async function rest<T>(
  method: string,
  pathAndQuery: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const url = `${baseUrl()}/rest/v1/${pathAndQuery}`;
  const res = await fetch(url, {
    method,
    signal: AbortSignal.timeout(30_000),
    headers: headers(extraHeaders),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`supabase ${method} ${pathAndQuery} → ${res.status}: ${text.slice(0, 400)}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const db = {
  async rpc<T>(name: string, args: DbRow): Promise<T> { return rest<T>("POST", `rpc/${name}`, args); },
  async select<T extends DbRow>(table: string, query: string): Promise<T[]> {
    if (/(^|&)limit=/.test(query)) return rest<T[]>("GET", `${table}?${query}`);
    const all: T[] = [];
    // PostgREST defaults to a capped page. Resume/migration must not silently stop at 1000 rows.
    const stable = /(^|&)order=/.test(query) ? query.replace(/(order=[^&]+)/, "$1,id.asc") : `${query}&order=id.asc`;
    for (let offset = 0; ; offset += 500) {
      const rows = await rest<T[]>("GET", `${table}?${stable}&limit=500&offset=${offset}`);
      all.push(...rows);
      if (rows.length < 500) return all;
    }
  },

  async selectOne<T extends DbRow>(table: string, query: string): Promise<T | null> {
    const rows = await this.select<T>(table, `${query}&limit=1`);
    return rows[0] ?? null;
  },

  async insert<T extends DbRow>(table: string, row: DbRow | DbRow[]): Promise<T[]> {
    const rows = await rest<T[]>("POST", table, row);
    return Array.isArray(rows) ? rows : rows ? [rows as unknown as T] : [];
  },

  async upsert<T extends DbRow>(
    table: string,
    row: DbRow | DbRow[],
    onConflict: string,
  ): Promise<T[]> {
    const rows = await rest<T[]>(
      "POST",
      `${table}?on_conflict=${encodeURIComponent(onConflict)}`,
      row,
      { Prefer: "resolution=merge-duplicates,return=representation" },
    );
    return Array.isArray(rows) ? rows : rows ? [rows as unknown as T] : [];
  },

  async update<T extends DbRow>(table: string, query: string, patch: DbRow): Promise<T[]> {
    const rows = await rest<T[]>("PATCH", `${table}?${query}`, patch);
    return Array.isArray(rows) ? rows : [];
  },

  async delete(table: string, query: string): Promise<void> {
    await rest("DELETE", `${table}?${query}`, undefined, { Prefer: "return=minimal" });
  },
};

export function eq(column: string, value: string): string {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

/** All API calls and private media go directly to the backend, never through Vercel. */
export function createApiClient(origin: string) {
  const base = origin.replace(/\/$/, "");
  const apiUrl = (url: string) => /^\/api(?:\/|\?|$)/.test(url) ? `${base}${url}` : url;
  const apiFetch = (url: string, init?: RequestInit) => fetch(apiUrl(url), { ...init, credentials: "include" });
  const publicCatalogs = new Set(["/api/image-templates", "/api/video-templates", "/api/effects", "/api/billing/plans"]);
  const catalogCache = new Map<string, { expires: number; request: Promise<unknown> }>();
  async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, init);
    // Only URL fields are resolved; user-authored text is never rewritten.
    const body = JSON.parse(await res.text(), (key, value) =>
      typeof value === "string" && (key === "url" || key.endsWith("_url")) ? apiUrl(value) : value,
    ) as T & { error?: string };
    if (!res.ok) throw new Error(body.error || res.statusText);
    return body;
  }
  function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
    // Exact public catalog paths only. Custom request options always bypass caching.
    if (!publicCatalogs.has(url) || init !== undefined) return requestJson<T>(url, init);
    const cached = catalogCache.get(url);
    if (cached && cached.expires > Date.now()) return cached.request as Promise<T>;
    const entry = { expires: Infinity, request: Promise.resolve() as Promise<unknown> };
    entry.request = requestJson<T>(url).then((body) => {
      entry.expires = Date.now() + 15_000;
      return body;
    }).catch((error) => {
      if (catalogCache.get(url) === entry) catalogCache.delete(url);
      throw error;
    });
    catalogCache.set(url, entry);
    return entry.request as Promise<T>;
  }
  return { apiUrl, apiFetch, apiJson };
}

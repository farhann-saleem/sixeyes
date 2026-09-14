/** All API calls and private media go directly to the backend, never through Vercel. */
export function createApiClient(origin: string) {
  const base = origin.replace(/\/$/, "");
  const apiUrl = (url: string) => /^\/api(?:\/|\?|$)/.test(url) ? `${base}${url}` : url;
  const apiFetch = (url: string, init?: RequestInit) => fetch(apiUrl(url), { ...init, credentials: "include" });
  async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, init);
    // Only URL fields are resolved; user-authored text is never rewritten.
    const body = JSON.parse(await res.text(), (key, value) =>
      typeof value === "string" && (key === "url" || key.endsWith("_url")) ? apiUrl(value) : value,
    ) as T & { error?: string };
    if (!res.ok) throw new Error(body.error || res.statusText);
    return body;
  }
  return { apiUrl, apiFetch, apiJson };
}

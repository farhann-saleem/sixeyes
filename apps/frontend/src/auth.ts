export type User = {
  id?: string | null;
  email: string;
  name: string;
  picture: string;
  tier?: string;
};

let cached: User | null | undefined = undefined;

export async function fetchUser(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) { setUser(null); return null; }
    const body = (await res.json()) as { user: User | null };
    setUser(body.user ?? null);
    return body.user ?? null;
  } catch {
    setUser(null); return null;
  }
}

export function setUser(user: User | null) {
  cached = user;
}

export function getUser(): User | null | undefined {
  return cached;
}

export function googleLogin(next: string) {
  window.location.assign(`/api/auth/login?next=${encodeURIComponent(next)}`);
}

export async function googleLogout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    cached = null;
    window.location.assign("/");
  }
}

function askAndGo() {
  const ok = window.confirm(
    "Creating asks Google to authorize this app — it reads your name, email and profile picture. Continue to sign in?",
  );
  if (ok) googleLogin(`${window.location.pathname}${window.location.search}`);
}

export function ensureAuthed(): boolean {
  if (cached) return true;
  if (cached === undefined) {
    void fetchUser().then((u) => {
      if (!u) askAndGo();
    });
    return false;
  }
  askAndGo();
  return false;
}

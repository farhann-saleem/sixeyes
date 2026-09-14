export type User = {
  email: string;
  name: string;
  picture: string;
};

export async function fetchUser(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    const body = (await res.json()) as { user: User | null };
    return body.user ?? null;
  } catch {
    return null;
  }
}

export function googleLogin(next: string) {
  window.location.assign(`/api/auth/login?next=${encodeURIComponent(next)}`);
}

export async function googleLogout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.assign("/");
  }
}

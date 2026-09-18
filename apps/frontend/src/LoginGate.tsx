import { useEffect, useId, useRef, useState } from "react";
import { googleLogin, type User } from "./auth";

export function LoginPage() {
  const authError = new URLSearchParams(window.location.search).get("auth_error");
  const next = new URLSearchParams(window.location.search).get("next") || "/projects";

  return (
    <main className="login-page">
      <div className="login-ambient" aria-hidden="true">
        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
      </div>

      <div className="login-stage">
        <div className="login-card">
          <img
            className="login-logo"
            src="/brand/marketing-studio-logo.svg"
            width="120"
            height="120"
            alt="Marketing Studio"
          />
          <p className="login-kicker">Your Imagination Engine</p>
          <h1>
            Imagine it.
            <span className="login-accent"> Then be in it.</span>
          </h1>
          <p className="login-lede">
            Sign in with Google to create films, looks, and audio in Marketing Studio.
          </p>

          {authError ? (
            <p className="login-error" role="alert">
              Sign-in didn’t finish ({authError}). Try Google again.
            </p>
          ) : null}

          <button type="button" className="login-google" onClick={() => googleLogin(next)}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2 3.7-5 3.7-8.6z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-7-5.1l-3.9 3C3.1 21.3 7.2 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5 14.3c-.3-.8-.4-1.6-.4-2.3s.1-1.5.4-2.3L1.1 6.7C.4 8.3 0 10.1 0 12s.4 3.7 1.1 5.3l3.9-3z"
              />
              <path
                fill="#EA4335"
                d="M12 4.7c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.2 0 3.1 2.7 1.1 6.7l3.9 3c1-3 3.8-5 7-5z"
              />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>

      <div className="login-foot-wave" aria-hidden="true">
        <div className="site-foot-seam" />
      </div>
    </main>
  );
}

/** @deprecated Prefer LoginPage */
export function LoginGate() {
  return <LoginPage />;
}

export function AuthBadge({
  user,
  onGoLogin,
  onLogout,
}: {
  user: User | null;
  onGoLogin: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <button type="button" className="nav-top auth-signin" onClick={onGoLogin}>
        Sign in
      </button>
    );
  }

  return (
    <div className={`auth-menu${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="auth-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {user.picture ? (
          <img src={user.picture} alt="" />
        ) : (
          <span className="auth-fallback" aria-hidden="true" />
        )}
        <span className="auth-name">{user.name || user.email}</span>
        <span className="auth-caret" aria-hidden="true" />
      </button>
      {open ? (
        <div className="auth-dropdown" id={menuId} role="menu">
          <p className="auth-email" role="none">
            {user.email}
          </p>
          <button
            type="button"
            className="auth-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

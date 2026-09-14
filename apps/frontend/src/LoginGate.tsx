import { googleLogin, type User } from "./auth";

export function LoginGate() {
  const authError = new URLSearchParams(window.location.search).get("auth_error");
  return (
    <div className="login-gate">
      <div className="login-card">
        <h1>Marketing Studio</h1>
        <p className="muted">
          Sign in to continue. When you click <strong>Create</strong> or{" "}
          <strong>Generate</strong>, Google will ask you to authorize this app
          to see your name, email and profile picture.
        </p>
        {authError ? (
          <p className="auth-error">Sign-in didn't complete ({authError}). Try again.</p>
        ) : null}
        <button
          type="button"
          className="btn lime login-btn"
          onClick={() =>
            googleLogin(`${window.location.pathname}${window.location.search}`)
          }
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2 3.7-5 3.7-8.6z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-7-5.1l-3.9 3C3.1 21.3 7.2 24 12 24z" />
            <path fill="#FBBC05" d="M5 14.3c-.3-.8-.4-1.6-.4-2.3s.1-1.5.4-2.3L1.1 6.7C.4 8.3 0 10.1 0 12s.4 3.7 1.1 5.3l3.9-3z" />
            <path fill="#EA4335" d="M12 4.7c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.2 0 3.1 2.7 1.1 6.7l3.9 3c1-3 3.8-5 7-5z" />
          </svg>
          Continue with Google
        </button>
        <p className="muted small">
          Your session is stored in a cookie and expires after 7 days.
        </p>
      </div>
    </div>
  );
}

export function AuthBadge({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <div className="auth-badge" title={user.email}>
      {user.picture ? <img src={user.picture} alt="" /> : null}
      <span className="auth-name">{user.name}</span>
      <button type="button" className="auth-logout" onClick={onLogout}>
        Sign out
      </button>
    </div>
  );
}

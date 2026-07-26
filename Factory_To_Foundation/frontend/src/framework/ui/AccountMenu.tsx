import { useEffect, useRef, useState, type FormEvent } from "react";

import { useAuth } from "@/context/AuthContext";

import "./AccountMenu.css";

/**
 * The one real login/logout control, always anchored at the avatar's
 * position (top-right of CommandRibbon when signed in, or the equivalent
 * spot in the signed-out shell — see App.tsx's SignedOutShell). Self-
 * contained: reads/drives useAuth() directly rather than taking props, so
 * every mount point (every page's CommandRibbon, plus the signed-out
 * shell) is wired to the exact same real session state, never a
 * duplicated copy of it.
 *
 * Real reason this exists: the avatar used to only support "click to sign
 * out," and a fully signed-out session showed nothing but a full-page
 * LoginPage — if that session got left on a lower-privilege test account
 * (or logged out entirely) the user had no fast, self-service way back to
 * their own account without asking for help. This makes signing back in
 * (as CEO or anyone else) a real, always-reachable action from the same
 * spot, not something that depends on remembering a separate URL/page.
 */
export default function AccountMenu() {
  const { status, user, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      setOpen(false);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="account-menu" ref={containerRef}>
      <button
        type="button"
        className="command-ribbon-avatar"
        title={user ? `${user.displayName} — ${user.roleName}` : "Sign in"}
        onClick={() => setOpen((o) => !o)}
      />

      {open && (
        <div className="account-menu-panel">
          {status === "authenticated" && user ? (
            <>
              <p className="account-menu-identity">
                {user.displayName}
                <span className="account-menu-role"> — {user.roleName}</span>
              </p>
              <button
                type="button"
                className="account-menu-signout"
                onClick={() => {
                  void logout();
                  setOpen(false);
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="account-menu-login">
              <label className="account-menu-label">
                Email
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="account-menu-input"
                />
              </label>
              <label className="account-menu-label">
                Password
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="account-menu-input"
                />
              </label>

              {error && <p className="account-menu-error">{error}</p>}

              <button type="submit" disabled={submitting} className="account-menu-submit">
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

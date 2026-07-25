import { useState, type FormEvent } from "react";

import { useAuth } from "@/context/AuthContext";

/**
 * Real login form — correctness over polish this phase (Phase 3b). Gates
 * the entire app shell in App.tsx: unauthenticated visitors see only this.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center" style={{ background: "var(--ff-content-bg)" }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm"
        style={{ borderColor: "var(--ff-panel-border)" }}
      >
        <h1 className="text-2xl font-bold" style={{ color: "var(--ff-accent)" }}>
          Factory » Foundation
        </h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to continue</p>

        <label className="mt-6 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
          Email
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--ff-panel-border)" }}
          />
        </label>

        <label className="mt-4 block text-xs font-medium" style={{ color: "var(--ff-text-secondary)" }}>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--ff-panel-border)" }}
          />
        </label>

        {error && (
          <p className="mt-4 text-sm" style={{ color: "var(--ff-status-critical)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "var(--ff-accent)" }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

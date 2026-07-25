import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Real auth (Phase 3b of the enterprise migration) — session lives in
 * httpOnly cookies set by the backend (backend/src/routes/auth.ts), never
 * read/stored here directly. This context only tracks what GET /auth/me
 * (and the login/logout calls) tell us: the real current user, their real
 * role, and their real resolved permissions (module -> granted actions),
 * for the frontend to know what to show/hide/gate.
 */
const API_BASE = "http://localhost:4300";

/**
 * Fired on every real auth transition (initial resolve, a fresh login, a
 * logout) — a generic hook any feature store can listen for to know its
 * cached data may now be wrong for whoever's actually logged in, without
 * AuthContext needing to import or know about that feature at all. Real
 * bug this fixes: constructionSiteStore.ts used to load its data exactly
 * once per page load; logging out and back in as a different role (no
 * full page reload in between) left it silently showing the previous
 * user's stale fetch/error state.
 */
export const AUTH_CHANGED_EVENT = "ff:auth-changed";

function broadcastAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  roleId: string;
  roleName: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  /** Real module -> granted-action-list map from role_permission, resolved server-side — empty until authenticated. */
  permissions: Record<string, string[]>;
  /** True if the current user's role genuinely has this exact module+action grant. */
  hasPermission: (moduleId: string, action: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchMe(): Promise<{ user: AuthUser; permissions: Record<string, string[]> } | null> {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((result) => {
      if (cancelled) return;
      if (result) {
        setUser(result.user);
        setPermissions(result.permissions);
        setStatus("authenticated");
      } else {
        setStatus("unauthenticated");
      }
      broadcastAuthChanged();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Login failed (${res.status})`);
    }
    const me = await fetchMe();
    if (!me) throw new Error("Logged in, but couldn't load the account afterward — try again.");
    setUser(me.user);
    setPermissions(me.permissions);
    setStatus("authenticated");
    broadcastAuthChanged();
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {
      // Real network failure — still clear local state below, since the
      // point of logging out client-side is to stop treating the session
      // as valid regardless of whether the revoke call itself landed.
    });
    setUser(null);
    setPermissions({});
    setStatus("unauthenticated");
    broadcastAuthChanged();
  }, []);

  const hasPermission = useCallback(
    (moduleId: string, action: string) => permissions[moduleId]?.includes(action) ?? false,
    [permissions]
  );

  return (
    <AuthContext.Provider value={{ status, user, permissions, hasPermission, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}

export type PermissionCheck = {
  allowed: boolean;
  /** A real, specific reason to show the user when `allowed` is false — e.g. as a disabled control's tooltip. Undefined when allowed. */
  reason: string | undefined;
};

/**
 * Phase 3c — the one shared mechanism every module's real write/execute
 * control gates through, rather than each feature re-deriving its own
 * disabled/tooltip logic. THIS IS A UX/HONESTY LAYER, NOT SECURITY: the
 * real protection (where it exists at all) is the backend's
 * requirePermission middleware — see backend/src/middleware/auth.ts. A
 * disabled button here only stops the app from *offering* an action the
 * backend (or, for Manufacturing/Factory's bridge-hosted controls, no
 * backend at all) would refuse — it enforces nothing by itself.
 */
export function usePermission(moduleId: string, action: string): PermissionCheck {
  const { hasPermission, user } = useAuth();
  const allowed = hasPermission(moduleId, action);
  return {
    allowed,
    reason: allowed ? undefined : `Requires ${moduleId}:${action} — your role is ${user?.roleName ?? "unknown"}`,
  };
}

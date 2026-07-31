import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useSettings } from "@/context/SettingsContext";
import { getLastVisitedPath } from "./lastVisitedPath";

const SESSION_FLAG = "ff-startup-redirect-done";

/**
 * Real backing for Workspace's "Remember open tabs" and Preferences'
 * "Default startup page" — wraps only the "/" route's element. Decides
 * once per browser session (a sessionStorage flag, not per-mount): a
 * deliberate later click back to "/" from the sidebar must land on the
 * real page, never get redirected away again. Precedence: rememberOpenTabs
 * (a real last-visited page) wins over defaultStartupPage when both are
 * set, since it reflects where the user actually was, not a static choice.
 */
export default function StartupRedirect({ children }: { children: ReactNode }) {
  const { preferences, loading } = useSettings();
  const [decided, setDecided] = useState(() => sessionStorage.getItem(SESSION_FLAG) === "true");
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (decided || loading || !preferences) return;

    let redirectTarget: string | null = null;
    const lastPath = getLastVisitedPath();
    if (preferences.workspace.rememberOpenTabs && lastPath && lastPath !== "/") {
      redirectTarget = lastPath;
    } else if (preferences.preferences.defaultStartupPage && preferences.preferences.defaultStartupPage !== "/") {
      redirectTarget = preferences.preferences.defaultStartupPage;
    }

    setTarget(redirectTarget);
    sessionStorage.setItem(SESSION_FLAG, "true");
    setDecided(true);
  }, [decided, loading, preferences]);

  // Deliberately blank rather than flashing Genealogy then redirecting —
  // same "brief nothing beats a flash" convention as Gate()'s own loading
  // state.
  if (!decided) return null;
  if (target) return <Navigate to={target} replace />;
  return <>{children}</>;
}

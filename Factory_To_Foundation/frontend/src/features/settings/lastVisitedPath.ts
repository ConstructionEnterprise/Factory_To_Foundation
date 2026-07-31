/**
 * Real backing for Workspace's "Remember open tabs" preference — this app
 * is a single-page-at-a-time SPA with no real multi-tab concept, so
 * "remember open tabs" is implemented honestly as "remember the last real
 * page you were on and return there on your next startup," not a
 * fabricated multi-tab restore.
 */
const LAST_VISITED_PATH_KEY = "ff-last-visited-path";

export function recordVisitedPath(path: string): void {
  // Never record "/" itself — it's the landing route, not a real
  // destination to redirect back to.
  if (path === "/") return;
  try {
    window.localStorage.setItem(LAST_VISITED_PATH_KEY, path);
  } catch {
    // localStorage unavailable — nothing to do, this preference just won't
    // persist across a reload this session.
  }
}

export function getLastVisitedPath(): string | null {
  try {
    return window.localStorage.getItem(LAST_VISITED_PATH_KEY);
  } catch {
    return null;
  }
}

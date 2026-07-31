import { authFetch } from "@/lib/authFetch";
import { BACKEND_URL } from "@/lib/env";

/**
 * Real API client for the Settings panel (A2) — backend/src/routes/
 * userPreferences.ts. Always scoped to "my own preferences": there is no
 * userId parameter anywhere here, the backend always resolves it from the
 * auth cookie.
 */
const API_BASE = BACKEND_URL;

export type WorkspacePreferences = {
  savePanelPositions: boolean;
  snapPanels: boolean;
  floatingWindows: boolean;
  defaultDashboard: string | null;
  rememberOpenTabs: boolean;
};

export type AppearancePreferences = {
  theme: "light" | "dark";
  ceTheme: boolean;
  fontSize: "small" | "medium" | "large";
  compactMode: boolean;
  uiAnimations: boolean;
};

export type NotificationsPreferences = {
  desktopAlerts: boolean;
  emailAlerts: boolean;
  soundEffects: boolean;
};

export type AccessibilityPreferences = {
  keyboardShortcuts: boolean;
  highContrastMode: boolean;
  screenScaling: number;
  reducedMotion: boolean;
};

export type GeneralPreferences = {
  defaultStartupPage: string | null;
  autoSaveIntervalSec: number;
  dateTimeFormat: string;
  languageRegion: string;
};

export type UserPreferences = {
  workspace: WorkspacePreferences;
  appearance: AppearancePreferences;
  notifications: NotificationsPreferences;
  accessibility: AccessibilityPreferences;
  preferences: GeneralPreferences;
};

async function describeResponseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.error === "string") return body.error;
  return `server responded ${res.status}`;
}

export async function fetchPreferences(): Promise<UserPreferences> {
  const res = await authFetch(`${API_BASE}/user-preferences`);
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json();
}

export type PreferencesSectionPatch = Partial<{
  workspace: WorkspacePreferences;
  appearance: AppearancePreferences;
  notifications: NotificationsPreferences;
  accessibility: AccessibilityPreferences;
  preferences: GeneralPreferences;
}>;

export async function patchPreferences(patch: PreferencesSectionPatch): Promise<UserPreferences> {
  const res = await authFetch(`${API_BASE}/user-preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await describeResponseError(res));
  return res.json();
}

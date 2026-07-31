import * as repo from "../repositories/userPreferenceRepository";

/**
 * Settings panel (A2). Each of the 5 sections is its own independent JSON
 * blob (see schema.prisma's own doc comment on UserPreference) — a user who
 * has only ever opened Appearance has a real null workspaceJson/
 * notificationsJson/etc., not a fabricated stored default. Real UI
 * defaults below are applied only in this service's *response*, never
 * written back to the row until the user actually changes something in
 * that section — so "never touched" and "explicitly set to the default
 * value" stay distinguishable in the database, even though they render
 * identically in the UI.
 */
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
  /** Percent, 100 = real default/unscaled. */
  screenScaling: number;
  reducedMotion: boolean;
};

export type GeneralPreferences = {
  defaultStartupPage: string | null;
  autoSaveIntervalSec: number;
  dateTimeFormat: string;
  languageRegion: string;
};

export type UserPreferencesDto = {
  workspace: WorkspacePreferences;
  appearance: AppearancePreferences;
  notifications: NotificationsPreferences;
  accessibility: AccessibilityPreferences;
  preferences: GeneralPreferences;
};

const DEFAULT_WORKSPACE: WorkspacePreferences = {
  savePanelPositions: true,
  snapPanels: true,
  floatingWindows: false,
  defaultDashboard: null,
  rememberOpenTabs: false,
};

const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: "light",
  ceTheme: false,
  fontSize: "medium",
  compactMode: false,
  uiAnimations: true,
};

const DEFAULT_NOTIFICATIONS: NotificationsPreferences = {
  desktopAlerts: true,
  emailAlerts: false,
  soundEffects: false,
};

const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
  keyboardShortcuts: true,
  highContrastMode: false,
  screenScaling: 100,
  reducedMotion: false,
};

const DEFAULT_PREFERENCES: GeneralPreferences = {
  defaultStartupPage: null,
  autoSaveIntervalSec: 60,
  dateTimeFormat: "MM/DD/YYYY",
  languageRegion: "en-US",
};

export async function getPreferences(userId: string): Promise<UserPreferencesDto> {
  const row = await repo.findByUserId(userId);
  return {
    workspace: { ...DEFAULT_WORKSPACE, ...((row?.workspaceJson as Partial<WorkspacePreferences> | null) ?? {}) },
    appearance: { ...DEFAULT_APPEARANCE, ...((row?.appearanceJson as Partial<AppearancePreferences> | null) ?? {}) },
    notifications: {
      ...DEFAULT_NOTIFICATIONS,
      ...((row?.notificationsJson as Partial<NotificationsPreferences> | null) ?? {}),
    },
    accessibility: {
      ...DEFAULT_ACCESSIBILITY,
      ...((row?.accessibilityJson as Partial<AccessibilityPreferences> | null) ?? {}),
    },
    preferences: { ...DEFAULT_PREFERENCES, ...((row?.preferencesJson as Partial<GeneralPreferences> | null) ?? {}) },
  };
}

export type PreferencesPatch = {
  workspace?: WorkspacePreferences;
  appearance?: AppearancePreferences;
  notifications?: NotificationsPreferences;
  accessibility?: AccessibilityPreferences;
  preferences?: GeneralPreferences;
};

/** Section-level replace, matching UserPreference's own "5 independent blobs" schema design — a patch to one section never touches the others' real stored state. */
export async function updatePreferences(userId: string, patch: PreferencesPatch): Promise<UserPreferencesDto> {
  await repo.upsertPatch(userId, {
    workspaceJson: patch.workspace,
    appearanceJson: patch.appearance,
    notificationsJson: patch.notifications,
    accessibilityJson: patch.accessibility,
    preferencesJson: patch.preferences,
  });
  return getPreferences(userId);
}

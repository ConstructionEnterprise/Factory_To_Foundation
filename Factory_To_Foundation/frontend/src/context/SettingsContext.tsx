import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { useAuth } from "./AuthContext";
import { applyAppearance } from "@/features/settings/applyAppearance";
import {
  fetchPreferences,
  patchPreferences,
  type PreferencesSectionPatch,
  type UserPreferences,
} from "@/features/settings/settingsApi";

/**
 * Real per-user Settings (A2) — one provider, mounted only once
 * authenticated (preferences are meaningless for a signed-out session).
 * Fetches the real row (or real defaults) once, applies Appearance/
 * Accessibility immediately via applyAppearance, and re-applies on every
 * real change — a saved preference takes effect the same session it's
 * changed, not just after a reload.
 */
type SettingsContextValue = {
  preferences: UserPreferences | null;
  loading: boolean;
  error: string | null;
  updateSection: (patch: PreferencesSectionPatch) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    setLoading(true);
    fetchPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setPreferences(prefs);
        applyAppearance(prefs.appearance, prefs.accessibility);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load preferences");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  async function updateSection(patch: PreferencesSectionPatch): Promise<void> {
    const updated = await patchPreferences(patch);
    setPreferences(updated);
    applyAppearance(updated.appearance, updated.accessibility);
  }

  return (
    <SettingsContext.Provider value={{ preferences, loading, error, updateSection }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider.");
  return context;
}

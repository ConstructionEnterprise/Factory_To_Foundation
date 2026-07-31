import type { AccessibilityPreferences, AppearancePreferences } from "./settingsApi";

/**
 * The one real place a saved Appearance/Accessibility preference becomes a
 * visible effect — sets data attributes/inline styles on <html> that
 * index.css's own `:root[data-*]` overrides (or, for font size/screen
 * scaling, a root font-size percentage that every rem-based measurement in
 * the app already scales from) key off. No per-component change needed:
 * every page already renders through the same ~19 CSS tokens.
 *
 * Real, disclosed limitation: `ceTheme` has no defined visual treatment yet
 * (no CE-specific palette was ever specified) — it's saved for real, and
 * intentionally has no effect here rather than inventing a color scheme
 * with no real basis. Same for Workspace/Notifications/most of
 * Preferences — see SettingsPanel.tsx's own disclosure banner.
 */
export function applyAppearance(appearance: AppearancePreferences, accessibility: AccessibilityPreferences): void {
  const root = document.documentElement;

  root.dataset.theme = appearance.theme;
  root.dataset.compact = String(appearance.compactMode);
  root.dataset.contrast = accessibility.highContrastMode ? "high" : "normal";
  root.dataset.motion = !appearance.uiAnimations || accessibility.reducedMotion ? "reduced" : "normal";

  const FONT_SIZE_PERCENT: Record<AppearancePreferences["fontSize"], number> = {
    small: 87.5,
    medium: 100,
    large: 112.5,
  };
  // Screen scaling and font size both express as a single real root
  // font-size percentage (rem-based sizing throughout the app already
  // scales from this) — combined multiplicatively, not one silently
  // overriding the other.
  const combinedPercent = (FONT_SIZE_PERCENT[appearance.fontSize] * accessibility.screenScaling) / 100;
  root.style.fontSize = `${combinedPercent}%`;
}

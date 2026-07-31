import { useEffect, useRef, useState } from "react";

import { useSettings } from "@/context/SettingsContext";
import { PAGE_OPTIONS } from "@/router/pageOptions";
import type {
  AccessibilityPreferences,
  AppearancePreferences,
  GeneralPreferences,
  NotificationsPreferences,
  WorkspacePreferences,
} from "@/features/settings/settingsApi";
import CollapsibleSection from "./CollapsibleSection";
import "./SettingsMenu.css";

/**
 * The global Settings control (A1/A2) — a literal "Settings" text button
 * (not a gear icon, per the brief), anchored in the same top-right ribbon
 * spot on every page, mirroring AccountMenu's real self-contained
 * pattern (own outside-click/Escape close, reads its own context directly)
 * so no per-page wiring is needed — CommandRibbon mounts this once and
 * every FeaturePage/SimplePage gets it for free.
 */
export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { preferences, loading, error, updateSection } = useSettings();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
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

  return (
    <div className="settings-menu" ref={containerRef}>
      <button type="button" className="settings-menu-trigger" onClick={() => setOpen((o) => !o)}>
        Settings
      </button>

      {open && (
        <div className="settings-menu-panel">
          <p className="settings-menu-disclosure">
            Saved to your account and applied immediately for Appearance/Accessibility. Workspace,
            Notifications, and a few Preferences fields are saved for real but not yet wired to real app
            behavior — noted per field below.
          </p>

          {loading && <p className="settings-menu-status">Loading your settings…</p>}
          {error && <p className="settings-menu-error">{error}</p>}

          {preferences && (
            <>
              <CollapsibleSection title="Workspace" storageKey="settings-menu-workspace-collapsed">
                <WorkspaceSection
                  value={preferences.workspace}
                  onChange={(workspace) => void updateSection({ workspace })}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Appearance" storageKey="settings-menu-appearance-collapsed">
                <AppearanceSection
                  value={preferences.appearance}
                  onChange={(appearance) => void updateSection({ appearance })}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Notifications" storageKey="settings-menu-notifications-collapsed">
                <NotificationsSection
                  value={preferences.notifications}
                  onChange={(notifications) => void updateSection({ notifications })}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Accessibility" storageKey="settings-menu-accessibility-collapsed">
                <AccessibilitySection
                  value={preferences.accessibility}
                  onChange={(accessibility) => void updateSection({ accessibility })}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Preferences" storageKey="settings-menu-preferences-collapsed">
                <GeneralSection
                  value={preferences.preferences}
                  onChange={(prefs) => void updateSection({ preferences: prefs })}
                />
              </CollapsibleSection>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <label className="settings-field">
      <span className="settings-field-label">
        {label}
        {note && <span className="settings-field-note"> — {note}</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}

function WorkspaceSection({
  value,
  onChange,
}: {
  value: WorkspacePreferences;
  onChange: (v: WorkspacePreferences) => void;
}) {
  return (
    <div className="settings-section-body">
      <Field label="Save panel positions" note="not yet wired to Workspace">
        <Checkbox checked={value.savePanelPositions} onChange={(v) => onChange({ ...value, savePanelPositions: v })} />
      </Field>
      <Field label="Snap panels" note="not yet wired to Workspace">
        <Checkbox checked={value.snapPanels} onChange={(v) => onChange({ ...value, snapPanels: v })} />
      </Field>
      <Field label="Floating windows" note="not yet wired to Workspace">
        <Checkbox checked={value.floatingWindows} onChange={(v) => onChange({ ...value, floatingWindows: v })} />
      </Field>
      <Field label="Default dashboard" note="not yet wired to app startup">
        <select
          className="settings-select"
          value={value.defaultDashboard ?? ""}
          onChange={(e) => onChange({ ...value, defaultDashboard: e.target.value || null })}
        >
          <option value="">None</option>
          {PAGE_OPTIONS.map((p) => (
            <option key={p.path} value={p.path}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Remember open tabs" note="real — redirects to your last-visited page on startup">
        <Checkbox checked={value.rememberOpenTabs} onChange={(v) => onChange({ ...value, rememberOpenTabs: v })} />
      </Field>
    </div>
  );
}

function AppearanceSection({
  value,
  onChange,
}: {
  value: AppearancePreferences;
  onChange: (v: AppearancePreferences) => void;
}) {
  return (
    <div className="settings-section-body">
      <Field label="Theme">
        <select
          className="settings-select"
          value={value.theme}
          onChange={(e) => onChange({ ...value, theme: e.target.value as AppearancePreferences["theme"] })}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </Field>
      <Field label="CE theme" note="saved — no CE-specific palette defined yet">
        <Checkbox checked={value.ceTheme} onChange={(v) => onChange({ ...value, ceTheme: v })} />
      </Field>
      <Field label="Font size">
        <select
          className="settings-select"
          value={value.fontSize}
          onChange={(e) => onChange({ ...value, fontSize: e.target.value as AppearancePreferences["fontSize"] })}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </Field>
      <Field label="Compact mode">
        <Checkbox checked={value.compactMode} onChange={(v) => onChange({ ...value, compactMode: v })} />
      </Field>
      <Field label="UI animations">
        <Checkbox checked={value.uiAnimations} onChange={(v) => onChange({ ...value, uiAnimations: v })} />
      </Field>
    </div>
  );
}

function NotificationsSection({
  value,
  onChange,
}: {
  value: NotificationsPreferences;
  onChange: (v: NotificationsPreferences) => void;
}) {
  return (
    <div className="settings-section-body">
      <Field label="Desktop alerts" note="saved — no real notification system exists yet">
        <Checkbox checked={value.desktopAlerts} onChange={(v) => onChange({ ...value, desktopAlerts: v })} />
      </Field>
      <Field label="Email alerts" note="saved — no real notification system exists yet">
        <Checkbox checked={value.emailAlerts} onChange={(v) => onChange({ ...value, emailAlerts: v })} />
      </Field>
      <Field label="Sound effects" note="saved — no real notification system exists yet">
        <Checkbox checked={value.soundEffects} onChange={(v) => onChange({ ...value, soundEffects: v })} />
      </Field>
    </div>
  );
}

function AccessibilitySection({
  value,
  onChange,
}: {
  value: AccessibilityPreferences;
  onChange: (v: AccessibilityPreferences) => void;
}) {
  return (
    <div className="settings-section-body">
      <Field label="Keyboard shortcuts" note="saved — no real shortcut system exists yet">
        <Checkbox checked={value.keyboardShortcuts} onChange={(v) => onChange({ ...value, keyboardShortcuts: v })} />
      </Field>
      <Field label="High contrast mode">
        <Checkbox checked={value.highContrastMode} onChange={(v) => onChange({ ...value, highContrastMode: v })} />
      </Field>
      <Field label={`Screen scaling — ${value.screenScaling}%`}>
        <input
          type="range"
          min={75}
          max={150}
          step={5}
          value={value.screenScaling}
          onChange={(e) => onChange({ ...value, screenScaling: Number(e.target.value) })}
        />
      </Field>
      <Field label="Reduced motion">
        <Checkbox checked={value.reducedMotion} onChange={(v) => onChange({ ...value, reducedMotion: v })} />
      </Field>
    </div>
  );
}

function GeneralSection({ value, onChange }: { value: GeneralPreferences; onChange: (v: GeneralPreferences) => void }) {
  return (
    <div className="settings-section-body">
      <Field label="Default startup page" note="real — used when Remember Open Tabs is off">
        <select
          className="settings-select"
          value={value.defaultStartupPage ?? ""}
          onChange={(e) => onChange({ ...value, defaultStartupPage: e.target.value || null })}
        >
          <option value="">None (default landing page)</option>
          {PAGE_OPTIONS.map((p) => (
            <option key={p.path} value={p.path}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Auto-save interval (seconds)" note="saved — no real auto-save system exists yet">
        <input
          type="number"
          className="settings-number"
          min={5}
          value={value.autoSaveIntervalSec}
          onChange={(e) => onChange({ ...value, autoSaveIntervalSec: Number(e.target.value) })}
        />
      </Field>
      <Field label="Date & time format" note="saved — not yet applied to date displays app-wide">
        <select
          className="settings-select"
          value={value.dateTimeFormat}
          onChange={(e) => onChange({ ...value, dateTimeFormat: e.target.value })}
        >
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        </select>
      </Field>
      <Field label="Language & region" note="saved — no real i18n system exists yet">
        <select
          className="settings-select"
          value={value.languageRegion}
          onChange={(e) => onChange({ ...value, languageRegion: e.target.value })}
        >
          <option value="en-US">English (United States)</option>
          <option value="en-GB">English (United Kingdom)</option>
          <option value="es-US">Español (Estados Unidos)</option>
        </select>
      </Field>
    </div>
  );
}

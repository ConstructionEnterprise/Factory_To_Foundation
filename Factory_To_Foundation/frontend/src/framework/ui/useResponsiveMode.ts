import { useOrientation } from "./useOrientation";
import { useViewportTier } from "./useViewportTier";

export type ResponsiveMode =
  | "phone-portrait"
  | "phone-landscape"
  | "tablet-portrait"
  | "tablet-landscape"
  | "desktop";

/**
 * The real layout-mode matrix a workspace needs, per the "Responsive UI &
 * Mobile Experience" milestone's orientation-aware brief: width tier alone
 * (`useViewportTier`) isn't enough, since a phone in landscape and a
 * tablet in portrait can have overlapping real widths but need genuinely
 * different panel arrangements. Desktop ignores orientation entirely
 * (a desktop monitor is never meaningfully "portrait" for this app's
 * purposes, and the brief itself says "leave unchanged").
 *
 * Working-mode framing from the brief, kept here since it's what each
 * mode's real layout decision traces back to:
 *   - phone-portrait  = "Inspection Mode"  - stacked, one-handed, walking the floor
 *   - phone-landscape = "Workstation Mode" - compact multi-panel, stopped to look
 *   - tablet-portrait = adaptive two-column
 *   - tablet-landscape / desktop = "Engineering Mode" - full multi-panel workspace
 */
export function useResponsiveMode(): ResponsiveMode {
  const tier = useViewportTier();
  const orientation = useOrientation();

  if (tier === "desktop") return "desktop";
  if (tier === "tablet") return orientation === "portrait" ? "tablet-portrait" : "tablet-landscape";
  return orientation === "portrait" ? "phone-portrait" : "phone-landscape";
}

import { useEffect, useState } from "react";

export type Orientation = "portrait" | "landscape";

function readOrientation(): Orientation {
  if (typeof window === "undefined") return "landscape";
  return window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape";
}

/**
 * Real device/window orientation via the standard `(orientation: ...)`
 * media feature - not derived from width/height comparison, since a
 * resizable desktop window can be "tall" without being a real portrait
 * device. Paired with `useViewportTier` by `useResponsiveMode` for the
 * phone/tablet layout-mode matrix (see that hook's own doc comment).
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(readOrientation);

  useEffect(() => {
    const query = window.matchMedia("(orientation: portrait)");
    const update = () => setOrientation(query.matches ? "portrait" : "landscape");

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return orientation;
}

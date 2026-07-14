import { useCamera } from "./CameraContext";
import "./ViewportControls.css";

/**
 * Floating "Reset View" control for any Viewport. Generic — render it as
 * a sibling of your content inside <Viewport>, anywhere a fit-to-content
 * or return-to-origin action is useful (graphs, floor plans, twin views).
 */
export default function ViewportControls() {
  const { reset } = useCamera();

  return (
    <div className="viewport-controls">
      <button
        type="button"
        className="viewport-controls-button"
        onClick={reset}
      >
        Reset View
      </button>
    </div>
  );
}

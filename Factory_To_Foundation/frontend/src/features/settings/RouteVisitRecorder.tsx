import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { recordVisitedPath } from "./lastVisitedPath";

/** Mounted once inside the router — records every real route change so "Remember open tabs" has a real last-visited page to return to. No UI of its own. */
export default function RouteVisitRecorder() {
  const location = useLocation();
  useEffect(() => {
    recordVisitedPath(location.pathname);
  }, [location.pathname]);
  return null;
}

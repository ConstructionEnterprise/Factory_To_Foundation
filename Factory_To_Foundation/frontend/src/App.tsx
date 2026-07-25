import { BrowserRouter, Route, Routes } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import { SelectionProvider } from "./context/SelectionContext";
import { ManufacturingOutputProvider } from "./context/ManufacturingOutputContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./features/auth/LoginPage";
import { appRoutes, type AppRoute } from "./router/routes";

/**
 * Phase 3c — blocks direct navigation (typed URL, bookmark, back button)
 * to a route the current role lacks the required permission for, not just
 * the nav link. Sidebar.tsx already hides the link; this is what stops
 * the route itself from rendering if reached another way. Same UX/honesty
 * framing as every other Phase 3c gate: nothing server-side backs this up
 * for routes with no real API behind them yet.
 */
function RouteGuard({ route }: { route: AppRoute }) {
  const { hasPermission, user } = useAuth();
  if (route.requiredPermission && !hasPermission(route.requiredPermission.module, route.requiredPermission.action)) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--ff-text-primary)" }}>Not available for your role</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--ff-text-muted)" }}>
            {route.label} requires {route.requiredPermission.module}:{route.requiredPermission.action} — your role is{" "}
            {user?.roleName ?? "unknown"}.
          </p>
        </div>
      </div>
    );
  }
  return <>{route.element}</>;
}

function Gate() {
  const { status } = useAuth();

  // Deliberately blank rather than a spinner/flash of the login form —
  // this resolves almost instantly against a local backend, and briefly
  // showing (then hiding) a login form on every real page load would be
  // more distracting than a beat of nothing.
  if (status === "loading") return null;

  if (status === "unauthenticated") return <LoginPage />;

  return (
    <SelectionProvider>
      <ManufacturingOutputProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              {appRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={<RouteGuard route={route} />} />
              ))}
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </ManufacturingOutputProvider>
    </SelectionProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

import { BrowserRouter, Route, Routes } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import { SelectionProvider } from "./context/SelectionContext";
import { ManufacturingOutputProvider } from "./context/ManufacturingOutputContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./features/auth/LoginPage";
import { appRoutes } from "./router/routes";

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
                <Route key={route.path} path={route.path} element={route.element} />
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

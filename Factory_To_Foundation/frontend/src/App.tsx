import { BrowserRouter, Route, Routes } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import { SelectionProvider } from "./context/SelectionContext";
import { appRoutes } from "./router/routes";

export default function App() {
  return (
    <SelectionProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            {appRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </SelectionProvider>
  );
}

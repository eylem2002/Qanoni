import { BrowserRouter, Route, Routes } from "react-router-dom";
import { routes } from "./routeRegistry";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AppRouter() {
  return (
    <BrowserRouter basename={basename || undefined}>
      <Routes>
        {routes.map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
      </Routes>
    </BrowserRouter>
  );
}

import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";

export default function App() {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/register";

  return (
    <div className={`app-shell ${isAuthRoute ? "app-shell--auth" : ""}`}>
      {isAuthRoute ? null : <header className="app-header">Aelzerant:Aeltherant and fatelume</header>}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";

export default function App() {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/register";
  const isTalentEditorRoute = location.pathname === "/system/talent-trees";

  return (
    <div className={`app-shell ${isAuthRoute ? "app-shell--auth" : ""}`}>
      {isAuthRoute ? null : <header className="app-header">艾尔泽兰特：天穹之剑与命运之星</header>}
      <main className={`app-main ${isTalentEditorRoute ? "app-main--talent-editor" : ""}`}>
        <Outlet />
      </main>
    </div>
  );
}
import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";

export default function App() {
  const location = useLocation();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/register";
  const isWorldRoute = location.pathname.startsWith("/world/");
  const isAbilityLabRoute = location.pathname.startsWith("/system/ability-lab");
  const isTalentEditorRoute = location.pathname === "/system/talent-trees";

  return (
    <div className={`app-shell ${isAuthRoute ? "app-shell--auth" : ""}`}>
      {isAuthRoute || isWorldRoute || isAbilityLabRoute ? null : <header className="app-header">艾尔泽兰特：天穹之剑与命运之星</header>}
      <main
        className={`app-main ${isTalentEditorRoute ? "app-main--talent-editor" : ""} ${isWorldRoute || isAbilityLabRoute ? "app-main--world" : ""}`.trim()}
      >
        <Outlet />
      </main>
    </div>
  );
}

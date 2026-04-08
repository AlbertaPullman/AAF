import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "../App";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import LobbyPage from "../pages/lobby/LobbyPage";
import WorldPage from "../pages/world/WorldPage";
import NotFoundPage from "../pages/system/NotFoundPage";
import TalentTreeEditorPage from "../pages/system/TalentTreeEditorPage";
import RulebookEditorPage from "../pages/system/RulebookEditorPage";
import TalentTrialPage from "../pages/system/TalentTrialPage";
import RequireAuth from "./RequireAuth";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "lobby", element: <LobbyPage /> },
          { path: "world/:worldId", element: <WorldPage /> },
          { path: "system/talent-trees", element: <TalentTreeEditorPage /> },
          { path: "system/talent-trial", element: <TalentTrialPage /> },
          { path: "system/rulebook", element: <RulebookEditorPage /> }
        ]
      },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
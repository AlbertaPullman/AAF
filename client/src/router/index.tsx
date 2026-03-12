import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import LobbyPage from "../pages/lobby/LobbyPage";
import WorldPage from "../pages/world/WorldPage";
import NotFoundPage from "../pages/system/NotFoundPage";
import RequireAuth from "./RequireAuth";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "lobby", element: <LobbyPage /> },
          { path: "world/:worldId", element: <WorldPage /> }
        ]
      },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
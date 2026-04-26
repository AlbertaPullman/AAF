import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./styles/index.css";
import { bootstrapTheme } from "./store/themeStore";

// Apply persisted theme before React renders to avoid a flash of the wrong palette.
bootstrapTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider
      router={router}
      future={{
        v7_startTransition: true
      }}
    />
  </React.StrictMode>
);
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const clientPort = Number(process.env.CLIENT_PORT ?? 5174);

export default defineConfig({
  plugins: [react()],
  server: {
    port: clientPort
  }
});
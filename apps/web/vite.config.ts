import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development, forward API calls to the Node server.
    proxy: { "/api": "http://localhost:3000" },
  },
});

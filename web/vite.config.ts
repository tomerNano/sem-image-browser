import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  server: {
    // In development the API runs as a separate process; Vite forwards /api calls to it.
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
});

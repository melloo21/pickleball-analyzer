import { defineConfig } from "vite";

// `npm run dev` serves on :5173 and forwards /api to the Python backend on :8000.
// `npm run build` writes web/dist, which the backend serves at http://localhost:8000.
export default defineConfig({
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
  build: { outDir: "dist", emptyOutDir: true },
});

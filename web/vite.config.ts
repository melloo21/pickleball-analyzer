import { defineConfig } from "vite";

// `npm run dev` serves on :5173 and forwards /api to the Python backend on :8000.
// `npm run build` writes web/dist, which the backend serves at http://localhost:8000.
// `npm run build:demo` writes a static, backend-free demo (GitHub Pages): relative asset paths so it
// works under /pickleball-analyzer/, demo-public/ (sample video + analysis) copied in, output in dist-demo/.
export default defineConfig(({ mode }) => {
  const demo = mode === "demo";
  return {
    base: demo ? "./" : "/",
    publicDir: demo ? "demo-public" : "public",
    server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
    build: { outDir: demo ? "dist-demo" : "dist", emptyOutDir: true },
  };
});

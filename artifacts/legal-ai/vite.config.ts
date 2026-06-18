import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Frontend dev server port — defaults to 5173 locally.
// In Replit, PORT is set by the platform for the shared reverse proxy.
const rawPort = process.env.VITE_PORT ?? process.env.PORT ?? "5173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid port value: "${rawPort}"`);
}

// Backend Express port — needed for the dev-server proxy.
// Locally, run the API server on API_PORT (default 5001) while Vite runs on
// VITE_PORT (default 5173). In Replit the reverse proxy handles routing so
// this proxy config is not used there.
const apiPort = Number(process.env.API_PORT ?? "5001");
const apiTarget = `http://127.0.0.1:${apiPort}`;

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      // Proxy all /api requests to the Express backend during local development.
      "/api": {
        target: apiTarget,
        changeOrigin: false,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

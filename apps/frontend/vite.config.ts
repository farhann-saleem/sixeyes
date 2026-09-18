import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      ignored: ["**/apps/backend/data/**", "**/data/**"],
    },
    proxy: {
      "/api": "http://localhost:3001",
      "/health": "http://localhost:3001",
    },
  },
  build: {
    target: "es2022",
    minify: "esbuild",
    cssMinify: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/@vercel/analytics")) {
            return "vendor-analytics";
          }
        },
      },
    },
  },
});

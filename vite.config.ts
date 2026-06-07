// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Served at the apex of the custom domain (dmosh.com), so assets live at root.
  base: "/",
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  // @ffmpeg/ffmpeg's "node" export condition resolves to an empty stub; we always
  // want the real browser ESM build (it spawns a Worker that Vite bundles for us).
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
});

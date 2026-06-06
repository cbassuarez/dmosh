// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGitHubPages = !!process.env.GITHUB_PAGES_BASE;

export default defineConfig({
  plugins: [react()],
  base: isGitHubPages ? "/dmosh/" : "/",
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

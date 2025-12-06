// vite.config.ts
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGitHubPages = !!process.env.GITHUB_PAGES_BASE;

export default defineConfig({
  plugins: [react()],
  base: isGitHubPages ? "/dmosh/" : "/",
  resolve: {
    alias: {
      "@": "/src",
      "@ffmpeg/ffmpeg": path.resolve(
        process.cwd(),
        "node_modules/@ffmpeg/ffmpeg/dist/umd/ffmpeg.js",
      ),
    },
  },
});

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGitHubPages = !!process.env.GITHUB_PAGES_BASE;

export default defineConfig({
  plugins: [react()],
  base: isGitHubPages ? "/dmosh/" : "/",
  resolve: { alias: { "@": "/src" } },
});

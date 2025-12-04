import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use jsdom for React component tests (fixes `document is not defined`)
    environment: "jsdom",

    // IMPORTANT: Don't let Vitest touch Playwright specs
    exclude: [
      "tests/e2e/**",    // ⬅️ exclude Playwright tests
      "node_modules/**",
      "dist/**",
      ".git/**",
    ],

    // Optional but nice: treat describe/it/expect as globals
    globals: true,
  },
});
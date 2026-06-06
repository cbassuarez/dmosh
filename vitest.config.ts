import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Engine tests (src/mosh) are pure and run fine in node.
    environment: "node",
    globals: true,
    exclude: ["node_modules/**", "dist/**", ".git/**"],
  },
});

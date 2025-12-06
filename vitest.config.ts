import { defineConfig } from "vitest/config";

const resizableDescriptor = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")
if (!resizableDescriptor || typeof resizableDescriptor.get !== "function") {
  Object.defineProperty(ArrayBuffer.prototype, "resizable", {
    get() {
      return false
    },
    configurable: true,
  })
}

if (typeof SharedArrayBuffer !== "undefined") {
  const sabGrowableDescriptor = Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "growable")
  if (!sabGrowableDescriptor || typeof sabGrowableDescriptor.get !== "function") {
    Object.defineProperty(SharedArrayBuffer.prototype, "growable", {
      get() {
        return false
      },
      configurable: true,
    })
  }
}

export default defineConfig({
  test: {
    // Default to jsdom for UI-heavy suites, while letting engine tests opt into node.
    environment: "./tests/vitestEnvironment.ts",
    environmentMatchGlobs: [["tests/engine/**", "node"]],

    setupFiles: ["./tests/setupVitest.ts"],
    globalSetup: "./tests/globalSetup.ts",

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

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "dm-bg": "#05060a",
        "dm-panel": "#0c0f16",
        "dm-border": "#1b1f2b",
        "dm-accent": "#4fd1c5",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        displayA: ["'DM Display A'", "system-ui", "sans-serif"],
        displayB: ["'DM Display B'", "system-ui", "sans-serif"],
        displayC: ["'DM Display C'", "system-ui", "sans-serif"],
        displayD: ["'DM Display D'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

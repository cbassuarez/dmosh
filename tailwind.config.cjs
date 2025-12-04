cd dmosh
cat > tailwind.config.cjs << 'EOF'
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
    },
  },
  plugins: [],
};
EOF


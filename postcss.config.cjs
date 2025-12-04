// postcss.config.cjs
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    // autoprefixer is optional with Tailwind v4, but this is fine:
    autoprefixer: {},
  },
};

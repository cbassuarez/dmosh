/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui'],
        mono: ['"IBM Plex Mono"', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        surface: {
          100: '#0b0b0f',
          200: '#0f1015',
          300: '#14151c',
          400: '#1a1b23',
        },
        accent: {
          DEFAULT: '#ff5135',
          soft: '#ff755f',
        },
        danger: '#ff3b3f',
        success: '#5dd39e',
        frame: '#cbd5e1',
      },
      boxShadow: {
        panel: '0 10px 30px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(255,81,53,0.4)',
      },
    },
  },
  plugins: [],
}

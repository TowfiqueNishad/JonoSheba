/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--accent)',
          secondary: 'var(--gold)',
          accent: 'var(--gold)',
        },
        nostos: {
          page: 'var(--page)',
          surface: 'var(--surface)',
          surface2: 'var(--surface-2)',
          text: 'var(--text)',
          muted: 'var(--text-muted)',
          accent: 'var(--accent)',
          gold: 'var(--gold)',
          danger: '#B3261E',
        },
      },
      fontFamily: {
        sans: ['var(--font-anek-bangla)', 'var(--font-montserrat)', 'system-ui', 'sans-serif'],
        display: ['var(--font-anek-bangla)', 'var(--font-montserrat)', 'system-ui', 'sans-serif'],
        overline: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
        editorial: ['var(--font-cormorant)', 'Georgia', 'serif'],
      },
      transitionTimingFunction: {
        nostos: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

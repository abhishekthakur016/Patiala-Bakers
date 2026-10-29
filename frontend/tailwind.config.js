/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#FBF6EE', 2: '#F4EADB', 3: '#EFE3D0' },
        paper: '#FFFDF9',
        line: { DEFAULT: '#E6D8C3', 2: '#EFE5D6' },
        ink: { DEFAULT: '#2B1A1E', 2: '#54424A' },
        mute: '#6E5A60',
        wine: { DEFAULT: '#6E1630', 2: '#5A1127', d: '#3B0B19', ink: '#2A0812' },
        gold: { DEFAULT: '#B8893B', d: '#86601C', l: '#EBD6A8', bg: '#F7EDD8' },
        ok: { DEFAULT: '#2B6638', bg: '#E4EFE1' },
        warn: { DEFAULT: '#8A5506', bg: '#FAEDD2' },
        bad: { DEFAULT: '#A12428', bg: '#F8E0DD' },
        info: { DEFAULT: '#2B5A88', bg: '#E2EBF5' },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        1: '0 1px 2px rgba(59,11,25,.06),0 2px 10px rgba(59,11,25,.05)',
        2: '0 12px 32px rgba(59,11,25,.10),0 2px 6px rgba(59,11,25,.06)',
        3: '0 30px 80px rgba(42,8,18,.28)',
      },
    },
  },
  plugins: [],
};

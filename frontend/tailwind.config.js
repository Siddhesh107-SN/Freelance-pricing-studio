export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { ink: '#111827', paper: '#faf9f6', line: '#e7e5e0', accent: { DEFAULT: '#ea580c', soft: '#fff1e8', dark: '#c2410c' } },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};

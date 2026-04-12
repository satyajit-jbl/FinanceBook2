/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#f0f4ff', 100: '#e0e9ff', 500: '#3b5bdb', 600: '#3451c7', 700: '#2c44b0', 800: '#1e3a8a', 900: '#172554' },
        surface: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1' },
        income: { light: '#dcfce7', DEFAULT: '#16a34a', dark: '#15803d' },
        expense: { light: '#fee2e2', DEFAULT: '#dc2626', dark: '#b91c1c' },
        warning: { light: '#fef9c3', DEFAULT: '#ca8a04' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
};

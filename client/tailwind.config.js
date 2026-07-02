/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        /* 온기 포인트 컬러 — 옐로우/앰버(honey) */
        brand: {
          50: '#fff9ed',
          100: '#fff2d3',
          200: '#ffe1a6',
          300: '#ffcb6e',
          400: '#ffb43a',
          500: '#f59e0b',
          600: '#d97f06',
          700: '#b45f09',
          800: '#924b0e',
          900: '#783e0f',
          950: '#451f04',
        },
        /* 라이트=따뜻한 크림/골드, 다크=포근한 웜 차콜 */
        warm: {
          50: '#fdf4e3',
          100: '#f8ebd3',
          200: '#efdcbb',
          300: '#e0c79c',
          400: '#c3a97e',
          500: '#9b8768',
          600: '#75634c',
          700: '#5b4d3c',
          800: '#493d30',
          850: '#3b322b',
          900: '#2f2823',
          950: '#26201b',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

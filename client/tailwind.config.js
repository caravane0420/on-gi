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
        /* 따뜻한 웜그레이 — 라이트 배경 & 다크모드 배경 */
        warm: {
          50: '#faf8f5',
          100: '#f4f0ea',
          200: '#e9e2d8',
          300: '#d8ccbc',
          400: '#b9a892',
          500: '#94836e',
          600: '#6f6153',
          700: '#4c433a',
          800: '#3a332d',
          850: '#2b2622',
          900: '#221e1b',
          950: '#17140f',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

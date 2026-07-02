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
        /* 따뜻한 웜그레이 — 라이트 배경 & 다크모드(포근한 웜 차콜) 배경 */
        warm: {
          50: '#faf7f2',
          100: '#f3ede4',
          200: '#e8dfd3',
          300: '#d6c8b6',
          400: '#b6a58f',
          500: '#8f7f6b',
          600: '#6b5d50',
          700: '#574b40',
          800: '#463c34',
          850: '#3a322c',
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

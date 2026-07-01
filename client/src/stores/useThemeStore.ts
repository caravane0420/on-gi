/* ================================================================
 * Theme Store — light / dark toggle for '온기(On-gi)'
 *
 * Strategy: Tailwind `darkMode: 'class'`. We toggle the `dark` class on
 * <html>. The initial value is resolved in index.html (inline script,
 * before paint) to avoid a flash; this store keeps React in sync and
 * persists the choice to localStorage.
 * ================================================================ */

import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ongi:theme';

function resolveInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    // Follow OS preference on first visit
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    /* ignore */
  }
  return 'light';
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = resolveInitialTheme();
  applyTheme(initial);

  return {
    theme: initial,

    setTheme(theme) {
      applyTheme(theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* ignore */
      }
      set({ theme });
    },

    toggleTheme() {
      get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
    },
  };
});

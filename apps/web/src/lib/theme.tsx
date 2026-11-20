'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type NostosTheme = 'night' | 'day';

const THEME_STORAGE_KEY = 'jonoshheba_nostos_theme';
const REDUCE_MOTION_KEY = 'jonoshheba_reduce_motion';

interface ThemeContextValue {
  theme: NostosTheme;
  setTheme: (next: NostosTheme) => void;
  toggleTheme: () => void;
  reducedMotion: boolean;
  setReducedMotion: (next: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'night',
  setTheme: () => undefined,
  toggleTheme: () => undefined,
  reducedMotion: false,
  setReducedMotion: () => undefined,
});

function detectInitialTheme(): NostosTheme {
  if (typeof window === 'undefined') return 'night';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'night' || saved === 'day') return saved;
  } catch {
    // ignore
  }
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6 ? 'night' : 'day';
}

function detectLowPowerOrReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = window.localStorage.getItem(REDUCE_MOTION_KEY);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
  } catch {
    // ignore
  }
  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = window.navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const lowMem = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2;
  const saveData = Boolean(nav.connection?.saveData);
  return prefersReduced || lowMem || saveData;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<NostosTheme>('night');
  const [reducedMotion, setReducedMotionState] = useState<boolean>(false);

  useEffect(() => {
    const initialTheme = detectInitialTheme();
    const initialReduced = detectLowPowerOrReducedMotion();
    setThemeState(initialTheme);
    setReducedMotionState(initialReduced);
    document.documentElement.setAttribute('data-theme', initialTheme);
    document.documentElement.setAttribute(
      'data-reduced-motion',
      initialReduced ? 'true' : 'false',
    );
  }, []);

  function applyTheme(next: NostosTheme) {
    const updateDom = () => {
      setThemeState(next);
      document.documentElement.setAttribute('data-theme', next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // ignore
      }
    };

    const docWithVT = document as Document & {
      startViewTransition?: (cb: () => void) => void;
    };
    if (!reducedMotion && typeof docWithVT.startViewTransition === 'function') {
      docWithVT.startViewTransition(updateDom);
    } else {
      updateDom();
    }
  }

  function applyReducedMotion(next: boolean) {
    setReducedMotionState(next);
    document.documentElement.setAttribute('data-reduced-motion', next ? 'true' : 'false');
    try {
      window.localStorage.setItem(REDUCE_MOTION_KEY, String(next));
    } catch {
      // ignore
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: applyTheme,
        toggleTheme: () => applyTheme(theme === 'night' ? 'day' : 'night'),
        reducedMotion,
        setReducedMotion: applyReducedMotion,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

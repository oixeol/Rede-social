'use client';

import { MoonStar, Sun } from 'lucide-react';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { IconButton } from '@/components/ui/icon-button';

const STORAGE_KEY = 'vibra-theme';

type Theme = 'light' | 'dark';

const listeners = new Set<() => void>();
let currentTheme: Theme | null = null;

function readStoredTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'light';
}

function ensureTheme(): Theme {
  if (currentTheme === null) currentTheme = readStoredTheme();
  return currentTheme;
}

function getSnapshot(): Theme {
  return ensureTheme();
}

function getServerSnapshot(): Theme {
  // The server always renders light so the first client render matches the
  // server markup and no hydration mismatch is produced.
  return 'light';
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    currentTheme = null;
    listener();
  }

  window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

function setTheme(theme: Theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === 'dark';

  useEffect(() => {
    // Apply the persisted preference once mounted and keep the document in
    // sync with the active theme.
    const applied = ensureTheme();
    document.documentElement.dataset.theme = applied;
    document.documentElement.style.colorScheme = applied;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark]);

  return (
    <IconButton
      label="Alternar tema"
      pressed={isDark}
      icon={isDark ? (
        <MoonStar className="size-[18px]" aria-hidden="true" />
      ) : (
        <Sun className="size-[18px]" aria-hidden="true" />
      )}
      onClick={toggleTheme}
    />
  );
}

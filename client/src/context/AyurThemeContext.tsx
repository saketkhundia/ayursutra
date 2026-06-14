import { createContext, useContext, useEffect, type ReactNode } from 'react';

interface ThemeContextType {
  theme: 'light';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function AyurThemeProvider({ children }: { children: ReactNode }) {
  // Hardcode theme to 'light' and remove all dark mode logic
  const theme = 'light';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  }, []);

  const toggleTheme = () => {
    console.warn('Dark mode has been disabled.');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAyurTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAyurTheme must be used within AyurThemeProvider');
  return ctx;
}

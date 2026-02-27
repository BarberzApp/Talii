import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { theme, getResolvedColors, type ColorScheme, type ResolvedColors } from '../../lib/theme';
import { getThemePreference, setThemePreference, type ThemePreference } from '../../lib/themeStorage';

interface ThemeContextType {
  theme: typeof theme;
  colors: ResolvedColors;
  colorScheme: ColorScheme;
  themePreference: ThemePreference;
  setColorScheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useSystemColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    getThemePreference().then((pref) => {
      setThemePreferenceState(pref);
    });
  }, []);

  const colorScheme: ColorScheme = useMemo(() => {
    if (themePreference === 'system') {
      return (systemColorScheme ?? 'light') === 'dark' ? 'dark' : 'light';
    }
    return themePreference;
  }, [themePreference, systemColorScheme]);

  const colors = useMemo(() => getResolvedColors(colorScheme), [colorScheme]);

  const setColorScheme = (preference: ThemePreference) => {
    setThemePreferenceState(preference);
    setThemePreference(preference);
  };

  const value = useMemo(
    () => ({
      theme,
      colors,
      colorScheme,
      themePreference,
      setColorScheme,
    }),
    [colors, colorScheme, themePreference]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

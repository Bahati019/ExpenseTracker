import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Appearance, ColorSchemeName, useColorScheme as useRNColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { light, dark, ThemeColors } from '../theme';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  theme: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = '@app_theme_mode';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const hookScheme = useRNColorScheme();
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() || hookScheme || 'light'
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  // Actively track device Appearance changes
  useEffect(() => {
    const current = Appearance.getColorScheme();
    if (current) {
      setSystemScheme(current);
    }

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) {
        setSystemScheme(colorScheme);
      }
    });

    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, []);

  // Update when React Native hook changes
  useEffect(() => {
    if (hookScheme) {
      setSystemScheme(hookScheme);
    }
  }, [hookScheme]);

  // Restore stored preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeModeState(stored as ThemeMode);
        }
      } catch (e) {
        console.warn('Failed to load theme preference', e);
      }
    };
    loadTheme();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }
  };

  const activeSystem = systemScheme || hookScheme || Appearance.getColorScheme() || 'light';
  const isDark = themeMode === 'system' ? activeSystem === 'dark' : themeMode === 'dark';
  const theme = isDark ? dark : light;

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDark, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    const systemScheme = Appearance.getColorScheme() || 'light';
    const isDark = systemScheme === 'dark';
    return {
      themeMode: 'system' as ThemeMode,
      setThemeMode: () => {},
      isDark,
      theme: isDark ? dark : light,
    };
  }
  return context;
};

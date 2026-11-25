import { useColorScheme } from 'react-native';

export interface ThemeColors {
  background: string;
  card: string;
  cardSecondary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  inputBackground: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  shadow: string;
}

export const light: ThemeColors = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  cardSecondary: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  inputBackground: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  primary: '#4F46E5', // Rich Indigo
  primaryDark: '#4338CA',
  primaryLight: '#EEF2FF',
  accent: '#06B6D4',
  success: '#10B981',
  successBg: '#ECFDF5',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  shadow: '#0F172A',
};

export const dark: ThemeColors = {
  background: '#0B0F19',
  card: '#161F30',
  cardSecondary: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  inputBackground: '#1E293B',
  border: '#2A374D',
  borderLight: '#1E293B',
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#1E1B4B',
  accent: '#22D3EE',
  success: '#34D399',
  successBg: '#064E3B',
  warning: '#FBBF24',
  warningBg: '#78350F',
  danger: '#F87171',
  dangerBg: '#451A1A',
  shadow: '#000000',
};

export interface CategoryMeta {
  name: string;
  icon: string;
  color: string;
  lightBg: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { name: 'Food', icon: 'fast-food', color: '#EF4444', lightBg: '#FEE2E2' },
  { name: 'Transport', icon: 'car', color: '#3B82F6', lightBg: '#DBEAFE' },
  { name: 'Utilities', icon: 'flash', color: '#F59E0B', lightBg: '#FEF3C7' },
  { name: 'Rent & Housing', icon: 'home', color: '#0EA5E9', lightBg: '#E0F2FE' },
  { name: 'Entertainment', icon: 'film', color: '#10B981', lightBg: '#D1FAE5' },
  { name: 'Others', icon: 'grid', color: '#8B5CF6', lightBg: '#EDE9FE' },
];

export const CATEGORY_MAP: Record<string, CategoryMeta> = CATEGORIES.reduce((acc, cat) => {
  acc[cat.name] = cat;
  return acc;
}, {} as Record<string, CategoryMeta>);

export const getCategoryMeta = (name?: string): CategoryMeta => {
  if (name && CATEGORY_MAP[name]) {
    return CATEGORY_MAP[name];
  }
  return {
    name: name || 'Others',
    icon: 'grid',
    color: '#8B5CF6',
    lightBg: '#EDE9FE',
  };
};

/**
 * Robust currency formatter for KES (e.g. KES 12,500.00)
 */
export const formatCurrency = (amount: number = 0): string => {
  const parts = Math.abs(amount).toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = amount < 0 ? '-' : '';
  return `${sign}KES ${parts.join('.')}`;
};

/**
 * Compact currency formatter (e.g. KES 12.5k)
 */
export const formatCurrencyCompact = (amount: number = 0): string => {
  if (Math.abs(amount) >= 1_000_000) {
    return `KES ${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `KES ${(amount / 1_000).toFixed(1)}k`;
  }
  return formatCurrency(amount);
};

/**
 * Standard theme hook using ThemeContext if available, falling back to useColorScheme()
 */
export const useThemeColors = (): ThemeColors => {
  try {
    // Dynamic import avoidance; will delegate to useTheme from context/ThemeContext
    const { useTheme } = require('../context/ThemeContext');
    const { theme } = useTheme();
    if (theme) return theme;
  } catch {
    // fallback
  }
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
};

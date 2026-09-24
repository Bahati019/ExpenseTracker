import { useColorScheme } from 'react-native';

const light = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  inputBackground: '#F1F5F9',
  border: '#E2E8F0',
  primary: '#6366F1',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
};

const dark = {
  background: '#0F172A',
  card: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  inputBackground: '#334155',
  border: '#334155',
  primary: '#818CF8',
  danger: '#F87171',
  dangerBg: '#451A1A',
};

export const useThemeColors = () => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
};

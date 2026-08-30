import { useColorScheme } from 'react-native';

export const palette = {
  indigo: '#5B3FD9',
  indigoSoft: '#8B74F2',
  ink: '#1A1328',
};

export const lightTheme = {
  bg: '#F6F4FB',
  card: '#FFFFFF',
  text: '#1A1328',
  muted: '#6B6280',
  border: '#E6E1F2',
  accent: '#5B3FD9',
  accentSoft: '#EDE8FF',
  danger: '#C63B54',
  success: '#2F9E6E',
  quiet: '#9B93B0',
};

export const darkTheme = {
  bg: '#120F1A',
  card: '#1C1826',
  text: '#F4F0FF',
  muted: '#9B93B0',
  border: '#2C2740',
  accent: '#8B74F2',
  accentSoft: '#2A2244',
  danger: '#F07187',
  success: '#4CC38A',
  quiet: '#6B6280',
};

export type Theme = typeof lightTheme;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

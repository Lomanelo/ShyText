import { Platform, TextStyle, useColorScheme } from 'react-native';

const displayFace = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

/** Exact colors sampled from assets/images/icon.png */
export const palette = {
  cream: '#FCF3E8',
  flame: '#D05927',
  rust: '#993818',
};

export const space = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  24: 24,
  32: 32,
  48: 48,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const type = {
  display: {
    fontFamily: displayFace,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '400',
    letterSpacing: -0.4,
  } satisfies TextStyle,
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2 } satisfies TextStyle,
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' } satisfies TextStyle,
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' } satisfies TextStyle,
};

export const motion = {
  press: 0.96,
  duration: 150,
} as const;

export const lightTheme = {
  bg: palette.cream,
  card: '#FFFFFF',
  text: palette.rust,
  muted: '#8A5A3C',
  border: '#E8D4C4',
  accent: palette.flame,
  accentSoft: '#F6E0D4',
  danger: '#B42318',
  success: '#2F7A4A',
  quiet: '#B08970',
  shadow: palette.rust,
  imageOutline: 'rgba(0,0,0,0.10)',
};

export const darkTheme = {
  bg: '#1A0E0A',
  card: '#2A1814',
  text: palette.cream,
  muted: '#C9A892',
  border: '#3D241C',
  accent: palette.flame,
  accentSoft: '#3A1C12',
  danger: '#F07187',
  success: '#4CC38A',
  quiet: '#8A5A3C',
  shadow: '#000000',
  imageOutline: 'rgba(255,255,255,0.10)',
};

export type Theme = typeof lightTheme;

export function cardShadow(theme: Theme) {
  return Platform.select({
    ios: {
      shadowColor: theme.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 3 },
    default: {},
  });
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

import { ColorValue, Platform, TextStyle, useColorScheme } from 'react-native';
import { Color } from 'expo-router';

/** Logo flame. The only brand hex; everything else is a system semantic color. */
export const brand = {
  accent: '#D05927',
  onAccent: '#FFFFFF',
} as const;

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
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: 0.37,
  } satisfies TextStyle,
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: 0.35 } satisfies TextStyle,
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' } satisfies TextStyle,
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' } satisfies TextStyle,
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' } satisfies TextStyle,
};

export const motion = {
  press: 0.96,
  duration: 150,
} as const;

export const shadows = {
  card: '0 8px 24px rgba(28, 18, 14, 0.08)',
} as const;

export type Theme = {
  bg: ColorValue;
  card: ColorValue;
  text: ColorValue;
  muted: ColorValue;
  quiet: ColorValue;
  border: ColorValue;
  accent: string;
  accentSoft: string;
  danger: ColorValue;
  success: ColorValue;
  onAccent: string;
  imageOutline: string;
};

function semanticTheme(): Theme {
  return {
    bg: Platform.select({
      ios: Color.ios.systemGroupedBackground,
      android: Color.android.dynamic.background,
      default: '#F2EDE6',
    })!,
    card: Platform.select({
      ios: Color.ios.secondarySystemGroupedBackground,
      android: Color.android.dynamic.surfaceContainer,
      default: '#FFFFFF',
    })!,
    text: Platform.select({
      ios: Color.ios.label,
      android: Color.android.dynamic.onSurface,
      default: '#1C120E',
    })!,
    muted: Platform.select({
      ios: Color.ios.secondaryLabel,
      android: Color.android.dynamic.onSurfaceVariant,
      default: '#6B5344',
    })!,
    quiet: Platform.select({
      ios: Color.ios.tertiaryLabel,
      android: Color.android.dynamic.outline,
      default: '#8A735F',
    })!,
    border: Platform.select({
      ios: Color.ios.separator,
      android: Color.android.dynamic.outlineVariant,
      default: '#E4D6C8',
    })!,
    accent: brand.accent,
    accentSoft: 'rgba(208, 89, 39, 0.14)',
    danger: Platform.select({
      ios: Color.ios.systemRed,
      android: Color.android.dynamic.error,
      default: '#B42318',
    })!,
    success: Platform.select({
      ios: Color.ios.systemGreen,
      android: Color.android.dynamic.primary,
      default: '#2F7A4A',
    })!,
    onAccent: brand.onAccent,
    imageOutline: 'rgba(0,0,0,0.10)',
  };
}

export function cardShadow(_theme?: Theme) {
  return { boxShadow: shadows.card };
}

export function useTheme(): Theme {
  useColorScheme();
  return semanticTheme();
}

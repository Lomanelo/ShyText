// ShyText app theme colors and styles

// Colors
export const colors = {
  // Background colors
  background: '#f9f1e7',
  card: '#ffffff',
  
  // Text colors
  text: {
    primary: '#222222',
    secondary: '#666666',
    tertiary: '#999999',
    light: '#ffffff',
    accent: '#c45c26',
    error: '#FF4444',
  },
  
  // UI element colors
  ui: {
    primary: '#222222',
    secondary: '#f2f2f2',
    accent: '#c45c26',
    success: '#4CAF50',
    error: '#FF4444',
    warning: '#FFAA00',
    ghost: '#ddd',
  },
  
  // Shadow
  shadow: {
    color: '#000000',
    opacity: 0.1,
  },
};

// Typography
export const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 24,
    title: 32,
    header: 48,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

// Spacing
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Border radius
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 25,
  pill: 999,
  circle: 999,
};

// Shadows
export const shadows = {
  small: {
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: colors.shadow.opacity,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: colors.shadow.opacity + 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  large: {
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: colors.shadow.opacity + 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Theme object
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
};

export default theme; 
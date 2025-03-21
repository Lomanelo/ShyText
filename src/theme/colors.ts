// App color palette based on black and white logo
const colors = {
  // Primary colors
  primary: '#000000', // Black (from logo)
  primaryGradientEnd: '#333333', // Darker shade for gradients
  background: '#FFFFFF', // White background
  text: '#000000', // Black text for light mode
  
  // Secondary/utility colors
  lightGray: '#F5F5F5', // For backgrounds, cards, etc.
  mediumGray: '#E0E0E0', // For borders, dividers
  darkGray: '#707070', // For secondary text
  error: '#E53935', // For error messages (dark red)
  success: '#43A047', // For success messages (dark green)
  warning: '#FFA000', // For warning messages
  
  // Variants of the primary color
  primaryLight: '#333333', // Dark gray as lighter version
  primaryDark: '#000000', // Black
  
  // Transparent versions for overlays
  transparentBlack: 'rgba(0, 0, 0, 0.7)',
  transparentPrimary: 'rgba(0, 0, 0, 0.1)',
};

export default colors; 
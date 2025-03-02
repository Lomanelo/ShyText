import { StyleSheet } from 'react-native';
import colors from '../../theme/colors';

// New color palette
const COLORS = {
  cream: '#F9F1E7', // Light cream/beige
  teal: '#1B93AD',  // Teal/turquoise
  lightTeal: '#8ECADA', // Lighter teal for accents
  darkCream: '#E5DDD3', // Darker cream for borders
  white: '#FFFFFF',
  black: '#333333',
};

export const styles = StyleSheet.create({
  // Main container
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: colors.background,
  },
  
  // Circular background
  radarBackground: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 1000, // Large value ensures circle
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.mediumGray,
    backgroundColor: colors.background,
  },
  
  // Current user (center of radar)
  currentUserContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  
  // User bubble styles
  userBubbleContainer: {
    alignItems: 'center',
    zIndex: 5,
  },
  
  userBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 2,
    borderColor: colors.background,
  },
  
  userPhoto: {
    width: '100%',
    height: '100%',
  },
  
  userPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  
  userInitial: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: 20,
  },
  
  // Current user indicator
  currentUserIndicator: {
    position: 'absolute',
    bottom: -5,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0,
  },
  
  currentUserText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '500',
  },
}); 
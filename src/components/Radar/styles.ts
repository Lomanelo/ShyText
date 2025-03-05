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
    aspectRatio: 1,
    borderRadius: 1000, // Large value ensures circle
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible', // Allow bubbles to slightly overflow
    borderWidth: 1,
    borderColor: colors.mediumGray,
    backgroundColor: colors.lightGray,
    position: 'relative', // Ensures absolute positioning of children works correctly
  },
  
  // Current user (center of radar)
  currentUserContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20, // Ensure it's above other users
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6, // Increased elevation for better shadow on Android
    borderWidth: 2,
    borderColor: colors.background,
  },
  
  userPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.lightGray, // Background color while image loads
    resizeMode: 'cover', // Ensure image fills the container
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
    bottom: -15, // Move further down
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.background,
    zIndex: 21, // Ensure it's above the user bubble
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  
  currentUserText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
}); 
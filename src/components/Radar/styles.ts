import { StyleSheet } from 'react-native';
import colors from '../../theme/colors';

// Refined color palette to match Dribbble reference
const COLORS = {
  background: '#F7F7F7',
  teal: '#333333',       // Brighter teal to match Dribbble
  white: '#FFFFFF',
  lightGray: '#F0F0F0',
  mediumGray: '#E5E5E5',
  darkGray: '#888888',
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
  
  // Current user section at the top
  currentUserSection: {
    alignItems: 'center',
    marginBottom: 25,
    width: '100%',
  },
  
  // Current user label
  currentUserLabel: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    letterSpacing: 0.3,
    textAlign: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
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
    marginTop: 10, // Add some space from the current user
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    borderRadius: 1000, // Make it circular
    overflow: 'hidden', // Ensure image stays within bounds
    backgroundColor: colors.primary,
  },
  
  userPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 1000, // Make image circular
  },
  
  userPlaceholder: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    borderRadius: 1000, // Make placeholder circular
  },
  
  userInitial: {
    color: colors.background,
    fontSize: 20,
    fontWeight: 'bold',
  },
  
  currentUserIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
    zIndex: 2,
  },
  
  currentUserText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  
  // User name below bubble
  userName: {
    position: 'absolute',
    bottom: -20,
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
    width: 60,
    textAlign: 'center',
  },
}); 
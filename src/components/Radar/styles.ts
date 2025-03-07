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
  
  // Drop target in the center
  dropTarget: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  
  // Active drop target (highlighted when something is being dragged)
  dropTargetActive: {
    backgroundColor: 'rgba(200, 240, 255, 0.95)',
    borderColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  
  // Drop target icon (plus sign)
  dropTargetIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  
  // Drop target text (plus sign)
  dropTargetText: {
    fontSize: 32,
    color: colors.primary,
    fontWeight: 'bold',
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
  
  // Concentric circles
  radarCircle: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.5)',
    borderRadius: 1000,
  },
  
  // Message composition area
  messageComposer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    zIndex: 100,
  },
  
  messageInput: {
    backgroundColor: colors.lightGray,
    borderRadius: 20,
    padding: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
  },
  
  sendButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 
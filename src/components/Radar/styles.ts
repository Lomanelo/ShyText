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
  
  // Drop target indicator that appears when dragging
  dropTargetIndicator: {
    position: 'absolute',
    bottom: -30,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  
  // Text for drop indicator
  dropTargetIndicatorText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Highlighted drop target during dragging
  highlightedDropTarget: {
    backgroundColor: 'rgba(230, 250, 255, 0.95)',
    borderWidth: 3,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 10,
    transform: [{ scale: 1.05 }]
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  
  // Message header with recipient
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  
  // Message recipient container
  messageRecipient: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // "To:" label
  messageTo: {
    fontSize: 16,
    color: colors.darkGray,
    fontWeight: '500',
  },
  
  // Recipient name
  messageRecipientName: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    marginLeft: 4,
  },
  
  // Cancel button
  cancelButton: {
    padding: 5,
  },
  
  // Message input field
  messageInput: {
    backgroundColor: colors.lightGray,
    borderRadius: 20,
    padding: 12,
    paddingHorizontal: 16,
    paddingRight: 50, // Make room for the send button
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
    minHeight: 50,
  },
  
  // Send button
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
  
  // Disabled send button
  sendButtonDisabled: {
    opacity: 0.6,
  },

  // Modal overlay for the message input
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Message modal container
  messageModal: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    width: '90%',
    maxWidth: 340, // Narrower modal
    paddingTop: 45, // Reduced padding to bring content closer together
    paddingBottom: 15,
    paddingHorizontal: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    position: 'relative',
  },

  // Message modal header
  messageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start', // Changed from center to flex-start to align name to the left
    alignItems: 'center',
    marginBottom: 15, // Slightly reduced to bring text input closer
    position: 'relative',
    marginLeft: 85, // Add left margin to make space for the photo
  },

  // Message modal title
  messageModalTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: COLORS.black,
    textAlign: 'left', // Changed from center to left
  },

  // Close button for modal - positioned at top right
  closeButton: {
    position: 'absolute',
    right: -5,
    top: -5,
    padding: 8,
  },

  // User profile picture in message modal
  messageUserProfileContainer: {
    position: 'absolute',
    top: -35, // Adjusted to position it better
    left: 15,
    width: 85, // Increased size from 75 to 85
    height: 85, // Increased size from 75 to 85
    borderRadius: 42.5, // Half of width/height
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },

  // User profile image
  messageUserProfile: {
    width: '100%',
    height: '100%',
    borderRadius: 42.5, // Half of container width/height
  },

  // User profile fallback (for when image is not available)
  messageUserProfileFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 42.5, // Half of container width/height
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // User profile fallback text
  messageUserProfileFallbackText: {
    color: COLORS.white,
    fontSize: 32, // Larger text for the bigger container
    fontWeight: 'bold',
  },

  // Message input in modal - light gray like in second image
  messageModalInput: {
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    padding: 15,
    fontSize: 16,
    color: COLORS.black,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 5, // Added small margin to separate from header
    marginBottom: 10,
  },
}); 
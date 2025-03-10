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
  
  // Drop target indicator that appears when dragging
  dropTargetIndicator: {
    position: 'absolute',
    bottom: -30,
    backgroundColor: 'rgba(0, 173, 181, 0.9)',
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
    backgroundColor: colors.lightGray,
    borderWidth: 1,
    borderColor: colors.mediumGray,
  },

  // Modal overlay for the message input
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Message modal container
  messageModal: {
    backgroundColor: colors.background,
    borderRadius: 15,
    width: '90%',
    maxWidth: 400,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  // Message modal header
  messageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  // Message modal title
  messageModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },

  // Close button for modal
  closeButton: {
    padding: 5,
  },

  // Message input in modal
  messageModalInput: {
    backgroundColor: colors.lightGray,
    borderRadius: 15,
    padding: 15,
    fontSize: 16,
    color: colors.text,
    minHeight: 120,
    maxHeight: 200,
    textAlignVertical: 'top',
    marginBottom: 15,
  },

  // Message modal footer
  messageModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  // Send message button
  sendMessageButton: {
    backgroundColor: colors.primary,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Send message button text
  sendMessageButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 5,
  },
}); 
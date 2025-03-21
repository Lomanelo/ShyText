import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Dimensions, Platform, Animated, TextInput, TouchableOpacity, Text, Modal, Image, Keyboard, TouchableWithoutFeedback, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserBubble from './UserBubble';
import { styles } from './styles';
import colors from '../../theme/colors';
import VerifiedBadge from '../VerifiedBadge';

// Access the COLORS object from styles for consistency
const { teal, white, darkGray } = {
  teal: '#00BFD1',
  white: '#FFFFFF',
  darkGray: '#888888'
};

const { width, height } = Dimensions.get('window');
const RADAR_SIZE = width * 0.9; // 90% of screen width
const BUBBLE_SIZE = 60; // Increased bubble size for better visibility
const MIN_DISTANCE = BUBBLE_SIZE * 1.8; // Further increased minimum distance between bubbles
const CENTER_BUFFER = 100; // Buffer around center to prevent overlapping with current user
const DROP_TARGET_SIZE = 70; // Smaller visual circle with the plus icon
const DRAG_THRESHOLD = 120; // Distance from center to trigger a successful drop

interface RadarProps {
  users: Array<{
    id: string;
    display_name?: string;
    photo_url?: string;
    status?: string;
    lastActive?: string;
    is_verified?: boolean;
    mac_address?: string;
    [key: string]: any;
  }>;
  currentUser: {
    id: string;
    photo_url?: string;
    display_name?: string;
    is_verified?: boolean;
  };
  maxDistance: number; // Maximum distance in meters
  onUserPress: (userId: string) => void;
  onMessageSend?: (userId: string, message: string) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

// Interface for fixed position
interface SlotPosition {
  x: number;
  y: number;
  userId?: string;
}

// Define user position type
interface UserPositions {
  [key: string]: SlotPosition;
}

// Interface for a user's birth date logic 
const calculateAge = (birthDate: string) => {
  if (!birthDate) return null;
  
  try {
    const birthDateObj = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }
    
    return age;
  } catch (e) {
    console.error('Error calculating age:', e);
    return null;
  }
};

const Radar = ({ users, currentUser, maxDistance, onUserPress, onMessageSend, onDragStateChange }: RadarProps) => {
  // State for handling drag-and-drop messaging
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<TextInput>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedUser, setDraggedUser] = useState<any>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [userPositions, setUserPositions] = useState<UserPositions>({});
  const [showProfileModal, setShowProfileModal] = useState(false);
  const modalOpenTimeRef = useRef(Date.now());
  
  // Update modal open time when showing any modal
  useEffect(() => {
    if (showProfileModal || showMessageInput) {
      modalOpenTimeRef.current = Date.now();
    }
  }, [showProfileModal, showMessageInput]);
  
  // Calculate the radar center coordinates
  const centerX = RADAR_SIZE / 2;
  const centerY = RADAR_SIZE / 2;
  
  // Clear states when users change
  useEffect(() => {
    // Only reset these states when users array actually changes identity
    // Don't reset during normal rerenders
    if (draggedUserId) {
      return; // Don't reset if we're currently showing the modal
    }
    
    setDraggedUserId(null);
    setShowMessageInput(false);
    setMessage('');
    setIsDragging(false);
    setDraggedUser(null);
  }, [users]);
  
  // Add keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  // Get fixed slot positions
  const getFixedSlotPositions = (): SlotPosition[] => {
    const slots: SlotPosition[] = [];
    const numSlots = 10; // Number of fixed positions
    const radius = RADAR_SIZE * 0.35; // 35% of radar size for a nice circle
    
    for (let i = 0; i < numSlots; i++) {
      // Calculate angle for evenly distributed points around a circle
      // Starting from the top (270 degrees or -90 degrees) and going clockwise
      // We're using -90 degrees (top of the circle) as the starting point
      const angle = ((i * 2 * Math.PI) / numSlots) - Math.PI/2;
      
      // Convert polar coordinates to cartesian
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      slots.push({ x, y });
    }
    
    return slots;
  };
  
  // Calculate positions for each user with sorting by lastActive
  const calculatePositions = (): UserPositions => {
    // Sort users by lastActive (most recent first)
    const sortedUsers = [...users].sort((a, b) => {
      const timeA = a.lastActive ? new Date(a.lastActive).getTime() : 0;
      const timeB = b.lastActive ? new Date(b.lastActive).getTime() : 0;
      return timeB - timeA;
    });
    
    // Limit to 10 users maximum (the number of available slots)
    const usersToDisplay = sortedUsers.slice(0, 10);
    
    // Get the fixed slot positions
    const fixedSlots = getFixedSlotPositions();
    
    // Assign users to slots based on recency
    const positions: UserPositions = {};
    
    usersToDisplay.forEach((user, index) => {
      // Assign this user to the corresponding fixed slot
      if (index < fixedSlots.length) {
        positions[user.id] = {
          ...fixedSlots[index],
          userId: user.id
        };
      }
    });
    
    return positions;
  };
  
  // Calculate user positions once when users array changes or window resizes
  // Memoize the positions to prevent unnecessary recalculations
  const memoizedPositions = useMemo(() => calculatePositions(), [users, width, height]);
  
  // Use a state update only when the memoized positions change
  useEffect(() => {
    setUserPositions(memoizedPositions);
  }, [memoizedPositions]);
  
  // Define the center point for dragging to
  const dropCenterPoint = useMemo(() => ({
    x: centerX,
    y: centerY
  }), [centerX, centerY]);
  
  // Handle when a user is dragged and dropped on the center target
  const handleUserDragRelease = (userId: string, dropSuccess: boolean) => {
    console.log(`User ${userId} dropped with success: ${dropSuccess}`);
    
    // Only show profile UI when properly dropped on center
    if (dropSuccess) {
      console.log("Drop success detected! Showing profile modal for user:", userId);
      // Find the user data for the dropped user
      const user = users.find(u => u.id === userId);
      setDraggedUser(user);
      setDraggedUserId(userId);
      
      // Show the profile modal instead of message input
      setTimeout(() => {
        setShowProfileModal(true);
      }, 100);
    } else {
      console.log("Drop was NOT successful, NOT showing profile modal");
      // Ensure modals are NOT shown for unsuccessful drops
      setShowProfileModal(false);
      setShowMessageInput(false);
      setDraggedUser(null);
      setDraggedUserId(null);
    }
    
    setIsDragging(false);
    // Notify parent component that dragging has ended
    if (onDragStateChange) {
      onDragStateChange(false);
    }
  };
  
  // Handle user drag start
  const handleDragStart = () => {
    setIsDragging(true);
    if (onDragStateChange) {
      onDragStateChange(true);
    }
  };
  
  // Handle send message button
  const handleSendMessage = () => {
    if (message.trim() !== '' && draggedUserId && onMessageSend) {
      onMessageSend(draggedUserId, message);
      setMessage('');
      setShowMessageInput(false);
      setDraggedUserId(null);
      setDraggedUser(null);
    }
  };
  
  // Handle cancel message
  const handleCancelMessage = () => {
    setShowMessageInput(false);
    setMessage('');
    setDraggedUserId(null);
    setDraggedUser(null);
  };
  
  // Handle background tap (dismiss if tapped outside the modal)
  const handleBackgroundTap = (event: GestureResponderEvent) => {
    // Don't dismiss if keyboard is visible or if we just opened the modal
    if (isKeyboardVisible) {
      return;
    }
    
    // Small delay to prevent accidental dismissal right after opening
    if (Date.now() - modalOpenTimeRef.current < 300) {
      return;
    }
    
    // Only cancel if we actually have a modal showing
    if (showMessageInput) {
      handleCancelMessage();
    } else if (showProfileModal) {
      handleCloseProfile();
    }
  };
  
  // Handle closing the profile modal
  const handleCloseProfile = () => {
    setShowProfileModal(false);
    setDraggedUser(null);
    setDraggedUserId(null);
  };
  
  // Show message composer from profile modal
  const handleOpenMessageFromProfile = () => {
    setShowProfileModal(false);
    setTimeout(() => {
      setShowMessageInput(true);
      // Focus the input after a small delay
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 150);
    }, 100);
  };
  
  return (
    <View style={styles.container}>
      {/* Current User (Top) */}
      <View style={styles.currentUserSection}>
        <UserBubble
          user={{
            id: currentUser.id,
            display_name: currentUser.display_name || 'You',
            photo_url: currentUser.photo_url,
            isCurrentUser: true,
            is_verified: currentUser.is_verified
          }}
          onPress={() => {}}
          size={BUBBLE_SIZE * 1.4} // Make the bubble significantly bigger
        />
      </View>
      
      {/* Radar Area - simplified without concentric circles */}
      <View style={[styles.radarBackground, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
        {/* Drop target in center */}
        <View style={styles.currentUserContainer}>
          <UserBubble
            user={{
              id: 'drop-target',
              display_name: '+',
              isDropTarget: true,
            }}
            isDropTarget={true}
            onPress={() => {}}
            size={DROP_TARGET_SIZE}
            centerPoint={{ x: centerX, y: centerY }}
            style={isDragging ? 
              { ...styles.highlightedDropTarget, transform: [{ scale: 1.1 }] } : 
              styles.highlightedDropTarget}
          />
        </View>
        
        {/* Nearby Users */}
        {Object.entries(userPositions).map(([userId, position]) => {
          // Find the user data based on userId
          const userData = users.find(u => u.id === userId);
          if (!userData) return null;
          
          return (
            <UserBubble
              key={userId}
              user={userData}
              onPress={() => onUserPress(userId)}
              onDragRelease={handleUserDragRelease}
              onDragStart={handleDragStart}
              draggable={true}
              centerPoint={dropCenterPoint}
              style={{
                position: 'absolute',
                left: position.x - (BUBBLE_SIZE / 2), // Half of bubble size
                top: position.y - (BUBBLE_SIZE / 2),
                zIndex: 5, // Ensure bubbles appear above radar background
              }}
              size={BUBBLE_SIZE}
            />
          );
        })}
      </View>
      
      {/* User Profile Modal */}
      <Modal
        visible={showProfileModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseProfile}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.profileModal}>
            {/* Full Profile Photo */}
            <View style={styles.fullProfileImageContainer}>
              {draggedUser?.photo_url ? (
                <Image
                  source={{ uri: draggedUser.photo_url }}
                  style={styles.fullProfileImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.fullProfileImagePlaceholder}>
                  <Text style={styles.fullProfileImagePlaceholderText}>
                    {draggedUser?.display_name?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              
              {/* Age overlay on photo */}
              {draggedUser?.birth_date && (
                <View style={styles.ageContainer}>
                  <Text style={styles.ageText}>
                    {calculateAge(draggedUser.birth_date)}
                  </Text>
                </View>
              )}
              
              {/* Verification badge on photo */}
              {draggedUser?.is_verified && (
                <View style={styles.profileVerificationBadge}>
                  <VerifiedBadge 
                    isVerified={true} 
                    size="large"
                  />
                </View>
              )}
              
              {/* Close Button */}
              <TouchableOpacity 
                style={styles.closeProfileButton}
                onPress={handleCloseProfile}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {/* Message input below profile */}
            <View style={styles.profileMessageInputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.profileMessageInput}
                placeholder="Message ..."
                placeholderTextColor="#999"
                value={message}
                onChangeText={setMessage}
                multiline={false}
                maxLength={500}
                returnKeyType="send"
                blurOnSubmit={true}
                onSubmitEditing={() => {
                  if (message.trim() !== '' && draggedUserId && onMessageSend) {
                    onMessageSend(draggedUserId, message);
                    setMessage('');
                    setShowProfileModal(false);
                    setDraggedUserId(null);
                    setDraggedUser(null);
                  }
                }}
              />
              
              <TouchableOpacity 
                style={[
                  styles.profileSendButton,
                  !message.trim() && styles.profileSendButtonDisabled
                ]}
                onPress={() => {
                  if (message.trim() !== '' && draggedUserId && onMessageSend) {
                    onMessageSend(draggedUserId, message);
                    setMessage('');
                    setShowProfileModal(false);
                    setDraggedUserId(null);
                    setDraggedUser(null);
                  }
                }}
                disabled={!message.trim()}
              >
                <Ionicons name="send" size={20} color={message.trim() ? colors.background : "#999"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Message Input Modal - centered on screen */}
      <Modal
        visible={showMessageInput}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelMessage}
      >
        <TouchableWithoutFeedback onPress={handleBackgroundTap}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.messageModal}>
                {/* User Profile Image - Positioned to overlap from the left */}
                {draggedUser && (
                  <View style={styles.messageUserProfileContainer}>
                    {draggedUser.photo_url ? (
                      <Image
                        source={{ uri: draggedUser.photo_url }}
                        style={styles.messageUserProfile}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.messageUserProfileFallback}>
                        <Text style={styles.messageUserProfileFallbackText}>
                          {draggedUser.display_name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                
                <View style={styles.messageModalHeader}>
                  {draggedUser && (
                    <Text style={styles.messageModalTitle}>
                      {draggedUser.display_name || ''}
                    </Text>
                  )}
                  <TouchableOpacity 
                    onPress={handleCancelMessage} 
                    style={styles.closeButton}
                    hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <Text style={{fontSize: 20, color: '#999', fontWeight: '300'}}>×</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  ref={inputRef}
                  style={styles.messageModalInput}
                  placeholder={`Hey ${draggedUser?.display_name || 'there'}, I would like to chat...`}
                  placeholderTextColor="#BBBBBB"
                  value={message}
                  onChangeText={setMessage}
                  multiline={true}
                  maxLength={500}
                  autoFocus
                  returnKeyType="send"
                  blurOnSubmit={true}
                  onSubmitEditing={() => {
                    if (message.trim() !== '') {
                      handleSendMessage();
                    }
                  }}
                />

                {/* Add Send Button for better UX */}
                <TouchableOpacity 
                  style={[
                    styles.modalSendButton,
                    !message.trim() && styles.modalSendButtonDisabled
                  ]}
                  onPress={handleSendMessage}
                  disabled={!message.trim()}
                >
                  <Text style={[
                    styles.modalSendButtonText,
                    !message.trim() && styles.modalSendButtonTextDisabled
                  ]}>
                    Send
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default Radar; 
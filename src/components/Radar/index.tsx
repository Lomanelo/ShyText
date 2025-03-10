import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Dimensions, Platform, Animated, TextInput, TouchableOpacity, Text, Modal, Image, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserBubble from './UserBubble';
import { styles } from './styles';
import colors from '../../theme/colors';

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
    distance: number;
    display_name?: string;
    photo_url?: string;
    [key: string]: any;
  }>;
  currentUser: {
    id: string;
    photo_url?: string;
    display_name?: string;
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
  
  // Calculate the radar center coordinates
  const centerX = RADAR_SIZE / 2;
  const centerY = RADAR_SIZE / 2;
  
  // Clear states when users change
  useEffect(() => {
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
  
  // Calculate positions for each user with sorting by distance
  const calculatePositions = (): UserPositions => {
    // Sort users by distance (closest first)
    const sortedUsers = [...users].sort((a, b) => a.distance - b.distance);
    
    // Limit to 10 users maximum (the number of available slots)
    const usersToDisplay = sortedUsers.slice(0, 10);
    
    // Get the fixed slot positions
    const fixedSlots = getFixedSlotPositions();
    
    // Assign users to slots based on proximity
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
  useEffect(() => {
    const newPositions = calculatePositions();
    setUserPositions(newPositions);
  }, [users, width, height]);
  
  // Define the center point for dragging to
  const dropCenterPoint = useMemo(() => ({
    x: centerX,
    y: centerY
  }), [centerX, centerY]);
  
  // Handle when a user is dragged and dropped on the center target
  const handleUserDragRelease = (userId: string, dropSuccess: boolean) => {
    console.log(`User ${userId} dropped with success: ${dropSuccess}`);
    
    // Only show message UI when properly dropped on center
    if (dropSuccess) {
      console.log("Drop success detected! Showing message input for user:", userId);
      // Find the user data for the dropped user
      const user = users.find(u => u.id === userId);
      setDraggedUser(user);
      setDraggedUserId(userId);
      setShowMessageInput(true);
      
      // Focus the input after a small delay to ensure the UI has updated
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    } else {
      console.log("Drop was NOT successful, NOT showing message input");
      // Ensure message input is NOT shown for unsuccessful drops
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
  
  // Handle sending a message
  const handleSendMessage = () => {
    if (draggedUserId && message.trim() !== '' && onMessageSend) {
      onMessageSend(draggedUserId, message);
      setShowMessageInput(false);
      setDraggedUserId(null);
      setMessage('');
      setDraggedUser(null);
    }
  };
  
  // Handle canceling message input
  const handleCancelMessage = () => {
    setShowMessageInput(false);
    setDraggedUserId(null);
    setMessage('');
    setDraggedUser(null);
  };
  
  // Handle background tap
  const handleBackgroundTap = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
    } else {
      handleCancelMessage();
    }
  };
  
  // Draw concentric circles to indicate distance
  const renderConcentricCircles = () => {
    const circles = [];
    const numCircles = 3; // Number of concentric circles
    
    for (let i = 1; i <= numCircles; i++) {
      const size = (RADAR_SIZE * i) / numCircles;
      circles.push(
        <View
          key={`circle-${i}`}
          style={[
            styles.radarCircle,
            {
              width: size,
              height: size,
              left: (RADAR_SIZE - size) / 2,
              top: (RADAR_SIZE - size) / 2,
            },
          ]}
        />
      );
    }
    
    return circles;
  };
  
  // Add a special effect to preserve modal state during user/location updates
  useEffect(() => {
    // Only update the users data if we're not currently showing the message input
    // This prevents the modal from closing when location updates occur
    if (!showMessageInput) {
      // If draggedUser exists, find and preserve it in the updated users array
      if (draggedUser && draggedUserId) {
        const updatedDraggedUser = users.find(u => u.id === draggedUserId);
        if (updatedDraggedUser) {
          setDraggedUser(updatedDraggedUser);
        }
      }
    }
  }, [users, showMessageInput]);
  
  return (
    <View style={styles.container}>
      <View style={[styles.radarBackground, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
        {/* Concentric circles for distance visualization */}
        {renderConcentricCircles()}
        
        {/* Drop target in center - make it more visible */}
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
        
        {/* Current User (Top) */}
        <View 
          style={{
            position: 'absolute',
            top: -BUBBLE_SIZE,
            alignItems: 'center',
          }}
        >
          <UserBubble
            user={{
              id: currentUser.id,
              display_name: currentUser.display_name || 'You',
              photo_url: currentUser.photo_url,
              isCurrentUser: true,
            }}
            onPress={() => {}}
            size={BUBBLE_SIZE}
          />
        </View>
      </View>
      
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
                      {draggedUser.display_name || 'User'}
                    </Text>
                  )}
                  <TouchableOpacity onPress={handleCancelMessage} style={styles.closeButton}>
                    <Text style={{fontSize: 20, color: '#999', fontWeight: '300'}}>×</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  ref={inputRef}
                  style={styles.messageModalInput}
                  placeholder={`Hey ${draggedUser?.display_name || 'there'}, was nice meeting you...`}
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
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default Radar; 
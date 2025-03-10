import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Dimensions, Platform, Animated, TextInput, TouchableOpacity, Text, Modal, Image } from 'react-native';
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

const Radar = ({ users, currentUser, maxDistance, onUserPress, onMessageSend, onDragStateChange }: RadarProps) => {
  // State for handling drag-and-drop messaging
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<TextInput>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedUser, setDraggedUser] = useState<any>(null);
  
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
  
  // Convert actual distances to radar display distances with improved distribution
  const getPositionOnRadar = (distance: number, angle: number) => {
    // Scale distance based on maximum distance with better distribution
    // Using sqrt for more natural distribution (focuses more users toward center)
    const scaleFactor = Math.min(1, Math.sqrt(distance / maxDistance));
    
    // Modified scaling to create better spacing - minimum 30% from center, max 80% of radius
    // This ensures users don't appear too close to the center
    const scaledDistance = (scaleFactor * 0.5 + 0.3) * (RADAR_SIZE / 2);
    
    // Convert polar coordinates to cartesian
    const x = centerX + scaledDistance * Math.cos(angle);
    const y = centerY + scaledDistance * Math.sin(angle);
    
    return { x, y };
  };
  
  // Check if two positions are too close
  const arePositionsColliding = (pos1: {x: number, y: number}, pos2: {x: number, y: number}) => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < MIN_DISTANCE;
  };
  
  // Check if position is too close to center (current user)
  const isTooCloseToCenter = (pos: {x: number, y: number}) => {
    const dx = pos.x - centerX;
    const dy = pos.y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < CENTER_BUFFER;
  };
  
  // Adjust position to avoid overlap with improved algorithm
  const adjustPosition = (position: {x: number, y: number}, existingPositions: Array<{x: number, y: number}>) => {
    let adjustedPosition = { ...position };
    let attempts = 0;
    const maxAttempts = 40; // Increased max attempts for better placement
    
    // First check if too close to center and adjust if needed
    if (isTooCloseToCenter(adjustedPosition)) {
      const dx = adjustedPosition.x - centerX;
      const dy = adjustedPosition.y - centerY;
      const angle = Math.atan2(dy, dx);
      adjustedPosition.x = centerX + CENTER_BUFFER * Math.cos(angle);
      adjustedPosition.y = centerY + CENTER_BUFFER * Math.sin(angle);
    }
    
    while (attempts < maxAttempts) {
      // Check if current position collides with any existing positions
      const collision = existingPositions.some(pos => 
        arePositionsColliding(adjustedPosition, pos)
      );
      
      if (!collision) {
        // No collision, position is good
        break;
      }
      
      // Calculate vector from center to current position
      const dx = adjustedPosition.x - centerX;
      const dy = adjustedPosition.y - centerY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      // Try different strategies based on attempt number
      if (attempts < 10) {
        // First try: Increase distance from center
        const newDistance = currentDistance + (MIN_DISTANCE * 0.25);
        adjustedPosition.x = centerX + newDistance * Math.cos(angle);
        adjustedPosition.y = centerY + newDistance * Math.sin(angle);
      } else if (attempts < 20) {
        // Second try: Slightly adjust angle
        const angleAdjustment = (Math.random() - 0.5) * 0.5; // Up to ±0.25 radians
        const newAngle = angle + angleAdjustment;
        adjustedPosition.x = centerX + currentDistance * Math.cos(newAngle);
        adjustedPosition.y = centerY + currentDistance * Math.sin(newAngle);
      } else if (attempts < 30) {
        // Third try: Combine both approaches
        const angleAdjustment = (Math.random() - 0.5) * 0.3;
        const newAngle = angle + angleAdjustment;
        const newDistance = currentDistance + (MIN_DISTANCE * 0.3);
        adjustedPosition.x = centerX + newDistance * Math.cos(newAngle);
        adjustedPosition.y = centerY + newDistance * Math.sin(newAngle);
      } else {
        // Last resort: Try a random position at the outer edge
        const randomAngle = Math.random() * Math.PI * 2;
        const edgeDistance = (RADAR_SIZE / 2) - (BUBBLE_SIZE / 2) - 10;
        adjustedPosition.x = centerX + edgeDistance * Math.cos(randomAngle);
        adjustedPosition.y = centerY + edgeDistance * Math.sin(randomAngle);
      }
      
      attempts++;
    }
    
    // Ensure the adjusted position stays within radar bounds
    const distanceFromCenter = Math.sqrt(
      Math.pow(adjustedPosition.x - centerX, 2) + 
      Math.pow(adjustedPosition.y - centerY, 2)
    );
    
    const maxAllowedDistance = (RADAR_SIZE / 2) - (BUBBLE_SIZE / 2) - 5;
    
    if (distanceFromCenter > maxAllowedDistance) {
      const angle = Math.atan2(
        adjustedPosition.y - centerY, 
        adjustedPosition.x - centerX
      );
      adjustedPosition.x = centerX + maxAllowedDistance * Math.cos(angle);
      adjustedPosition.y = centerY + maxAllowedDistance * Math.sin(angle);
    }
    
    return adjustedPosition;
  };
  
  // Generate positions for users with memoization to prevent unnecessary recalculations
  const usersWithPositions = useMemo(() => {
    const usersWithPos = [];
    const existingPositions: Array<{x: number, y: number}> = [];
    
    // Sort users by distance so closer users are positioned first
    const sortedUsers = [...users].sort((a, b) => a.distance - b.distance);
    
    for (const user of sortedUsers) {
      // Generate a random angle if not available, or use existing one
      // This ensures positions remain stable between renders
      user.angle = user.angle || Math.random() * Math.PI * 2;
      
      // Get initial position
      let position = getPositionOnRadar(user.distance, user.angle);
      
      // Adjust position to avoid overlaps
      position = adjustPosition(position, existingPositions);
      
      // Add to existing positions
      existingPositions.push(position);
      
      // Add user with position
      usersWithPos.push({
        ...user,
        position,
      });
    }
    
    return usersWithPos;
  }, [users, maxDistance]); // Dependencies that would cause a recalculation
  
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
  
  // Handle when dragging starts
  const handleDragStart = () => {
    setIsDragging(true);
    // Notify parent component that dragging has started
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
        {usersWithPositions.map(user => (
          <UserBubble
            key={user.id}
            user={user}
            onPress={() => onUserPress(user.id)}
            onDragRelease={handleUserDragRelease}
            onDragStart={handleDragStart}
            draggable={true}
            centerPoint={{ 
              // Use the screen center as the target point
              x: width / 2,
              y: height / 2
            }}
            style={{
              position: 'absolute',
              left: user.position.x - (BUBBLE_SIZE / 2), // Half of bubble size
              top: user.position.y - (BUBBLE_SIZE / 2),
              zIndex: 5, // Ensure bubbles appear above radar background
            }}
            size={BUBBLE_SIZE}
          />
        ))}
        
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
        <View style={styles.modalOverlay}>
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
                <Ionicons name="close" size={24} color={'#666'} />
              </TouchableOpacity>
            </View>

            <TextInput
              ref={inputRef}
              style={styles.messageModalInput}
              placeholder={`Hey ${draggedUser?.display_name || 'there'}, was nice meeting you...`}
              placeholderTextColor="#999"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={500}
              autoFocus
            />
            
            <View style={styles.messageModalFooter}>
              <TouchableOpacity 
                style={[
                  styles.sendMessageButton,
                  message.trim() === '' ? styles.sendButtonDisabled : null
                ]}
                onPress={handleSendMessage}
                disabled={message.trim() === ''}
              >
                <Ionicons 
                  name="arrow-forward" 
                  size={24} 
                  color={'#666'} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Radar; 
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

const Radar = ({ users, currentUser, maxDistance, onUserPress, onMessageSend }: RadarProps) => {
  const [userPositions, setUserPositions] = useState<UserPositions>({});
  
  // Calculate the radar center coordinates
  const centerX = RADAR_SIZE / 2;
  const centerY = RADAR_SIZE / 2;
  
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
          size={BUBBLE_SIZE * 1.4}
        />
      </View>
      
      {/* Radar Area */}
      <View style={[styles.radarBackground, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
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
              style={{
                position: 'absolute',
                left: position.x - (BUBBLE_SIZE / 2),
                top: position.y - (BUBBLE_SIZE / 2),
                zIndex: 5,
              }}
              size={BUBBLE_SIZE}
            />
          );
        })}
      </View>
    </View>
  );
};

export default Radar; 
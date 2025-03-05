import React, { useMemo } from 'react';
import { View, Dimensions, Platform } from 'react-native';
import UserBubble from './UserBubble';
import { styles } from './styles';

const { width } = Dimensions.get('window');
const RADAR_SIZE = width * 0.9; // 90% of screen width
const BUBBLE_SIZE = 60; // Increased bubble size for better visibility
const MIN_DISTANCE = BUBBLE_SIZE * 1.8; // Further increased minimum distance between bubbles
const CENTER_BUFFER = 100; // Buffer around center to prevent overlapping with current user

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
}

const Radar = ({ users, currentUser, maxDistance, onUserPress }: RadarProps) => {
  // Calculate the radar center coordinates
  const centerX = RADAR_SIZE / 2;
  const centerY = RADAR_SIZE / 2;
  
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
  
  return (
    <View style={styles.container}>
      <View style={[styles.radarBackground, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
        {/* Nearby Users (render these first so they appear behind the current user) */}
        {usersWithPositions.map(user => (
          <UserBubble
            key={user.id}
            user={user}
            onPress={() => onUserPress(user.id)}
            style={{
              position: 'absolute',
              left: user.position.x - (BUBBLE_SIZE / 2), // Half of bubble size
              top: user.position.y - (BUBBLE_SIZE / 2),
              zIndex: 5, // Ensure bubbles appear above radar background
            }}
            size={BUBBLE_SIZE}
          />
        ))}
        
        {/* Current User (Center) - render last so it appears on top */}
        <View style={styles.currentUserContainer}>
          <UserBubble
            user={{
              id: currentUser.id,
              display_name: currentUser.display_name || 'You',
              photo_url: currentUser.photo_url,
              isCurrentUser: true,
            }}
            onPress={() => {}}
            size={80} // Increased size for center profile
          />
        </View>
      </View>
    </View>
  );
};

export default Radar; 
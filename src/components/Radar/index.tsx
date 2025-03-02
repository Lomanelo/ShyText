import React from 'react';
import { View, Dimensions } from 'react-native';
import UserBubble from './UserBubble';
import { styles } from './styles';

const { width } = Dimensions.get('window');
const RADAR_SIZE = width * 0.9; // 90% of screen width

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
  };
  maxDistance: number; // Maximum distance in meters
  onUserPress: (userId: string) => void;
}

const Radar = ({ users, currentUser, maxDistance, onUserPress }: RadarProps) => {
  // Calculate the radar center coordinates
  const centerX = RADAR_SIZE / 2;
  const centerY = RADAR_SIZE / 2;
  
  // Convert actual distances to radar display distances
  const getPositionOnRadar = (distance: number, angle: number) => {
    // Scale distance based on maximum distance, with better distribution
    // Add a buffer to prevent users from being too close to the center
    const scaleFactor = Math.min(1, distance / maxDistance);
    // Modified scaling to create better spacing - minimum 15% from center, max 85% of radius
    const scaledDistance = (scaleFactor * 0.7 + 0.15) * (RADAR_SIZE / 2);
    
    // Convert polar coordinates to cartesian
    const x = centerX + scaledDistance * Math.cos(angle);
    const y = centerY + scaledDistance * Math.sin(angle);
    
    return { x, y };
  };
  
  // Generate positions for users
  const getUsersWithPositions = () => {
    return users.map(user => {
      // Generate a random angle if not available, or use existing one
      // This ensures positions remain stable between renders
      user.angle = user.angle || Math.random() * Math.PI * 2;
      
      const position = getPositionOnRadar(user.distance, user.angle);
      
      return {
        ...user,
        position,
      };
    });
  };
  
  const usersWithPositions = getUsersWithPositions();
  
  return (
    <View style={styles.container}>
      <View style={styles.radarBackground}>
        {/* Current User (Center) */}
        <View style={styles.currentUserContainer}>
          <UserBubble
            user={{
              id: currentUser.id,
              display_name: 'You',
              photo_url: currentUser.photo_url,
              isCurrentUser: true,
            }}
            onPress={() => {}}
            size={75} // Slightly larger center profile
          />
        </View>
        
        {/* Nearby Users */}
        {usersWithPositions.map(user => (
          <UserBubble
            key={user.id}
            user={user}
            onPress={() => onUserPress(user.id)}
            style={{
              position: 'absolute',
              left: user.position.x - 25, // Half of bubble size
              top: user.position.y - 25,
            }}
            size={50}
          />
        ))}
      </View>
    </View>
  );
};

export default Radar; 
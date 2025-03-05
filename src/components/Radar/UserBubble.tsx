import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  ViewStyle,
  ActivityIndicator,
  Platform
} from 'react-native';
import { styles } from './styles';
import colors from '../../theme/colors';

interface User {
  id: string;
  display_name?: string;
  photo_url?: string;
  isCurrentUser?: boolean;
  [key: string]: any;
}

interface UserBubbleProps {
  user: User;
  onPress: () => void;
  style?: ViewStyle;
  size?: number;
}

const UserBubble = ({ user, onPress, style, size = 50 }: UserBubbleProps) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const displayName = user.display_name || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  
  // Helper function to validate photo URL
  const hasValidPhotoUrl = () => {
    if (!user.photo_url) return false;
    
    // Check if it's a data URL (starts with data:image)
    if (user.photo_url.startsWith('data:image/')) {
      return true;
    }
    
    // Check if it's a remote URL (http/https)
    if (user.photo_url.startsWith('http://') || user.photo_url.startsWith('https://')) {
      try {
        new URL(user.photo_url);
        return true;
      } catch (e) {
        console.log(`Invalid URL format for user ${user.id}: ${user.photo_url}`);
        return false;
      }
    }
    
    console.log(`Unsupported photo URL format for user ${user.id}: ${user.photo_url.substring(0, 30)}...`);
    return false;
  };

  // Handle image load start
  const handleImageLoadStart = () => {
    console.log(`Starting to load image for user: ${user.id}`);
    setImageLoading(true);
    setImageError(false);
  };

  // Handle image load success
  const handleImageLoadSuccess = () => {
    console.log(`Successfully loaded image for user: ${user.id}`);
    setImageLoading(false);
  };

  // Handle image load error
  const handleImageLoadError = () => {
    console.log(`Error loading image for user: ${user.id}, URL: ${user.photo_url}`);
    setImageLoading(false);
    setImageError(true);
  };

  return (
    <TouchableOpacity 
      style={[styles.userBubble, { width: size, height: size }, style]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {hasValidPhotoUrl() && !imageError ? (
        <>
          <Image
            source={{ uri: user.photo_url }}
            style={[styles.userPhoto, { width: size, height: size }]}
            onLoadStart={handleImageLoadStart}
            onLoad={handleImageLoadSuccess}
            onError={handleImageLoadError}
          />
          {imageLoading && (
            <ActivityIndicator 
              size="small" 
              color={colors.primary} 
              style={styles.userPlaceholder} 
            />
          )}
        </>
      ) : (
        <View style={[styles.userPlaceholder, { width: size, height: size, backgroundColor: colors.primary }]}>
          <Text style={styles.userInitial}>{initial}</Text>
        </View>
      )}
      {user.isCurrentUser && (
        <View style={styles.currentUserIndicator} />
      )}
    </TouchableOpacity>
  );
};

export default UserBubble; 
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  ViewStyle,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { styles } from './styles';
import colors from '../../theme/colors';
import VerifiedBadge from '../VerifiedBadge';

// Custom component styles
const localStyles = StyleSheet.create({
  verifiedBadgeContainer: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    zIndex: 10,
  }
});

interface User {
  id: string;
  display_name?: string;
  photo_url?: string;
  isCurrentUser?: boolean;
  is_verified?: boolean;
  mac_address?: string;
  [key: string]: any;
}

interface UserBubbleProps {
  user: User;
  onPress: () => void;
  style?: ViewStyle;
  size?: number;
}

const UserBubble = ({ 
  user, 
  onPress, 
  style, 
  size = 50
}: UserBubbleProps) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const displayName = user.display_name || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  
  // Check if photo URL is valid
  const hasValidPhotoUrl = () => {
    return !!user.photo_url && user.photo_url.length > 0;
  };
  
  // Handle image loading events
  const handleImageLoadStart = () => {
    setImageLoading(true);
    setImageError(false);
  };
  
  const handleImageLoadSuccess = () => {
    setImageLoading(false);
  };
  
  const handleImageLoadError = () => {
    setImageLoading(false);
    setImageError(true);
  };
  
  // Get styles for the bubble
  const getBubbleStyles = () => {
    return [
      styles.userBubble, 
      { 
        width: size, 
        height: size,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3
      },
      style
    ];
  };

  // Use regular TouchableOpacity for simple tap interaction
  return (
    <TouchableOpacity 
      style={getBubbleStyles()} 
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
        <View style={[styles.userPlaceholder, { width: size, height: size }]}>
          <Text style={[styles.userInitial, { fontSize: size * 0.4 }]}>{initial}</Text>
        </View>
      )}
      
      {/* Verified Badge */}
      {user.is_verified && (
        <View style={localStyles.verifiedBadgeContainer}>
          <VerifiedBadge isVerified={true} size="small" />
        </View>
      )}
      
      {user.isCurrentUser && (
        <View style={styles.currentUserIndicator} />
      )}
      
      {displayName && (
        <Text 
          style={[styles.userName, { fontSize: size * 0.24 }]} 
          numberOfLines={1}
        >
          {displayName}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export default UserBubble; 
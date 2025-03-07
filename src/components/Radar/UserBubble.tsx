import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  ViewStyle,
  ActivityIndicator,
  Platform,
  PanResponder,
  Animated,
  Dimensions
} from 'react-native';
import { styles } from './styles';
import colors from '../../theme/colors';

interface User {
  id: string;
  display_name?: string;
  photo_url?: string;
  isCurrentUser?: boolean;
  position?: { x: number, y: number };
  [key: string]: any;
}

interface UserBubbleProps {
  user: User;
  onPress: () => void;
  onDragRelease?: (userId: string, dropSuccess: boolean) => void;
  centerPoint?: { x: number, y: number };
  isDropTarget?: boolean;
  style?: ViewStyle;
  size?: number;
  draggable?: boolean;
}

const DRAG_THRESHOLD = 80; // Distance from center to trigger a successful drop

const UserBubble = ({ 
  user, 
  onPress, 
  onDragRelease,
  centerPoint,
  isDropTarget = false,
  style, 
  size = 50,
  draggable = false
}: UserBubbleProps) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;

  const displayName = user.display_name || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  
  // Setup PanResponder for drag functionality
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => draggable,
      onMoveShouldSetPanResponder: () => draggable,
      
      onPanResponderGrant: () => {
        setIsDragging(true);
        // Scale up slightly when dragging
        Animated.spring(scale, {
          toValue: 1.1,
          friction: 5,
          useNativeDriver: true
        }).start();
        
        // Keep the offset when starting drag
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value
        });
        pan.setValue({ x: 0, y: 0 });
      },
      
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();
        setIsDragging(false);
        
        // Restore original scale
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true
        }).start();
        
        let dropSuccess = false;
        
        // If we have centerPoint and onDragRelease, check if the user was dropped on target
        if (centerPoint && onDragRelease) {
          // Calculate distance from center target
          const dragX = gesture.moveX;
          const dragY = gesture.moveY;
          const distance = Math.sqrt(
            Math.pow(dragX - centerPoint.x, 2) + 
            Math.pow(dragY - centerPoint.y, 2)
          );
          
          dropSuccess = distance < DRAG_THRESHOLD;
          
          // Call the callback
          onDragRelease(user.id, dropSuccess);
        }
        
        // If not dropped on target or no target provided, animate back to original position
        if (!dropSuccess) {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: true
          }).start();
        }
      }
    })
  ).current;
  
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
    
    return false;
  };

  // Handle image load start
  const handleImageLoadStart = () => {
    setImageLoading(true);
    setImageError(false);
  };

  // Handle image load success
  const handleImageLoadSuccess = () => {
    setImageLoading(false);
  };

  // Handle image load error
  const handleImageLoadError = () => {
    console.log(`Error loading image for user: ${user.id}, URL: ${user.photo_url}`);
    setImageLoading(false);
    setImageError(true);
  };

  // Calculate dynamic styles for dragging 
  const getBubbleStyles = () => {
    const baseStyles = [
      styles.userBubble, 
      { width: size, height: size },
      style
    ];
    
    // Add drop target styles if this is the center drop target
    if (isDropTarget) {
      baseStyles.push(styles.dropTarget);
      
      // If someone is dragging, highlight the drop target
      if (isDragging) {
        baseStyles.push(styles.dropTargetActive);
      }
    }
    
    return baseStyles;
  };

  // For draggable bubbles, use Animated.View
  if (draggable) {
    return (
      <Animated.View
        style={[
          ...getBubbleStyles(),
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: scale }
            ],
            zIndex: isDragging ? 100 : 5 // Bring to front while dragging
          }
        ]}
        {...panResponder.panHandlers}
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
            <Text style={styles.userInitial}>{initial}</Text>
          </View>
        )}
        {user.isCurrentUser && (
          <View style={styles.currentUserIndicator} />
        )}
        {!isDropTarget && (
          <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
        )}
      </Animated.View>
    );
  }

  // For non-draggable or drop target, use regular TouchableOpacity
  return (
    <TouchableOpacity 
      style={getBubbleStyles()} 
      onPress={onPress}
      activeOpacity={0.7}
      disabled={isDropTarget}
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
          <Text style={styles.userInitial}>{initial}</Text>
        </View>
      )}
      {user.isCurrentUser && (
        <View style={styles.currentUserIndicator} />
      )}
      {isDropTarget ? (
        <View style={styles.dropTargetIcon}>
          <Text style={styles.dropTargetText}>+</Text>
        </View>
      ) : (
        <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
      )}
    </TouchableOpacity>
  );
};

export default UserBubble; 
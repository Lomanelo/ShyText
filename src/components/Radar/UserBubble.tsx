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
  onDragStart?: () => void;
  centerPoint?: { x: number, y: number };
  isDropTarget?: boolean;
  style?: ViewStyle;
  size?: number;
  draggable?: boolean;
}

const DRAG_THRESHOLD = 80; // Distance from center to trigger a successful drop
export const SNAP_THRESHOLD = 0.33; // When 1/3 of the bubble overlaps with the center

// Additional constants for detection
const DETECTION_RADIUS_MULTIPLIER = 1.5; // Makes the actual detection area larger than the visual circle

const UserBubble = ({ 
  user, 
  onPress, 
  onDragRelease,
  onDragStart,
  centerPoint,
  isDropTarget = false,
  style, 
  size = 50,
  draggable = false
}: UserBubbleProps) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapped, setIsSnapped] = useState(false);
  
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const screenCenterX = screenWidth / 2;
  const screenCenterY = screenHeight / 2;

  const displayName = user.display_name || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  
  // Reset position when user changes
  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
  }, [user.id]);
  
  // Create the pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => draggable,
      onMoveShouldSetPanResponder: () => draggable,
      
      onPanResponderGrant: () => {
        // Use offset to maintain position between moves
        pan.extractOffset();
        
        // Scale up slightly when dragging
        Animated.spring(scale, {
          toValue: 1.1,
          friction: 5,
          useNativeDriver: true
        }).start();
        
        setIsDragging(true);
        
        // Notify parent when drag starts
        if (onDragStart) {
          onDragStart();
        }
      },
      
      onPanResponderMove: (_, gesture) => {
        // Normal movement - no JS-based snapping during move
        // Just use setValue which is compatible with native driver
        pan.setValue({ x: gesture.dx, y: gesture.dy });
        
        // Instead of animated snapping during drag, we'll do position 
        // checking and only snap on release
        if (centerPoint) {
          const touchX = gesture.moveX;
          const touchY = gesture.moveY;
          
          // Calculate distance to center
          const distanceToCenter = Math.sqrt(
            Math.pow(touchX - screenCenterX, 2) + 
            Math.pow(touchY - screenCenterY, 2)
          );
          
          // Calculate the snap threshold
          const dropTargetRadius = 45; // Using a consistent size (visual circle is 70px)
          const userBubbleRadius = size / 2;
          // Apply the multiplier to increase detection area
          const snapDistance = (dropTargetRadius + userBubbleRadius) * DETECTION_RADIUS_MULTIPLIER;
          
          // Just update the snapped state for visual feedback
          // but don't do animations during drag
          setIsSnapped(distanceToCenter < snapDistance);
        }
      },
      
      onPanResponderRelease: (evt, gesture) => {
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
          // Get final position
          const touchX = gesture.moveX;
          const touchY = gesture.moveY;
          
          // Calculate distance to center
          const distanceToCenter = Math.sqrt(
            Math.pow(touchX - screenCenterX, 2) + 
            Math.pow(touchY - screenCenterY, 2)
          );
          
          // Calculate the drop threshold - use larger detection area
          const dropTargetRadius = 45; // Half of visual circle (70px)
          const userBubbleRadius = size / 2;
          // Apply the multiplier to increase detection area
          const dropThreshold = (dropTargetRadius + userBubbleRadius) * DETECTION_RADIUS_MULTIPLIER;
          
          dropSuccess = distanceToCenter < dropThreshold;
          
          console.log(`User ${user.id} dropped with success: ${dropSuccess}`);
          
          // Call the callback with drop result
          onDragRelease(user.id, dropSuccess);
        }
        
        // Reset snap state
        setIsSnapped(false);
        
        // Always animate back to original position
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          useNativeDriver: true
        }).start();
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

  const renderDropTarget = () => {
    if (!isDropTarget) return null;
    
    return (
      <View style={{ 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: '100%', 
        height: '100%',
        borderRadius: 1000, // Ensure it's a perfect circle
        backgroundColor: '#FFFFFF'
      }}>
        <Text style={{ 
          fontSize: size * 0.5, 
          fontWeight: '700',
          color: '#00BCD4', // Teal color matching the design
          textAlign: 'center',
          marginTop: -2, // Adjust vertical alignment for the plus sign
        }}>+</Text>
      </View>
    );
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
        renderDropTarget()
      ) : (
        <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
      )}
    </TouchableOpacity>
  );
};

export default UserBubble; 
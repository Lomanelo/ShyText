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
  Dimensions,
  Easing,
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
  position?: { x: number, y: number };
  is_verified?: boolean;
  mac_address?: string;
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
  const pulseAnim = useRef(new Animated.Value(0)).current; // For pulse animation
  
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
        
        // Scale up more dramatically when dragging starts
        Animated.spring(scale, {
          toValue: 1.35, // Even bigger scale increase for dragging
          friction: 6,
          tension: 50,
          useNativeDriver: true
        }).start();
        
        // Start pulse animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true
            }),
            Animated.timing(pulseAnim, {
              toValue: 0,
              duration: 800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true
            })
          ])
        ).start();
        
        setIsDragging(true);
        
        // Notify parent when drag starts
        if (onDragStart) {
          onDragStart();
        }
      },
      
      onPanResponderMove: (_, gesture) => {
        // Normal movement
        pan.setValue({ x: gesture.dx, y: gesture.dy });
        
        if (centerPoint) {
          const touchX = gesture.moveX;
          const touchY = gesture.moveY;
          
          // Calculate distance to center
          const distanceToCenter = Math.sqrt(
            Math.pow(touchX - screenCenterX, 2) + 
            Math.pow(touchY - screenCenterY, 2)
          );
          
          // Calculate the snap threshold
          const dropTargetRadius = 35; // Half of visual circle
          const userBubbleRadius = size / 2;
          // Apply the multiplier to increase detection area, but less aggressive
          const snapDistance = (dropTargetRadius + userBubbleRadius) * 1.1; // More subtle
          
          // For smooth magnetic effect when close to the center target
          if (distanceToCenter < snapDistance && !isSnapped) {
            setIsSnapped(true);
            
            // Calculate the direction vector to center
            const dx = screenCenterX - touchX;
            const dy = screenCenterY - touchY;
            
            // Normalize for smooth animation
            const distance = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Create a stronger magnetic pull effect
            pan.flattenOffset();
            Animated.spring(pan, {
              toValue: { 
                x: gesture.dx + (nx * dropTargetRadius * 0.6), // Stronger pull
                y: gesture.dy + (ny * dropTargetRadius * 0.6)
              },
              friction: 5,  // Less friction for faster snap
              tension: 80,  // Higher tension for stronger pull
              useNativeDriver: true
            }).start();
            
            // Even more scale increase when snapped
            Animated.spring(scale, {
              toValue: 1.5, // Bigger scale when snapped
              friction: 4,
              tension: 80,
              useNativeDriver: true
            }).start();
          } 
          else if (distanceToCenter >= snapDistance && isSnapped) {
            // Reset when moving away from snap area
            setIsSnapped(false);
            
            // Reset scales with subtle transition
            Animated.spring(scale, {
              toValue: 1.35, // Back to dragging scale
              friction: 6,
              tension: 40,
              useNativeDriver: true
            }).start();
          }
        }
      },
      
      onPanResponderRelease: (evt, gesture) => {
        pan.flattenOffset();
        setIsDragging(false);
        
        // Stop the pulse animation
        pulseAnim.stopAnimation();
        pulseAnim.setValue(0);
        
        // Restore original scale
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 40,
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
          color: '#000000', // Changed from teal to black
          textAlign: 'center',
          marginTop: -2, // Adjust vertical alignment for the plus sign
        }}>+</Text>
      </View>
    );
  };

  // Create the animated transforms
  const animatedStyles = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
      { scale }
    ]
  };
  
  // Create the pulse scale animation
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15]
  });

  // If draggable, use Animated.View with PanResponder
  if (draggable) {
    // Create shadow style based on drag state
    const shadowStyle = isDragging ? {
      shadowColor: 'rgba(0,0,0,0.2)',
      shadowOffset: {width: 0, height: 3},
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 5
    } : {};

    return (
      <Animated.View
        style={[
          styles.userBubble,
          {
            width: size,
            height: size,
          },
          shadowStyle,
          style,
          { 
            zIndex: isDragging ? 100 : 5, // Bring to front while dragging
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: scale }
            ]
          }
        ]}
        {...panResponder.panHandlers}
      >
        {hasValidPhotoUrl() && !imageError ? (
          <>
          <Image
            source={{ uri: user.photo_url }}
              style={styles.userPhoto}
              onLoadStart={handleImageLoadStart}
              onLoad={handleImageLoadSuccess}
              onError={handleImageLoadError}
            />
            {imageLoading && (
              <ActivityIndicator
                size="small"
                color="#ffffff"
                style={{ position: 'absolute' }}
              />
            )}
          </>
        ) : (
          <View style={styles.userPlaceholder}>
            <Text style={styles.userInitial}>{initial}</Text>
          </View>
        )}
      
        {user.isCurrentUser && (
          <View style={styles.currentUserIndicator} />
        )}
        
        {/* Verified Badge for draggable */}
        {user.is_verified && (
          <View style={localStyles.verifiedBadgeContainer}>
            <VerifiedBadge isVerified={true} size="small" />
          </View>
        )}
        
        {!isDropTarget && displayName && (
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
      {isDropTarget ? (
        renderDropTarget()
      ) : (
        <>
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
          
          {/* Verified Badge for non-draggable */}
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
        </>
      )}
    </TouchableOpacity>
  );
};

export default UserBubble; 
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

// Improved detection constants
const DETECTION_RADIUS_MULTIPLIER = 2.5; // Makes the actual detection area larger than the visual circle
const ANIMATION_CONFIG = {
  tension: 120,  // Higher tension for snappier animations
  friction: 6,   // Lower friction for smoother feel
  useNativeDriver: true
};

const DRAG_DELAY = Platform.OS === 'ios' ? 30 : 50; // Milliseconds to wait before starting drag

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
  
  // Use refs for performance optimization
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current; 
  const shadowOpacity = useRef(new Animated.Value(0)).current;
  
  // Cache screen dimensions in ref
  const dimensions = useRef({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height
  }).current;
  
  // Calculate center points once
  const screenCenterX = dimensions.width / 2;
  const screenCenterY = dimensions.height / 2;

  const displayName = user.display_name || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  
  // Add a state to track if we're waiting for drag to start
  const [isWaitingForDrag, setIsWaitingForDrag] = useState(false);
  // Keep track of drag timer
  const dragTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (dragTimer.current) {
        clearTimeout(dragTimer.current);
      }
    };
  }, []);
  
  // Reset position when user changes
  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
  }, [user.id]);
  
  // Create the pan responder with optimizations
  const panResponder = useRef(
    PanResponder.create({
      // Only respond to moves if we're draggable
      onStartShouldSetPanResponder: () => draggable,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Only allow moving if we're already dragging or if we're deliberate
        // This prevents accidental drags when trying to tap
        if (isDragging) return true;
        
        // If the move is significant, allow it
        return draggable && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2);
      },
      
      // Improve first touch responsiveness
      onPanResponderGrant: () => {
        // Set waiting state
        setIsWaitingForDrag(true);
        
        // Use a small delay before starting drag to avoid accidental drags
        dragTimer.current = setTimeout(() => {
          // Extract offset for smoother initial movement
          pan.extractOffset();
          
          // Run animations in parallel for better performance
          Animated.parallel([
            // Scale up with optimized config
            Animated.spring(scale, {
              toValue: 1.35,
              ...ANIMATION_CONFIG
            }),
            
            // Add shadow for depth when dragging starts
            Animated.timing(shadowOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true
            })
          ]).start();
          
          // Start pulse animation for visual feedback
          Animated.loop(
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1,
                duration: 500, // Even faster pulse
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true
              }),
              Animated.timing(pulseAnim, {
                toValue: 0,
                duration: 500,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true
              })
            ])
          ).start();
          
          setIsDragging(true);
          setIsWaitingForDrag(false);
          
          // Notify parent when drag starts
          if (onDragStart) {
            onDragStart();
          }
        }, DRAG_DELAY);
      },
      
      onPanResponderMove: (_, gesture) => {
        // If we're still waiting, don't process move
        if (isWaitingForDrag) return;
        
        // Use direct setting for better performance
        pan.setValue({ x: gesture.dx, y: gesture.dy });
        
        if (centerPoint) {
          const touchX = gesture.moveX;
          const touchY = gesture.moveY;
          
          // Calculate distance to center - optimized
          const dx = touchX - screenCenterX;
          const dy = touchY - screenCenterY;
          const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
          
          // Calculate the snap threshold
          const dropTargetRadius = 45; // Half of visual circle
          const userBubbleRadius = size / 2;
          
          // Apply larger detection area for better UX
          const snapDistance = (dropTargetRadius + userBubbleRadius) * 1.2;
          
          // For smooth magnetic effect when close to the center target
          if (distanceToCenter < snapDistance && !isSnapped) {
            setIsSnapped(true);
            
            // Create a stronger and smoother magnetic pull effect
            pan.flattenOffset();
            
            // Calculate normalized direction vector
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / magnitude;
            const ny = dy / magnitude;
            
            // Spring animation to center with improved config
            Animated.spring(pan, {
              toValue: { 
                x: gesture.dx + (nx * dropTargetRadius * 0.8),
                y: gesture.dy + (ny * dropTargetRadius * 0.8)
              },
              tension: 120,   // Higher tension for snappier snap
              friction: 8,    // Balanced friction for natural feel
              useNativeDriver: true
            }).start();
            
            // More dramatic scale when snapped
            Animated.spring(scale, {
              toValue: 1.5,
              ...ANIMATION_CONFIG,
              tension: 120 // Even higher tension for snap effect
            }).start();
          } 
          else if (distanceToCenter >= snapDistance && isSnapped) {
            // Reset when moving away from snap area
            setIsSnapped(false);
            
            // Reset scale with smooth transition
            Animated.spring(scale, {
              toValue: 1.35,
              ...ANIMATION_CONFIG
            }).start();
          }
        }
      },
      
      onPanResponderRelease: (evt, gesture) => {
        // Clear any pending drag timer
        if (dragTimer.current) {
          clearTimeout(dragTimer.current);
          dragTimer.current = null;
        }
        
        // If we were waiting and not yet dragging, treat as tap
        if (isWaitingForDrag) {
          setIsWaitingForDrag(false);
          onPress();
          return;
        }
        
        pan.flattenOffset();
        setIsDragging(false);
        
        // Stop animations
        pulseAnim.stopAnimation();
        pulseAnim.setValue(0);
        
        // Reset visual feedback with parallel animations
        Animated.parallel([
          // Restore original scale
          Animated.spring(scale, {
            toValue: 1,
            ...ANIMATION_CONFIG
          }),
          
          // Fade out shadow
          Animated.timing(shadowOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true
          })
        ]).start();
        
        let dropSuccess = false;
        
        // If we have centerPoint and onDragRelease, check if the user was dropped on target
        if (centerPoint && onDragRelease) {
          // Get final position
          const touchX = gesture.moveX;
          const touchY = gesture.moveY;
          
          // Calculate distance to center - optimized
          const dx = touchX - screenCenterX;
          const dy = touchY - screenCenterY;
          const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
          
          // Calculate the drop threshold with larger detection area
          const dropTargetRadius = 45; // Half of visual circle
          const userBubbleRadius = size / 2;
          
          // Apply even larger multiplier for easier dropping
          const dropThreshold = (dropTargetRadius + userBubbleRadius) * DETECTION_RADIUS_MULTIPLIER;
          
          dropSuccess = distanceToCenter < dropThreshold;
          
          console.log(`User ${user.id} dropped with success: ${dropSuccess}`);
          
          // Call the callback with drop result
          onDragRelease(user.id, dropSuccess);
        }
        
        // Reset snap state
        setIsSnapped(false);
        
        // Always animate back to original position with improved spring config
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          ...ANIMATION_CONFIG,
          tension: 60,  // Lower tension for smoother return
          friction: 10  // Higher friction for less bounce
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
    outputRange: [1, 1.08]
  });

  // Create animated shadow opacity
  const shadowAnimStyle = {
    shadowOpacity: shadowOpacity.interpolate({
      inputRange: [0, 1],
      outputRange: [0.1, 0.8]
    }),
    elevation: shadowOpacity.interpolate({
      inputRange: [0, 1],
      outputRange: [2, 15]
    })
  };

  // If draggable, use Animated.View with PanResponder
  if (draggable) {
    // Create shadow style based on drag state
    const shadowStyle = {
      shadowColor: 'rgba(0,0,0,0.4)',
      shadowOffset: {width: 0, height: isDragging ? 8 : 2},
      shadowOpacity: isDragging ? 0.6 : 0.2,
      shadowRadius: isDragging ? 15 : 3,
      elevation: isDragging ? 10 : 3
    };

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
          shadowAnimStyle,
          { 
            zIndex: isDragging ? 100 : 5, // Bring to front while dragging
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: isSnapped ? Animated.multiply(scale, pulseScale) : scale }
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
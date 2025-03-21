import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

interface VerifiedBadgeProps {
  isVerified: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  style?: any;
}

/**
 * A reusable component to display user verification status
 */
const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ 
  isVerified, 
  size = 'medium', 
  showLabel = false,
  style
}) => {
  if (!isVerified) return null;
  
  // Define size dimensions
  const sizes = {
    small: {
      container: 16,
      icon: 12
    },
    medium: {
      container: 24,
      icon: 16
    },
    large: {
      container: 32,
      icon: 22
    }
  };
  
  const selectedSize = sizes[size];
  
  return (
    <View style={[styles.container, style]}>
      <View 
        style={[
          styles.badge, 
          { 
            width: selectedSize.container, 
            height: selectedSize.container,
            borderRadius: selectedSize.container / 2
          }
        ]}
      >
        <Ionicons 
          name="checkmark-circle" 
          size={selectedSize.icon} 
          color="#FFFFFF" 
        />
      </View>
      
      {showLabel && (
        <Text style={styles.verifiedText}>Verified</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedText: {
    marginLeft: 4,
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
  }
});

export default VerifiedBadge; 
import React from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  ViewStyle 
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
  // For current user, use primary color. For others, use primary or variants
  const backgroundColor = user.isCurrentUser 
    ? colors.primary 
    : [colors.primary, colors.primaryLight, colors.primaryDark][user.id.length % 3];

  return (
    <View style={[styles.userBubbleContainer, style]}>
      <TouchableOpacity
        style={[
          styles.userBubble,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: colors.background,
            borderWidth: user.isCurrentUser ? 3 : 2,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.9}
      >
        {user.photo_url ? (
          <Image
            source={{ uri: user.photo_url }}
            style={[
              styles.userPhoto,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.userPlaceholder,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor,
              },
            ]}
          >
            <Text style={styles.userInitial}>
              {user.display_name ? user.display_name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      
      {user.isCurrentUser && (
        <View style={styles.currentUserIndicator}>
          <Text style={styles.currentUserText}>You</Text>
        </View>
      )}
    </View>
  );
};

export default UserBubble; 
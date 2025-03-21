import React, { useEffect, useState, createContext, useContext } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../src/theme/colors';
import { getCurrentUser, getUnreadMessageCount, subscribeToUnreadMessageCount } from '../../src/lib/firebase';
import { useAuth } from '../../src/hooks/useAuth';
import { useColorScheme, Image, StyleSheet, View, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Create context for unread messages count
export const UnreadMessagesContext = createContext<{
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}>({
  unreadCount: 0,
  refreshUnreadCount: async () => {}
});

// Hook to use the unread messages context
export const useUnreadMessages = () => useContext(UnreadMessagesContext);

function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  focused?: boolean;
  isProfile?: boolean;
  showBadge?: boolean;
  badgeCount?: number;
}) {
  const { user } = useAuth();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (props.isProfile && user?.photoURL) {
      setPhotoUrl(user.photoURL);
    }
  }, [user?.photoURL, props.isProfile]);

  if (props.isProfile && photoUrl) {
    return (
      <Image 
        source={{ uri: photoUrl }} 
        style={[
          styles.profileImage, 
          { borderColor: props.focused ? props.color : 'transparent' }
        ]}
        onError={() => console.log('Error loading profile image')}
      />
    );
  }
  
  return (
    <View>
      <Ionicons size={28} style={{ marginBottom: -3 }} {...props} />
      
      {props.showBadge && props.badgeCount && props.badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {props.badgeCount > 99 ? '99+' : props.badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const [unreadCount, setUnreadCount] = useState(0);

  // Function to refresh the unread count
  const refreshUnreadCount = async () => {
    try {
      const count = await getUnreadMessageCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error refreshing unread count:', error);
    }
  };

  // Subscribe to unread messages in real-time
  useEffect(() => {
    // Set up real-time subscription to unread message count
    const unsubscribe = subscribeToUnreadMessageCount((count) => {
      setUnreadCount(count);
    });
    
    return () => {
      // Clean up subscription when component unmounts
      unsubscribe();
    };
  }, []);

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.mediumGray,
            elevation: 0,
            shadowOpacity: 0.1,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.darkGray,
          headerStyle: {
            backgroundColor: colors.background,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 3,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Nearby',
            tabBarIcon: ({ color }) => <TabBarIcon name="map" color={color} />,
          }}
        />
        <Tabs.Screen
          name="chats"
          options={{
            title: 'Chats',
            tabBarIcon: ({ color }) => (
              <TabBarIcon 
                name="chatbubbles" 
                color={color}
                showBadge={true}
                badgeCount={unreadCount}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name="person-circle" color={color} isProfile={true} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </UnreadMessagesContext.Provider>
  );
}

const styles = StyleSheet.create({
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -4,
    backgroundColor: colors.error || 'red',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.background,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
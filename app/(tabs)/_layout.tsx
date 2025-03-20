import React, { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../src/theme/colors';
import { getCurrentUser } from '../../src/lib/firebase';
import { useAuth } from '../../src/hooks/useAuth';
import { useColorScheme, Image, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  focused?: boolean;
  isProfile?: boolean;
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
  
  return <Ionicons size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const router = useRouter();

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = () => {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        // Not authenticated, redirect to login
        console.log('User not authenticated, redirecting to login');
        router.replace('/(auth)');
      }
    };

    // Check immediately on component mount
    checkAuth();

    // Set up periodic checks (optional, for extra safety)
    const interval = setInterval(checkAuth, 5000);
    
    return () => clearInterval(interval);
  }, [router]);

  return (
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
          tabBarIcon: ({ color }) => <TabBarIcon name="chatbubbles" color={color} />,
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
  );
}

const styles = StyleSheet.create({
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
});
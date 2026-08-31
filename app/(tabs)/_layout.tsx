import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { brand, useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useChatRequests } from '../../hooks/useChatRequests';

export default function TabsLayout() {
  const theme = useTheme();
  const { user } = useAuth();
  const { incoming } = useChatRequests(user?.uid);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerTintColor: brand.accent,
        headerStyle: { backgroundColor: theme.bg },
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: brand.accent,
        tabBarInactiveTintColor: theme.quiet,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="nearby"
        options={{
          title: 'Nearby',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'location' : 'location-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarBadge: incoming.length || undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

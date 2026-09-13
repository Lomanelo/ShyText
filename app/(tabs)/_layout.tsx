import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { brand, useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import { HapticTab } from '../../components/HapticTab';
import { Wordmark } from '../../components/wordmark';

/**
 * Mobbin social pattern (Instagram / BeReal / YouTube): brand mark + name
 * left in the nav. Logo-alone is for household names; ShyText still needs the word.
 */
function TabHeaderBrand() {
  const theme = useTheme();
  return (
    <View style={styles.brand}>
      <Wordmark theme={theme} size={24} />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const unread = useUnreadCount(user?.uid);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void Notifications.setBadgeCountAsync(unread).catch(() => undefined);
  }, [unread]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerTintColor: brand.accent,
        headerStyle: { backgroundColor: theme.bg },
        headerTitle: () => <TabHeaderBrand />,
        headerTitleAlign: 'left',
        tabBarActiveTintColor: brand.accent,
        tabBarInactiveTintColor: theme.quiet,
        tabBarButton: (props) => <HapticTab {...props} />,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="nearby"
        options={{
          title: t('tabs.nearby'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'location' : 'location-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: t('tabs.chats'),
          tabBarBadge: unread || undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.danger as string,
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: '700',
          },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  brand: {
    paddingLeft: Platform.OS === 'ios' ? 0 : 4,
    justifyContent: 'center',
  },
});

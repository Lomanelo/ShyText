import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
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
 * Mobbin social nav (Instagram / YouTube / BeReal): compact lockup in headerLeft
 * under the notch — lit mark + ink word, not a centered title.
 */
function TabHeaderBrand() {
  const theme = useTheme();
  return (
    <View style={styles.brand}>
      <Wordmark theme={theme} variant="nav" />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const unread = useUnreadCount(user?.uid);

  useEffect(() => {
    if (profile?.status === 'suspended') {
      router.replace('/suspended');
    }
  }, [profile?.status]);

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
        headerStyle: {
          backgroundColor: theme.bg,
        },
        headerTitle: '',
        headerLeft: () => <TabHeaderBrand />,
        headerLeftContainerStyle: styles.headerLeft,
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
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerLeft: {
    // Match Instagram / YouTube leading inset under the status bar / notch.
    paddingLeft: Platform.OS === 'ios' ? 12 : 8,
    marginLeft: 0,
  },
});

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../hooks/useAuth';
import { registerPushToken } from '../services/notifications';
import { useTheme } from '../theme';

export default function RootLayout() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const { user, hasProfile } = useAuth();

  useEffect(() => {
    if (user && hasProfile) {
      registerPushToken();
    }
  }, [user, hasProfile]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="venue/[venueId]" />
        <Stack.Screen name="shytext/create" />
        <Stack.Screen name="shytext/[shytextId]" />
        <Stack.Screen name="chat/[chatId]" />
        <Stack.Screen name="requests/index" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/privacy" />
        <Stack.Screen name="settings/blocked-users" />
        <Stack.Screen name="legal/privacy" options={{ headerShown: true, title: 'Privacy Policy' }} />
        <Stack.Screen name="legal/terms" options={{ headerShown: true, title: 'Terms of Service' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

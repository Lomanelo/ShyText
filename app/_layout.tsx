/**
 * THESIS: People at a real venue, not a paper-cream feed of fake names.
 * OWN-WORLD: System grouped surfaces + flame tint from the mark. System type only.
 * STORY: Pick the place. Drop a ShyText. Chat starts only if they accept.
 * FIRST VIEWPORT: Nearby large title, live Apple Maps venues, no seed people.
 * FORM: Native Operate / HIG. Inherited logo tint; Georgia cream is the anti-reference.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
 */
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { registerPushToken } from '../services/notifications';
import { brand, useTheme } from '../theme';

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
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            headerTintColor: brand.accent,
            headerShadowVisible: false,
            headerBackTitle: 'Back',
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="venue/[venueId]" options={{ headerShown: true, title: 'Venue' }} />
          <Stack.Screen name="shytext/create" options={{ headerShown: true, title: 'Drop a ShyText' }} />
          <Stack.Screen name="shytext/[shytextId]" options={{ headerShown: true, title: 'ShyText' }} />
          <Stack.Screen name="chat/[chatId]" options={{ headerShown: true, title: 'Chat' }} />
          <Stack.Screen name="requests/index" options={{ headerShown: true, title: 'Requests' }} />
          <Stack.Screen name="settings/index" options={{ headerShown: true, title: 'Settings' }} />
          <Stack.Screen name="settings/privacy" options={{ headerShown: true, title: 'Privacy' }} />
          <Stack.Screen name="settings/blocked-users" options={{ headerShown: true, title: 'Blocked' }} />
          <Stack.Screen name="legal/privacy" options={{ headerShown: true, title: 'Privacy Policy' }} />
          <Stack.Screen name="legal/terms" options={{ headerShown: true, title: 'Terms of Service' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

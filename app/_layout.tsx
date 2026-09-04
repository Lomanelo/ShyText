/**
 * THESIS: A ShyText is a directed note to one person checked in at the same venue — not a dating deck, people map, or paper-cream feed.
 * OWN-WORLD: Dim-bar / disposable-camera. System grouped surfaces, flame #D05927, lowercase shytext wordmark, tabular TTL.
 * STORY: Invisible until you check in. Hold a place. Send a ShyText. Chat only if they accept.
 * FIRST VIEWPORT: Nearby large title, live venues, hold-to-check-in hint, live stamp if you’re visible.
 * FORM: Native Operate / HIG. Assigned BeReal disposable-camera world, seed 0441a7e4. Signature: hold-to-check-in.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
 */
import '../i18n';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { persistUserLanguage } from '../services/auth';
import { listenNotificationTaps, registerPushToken } from '../services/notifications';
import { brand, useTheme } from '../theme';
import { AwayCheckoutHost } from '../components/AwayCheckoutHost';

export default function RootLayout() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const { t } = useTranslation();
  const { user, hasProfile } = useAuth();

  useEffect(() => {
    if (user && hasProfile) {
      registerPushToken();
      void persistUserLanguage();
    }
  }, [user, hasProfile]);

  useEffect(() => {
    const sub = listenNotificationTaps();
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            headerTintColor: brand.accent,
            headerShadowVisible: false,
            headerBackTitle: t('common.back'),
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="venue/[venueId]" options={{ headerShown: true, title: t('common.venue') }} />
          <Stack.Screen name="shytext/create" options={{ headerShown: true, title: t('common.checkIn') }} />
          <Stack.Screen name="shytext/[shytextId]" options={{ headerShown: true, title: 'ShyText' }} />
          <Stack.Screen name="chat/[chatId]" options={{ headerShown: true, title: t('common.chat') }} />
          <Stack.Screen name="requests/index" options={{ headerShown: false }} />
          <Stack.Screen name="settings/index" options={{ headerShown: true, title: t('settings.title') }} />
          <Stack.Screen name="settings/edit-profile" options={{ headerShown: true, title: t('profile.edit') }} />
          <Stack.Screen name="settings/notifications" options={{ headerShown: true, title: t('settings.notifications') }} />
          <Stack.Screen name="settings/privacy" options={{ headerShown: true, title: t('settings.privacy') }} />
          <Stack.Screen name="settings/blocked-users" options={{ headerShown: true, title: t('settings.blocked') }} />
          <Stack.Screen name="settings/delete-account" options={{ headerShown: true, title: t('settings.deleteAccount') }} />
          <Stack.Screen name="legal/privacy" options={{ headerShown: true, title: t('legal.privacy') }} />
          <Stack.Screen name="legal/terms" options={{ headerShown: true, title: t('legal.terms') }} />
        </Stack>
        <AwayCheckoutHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

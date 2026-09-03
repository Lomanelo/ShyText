import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { clearPushNotice, subscribePushNotice } from '../services/pushInbox';
import { radius, space, type, useTheme } from '../theme';
import { PressScale } from './PressScale';

export function IncomingPushHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<{
    id: string;
    title: string;
    body: string;
    route?: '/(tabs)/chats' | `/chat/${string}`;
  } | null>(null);

  useEffect(() => subscribePushNotice(setNotice), []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => clearPushNotice(), 4200);
    return () => clearTimeout(id);
  }, [notice]);

  if (!notice) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      <PressScale
        onPress={() => {
          const route = notice.route;
          clearPushNotice();
          if (route) router.push(route);
        }}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      >
        <Ionicons name="notifications" size={20} color={theme.accent} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]} numberOfLines={1}>
            {notice.title}
          </Text>
          <Text style={[type.caption, { color: theme.muted }]} numberOfLines={2}>
            {notice.body}
          </Text>
        </View>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: space[16],
    right: space[16],
    zIndex: 100,
  },
  card: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space[16],
    paddingVertical: 12,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});

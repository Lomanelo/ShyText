import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { type, useTheme } from '../theme';

/** Thin top banner when the device has no network — peers always surface this. */
export function OfflineBanner() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOffline(!connected);
    });
    return () => unsub();
  }, []);

  if (!offline) return null;

  return (
    <View style={[styles.bar, { backgroundColor: theme.danger }]} accessibilityRole="alert">
      <Text style={[type.caption, { color: '#fff', fontWeight: '600', textAlign: 'center' }]}>
        {t('common.offline')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});

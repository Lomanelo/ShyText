import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { type, useTheme } from '../theme';

type NetInfoModule = {
  addEventListener: (
    listener: (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void
  ) => () => void;
};

function loadNetInfo(): NetInfoModule | null {
  try {
    // Lazy load so a missing native binary (old dev client) does not crash boot.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-community/netinfo') as { default?: NetInfoModule } & NetInfoModule;
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

/** Thin top banner when the device has no network. No-ops if NetInfo isn’t in this build. */
export function OfflineBanner() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const NetInfo = loadNetInfo();
    if (!NetInfo?.addEventListener) return;

    let unsub: (() => void) | undefined;
    try {
      unsub = NetInfo.addEventListener((state) => {
        const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
        setOffline(!connected);
      });
    } catch {
      // Native module present in JS but not linked — skip banner.
    }
    return () => unsub?.();
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

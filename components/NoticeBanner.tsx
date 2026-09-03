import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, Theme, type } from '../theme';
import { PressScale } from './PressScale';
import { useTranslation } from 'react-i18next';

export function NoticeBanner({
  message,
  tone,
  theme,
  onDismiss,
}: {
  message: string;
  tone: 'ok' | 'error';
  theme: Theme;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const ok = tone === 'ok';

  useEffect(() => {
    if (!ok) return;
    const id = setTimeout(onDismiss, 3200);
    return () => clearTimeout(id);
  }, [ok, message, onDismiss]);

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: ok ? theme.accentSoft : 'rgba(255, 59, 48, 0.12)' },
      ]}
    >
      <Ionicons
        name={ok ? 'checkmark-circle' : 'alert-circle'}
        size={22}
        color={ok ? theme.accent : theme.danger}
      />
      <Text style={[type.headline, { color: theme.text, flex: 1 }]}>{message}</Text>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={t('a11y.dismissHint')}
        onPress={onDismiss}
        hitSlop={8}
        style={styles.close}
      >
        <Ionicons name="close" size={18} color={theme.quiet} />
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingLeft: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
  },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

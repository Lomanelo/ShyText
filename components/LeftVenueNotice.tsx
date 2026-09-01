import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { cardShadow, motion, radius, space, type, useTheme } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { LeftVenueNotice as Notice } from '../hooks/useAwayCheckout';
import { PressScale } from './PressScale';
import { useTranslation } from 'react-i18next';

export function LeftVenueNotice({
  notice,
  onDismiss,
}: {
  notice: Notice | null;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!notice) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const timer = setTimeout(onDismiss, 4_800);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        entering={
          reduce
            ? FadeIn.duration(motion.duration)
            : FadeInDown.springify().damping(motion.layout.damping).stiffness(motion.layout.stiffness)
        }
        exiting={
          reduce
            ? FadeOut.duration(motion.duration)
            : FadeOutUp.springify().damping(motion.layout.damping).stiffness(motion.layout.stiffness)
        }
        style={[
          styles.card,
          cardShadow(theme),
          {
            top: insets.top + space[8],
            backgroundColor: theme.card,
          },
        ]}
      >
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss')}
          style={styles.body}
        >
          <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="walk-outline" size={22} color={theme.accent} />
          </View>
          <View style={styles.copy}>
            <Text style={[type.headline, { color: theme.text }]} numberOfLines={1}>
              {t('venue.leftTitle', { venue: notice.venueName })}
            </Text>
            <Text style={[type.caption, { color: theme.muted }]}>
              {t('venue.leftBody')}
            </Text>
          </View>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
            onPress={onDismiss}
            hitSlop={8}
            style={styles.close}
          >
            <Ionicons name="close" size={18} color={theme.quiet} />
          </PressScale>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: space[16],
    right: space[16],
    borderRadius: radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    zIndex: 50,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingLeft: space[12],
    paddingVertical: space[12],
    minHeight: 72,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

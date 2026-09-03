import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { vibeLabel } from '../i18n/labels';
import { normalizeVibe } from '../types/shytext';
import { useTranslation } from 'react-i18next';
import { cardShadow, radius, space, Theme, type } from '../theme';
import { remainingCompact } from '../utils/dates';
import { prefetchProfileImage } from '../services/imageCache';
import { Avatar } from './Avatar';
import { PressScale } from './PressScale';
import { CheckIn } from '../types/venue';
import type { VenueContactMode } from '../hooks/useVenueContacts';

export function ApproachableUserCard({
  person,
  theme,
  mode,
  onSend,
  onAccept,
  onOpenChat,
  onReport,
}: {
  person: CheckIn;
  theme: Theme;
  mode: VenueContactMode;
  onSend: () => void;
  onAccept: () => void | Promise<void>;
  onOpenChat: () => void;
  onReport: () => void;
}) {
  const { t } = useTranslation();
  const name = person.age
    ? `${person.displayName ?? t('common.someone')}, ${person.age}`
    : person.displayName ?? t('common.someone');
  const swipe = useRef<Swipeable>(null);
  const vibe = person.vibe ? normalizeVibe(person.vibe) : undefined;
  const canSwipe = mode.kind === 'send' || mode.kind === 'accept';

  useEffect(() => {
    prefetchProfileImage([person.userId, person.avatarUrl], person.avatarUrl);
  }, [person.avatarUrl, person.userId]);

  const primary = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipe.current?.close();
    if (mode.kind === 'accept') onAccept();
    else if (mode.kind === 'chat') onOpenChat();
    else if (mode.kind === 'send') onSend();
  };

  const label =
    mode.kind === 'sent'
      ? t('venue.alreadySent')
      : mode.kind === 'accept'
        ? t('common.accept')
        : mode.kind === 'chat'
          ? t('venue.openChat')
          : t('venue.sendShyText');

  const a11y =
    mode.kind === 'sent'
      ? t('venue.alreadySentA11y', { name: person.displayName ?? t('common.them') })
      : mode.kind === 'accept'
        ? t('venue.acceptA11y', { name: person.displayName ?? t('common.them') })
        : mode.kind === 'chat'
          ? t('venue.openChatA11y', { name: person.displayName ?? t('common.them') })
          : t('venue.sendToA11y', { name: person.displayName ?? t('common.them') });

  const preview =
    mode.kind === 'accept' ? mode.request.introMessage || mode.request.shytextMessage : undefined;

  return (
    <Swipeable
      ref={swipe}
      friction={1.6}
      overshootFriction={8}
      overshootRight
      overshootLeft={false}
      enabled={canSwipe}
      renderRightActions={() =>
        !canSwipe ? null : (
          <View style={[styles.swipe, { backgroundColor: theme.accent }]}>
            <Text style={[type.headline, { color: theme.onAccent }]}>
              {mode.kind === 'accept' ? t('common.accept') : t('common.send')}
            </Text>
          </View>
        )
      }
      onSwipeableOpen={(direction) => {
        if (direction === 'right') primary();
      }}
    >
      <View style={[styles.card, cardShadow(theme), { backgroundColor: theme.card }]}>
        <View style={styles.top}>
          <Avatar name={person.displayName} uri={person.avatarUrl} userId={person.userId} theme={theme} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.headline, { color: theme.text }]}>{name}</Text>
            <Text style={[type.caption, { color: theme.accent, fontWeight: '600', fontVariant: ['tabular-nums'] }]}>
              {person.status || (vibe ? vibeLabel(vibe) : '')}
              {person.status || vibe ? ' · ' : ''}
              {remainingCompact(person.expiresAt)}
            </Text>
          </View>
        </View>
        {preview ? (
          <Text style={[type.body, { color: theme.muted }]} numberOfLines={2}>
            “{preview}”
          </Text>
        ) : null}
        {mode.kind === 'accept' ? (
          <Text style={[type.caption, { color: theme.quiet }]}>{t('venue.theySentFirst')}</Text>
        ) : null}
        <View style={styles.actions}>
          <PressScale
            disabled={mode.kind === 'sent'}
            accessibilityLabel={a11y}
            onPress={primary}
            style={[
              styles.hi,
              {
                backgroundColor:
                  mode.kind === 'sent' ? theme.border : mode.kind === 'chat' ? theme.bg : theme.accent,
              },
            ]}
          >
            <Text
              style={[
                type.headline,
                {
                  color:
                    mode.kind === 'sent'
                      ? theme.quiet
                      : mode.kind === 'chat'
                        ? theme.text
                        : theme.onAccent,
                },
              ]}
            >
              {label}
            </Text>
          </PressScale>
          <Pressable onPress={onReport} accessibilityLabel={t('venue.reportMore')} hitSlop={8} style={styles.more}>
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.quiet} />
          </Pressable>
        </View>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[16],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    marginBottom: space[12],
    gap: space[12],
  },
  swipe: {
    width: 96,
    marginBottom: space[12],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[12] },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hi: {
    borderRadius: radius.pill,
    paddingHorizontal: space[16],
    minHeight: 44,
    justifyContent: 'center',
  },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

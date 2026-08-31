import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { VIBE_LABELS, normalizeVibe } from '../types/shytext';
import { cardShadow, radius, space, Theme, type } from '../theme';
import { remainingCompact } from '../utils/dates';
import { Avatar } from './Avatar';
import { PressScale } from './PressScale';
import { CheckIn } from '../types/venue';

export function ApproachableUserCard({
  person,
  theme,
  onSend,
  onReport,
}: {
  person: CheckIn;
  theme: Theme;
  onSend: () => void;
  onReport: () => void;
}) {
  const name = person.age ? `${person.displayName ?? 'Someone'}, ${person.age}` : person.displayName ?? 'Someone';
  const swipe = useRef<Swipeable>(null);
  const vibe = person.vibe ? normalizeVibe(person.vibe) : undefined;

  const sayHi = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipe.current?.close();
    onSend();
  };

  return (
    <Swipeable
      ref={swipe}
      friction={1.6}
      overshootFriction={8}
      overshootRight
      overshootLeft={false}
      renderRightActions={() => (
        <View style={[styles.swipe, { backgroundColor: theme.accent }]}>
          <Text style={[type.headline, { color: theme.onAccent }]}>Send</Text>
        </View>
      )}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') sayHi();
      }}
    >
      <View style={[styles.card, cardShadow(theme), { backgroundColor: theme.card }]}>
        <View style={styles.top}>
          <Avatar name={person.displayName} uri={person.avatarUrl} theme={theme} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.headline, { color: theme.text }]}>{name}</Text>
            <Text style={[type.caption, { color: theme.accent, fontWeight: '600', fontVariant: ['tabular-nums'] }]}>
              {person.status || (vibe ? VIBE_LABELS[vibe] : '')}
              {person.status || vibe ? ' · ' : ''}
              {remainingCompact(person.expiresAt)}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <PressScale
            accessibilityLabel={`Send a ShyText to ${person.displayName ?? 'them'}`}
            onPress={sayHi}
            style={[styles.hi, { backgroundColor: theme.accent }]}
          >
            <Text style={[type.headline, { color: theme.onAccent }]}>Send a ShyText</Text>
          </PressScale>
          <Pressable onPress={onReport} accessibilityLabel="Report or more" hitSlop={8} style={styles.more}>
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

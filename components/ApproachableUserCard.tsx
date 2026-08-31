import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VIBE_LABELS, ShyTextPost } from '../types/shytext';
import { cardShadow, radius, space, Theme, type } from '../theme';
import { remainingCompact } from '../utils/dates';
import { Avatar } from './Avatar';

export function ApproachableUserCard({
  post,
  theme,
  onBreakIce,
  onReport,
}: {
  post: ShyTextPost;
  theme: Theme;
  onBreakIce: () => void;
  onReport: () => void;
}) {
  const name = post.authorAge ? `${post.authorName}, ${post.authorAge}` : post.authorName;
  return (
    <View style={[styles.card, cardShadow(theme), { backgroundColor: theme.card }]}>
      <View style={styles.top}>
        <Avatar name={post.authorName} uri={post.authorAvatarUrl} theme={theme} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.title, { color: theme.text }]}>{name}</Text>
          {post.authorBio ? (
            <Text style={[type.caption, { color: theme.muted }]}>{post.authorBio}</Text>
          ) : null}
        </View>
      </View>
      <Text style={[type.caption, { color: theme.accent, fontWeight: '700' }]}>
        {VIBE_LABELS[post.vibe]} · {remainingCompact(post.expiresAt)}
      </Text>
      {post.message ? <Text style={[type.body, { color: theme.muted }]}>“{post.message}”</Text> : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`Break the ice with ${post.authorName}`}
          onPress={onBreakIce}
          style={({ pressed }) => [styles.hi, { backgroundColor: theme.accent, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        >
          <Text style={styles.hiText}>Break the ice</Text>
        </Pressable>
        <Pressable
          onPress={onReport}
          accessibilityLabel="Report or more"
          hitSlop={8}
          style={styles.more}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={theme.quiet} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space[16], borderRadius: radius.lg, marginBottom: space[12], gap: space[12] },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[12] },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hi: { borderRadius: radius.pill, paddingHorizontal: space[16], minHeight: 44, justifyContent: 'center' },
  hiText: { color: '#fff', fontWeight: '700' },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

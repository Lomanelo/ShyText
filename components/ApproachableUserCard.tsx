import { Pressable, StyleSheet, Text, View } from 'react-native';
import { INTENT_LABELS, ShyTextPost } from '../types/shytext';
import { Theme } from '../theme';
import { Avatar } from './Avatar';
import { CountdownBadge } from './CountdownBadge';

export function ApproachableUserCard({
  post,
  theme,
  onSayHi,
  onReport,
}: {
  post: ShyTextPost;
  theme: Theme;
  onSayHi: () => void;
  onReport: () => void;
}) {
  const name = post.authorAge ? `${post.authorName}, ${post.authorAge}` : post.authorName;
  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.top}>
        <Avatar name={post.authorName} uri={post.authorAvatarUrl} theme={theme} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
          <Text style={[styles.intent, { color: theme.accent }]}>{INTENT_LABELS[post.intent]}</Text>
        </View>
        <CountdownBadge expiresAt={post.expiresAt} theme={theme} />
      </View>
      {post.message ? (
        <Text style={[styles.message, { color: theme.muted }]}>“{post.message}”</Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`Say hi to ${post.authorName}`}
          onPress={onSayHi}
          style={[styles.hi, { backgroundColor: theme.accent }]}
        >
          <Text style={styles.hiText}>Say hi</Text>
        </Pressable>
        <Pressable onPress={onReport} accessibilityLabel="Report or more">
          <Text style={{ color: theme.quiet, fontSize: 22 }}>⋯</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 20, marginBottom: 14, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 20, fontWeight: '800' },
  intent: { fontWeight: '700', marginTop: 4 },
  message: { fontSize: 16, lineHeight: 22 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hi: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  hiText: { color: '#fff', fontWeight: '700' },
});

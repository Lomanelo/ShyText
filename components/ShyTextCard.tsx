import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ShyTextPost } from '../types/shytext';
import { Theme } from '../theme';
import { Avatar } from './Avatar';
import { CountdownBadge } from './CountdownBadge';
import { timeAgo } from '../utils/dates';

const ICONS: Record<string, string> = {
  chat: '💬',
  play: '🎲',
  social: '🍻',
  study: '📚',
  watch: '⚽',
  network: '🤝',
  game: '🎮',
  other: '✨',
};

export function ShyTextCard({
  post,
  theme,
  isOwn,
  onHello,
  onReport,
  onDelete,
}: {
  post: ShyTextPost;
  theme: Theme;
  isOwn?: boolean;
  onHello: () => void;
  onReport: () => void;
  onDelete?: () => void;
}) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <Text style={styles.emoji}>{ICONS[post.category] ?? '✨'}</Text>
      <Text style={[styles.message, { color: theme.text }]}>{post.message}</Text>
      <View style={styles.row}>
        <Avatar name={post.authorName} uri={post.authorAvatarUrl} theme={theme} size={32} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>{post.authorName}</Text>
          <Text style={{ color: theme.muted, fontSize: 12 }}>{timeAgo(post.createdAt)}</Text>
        </View>
        <CountdownBadge expiresAt={post.expiresAt} theme={theme} />
      </View>
      <View style={styles.actions}>
        {!isOwn ? (
          <Pressable onPress={onHello} style={[styles.hello, { backgroundColor: theme.accent }]}>
            <Text style={styles.helloText}>Say hello</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onDelete}>
            <Text style={{ color: theme.muted, fontWeight: '600' }}>Delete</Text>
          </Pressable>
        )}
        <Pressable onPress={onReport} accessibilityLabel="Report">
          <Text style={{ color: theme.quiet, fontSize: 22 }}>⋯</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 20, marginBottom: 14, gap: 12 },
  emoji: { fontSize: 28 },
  message: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hello: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  helloText: { color: '#fff', fontWeight: '700' },
});

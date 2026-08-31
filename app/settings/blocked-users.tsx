import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { useTheme } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import { listBlockedIds, unblockUser } from '../../services/blocks';
import { getUserProfile } from '../../services/auth';

export default function BlockedUsersScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);

  const load = async () => {
    if (!user) return;
    const ids = await listBlockedIds(user.uid);
    const people = await Promise.all(
      ids.map(async (id) => ({
        id,
        name: (await getUserProfile(id))?.displayName ?? 'Someone',
      }))
    );
    setRows(people);
  };

  useEffect(() => {
    load();
  }, [user?.uid]);

  return (
    <Screen theme={theme}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={{ color: theme.accent, fontWeight: '700' }} onPress={() => router.back()}>
          ← Back
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>Blocked users</Text>
        {rows.length === 0 ? (
          <EmptyState theme={theme} title="Nobody blocked" body="People you block cannot break the ice or start a new chat." />
        ) : (
          rows.map((row) => (
            <View key={row.id} style={[styles.row, { backgroundColor: theme.card }]}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>{row.name}</Text>
              <Pressable
                onPress={async () => {
                  if (!user) return;
                  await unblockUser(user.uid, row.id);
                  load();
                }}
              >
                <Text style={{ color: theme.accent, fontWeight: '700' }}>Unblock</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 12 },
  title: { fontSize: 32, fontWeight: '800' },
  row: { borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between' },
});

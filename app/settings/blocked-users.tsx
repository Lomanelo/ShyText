import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { radius, type, useTheme } from '../../theme';
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
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.wrap} contentInsetAdjustmentBehavior="automatic">
        {rows.length === 0 ? (
          <EmptyState theme={theme} title="Nobody blocked" />
        ) : (
          rows.map((row) => (
            <View key={row.id} style={[styles.row, { backgroundColor: theme.card }]}>
              <Text style={[type.headline, { color: theme.text }]}>{row.name}</Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={async () => {
                  if (!user) return;
                  await unblockUser(user.uid, row.id);
                  load();
                }}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={[type.headline, { color: theme.accent }]}>Unblock</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  row: {
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

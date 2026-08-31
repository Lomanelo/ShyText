import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Group, ListRow } from '../../components/ListRow';
import { useTheme } from '../../theme';

export default function SettingsScreen() {
  const theme = useTheme();
  return (
    <Screen theme={theme} inset={false}>
      <ScrollView contentContainerStyle={styles.wrap} contentInsetAdjustmentBehavior="automatic">
        <Group theme={theme}>
          <ListRow title="Privacy" theme={theme} onPress={() => router.push('/settings/privacy')} />
          <ListRow title="Blocked users" theme={theme} last onPress={() => router.push('/settings/blocked-users')} />
        </Group>
        <Group theme={theme}>
          <ListRow title="Privacy policy" theme={theme} onPress={() => router.push('/legal/privacy')} />
          <ListRow title="Terms" theme={theme} last onPress={() => router.push('/legal/terms')} />
        </Group>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 16 },
});

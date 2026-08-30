import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme';

export default function SettingsScreen() {
  const theme = useTheme();
  return (
    <Screen theme={theme}>
      <View style={styles.wrap}>
        <Text style={{ color: theme.accent, fontWeight: '700' }} onPress={() => router.back()}>
          ← Back
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        <Pressable onPress={() => router.push('/settings/privacy')} style={styles.row}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Privacy</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings/blocked-users')} style={styles.row}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Blocked users</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/legal/privacy')} style={styles.row}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Privacy policy</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/legal/terms')} style={styles.row}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Terms</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 8 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 12 },
  row: { paddingVertical: 16 },
});

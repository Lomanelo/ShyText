import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Avatar } from '../../components/Avatar';
import { FlameMark } from '../../components/flame-mark';
import { Wordmark } from '../../components/wordmark';
import { cardShadow, radius, space, type, useTheme } from '../../theme';

export default function WelcomeScreen() {
  const theme = useTheme();

  return (
    <Screen theme={theme}>
      <View style={styles.wrap}>
        <Wordmark theme={theme} size={28} />

        <View style={styles.hero}>
          <FlameMark size={88} />
          <Text style={[type.display, { color: theme.text }]}>
            Meet people who{'\n'}are already there.
          </Text>
          <Text style={[type.body, { color: theme.muted }]}>
            Same café. Same bar. You decide when you’re approachable.
          </Text>

          <View style={[styles.person, cardShadow(theme), { backgroundColor: theme.card }]}>
            <View style={styles.personTop}>
              <Avatar name="Sarah" theme={theme} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: theme.text, fontSize: 18, lineHeight: 24 }]}>Sarah, 23</Text>
                <Text style={[type.caption, { color: theme.muted }]}>Architecture student</Text>
              </View>
            </View>
            <Text style={[type.caption, { color: theme.accent, fontWeight: '700' }]}>☕ Coffee · 14m</Text>
            <Text style={[type.body, { color: theme.muted }]}>“Waiting for a friend, happy to chat.”</Text>
            <View style={[styles.hi, { backgroundColor: theme.accent }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Break the ice</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton title="Get started" theme={theme} onPress={() => router.push('/(auth)/create-account')} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(auth)/sign-in')}
            style={styles.secondary}
          >
            <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 16 }}>I already have an account</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space[24], paddingBottom: space[8], justifyContent: 'space-between' },
  hero: { gap: space[16], paddingTop: space[16] },
  person: { borderRadius: radius.lg, padding: space[16], gap: space[12], marginTop: space[8] },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: space[12] },
  hi: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space[16], minHeight: 40, justifyContent: 'center' },
  actions: { gap: space[12], paddingBottom: space[8] },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});

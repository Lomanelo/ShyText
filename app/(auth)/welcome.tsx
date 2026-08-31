import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { FlameMark } from '../../components/flame-mark';
import { Wordmark } from '../../components/wordmark';
import { space, type, useTheme } from '../../theme';

export default function WelcomeScreen() {
  const theme = useTheme();

  return (
    <Screen theme={theme}>
      <View style={styles.wrap}>
        <Wordmark theme={theme} size={28} />

        <View style={styles.hero}>
          <FlameMark size={88} />
          <Text style={[type.display, { color: theme.text }]}>
            Make yourself{'\n'}approachable.
          </Text>
          <Text style={[type.body, { color: theme.muted }]}>
            Same café. Same bar. Drop a ShyText when you’re open to being approached. Chat starts only if they accept.
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton title="Get started" theme={theme} onPress={() => router.push('/(auth)/create-account')} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(auth)/sign-in')}
            style={styles.secondary}
          >
            <Text style={[type.headline, { color: theme.accent }]}>I already have an account</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: space[24], paddingBottom: space[8], justifyContent: 'space-between' },
  hero: { gap: space[16], paddingTop: space[16] },
  actions: { gap: space[12], paddingBottom: space[8] },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});

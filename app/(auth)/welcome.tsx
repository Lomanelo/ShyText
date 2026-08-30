import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useTheme } from '../../theme';

const SLIDES = [
  {
    title: 'Meet people who are already there.',
    body: 'ShyText helps break the ice with people at the same place.',
  },
  {
    title: 'Make yourself approachable.',
    body: "Choose what you're open to and go visible for a few minutes.",
  },
  {
    title: 'Only when you choose.',
    body: 'Checking in never makes you visible. Your exact location is never shared.',
  },
];

export default function WelcomeScreen() {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];

  return (
    <Screen theme={theme}>
      <View style={styles.wrap}>
        <Text style={[styles.wordmark, { color: theme.accent }]}>shytext</Text>
        <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
          <Text style={[styles.title, { color: theme.text }]}>{slide.title}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>{slide.body}</Text>
        </View>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === index ? theme.accent : theme.border },
              ]}
            />
          ))}
        </View>
        {index < SLIDES.length - 1 ? (
          <PrimaryButton title="Next" theme={theme} onPress={() => setIndex(index + 1)} />
        ) : (
          <PrimaryButton title="Get started" theme={theme} onPress={() => router.push('/(auth)/sign-in')} />
        )}
        <Pressable onPress={() => router.push('/(auth)/sign-in')} accessibilityRole="button">
          <Text style={[styles.skip, { color: theme.muted }]}>I already have an account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 28, justifyContent: 'space-between' },
  wordmark: { fontSize: 18, fontWeight: '800', letterSpacing: 0.4 },
  title: { fontSize: 34, fontWeight: '800', lineHeight: 40 },
  body: { fontSize: 18, lineHeight: 26 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  skip: { textAlign: 'center', marginTop: 16, fontWeight: '600' },
});

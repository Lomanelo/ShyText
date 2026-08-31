import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';
import { ICEBREAKERS, ShyTextVibe, VIBE_LABELS } from '../types/shytext';
import { Theme } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { MAX_MESSAGE_LENGTH } from '../utils/config';

export function ChatRequestModal({
  visible,
  name,
  theme,
  vibe,
  message,
  onClose,
  onSend,
}: {
  visible: boolean;
  name: string;
  theme: Theme;
  vibe?: ShyTextVibe;
  message?: string;
  onClose: () => void;
  onSend: (intro?: string) => Promise<void>;
}) {
  const [intro, setIntro] = useState('');
  const [writeOwn, setWriteOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replies = vibe ? ICEBREAKERS[vibe] : [];

  useEffect(() => {
    if (visible) {
      setIntro('');
      setWriteOwn(false);
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const send = async (text?: string) => {
    setBusy(true);
    setError(null);
    try {
      await onSend(text?.trim() || undefined);
      setIntro('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>Break the ice with {name}?</Text>
          {vibe ? (
            <Text style={{ color: theme.muted }}>They’re up for {VIBE_LABELS[vibe]}</Text>
          ) : null}
          {message ? <Text style={{ color: theme.muted }}>“{message}”</Text> : null}

          {!writeOwn ? (
            <View style={styles.chips}>
              {replies.map((reply) => (
                <Pressable
                  key={reply}
                  disabled={busy}
                  onPress={() => send(reply)}
                  style={[styles.chip, { backgroundColor: theme.bg }]}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{reply}</Text>
                </Pressable>
              ))}
              <Pressable
                disabled={busy}
                onPress={() => setWriteOwn(true)}
                style={[styles.chip, { backgroundColor: theme.accentSoft }]}
              >
                <Text style={{ color: theme.accent, fontWeight: '700' }}>Write my own…</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                value={intro}
                onChangeText={setIntro}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Write a short hello…"
                placeholderTextColor={theme.quiet}
                autoFocus
                style={[styles.input, { color: theme.text, backgroundColor: theme.bg }]}
              />
              <PrimaryButton
                title="Send"
                theme={theme}
                loading={busy}
                onPress={() => send(intro)}
              />
            </>
          )}
          {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 22, padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  input: { borderRadius: 14, padding: 14, minHeight: 80 },
});

import { Modal, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useState } from 'react';
import { Theme } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { MAX_MESSAGE_LENGTH } from '../utils/config';

export function ChatRequestModal({
  visible,
  name,
  theme,
  onClose,
  onSend,
}: {
  visible: boolean;
  name: string;
  theme: Theme;
  onClose: () => void;
  onSend: (intro?: string) => Promise<void>;
}) {
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>Say hello to {name}?</Text>
          <TextInput
            value={intro}
            onChangeText={setIntro}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="I'm down for dominoes 👋"
            placeholderTextColor={theme.quiet}
            style={[styles.input, { color: theme.text, backgroundColor: theme.bg }]}
          />
          {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
          <PrimaryButton
            title="Send request"
            theme={theme}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await onSend(intro.trim() || undefined);
                setIntro('');
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not send.');
              } finally {
                setBusy(false);
              }
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 22, padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  input: { borderRadius: 14, padding: 14, minHeight: 80 },
});

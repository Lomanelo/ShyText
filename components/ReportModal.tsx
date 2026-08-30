import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { Theme } from '../theme';
import { REPORT_REASONS, submitReport } from '../services/reports';
import { ReportTarget } from '../types/chat';
import { PrimaryButton } from './PrimaryButton';

export function ReportModal({
  visible,
  onClose,
  theme,
  targetType,
  targetId,
}: {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  targetType: ReportTarget;
  targetId: string;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await submitReport({ targetType, targetId, reason, details });
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.card }]} onPress={() => undefined}>
          <Text style={[styles.title, { color: theme.text }]}>{done ? 'Report sent' : 'Report'}</Text>
          {!done ? (
            <>
              {REPORT_REASONS.map((item) => (
                <Pressable key={item} onPress={() => setReason(item)}>
                  <Text style={{ color: item === reason ? theme.accent : theme.text, paddingVertical: 8, fontWeight: '600' }}>
                    {item}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Optional details"
                placeholderTextColor={theme.quiet}
                style={[styles.input, { color: theme.text, backgroundColor: theme.bg }]}
              />
              <PrimaryButton title="Submit report" onPress={submit} theme={theme} loading={busy} />
            </>
          ) : (
            <PrimaryButton title="Close" onPress={onClose} theme={theme} />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 22, padding: 20, gap: 8 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  input: { borderRadius: 12, padding: 12, minHeight: 64 },
});

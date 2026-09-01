import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Theme } from '../theme';
import { REPORT_REASON_KEYS, submitReport } from '../services/reports';
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
  const { t } = useTranslation();
  const [reason, setReason] = useState<(typeof REPORT_REASON_KEYS)[number]>(REPORT_REASON_KEYS[0]);
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
          <Text style={[styles.title, { color: theme.text }]}>{done ? t('report.sent') : t('report.title')}</Text>
          {!done ? (
            <>
              {REPORT_REASON_KEYS.map((item) => (
                <Pressable key={item} onPress={() => setReason(item)}>
                  <Text style={{ color: item === reason ? theme.accent : theme.text, paddingVertical: 8, fontWeight: '600' }}>
                    {t(`report.${item}`)}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder={t('report.details')}
                placeholderTextColor={theme.quiet}
                style={[styles.input, { color: theme.text, backgroundColor: theme.bg }]}
              />
              <PrimaryButton title={t('report.submit')} onPress={submit} theme={theme} loading={busy} />
            </>
          ) : (
            <PrimaryButton title={t('common.close')} onPress={onClose} theme={theme} />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 22, borderCurve: 'continuous', padding: 20, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  input: { borderRadius: 12, borderCurve: 'continuous', padding: 12, minHeight: 64, fontSize: 17 },
});

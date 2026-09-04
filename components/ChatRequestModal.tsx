import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { icebreakerKeyFor, icebreakersFor } from '../i18n/labels';
import { ShyTextVibe } from '../types/shytext';
import { useTranslation } from 'react-i18next';
import { radius, space, Theme, type } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { PressScale } from './PressScale';
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
  /** introKey is set when the intro is an unedited suggestion — receiver sees it translated. */
  onSend: (intro?: string, introKey?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [intro, setIntro] = useState('');
  const [writeOwn, setWriteOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replies = icebreakersFor(vibe ?? 'chat');

  useEffect(() => {
    if (visible) {
      setIntro('');
      setWriteOwn(false);
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const send = async (text?: string, introKey?: string) => {
    setBusy(true);
    setError(null);
    try {
      await onSend(text?.trim() || undefined, introKey);
      setIntro('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.couldNotSend'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.frame}>
        <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[type.title, { color: theme.text }]}>{t('venue.sendTo', { name })}</Text>
          {message ? <Text style={[type.body, { color: theme.muted }]}>“{message}”</Text> : null}

          {!writeOwn ? (
            <View style={styles.chips}>
              {replies.map((reply, index) => (
                <PressScale
                  key={reply}
                  disabled={busy}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    void send(reply, icebreakerKeyFor(vibe ?? 'chat', index));
                  }}
                  style={[styles.chip, { backgroundColor: theme.bg }]}
                >
                  <Text style={[type.headline, { color: theme.text }]}>{reply}</Text>
                </PressScale>
              ))}
              <PressScale
                disabled={busy}
                onPress={() => setWriteOwn(true)}
                style={[styles.chip, { backgroundColor: theme.accentSoft }]}
              >
                <Text style={[type.headline, { color: theme.accent }]}>{t('venue.writeOwn')}</Text>
              </PressScale>
            </View>
          ) : (
            <>
              <TextInput
                value={intro}
                onChangeText={setIntro}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder={t('venue.helloPlaceholder')}
                placeholderTextColor={theme.quiet}
                autoFocus
                returnKeyType="send"
                onSubmitEditing={() => send(intro)}
                style={[styles.input, { color: theme.text, backgroundColor: theme.bg }]}
              />
              <PrimaryButton title={t('common.send')} theme={theme} loading={busy} onPress={() => send(intro)} />
            </>
          )}
          {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
          <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
            <Text style={[type.headline, { color: theme.muted }]}>{t('venue.notNow')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    padding: space[24],
    paddingBottom: space[32],
    gap: space[12],
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  input: { borderRadius: radius.md, borderCurve: 'continuous', padding: 14, minHeight: 80, fontSize: 17 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});

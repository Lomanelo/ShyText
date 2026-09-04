import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cardShadow, radius, space, Theme, type } from '../theme';
import { ChatRequest } from '../types/chat';
import { Avatar } from './Avatar';
import { AvatarLightbox } from './AvatarLightbox';
import { PressScale } from './PressScale';
import { icebreakerFromKey } from '../i18n/labels';
import { useTranslation } from 'react-i18next';

export function RequestCard({
  request,
  theme,
  busy,
  onAccept,
  onDecline,
}: {
  request: ChatRequest;
  theme: Theme;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(false);
  // Suggested icebreakers translate into the receiver's language; custom text stays as written.
  const preview =
    (request.introMessage ? icebreakerFromKey(request.introKey) : undefined) ??
    request.introMessage ??
    request.shytextMessage;

  return (
    <View style={[styles.card, cardShadow(theme), { backgroundColor: theme.card }]}>
      <View style={styles.top}>
        <Pressable
          onPress={() => setZoom(true)}
          accessibilityRole="imagebutton"
          accessibilityLabel={t('a11y.viewPhoto', { name: request.senderName })}
          hitSlop={4}
        >
          <Avatar
            name={request.senderName}
            uri={request.senderAvatarUrl}
            userId={request.senderId}
            theme={theme}
            size={52}
          />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.headline, { color: theme.text }]} numberOfLines={1}>
            {request.senderName}
          </Text>
          {request.venueName ? (
            <Text style={[type.caption, { color: theme.quiet }]} numberOfLines={1}>
              {request.venueName}
            </Text>
          ) : null}
        </View>
      </View>
      {preview ? (
        <Text style={[type.body, { color: theme.muted }]} numberOfLines={3}>
          {preview}
        </Text>
      ) : null}
      <View style={styles.row}>
        <PressScale
          disabled={busy}
          onPress={onDecline}
          accessibilityRole="button"
          accessibilityLabel={t('common.decline')}
          style={[styles.pill, { backgroundColor: theme.bg }]}
        >
          <Text style={[type.headline, { color: theme.muted }]}>{t('common.decline')}</Text>
        </PressScale>
        <PressScale
          disabled={busy}
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel={t('common.accept')}
          style={[styles.pill, { backgroundColor: theme.accent }]}
        >
          <Text style={[type.headline, { color: theme.onAccent }]}>{t('common.accept')}</Text>
        </PressScale>
      </View>

      <AvatarLightbox
        visible={zoom}
        name={request.senderName}
        uri={request.senderAvatarUrl}
        userId={request.senderId}
        theme={theme}
        onClose={() => setZoom(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: space[16],
    gap: space[12],
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[12] },
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
});

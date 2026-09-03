import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Avatar } from './Avatar';
import { lookupImage } from '../services/imageCache';
import { Theme, type } from '../theme';

/**
 * Instagram / WhatsApp pattern: tap avatar → dim fullscreen, pinch to zoom, tap outside to close.
 */
export function AvatarLightbox({
  visible,
  name,
  uri,
  userId,
  theme,
  onClose,
}: {
  visible: boolean;
  name?: string;
  uri?: string;
  userId?: string;
  theme: Theme;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - 48, height * 0.62, 360);
  const src = uri || lookupImage(userId, uri);
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const [ready, setReady] = useState(visible);

  useEffect(() => {
    setReady(visible);
    if (!visible) {
      scale.value = 1;
      saved.value = 1;
    }
  }, [visible, scale, saved]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(3.2, Math.max(1, saved.value * e.scale));
    })
    .onEnd(() => {
      saved.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        saved.value = 1;
      }
    });

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal visible={ready} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <Text style={[type.headline, { color: '#fff', flex: 1 }]} numberOfLines={1}>
            {name || t('common.someone')}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={styles.close}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
        <GestureDetector gesture={pinch}>
          <Animated.View style={[styles.stage, zoomStyle]}>
            {src ? (
              <Image
                source={{ uri: src }}
                cachePolicy="memory-disk"
                contentFit="cover"
                style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)',
                }}
              />
            ) : (
              <Avatar name={name} userId={userId} theme={theme} size={size} />
            )}
          </Animated.View>
        </GestureDetector>
        {src ? (
          <Text style={[type.caption, styles.hint, { paddingBottom: insets.bottom + 16 }]}>
            {t('a11y.pinchToZoom')}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    position: 'absolute',
    bottom: 0,
    color: 'rgba(255,255,255,0.55)',
  },
});

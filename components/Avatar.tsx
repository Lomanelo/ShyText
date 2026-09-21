import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { initials } from '../utils/validation';
import { Theme, type } from '../theme';
import { lookupImage, prefetchProfileImage } from '../services/imageCache';

export function Avatar({
  name,
  uri,
  userId,
  theme,
  size = 40,
}: {
  name?: string;
  uri?: string;
  userId?: string;
  theme: Theme;
  size?: number;
}) {
  const src = uri || lookupImage(userId, uri);
  const [photoReady, setPhotoReady] = useState(false);

  useEffect(() => {
    setPhotoReady(false);
    prefetchProfileImage([userId, uri], uri);
  }, [uri, userId]);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.accentSoft,
        borderWidth: 1,
        borderColor: theme.imageOutline,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[type.headline, { color: theme.accent, fontSize: size * 0.36 }]}>
        {initials(name)}
      </Text>
      {src ? (
        <Image
          source={{ uri: src }}
          cachePolicy="memory-disk"
          recyclingKey={src}
          transition={0}
          priority="high"
          contentFit="cover"
          onLoad={() => setPhotoReady(true)}
          style={[StyleSheet.absoluteFill, { opacity: photoReady ? 1 : 0 }]}
        />
      ) : null}
    </View>
  );
}

import { useEffect } from 'react';
import { Text, View } from 'react-native';
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
  const outline = { borderWidth: 1, borderColor: theme.imageOutline };

  useEffect(() => {
    prefetchProfileImage([userId, uri], uri);
  }, [uri, userId]);

  if (src) {
    return (
      <Image
        source={{ uri: src }}
        cachePolicy="memory-disk"
        recyclingKey={src}
        transition={0}
        priority="high"
        contentFit="cover"
        style={{ width: size, height: size, borderRadius: size / 2, ...outline }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        ...outline,
      }}
    >
      <Text style={[type.headline, { color: theme.accent, fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

import { Image, Text, View } from 'react-native';
import { initials } from '../utils/validation';
import { Theme, type } from '../theme';

export function Avatar({
  name,
  uri,
  theme,
  size = 40,
}: {
  name?: string;
  uri?: string;
  theme: Theme;
  size?: number;
}) {
  const outline = { borderWidth: 1, borderColor: theme.imageOutline };
  if (uri) {
    return (
      <Image
        source={{ uri }}
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

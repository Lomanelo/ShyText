import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Theme, type } from '../theme';

export function ListRow({
  title,
  onPress,
  theme,
  last,
}: {
  title: string;
  onPress: () => void;
  theme: Theme;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        {
          marginHorizontal: -16,
          paddingHorizontal: 16,
          backgroundColor: pressed ? theme.bg : 'transparent',
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Text style={[type.body, { color: theme.text }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.quiet} />
    </Pressable>
  );
}

export function Group({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 16,
        borderCurve: 'continuous',
        overflow: 'hidden',
        paddingHorizontal: 16,
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

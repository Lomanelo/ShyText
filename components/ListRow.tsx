import { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Theme, type } from '../theme';

export function ListRow({
  title,
  subtitle,
  onPress,
  theme,
  last,
  destructive,
  accessory = 'chevron',
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  theme: Theme;
  last?: boolean;
  destructive?: boolean;
  accessory?: 'chevron' | 'none';
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
      <View style={styles.copy}>
        <Text style={[type.body, { color: destructive ? theme.danger : theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[type.caption, { color: theme.quiet }]}>{subtitle}</Text> : null}
      </View>
      {accessory === 'chevron' ? <Ionicons name="chevron-forward" size={18} color={theme.quiet} /> : null}
    </Pressable>
  );
}

export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  theme,
  last,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  theme: Theme;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        {
          marginHorizontal: -16,
          paddingHorizontal: 16,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <View style={styles.copy}>
        <Text style={[type.body, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[type.caption, { color: theme.quiet }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => {
          void Haptics.selectionAsync();
          onValueChange(next);
        }}
        trackColor={{ false: theme.border, true: theme.accent }}
        ios_backgroundColor={theme.border}
        accessibilityLabel={title}
      />
    </View>
  );
}

export function Group({
  children,
  theme,
  footer,
}: {
  children: ReactNode;
  theme: Theme;
  footer?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
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
      {footer ? (
        <Text style={[type.caption, { color: theme.quiet, paddingHorizontal: 16 }]}>{footer}</Text>
      ) : null}
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
    gap: 12,
  },
  copy: { flex: 1, gap: 2 },
});

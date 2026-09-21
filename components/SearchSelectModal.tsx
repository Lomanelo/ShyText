import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { radius, space, type, type Theme } from '../theme';

export type SelectOption = { id: string; label: string };

type Props = {
  visible: boolean;
  title: string;
  theme: Theme;
  options: SelectOption[];
  selectedId?: string;
  searchPlaceholder?: string;
  onClose: () => void;
  onSelect: (option: SelectOption) => void;
};

/** Compact searchable bottom sheet — not a full-screen takeover. */
export function SearchSelectModal({
  visible,
  title,
  theme,
  options,
  selectedId,
  searchPlaceholder,
  onClose,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const sheetHeight = Math.min(height * 0.55, 420);

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              height: sheetHeight,
              paddingBottom: Math.max(insets.bottom, space[12]),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={styles.head}>
            <Text style={[type.headline, { color: theme.text, flex: 1 }]} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={[styles.close, { backgroundColor: theme.bg }]}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          <View style={[styles.searchWrap, { backgroundColor: theme.bg }]}>
            <Ionicons name="search" size={18} color={theme.quiet} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={searchPlaceholder ?? t('common.search')}
              placeholderTextColor={theme.quiet}
              style={[styles.search, { color: theme.text }]}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('common.close')}>
                <Ionicons name="close-circle" size={18} color={theme.quiet} />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={16}
            windowSize={6}
            style={styles.list}
            contentContainerStyle={filtered.length === 0 ? styles.listEmpty : undefined}
            ListEmptyComponent={
              <Text style={[type.body, { color: theme.quiet, textAlign: 'center', padding: space[16] }]}>
                {t('common.noResults')}
              </Text>
            }
            renderItem={({ item, index }) => {
              const selected = item.id === selectedId;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={[
                    styles.row,
                    index < filtered.length - 1
                      ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }
                      : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[type.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: space[16],
    gap: space[12],
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: space[8],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    minHeight: 36,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    minHeight: 44,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: space[12],
  },
  search: { flex: 1, fontSize: 17, paddingVertical: 8 },
  list: { flex: 1 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  row: {
    minHeight: 48,
    paddingHorizontal: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
  },
});

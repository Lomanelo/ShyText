import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Venue } from '../types/venue';
import { Theme } from '../theme';
import { formatDistance } from '../utils/geo';

export function activityLabel(count = 0) {
  if (count >= 1) {
    return { label: `${count} ${count === 1 ? 'person' : 'people'} open`, icon: count >= 5 ? '🔥' : '🟢' };
  }
  return { label: 'Quiet', icon: '⚪' };
}

export function VenueCard({
  venue,
  distance,
  theme,
  onPress,
}: {
  venue: Venue;
  distance?: number;
  theme: Theme;
  onPress: () => void;
}) {
  const activity = activityLabel(venue.activeCount);
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: theme.card, shadowColor: '#000' }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: theme.text }]}>{venue.name}</Text>
        <Text style={{ color: theme.muted, marginTop: 4 }}>
          {distance != null ? formatDistance(distance) : venue.address || venue.category}
        </Text>
        <Text style={{ color: theme.accent, marginTop: 8, fontWeight: '700' }}>
          {activity.icon} {activity.label}
        </Text>
      </View>
      <Text style={[styles.cta, { color: theme.accent }]}>Check in</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    elevation: 2,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  name: { fontSize: 18, fontWeight: '700' },
  cta: { fontWeight: '700' },
});

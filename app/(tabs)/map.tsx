import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { LocationPermission } from '../../components/LocationPermission';
import { ActivityMap, HeatSheet } from '../../components/ActivityMap';
import { radius, space, type, useTheme } from '../../theme';
import { useLocation } from '../../hooks/useLocation';
import { useAuth } from '../../hooks/useAuth';
import { listenTodayVenueHeat, VenueHeatSpot } from '../../services/venueHeat';

export default function MapScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { coords, status, error, busy, refresh } = useLocation();
  const { user } = useAuth();
  const [spots, setSpots] = useState<VenueHeatSpot[]>([]);
  const [selected, setSelected] = useState<VenueHeatSpot | null>(null);

  useEffect(() => {
    if (status !== 'granted' && !coords) {
      void refresh();
    }
  }, [coords, refresh, status]);

  useEffect(() => {
    if (!user) {
      setSpots([]);
      return;
    }
    return listenTodayVenueHeat(setSpots);
  }, [user]);

  if (!coords) {
    return (
      <Screen theme={theme} inset={false}>
        {status !== 'granted' ? (
          <LocationPermission theme={theme} error={error} busy={busy} onAllow={() => refresh()} />
        ) : (
          <View style={{ padding: space[16] }}>
            <Text style={[type.body, { color: theme.muted }]}>Getting a precise location…</Text>
          </View>
        )}
      </Screen>
    );
  }

  return (
    <View style={styles.fill}>
      <ActivityMap user={coords} spots={spots} onSelect={setSelected} />
      <View pointerEvents="none" style={[styles.legend, { top: insets.top + space[8] }]}>
        <Text style={[type.caption, { color: 'rgba(255,244,234,0.7)', fontWeight: '600' }]}>Today</Text>
        <Text style={[type.headline, { color: '#FFF4EA' }]}>Busy places</Text>
        <Text style={[type.caption, { color: 'rgba(255,244,234,0.55)' }]}>
          Glow is ShyText count by venue. Not people. Not the notes.
        </Text>
      </View>
      {spots.length === 0 ? (
        <View pointerEvents="none" style={styles.empty}>
          <Text style={[type.body, { color: 'rgba(255,244,234,0.7)', textAlign: 'center' }]}>
            Quiet so far today. Drops show up here as heat.
          </Text>
        </View>
      ) : null}
      {selected ? (
        <Pressable style={styles.sheetWrap} onPress={() => setSelected(null)}>
          <HeatSheet spot={selected} user={coords} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0B0B0D' },
  legend: {
    position: 'absolute',
    left: space[16],
    right: space[16],
    padding: space[12],
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(12, 8, 6, 0.72)',
    gap: 2,
  },
  empty: {
    position: 'absolute',
    left: space[24],
    right: space[24],
    bottom: 120,
  },
  sheetWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: space[16],
  },
});

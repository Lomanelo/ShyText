import { useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { VenueHeatSpot } from '../services/venueHeat';
import { NEARBY_RADIUS_METERS, distanceBetween } from '../utils/geo';
import { radius, space, type } from '../theme';

const TILE = 256;
const MIN_Z = 13;
const MAX_Z = 17;
const START_Z = 15;

type Camera = { latitude: number; longitude: number; zoom: number };
type Size = { width: number; height: number };

function wrapTile(n: number, z: number) {
  const count = 2 ** z;
  return ((n % count) + count) % count;
}

function worldX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * TILE * 2 ** zoom;
}

function worldY(lat: number, zoom: number) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** zoom;
}

function lngFromWorldX(x: number, zoom: number) {
  return (x / (TILE * 2 ** zoom)) * 360 - 180;
}

function latFromWorldY(y: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * y) / (TILE * 2 ** zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function tileUrl(x: number, y: number, z: number) {
  const host = ['a', 'b', 'c', 'd'][(x + y) % 4];
  return `https://${host}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}@2x.png`;
}

function HeatBlob({ size, count }: { size: number; count: number }) {
  const heat = Math.min(1, Math.log2(1 + count) / 4);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `rgba(208, 89, 39, ${0.16 + heat * 0.22})`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.58,
          height: size * 0.58,
          borderRadius: 999,
          backgroundColor: `rgba(255, 122, 64, ${0.38 + heat * 0.4})`,
        }}
      />
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: '#FFF4EA',
        }}
      />
    </View>
  );
}

export function ActivityMap({
  user,
  spots,
  onSelect,
}: {
  user: { latitude: number; longitude: number } | null;
  spots: VenueHeatSpot[];
  onSelect: (spot: VenueHeatSpot) => void;
}) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera | null>(null);
  const origin = camera ?? (user ? { latitude: user.latitude, longitude: user.longitude, zoom: START_Z } : null);
  const drag = useSharedValue({ x: 0, y: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const commitPan = (dx: number, dy: number) => {
    if (!origin) return;
    setCamera({
      latitude: latFromWorldY(worldY(origin.latitude, origin.zoom) - dy, origin.zoom),
      longitude: lngFromWorldX(worldX(origin.longitude, origin.zoom) - dx, origin.zoom),
      zoom: origin.zoom,
    });
    drag.value = { x: 0, y: 0 };
  };

  const commitZoom = (scale: number) => {
    if (!origin) return;
    const next = Math.min(MAX_Z, Math.max(MIN_Z, Math.round(origin.zoom + Math.log2(Math.max(0.25, scale)))));
    setCamera({ ...origin, zoom: next });
  };

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      drag.value = { x: event.translationX, y: event.translationY };
    })
    .onEnd((event) => {
      runOnJS(commitPan)(event.translationX, event.translationY);
    });

  const pinch = Gesture.Pinch().onEnd((event) => {
    runOnJS(commitZoom)(event.scale);
  });

  const layerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value.x }, { translateY: drag.value.y }],
  }));

  const tiles = useMemo(() => {
    if (!origin || size.width < 8) return [];
    const cx = worldX(origin.longitude, origin.zoom);
    const cy = worldY(origin.latitude, origin.zoom);
    const z = Math.round(origin.zoom);
    const minX = Math.floor((cx - size.width / 2) / TILE) - 1;
    const maxX = Math.floor((cx + size.width / 2) / TILE) + 1;
    const minY = Math.floor((cy - size.height / 2) / TILE) - 1;
    const maxY = Math.floor((cy + size.height / 2) / TILE) + 1;
    const out: { key: string; left: number; top: number; url: string }[] = [];
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        if (y < 0 || y >= 2 ** z) continue;
        const tx = wrapTile(x, z);
        out.push({
          key: `${z}:${tx}:${y}`,
          left: x * TILE - cx + size.width / 2,
          top: y * TILE - cy + size.height / 2,
          url: tileUrl(tx, y, z),
        });
      }
    }
    return out;
  }, [origin, size.height, size.width]);

  const markers = useMemo(() => {
    if (!origin || size.width < 8) return [];
    const cx = worldX(origin.longitude, origin.zoom);
    const cy = worldY(origin.latitude, origin.zoom);
    const maxCount = Math.max(1, ...spots.map((spot) => spot.count));
    return spots.map((spot) => {
      const sizePx = 56 + (spot.count / maxCount) * 70;
      return {
        spot,
        left: worldX(spot.longitude, origin.zoom) - cx + size.width / 2,
        top: worldY(spot.latitude, origin.zoom) - cy + size.height / 2,
        size: sizePx,
      };
    });
  }, [origin, size.height, size.width, spots]);

  const you = useMemo(() => {
    if (!origin || !user || size.width < 8) return null;
    const cx = worldX(origin.longitude, origin.zoom);
    const cy = worldY(origin.latitude, origin.zoom);
    return {
      left: worldX(user.longitude, origin.zoom) - cx + size.width / 2,
      top: worldY(user.latitude, origin.zoom) - cy + size.height / 2,
    };
  }, [origin, size.height, size.width, user]);

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
      <View style={styles.fill} onLayout={onLayout}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={{ flex: 1, backgroundColor: '#0B0B0D' }} />
        </View>
        {origin ? (
          <Animated.View style={[StyleSheet.absoluteFill, layerStyle]}>
            {tiles.map((tile) => (
              <Image
                key={tile.key}
                source={{ uri: tile.url }}
                style={{
                  position: 'absolute',
                  left: tile.left,
                  top: tile.top,
                  width: TILE,
                  height: TILE,
                }}
              />
            ))}
            {markers.map((marker) => (
              <Pressable
                key={marker.spot.venueId}
                onPress={() => onSelect(marker.spot)}
                style={{
                  position: 'absolute',
                  left: marker.left - marker.size / 2,
                  top: marker.top - marker.size / 2,
                  width: marker.size,
                  height: marker.size,
                }}
              >
                <HeatBlob size={marker.size} count={marker.spot.count} />
              </Pressable>
            ))}
            {you ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: you.left - 9,
                  top: you.top - 9,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: '#F4F7FF',
                  borderWidth: 3,
                  borderColor: '#3B82F6',
                }}
              />
            ) : null}
          </Animated.View>
        ) : null}
        <View pointerEvents="none" style={styles.credit}>
          <Text style={styles.creditText}>Map © CARTO · © OSM</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

export function HeatSheet({
  spot,
  user,
}: {
  spot: VenueHeatSpot;
  user: { latitude: number; longitude: number } | null;
}) {
  const nearby =
    user != null &&
    distanceBetween(user.latitude, user.longitude, spot.latitude, spot.longitude) <= NEARBY_RADIUS_METERS;
  return (
    <View style={styles.sheet}>
      <Text style={[type.caption, { color: 'rgba(255,244,234,0.62)', fontWeight: '600' }]}>Today at this place</Text>
      <Text style={[type.title, { color: '#FFF4EA' }]}>{spot.name}</Text>
      <Text style={[type.headline, { color: '#FF9A62', fontVariant: ['tabular-nums'] }]}>
        {spot.count} {spot.count === 1 ? 'ShyText' : 'ShyTexts'}
      </Text>
      <Text style={[type.caption, { color: 'rgba(255,244,234,0.55)' }]}>
        {nearby ? 'You’re close enough to drop one here.' : 'Counts only — no people, no messages.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0B0B0D', overflow: 'hidden' },
  credit: { position: 'absolute', right: space[12], bottom: space[8] },
  creditText: { color: 'rgba(255,244,234,0.35)', fontSize: 10 },
  sheet: {
    padding: space[16],
    gap: 6,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(18, 12, 10, 0.92)',
  },
});

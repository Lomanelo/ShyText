import { ReactNode, useEffect, useState } from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { placeKind, placeKindLabel, PlaceKind } from '../utils/venueMark';

const INK = '#8B3A22';

const STILLS: Record<PlaceKind, ImageSourcePropType> = {
  bar: require('../assets/stamps/bar.jpg'),
  cafe: require('../assets/stamps/cafe.jpg'),
  restaurant: require('../assets/stamps/restaurant.jpg'),
  nightlife: require('../assets/stamps/nightlife.jpg'),
  park: require('../assets/stamps/park.jpg'),
  study: require('../assets/stamps/study.jpg'),
  hotel: require('../assets/stamps/hotel.jpg'),
  gym: require('../assets/stamps/gym.jpg'),
  museum: require('../assets/stamps/museum.jpg'),
  theater: require('../assets/stamps/theater.jpg'),
  music: require('../assets/stamps/music.jpg'),
  campus: require('../assets/stamps/campus.jpg'),
  bakery: require('../assets/stamps/bakery.jpg'),
  brewery: require('../assets/stamps/brewery.jpg'),
  place: require('../assets/stamps/place.jpg'),
};

export function VenueStamp({
  category,
  height,
  imageUrl,
  children,
}: {
  category?: string;
  height: number;
  imageUrl?: string | null;
  children?: ReactNode;
}) {
  const kind = placeKind(category);
  const compact = height < 100;
  const [remoteFailed, setRemoteFailed] = useState(false);
  const remote = Boolean(imageUrl) && !remoteFailed;

  useEffect(() => {
    setRemoteFailed(false);
  }, [imageUrl]);

  return (
    <View style={[styles.well, { height }]} collapsable={false}>
      {remote ? (
        <Image
          source={{ uri: imageUrl! }}
          style={styles.still}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          onError={() => setRemoteFailed(true)}
        />
      ) : (
        <Image source={STILLS[kind]} style={styles.still} resizeMode="cover" accessibilityIgnoresInvertColors />
      )}
      {!compact ? (
        <View style={styles.stamp} accessibilityElementsHidden>
          <Text style={styles.stampText}>{placeKindLabel(kind)}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const FILL = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

const styles = StyleSheet.create({
  well: { overflow: 'hidden', backgroundColor: '#FCF3E8' },
  still: { ...FILL, width: '100%', height: '100%' },
  stamp: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    borderWidth: 1,
    borderColor: INK,
    backgroundColor: 'rgba(252, 243, 232, 0.82)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stampText: {
    color: INK,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'lowercase',
  },
});

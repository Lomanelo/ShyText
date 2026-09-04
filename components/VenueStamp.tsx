import { ReactNode, useEffect, useState } from 'react';
import { ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { placeKind, placeKindLabel, PlaceKind } from '../utils/venueMark';
import { radius } from '../theme';

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
          source={imageUrl!}
          style={styles.still}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={imageUrl!}
          transition={0}
          priority="high"
          placeholderContentFit="cover"
          onError={() => setRemoteFailed(true)}
        />
      ) : (
        <Image source={STILLS[kind]} style={styles.still} contentFit="cover" cachePolicy="memory-disk" transition={0} />
      )}
      {/* Film-poster scrim: the still fades to dark at the base so type sits in the scene. */}
      {!compact ? <View style={styles.scrim} pointerEvents="none" /> : null}
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
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    experimental_backgroundImage:
      'linear-gradient(to top, rgba(16, 10, 8, 0.55) 0%, rgba(16, 10, 8, 0.0) 100%)',
  },
  stamp: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(28, 18, 14, 0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stampText: {
    color: '#FFF4EA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
});

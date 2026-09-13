import { Linking, Platform } from 'react-native';
import { Venue } from '../types/venue';

/**
 * Open the platform maps app with walking directions to a venue.
 * Apple Maps on iOS, Google Maps (with geo: fallback) on Android.
 */
export async function openDirections(venue: Pick<Venue, 'name' | 'latitude' | 'longitude' | 'address'>) {
  const { latitude, longitude } = venue;
  if (latitude == null || longitude == null) return;
  const label = encodeURIComponent(venue.name);

  if (Platform.OS === 'ios') {
    await Linking.openURL(`maps://?daddr=${latitude},${longitude}&dirflg=w&q=${label}`).catch(() =>
      Linking.openURL(`https://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=w`)
    );
    return;
  }

  await Linking.openURL(`google.navigation:q=${latitude},${longitude}&mode=w`).catch(() =>
    Linking.openURL(`geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`)
  );
}

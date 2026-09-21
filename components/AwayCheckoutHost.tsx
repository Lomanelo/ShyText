import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAwayCheckout } from '../hooks/useAwayCheckout';
import { useCurrentVenue } from '../hooks/useCurrentVenue';
import { useShyneHeartbeat } from '../hooks/useShyneHeartbeat';
import {
  extendShyneFromLiveActivity,
  useShyneLiveActivityActions,
} from '../hooks/useShyneLiveActivity';
import { endAllShyneLiveActivities } from '../services/shyneLiveActivity';
import { LeftVenueNotice } from './LeftVenueNotice';

export function AwayCheckoutHost() {
  const { user, hasProfile } = useAuth();
  const { checkIn, expired, loading, leave } = useCurrentVenue();
  const enabled = Boolean(user && hasProfile);
  const { notice, dismiss } = useAwayCheckout({
    enabled,
    checkIn,
    expired,
    loading,
    leave,
  });
  useShyneHeartbeat({ enabled, checkIn, expired });

  // Local expiry (idle window elapsed) — dismiss the Live Activity even before Firestore clears.
  useEffect(() => {
    if (expired) void endAllShyneLiveActivities('immediate');
  }, [expired]);

  useShyneLiveActivityActions({
    onExtend: async () => {
      await extendShyneFromLiveActivity();
    },
    onShyOut: async () => {
      await leave();
    },
  });

  return <LeftVenueNotice notice={notice} onDismiss={dismiss} />;
}

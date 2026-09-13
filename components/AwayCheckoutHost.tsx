import { useAuth } from '../hooks/useAuth';
import { useAwayCheckout } from '../hooks/useAwayCheckout';
import { useCurrentVenue } from '../hooks/useCurrentVenue';
import { useShyneHeartbeat } from '../hooks/useShyneHeartbeat';
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

  return <LeftVenueNotice notice={notice} onDismiss={dismiss} />;
}

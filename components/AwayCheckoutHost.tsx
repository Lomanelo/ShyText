import { useAuth } from '../hooks/useAuth';
import { useAwayCheckout } from '../hooks/useAwayCheckout';
import { useCurrentVenue } from '../hooks/useCurrentVenue';
import { LeftVenueNotice } from './LeftVenueNotice';

export function AwayCheckoutHost() {
  const { user, hasProfile } = useAuth();
  const { checkIn, expired, loading, leave } = useCurrentVenue();
  const { notice, dismiss } = useAwayCheckout({
    enabled: Boolean(user && hasProfile),
    checkIn,
    expired,
    loading,
    leave,
  });

  return <LeftVenueNotice notice={notice} onDismiss={dismiss} />;
}

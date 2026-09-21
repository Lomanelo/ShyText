import type { LiveActivityFactory } from 'expo-widgets';
import type { ShyneLiveActivityProps } from './shyneLiveActivityTypes';

/**
 * Default stub for TypeScript / non-platform resolution.
 * Metro picks `.ios.tsx` / `.android.ts` / `.web.ts` at bundling time.
 */
const ShyneLiveActivity = null as unknown as LiveActivityFactory<ShyneLiveActivityProps>;

export default ShyneLiveActivity;

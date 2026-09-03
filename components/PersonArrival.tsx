import { ReactNode, useEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

/** Enter-only. Shy Out fades the whole presence block — no per-row exiting. */
export function PersonArrival({
  children,
  reduceMotion,
  staggerIndex = 0,
}: {
  children: ReactNode;
  reduceMotion?: boolean;
  staggerIndex?: number;
}) {
  const delayMs = useRef(Math.min(staggerIndex, 8) * 55).current;
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const played = useRef(false);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      played.current = true;
      return;
    }
    if (played.current) return;
    played.current = true;
    progress.value = 0;
    progress.value = withDelay(
      delayMs,
      withSpring(1, {
        damping: 20,
        stiffness: 180,
        mass: 0.8,
      })
    );
  }, [progress, reduceMotion, delayMs]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * 14 }, { scale: 0.96 + p * 0.04 }],
    };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}

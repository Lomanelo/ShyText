import { useCallback } from 'react';
import {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  SlideInDown,
  SlideInUp,
  SlideOutDown,
  SlideOutRight,
  SlideOutUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';
import { motion } from '../theme';
import { useReduceMotion } from './useReduceMotion';

export function springLayout() {
  return LinearTransition.springify()
    .damping(motion.layout.damping)
    .stiffness(motion.layout.stiffness);
}

export function springSlideUp() {
  return SlideInDown.springify()
    .damping(motion.layout.damping)
    .stiffness(motion.layout.stiffness);
}

export function springStampIn() {
  return SlideInUp.springify()
    .damping(motion.layout.damping)
    .stiffness(motion.layout.stiffness);
}

export function springSlideOut() {
  return SlideOutDown.springify()
    .damping(motion.layout.damping)
    .stiffness(motion.spring.stiffness);
}

export function springSlideOutUp() {
  return SlideOutUp.springify()
    .damping(motion.layout.damping)
    .stiffness(motion.spring.stiffness);
}

export function springSlideOutRight() {
  return SlideOutRight.springify()
    .damping(motion.layout.damping)
    .stiffness(motion.spring.stiffness);
}

export function springPop() {
  return ZoomIn.springify().damping(motion.spring.damping).stiffness(motion.spring.stiffness);
}

/** Arrival for someone who just Shyned into a live venue list. */
export function springPersonIn() {
  return FadeInDown.duration(480)
    .springify()
    .damping(17)
    .stiffness(150)
    .mass(0.85);
}

export function springPersonOut() {
  // Timing — not spring — so opacity can't overshoot and flash back visible.
  return FadeOutUp.duration(240);
}

export function usePressScale(disabled?: boolean) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = useCallback(() => {
    if (disabled || reduce) return;
    scale.value = withSpring(motion.press, motion.spring);
  }, [disabled, reduce, scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, motion.spring);
  }, [scale]);

  return { style, onPressIn, onPressOut };
}

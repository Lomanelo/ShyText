import { ComponentProps } from 'react';
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '../hooks/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = ComponentProps<typeof Pressable>;

export function PressScale({ style, onPressIn, onPressOut, disabled, ...rest }: Props) {
  const press = usePressScale(Boolean(disabled));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        press.onPressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.onPressOut();
        onPressOut?.(event);
      }}
      style={[style, press.style]}
    />
  );
}

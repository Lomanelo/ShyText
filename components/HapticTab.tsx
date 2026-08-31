import { ComponentProps } from 'react';
import { PlatformPressable } from 'expo-router/react-navigation';
import * as Haptics from 'expo-haptics';

export function HapticTab(props: ComponentProps<typeof PlatformPressable>) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(event) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        props.onPressIn?.(event);
      }}
    />
  );
}

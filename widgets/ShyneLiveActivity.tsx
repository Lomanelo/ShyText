import {
  Divider,
  HStack,
  Image,
  Link,
  ProgressView,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  labelsHidden,
  lineLimit,
  monospacedDigit,
  padding,
  progressViewStyle,
  resizable,
  tint,
  widgetAccentedRenderingMode,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { ShyneLiveActivityProps } from './shyneLiveActivityTypes';
import { SHYNE_LIVE_ACTIVITY_NAME } from './shyneLiveActivityTypes';

/**
 * Shyne Live Activity — Lock Screen + Dynamic Island.
 *
 * Single module (Expo docs pattern). On iOS, expo-widgets links ActivityKit;
 * on Android/web the factory is a no-op stub. Do NOT split into `.ios.tsx` +
 * a null `.ts` stub — Metro can resolve the stub on device and skip the factory.
 *
 * Pattern (Flighty / Uber): flame left of the camera cutout, countdown right;
 * Lock Screen shows venue + Extend / Shy Out.
 */
const ShyneLiveActivityLayout = (
  props: ShyneLiveActivityProps,
  environment: LiveActivityEnvironment
) => {
  'widget';
  const reduced = environment.isLuminanceReduced;
  const dark = environment.colorScheme === 'dark';

  const accent = reduced ? '#FFFFFF' : '#D05927';
  const danger = reduced ? '#FFFFFF' : '#B42318';
  const secondary = reduced ? '#E8E0D8' : dark ? '#B7ADA3' : '#6F655C';
  const primary = reduced ? '#FFFFFF' : dark ? '#FFFFFF' : '#1C120E';
  const rule = reduced
    ? 'rgba(255,255,255,0.22)'
    : dark
      ? 'rgba(255,255,255,0.16)'
      : 'rgba(28,18,14,0.12)';
  const paper = reduced ? null : dark ? '#171310' : '#F7EDE2';

  const isEnded = props.status === 'ended';
  const expires = new Date(props.expiresAt);
  const started = new Date(props.startedAt);

  /** Transparent flame-lit mark (fullColor so DI does not gray it out). */
  const brandMark = (size: number) =>
    props.logoUri ? (
      <Image
        uiImage={props.logoUri}
        modifiers={[
          widgetAccentedRenderingMode('fullColor'),
          resizable(),
          frame({ width: size, height: size }),
        ]}
      />
    ) : (
      <Image systemName="flame.fill" color={accent} size={size} />
    );

  const countdown = (size: number, weight: 'bold' | 'semibold' = 'bold') =>
    isEnded ? (
      <Text
        modifiers={[
          font({ weight: 'semibold', size: Math.min(size, 14) }),
          foregroundStyle(secondary),
        ]}
      >
        {props.endedLabel}
      </Text>
    ) : (
      <Text
        timerInterval={{ lower: started, upper: expires }}
        countsDown
        modifiers={[
          font({ weight, size, design: 'rounded' }),
          foregroundStyle(accent),
          monospacedDigit(),
        ]}
      />
    );

  const progress = isEnded ? null : (
    <ProgressView
      timerInterval={{ lower: started, upper: expires }}
      countsDown
      modifiers={[
        progressViewStyle('linear'),
        labelsHidden(),
        tint(accent),
        frame({ maxHeight: 3 }),
      ]}
    />
  );

  /** Twin actions — Extend (accent) / Shy Out (danger). */
  const actions = isEnded ? null : (
    <HStack spacing={0} modifiers={[padding({ top: 4 })]}>
      <Link
        label={props.extendLabel}
        destination={props.extendUrl}
        modifiers={[
          font({ weight: 'semibold', size: 16 }),
          foregroundStyle(accent),
          tint(accent),
          padding({ vertical: 8, trailing: 12 }),
        ]}
      />
      <Spacer />
      <Divider modifiers={[frame({ width: 1, height: 16 }), foregroundStyle(rule)]} />
      <Spacer />
      <Link
        label={props.shyOutLabel}
        destination={props.shyOutUrl}
        modifiers={[
          font({ weight: 'semibold', size: 16 }),
          foregroundStyle(danger),
          tint(danger),
          padding({ vertical: 8, leading: 12 }),
        ]}
      />
    </HStack>
  );

  const venueBlock = (
    <VStack spacing={2} modifiers={[frame({ maxWidth: 999, alignment: 'leading' })]}>
      <Text
        modifiers={[
          font({ weight: 'semibold', size: 12 }),
          foregroundStyle(secondary),
          lineLimit(1),
        ]}
      >
        {props.title}
      </Text>
      <Text
        modifiers={[
          font({ weight: 'bold', size: 18 }),
          foregroundStyle(primary),
          lineLimit(1),
        ]}
      >
        {props.venueName}
      </Text>
    </VStack>
  );

  return {
    banner: (
      <VStack
        spacing={12}
        modifiers={[padding({ horizontal: 16, vertical: 14 }), activityBackgroundTint(paper)]}
      >
        <HStack spacing={12}>
          {brandMark(40)}
          {venueBlock}
          <Spacer />
          <VStack spacing={1} modifiers={[frame({ alignment: 'trailing' })]}>
            {countdown(28)}
            {!isEnded ? (
              <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(secondary)]}>
                {props.remainingLabel}
              </Text>
            ) : null}
          </VStack>
        </HStack>
        {progress}
        {actions}
      </VStack>
    ),

    compactLeading: brandMark(20),
    compactTrailing: countdown(15, 'semibold'),
    minimal: brandMark(14),

    expandedLeading: (
      <VStack modifiers={[padding({ leading: 4 })]}>{brandMark(36)}</VStack>
    ),
    expandedTrailing: (
      <VStack
        spacing={0}
        modifiers={[padding({ trailing: 4 }), frame({ alignment: 'trailing' })]}
      >
        {countdown(22)}
        {!isEnded ? (
          <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(secondary)]}>
            {props.remainingLabel}
          </Text>
        ) : null}
      </VStack>
    ),
    expandedCenter: (
      <VStack spacing={1}>
        <Text
          modifiers={[
            font({ weight: 'semibold', size: 11 }),
            foregroundStyle(secondary),
            lineLimit(1),
          ]}
        >
          {props.title}
        </Text>
        <Text
          modifiers={[
            font({ weight: 'bold', size: 14 }),
            foregroundStyle(primary),
            lineLimit(1),
          ]}
        >
          {props.venueName}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack spacing={8} modifiers={[padding({ horizontal: 10, bottom: 8, top: 2 })]}>
        {progress}
        {actions}
      </VStack>
    ),
  };
};

export default createLiveActivity<ShyneLiveActivityProps>(
  SHYNE_LIVE_ACTIVITY_NAME,
  ShyneLiveActivityLayout
);

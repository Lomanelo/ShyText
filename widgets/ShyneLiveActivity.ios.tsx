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
 * Lock Screen + Dynamic Island for an active Shyne.
 *
 * Same transparent flame-lit mark everywhere (no cream well).
 * fullColor is required so Dynamic Island does not remap the PNG to a gray square.
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

  const isEnded = props.status === 'ended';
  const expires = new Date(props.expiresAt);
  const started = new Date(props.startedAt);

  /** Transparent brand flame — banner + Dynamic Island share this mark. */
  const brandMark = (size: number) =>
    props.logoUri ? (
      <Image
        uiImage={props.logoUri}
        modifiers={[
          // Must stay first: DI uses accented rendering without this.
          widgetAccentedRenderingMode('fullColor'),
          resizable(),
          frame({ width: size, height: size }),
        ]}
      />
    ) : (
      <Image systemName="flame.fill" color={accent} size={size} />
    );

  const heroTimer = isEnded ? (
    <Text
      modifiers={[
        font({ weight: 'semibold', size: 16, design: 'rounded' }),
        foregroundStyle(secondary),
      ]}
    >
      {props.endedLabel}
    </Text>
  ) : (
    <VStack spacing={1} modifiers={[frame({ alignment: 'trailing' })]}>
      <Text
        timerInterval={{ lower: started, upper: expires }}
        countsDown
        modifiers={[
          font({ weight: 'bold', size: 34, design: 'rounded' }),
          foregroundStyle(accent),
          monospacedDigit(),
        ]}
      />
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(secondary)]}>
        {props.remainingLabel}
      </Text>
    </VStack>
  );

  const progress = isEnded ? null : (
    <ProgressView
      timerInterval={{ lower: started, upper: expires }}
      countsDown
      modifiers={[
        progressViewStyle('linear'),
        labelsHidden(),
        tint(accent),
        frame({ maxHeight: 2 }),
      ]}
    />
  );

  const actions = isEnded ? null : (
    <HStack spacing={0} modifiers={[padding({ top: 2 })]}>
      <Link
        label={props.extendLabel}
        destination={props.extendUrl}
        modifiers={[
          font({ weight: 'semibold', size: 16 }),
          foregroundStyle(accent),
          tint(accent),
          padding({ vertical: 6, trailing: 16 }),
        ]}
      />
      <Spacer />
      <Divider modifiers={[frame({ width: 1, height: 14 }), foregroundStyle(rule)]} />
      <Spacer />
      <Link
        label={props.shyOutLabel}
        destination={props.shyOutUrl}
        modifiers={[
          font({ weight: 'semibold', size: 16 }),
          foregroundStyle(danger),
          tint(danger),
          padding({ vertical: 6, leading: 16 }),
        ]}
      />
    </HStack>
  );

  return {
    banner: (
      <VStack
        spacing={12}
        modifiers={[
          padding({ horizontal: 16, vertical: 14 }),
          activityBackgroundTint(reduced ? null : dark ? '#171310' : '#F7EDE2'),
        ]}
      >
        <HStack spacing={14}>
          {brandMark(48)}
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
                font({ weight: 'bold', size: 19 }),
                foregroundStyle(primary),
                lineLimit(1),
              ]}
            >
              {props.venueName}
            </Text>
          </VStack>
          <Spacer />
          {heroTimer}
        </HStack>
        {progress}
        {actions}
      </VStack>
    ),
    // Push island mark size — compact leading budget is ~37pt max on Pro models.
    compactLeading: brandMark(55),
    compactTrailing: isEnded ? (
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(secondary)]}>
        {props.endedLabel}
      </Text>
    ) : (
      <Text
        timerInterval={{ lower: started, upper: expires }}
        countsDown
        modifiers={[
          font({ weight: 'bold', size: 15, design: 'rounded' }),
          foregroundStyle(accent),
          monospacedDigit(),
        ]}
      />
    ),
    minimal: brandMark(22),
    expandedLeading: <VStack modifiers={[padding({ leading: 2 })]}>{brandMark(42)}</VStack>,
    expandedTrailing: (
      <VStack spacing={0} modifiers={[padding({ trailing: 4 }), frame({ alignment: 'trailing' })]}>
        {isEnded ? (
          <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle(secondary)]}>
            {props.endedLabel}
          </Text>
        ) : (
          <>
            <Text
              timerInterval={{ lower: started, upper: expires }}
              countsDown
              modifiers={[
                font({ weight: 'bold', size: 22, design: 'rounded' }),
                foregroundStyle(accent),
                monospacedDigit(),
              ]}
            />
            <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(secondary)]}>
              {props.remainingLabel}
            </Text>
          </>
        )}
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

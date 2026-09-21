import {
  HStack,
  Image,
  Link,
  ProgressView,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { ShyneLiveActivityProps } from './shyneLiveActivityTypes';
import { SHYNE_LIVE_ACTIVITY_NAME } from './shyneLiveActivityTypes';

/**
 * Lock Screen + Dynamic Island for an active Shyne.
 *
 * Layout follows Mobbin Live Activity norms from session apps
 * (Nike Run Club, Strava, BeReal, Forest, Flighty, Hevy):
 * - One hero metric (countdown)
 * - Short status + place context
 * - Progress rail for finite windows
 * - Two actions max (Extend + Shy Out); banner tap opens the app
 *
 * Widget body must stay pure — no hooks, no outer-scope values.
 */
const ShyneLiveActivityLayout = (
  props: ShyneLiveActivityProps,
  environment: LiveActivityEnvironment
) => {
  'widget';
  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#D05927';
  const danger = environment.isLuminanceReduced ? '#FFFFFF' : '#B42318';
  const secondary = environment.colorScheme === 'dark' ? '#C9C0B6' : '#6B6158';
  const primary = environment.colorScheme === 'dark' ? '#FFFFFF' : '#1C120E';
  const isEnded = props.status === 'ended';
  const expires = new Date(props.expiresAt);
  const started = new Date(props.startedAt);

  const countdownBlock = (
    <VStack spacing={0}>
      {isEnded ? (
        <Text modifiers={[font({ weight: 'semibold', size: 15, design: 'rounded' }), foregroundStyle(secondary)]}>
          {props.endedLabel}
        </Text>
      ) : (
        <>
          <Text
            timerInterval={{ lower: started, upper: expires }}
            countsDown
            modifiers={[font({ weight: 'bold', size: 28, design: 'rounded' }), foregroundStyle(accent)]}
          />
          <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(secondary)]}>
            {props.remainingLabel}
          </Text>
        </>
      )}
    </VStack>
  );

  const progress = isEnded ? null : (
    <ProgressView
      timerInterval={{ lower: started, upper: expires }}
      countsDown
      modifiers={[tint(accent), padding({ top: 6 })]}
    />
  );

  // Links (not in-process Buttons) so Extend / Shy Out still work from a cold start.
  const actions = isEnded ? null : (
    <HStack spacing={16} modifiers={[padding({ top: 8 })]}>
      <Link
        label={props.extendLabel}
        destination={props.extendUrl}
        modifiers={[tint(accent), font({ weight: 'semibold', size: 15 })]}
      />
      <Spacer />
      <Link
        label={props.shyOutLabel}
        destination={props.shyOutUrl}
        modifiers={[tint(danger), font({ weight: 'semibold', size: 15 })]}
      />
    </HStack>
  );

  return {
    banner: (
      <VStack spacing={2} modifiers={[padding({ all: 14 })]}>
        <HStack spacing={10}>
          <Image systemName="flame.fill" color={accent} size={20} />
          <VStack spacing={1}>
            <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle(secondary)]}>
              {props.title}
            </Text>
            <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(primary)]}>
              {props.venueName}
            </Text>
          </VStack>
          <Spacer />
          {countdownBlock}
        </HStack>
        {progress}
        {actions}
      </VStack>
    ),
    compactLeading: <Image systemName="flame.fill" color={accent} size={14} />,
    compactTrailing: isEnded ? (
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(secondary)]}>
        {props.endedLabel}
      </Text>
    ) : (
      <Text
        timerInterval={{ lower: started, upper: expires }}
        countsDown
        modifiers={[font({ weight: 'bold', size: 15, design: 'rounded' }), foregroundStyle(accent)]}
      />
    ),
    minimal: <Image systemName="flame.fill" color={accent} size={12} />,
    expandedLeading: (
      <VStack spacing={2} modifiers={[padding({ leading: 4 })]}>
        <Image systemName="flame.fill" color={accent} size={22} />
        <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(secondary)]}>
          {props.title}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack spacing={0} modifiers={[padding({ trailing: 4 })]}>
        {isEnded ? (
          <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle(secondary)]}>
            {props.endedLabel}
          </Text>
        ) : (
          <>
            <Text
              timerInterval={{ lower: started, upper: expires }}
              countsDown
              modifiers={[font({ weight: 'bold', size: 20, design: 'rounded' }), foregroundStyle(accent)]}
            />
            <Text modifiers={[font({ size: 10, weight: 'medium' }), foregroundStyle(secondary)]}>
              {props.remainingLabel}
            </Text>
          </>
        )}
      </VStack>
    ),
    expandedCenter: (
      <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle(primary)]}>
        {props.venueName}
      </Text>
    ),
    expandedBottom: (
      <VStack spacing={4} modifiers={[padding({ horizontal: 8, bottom: 6 })]}>
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

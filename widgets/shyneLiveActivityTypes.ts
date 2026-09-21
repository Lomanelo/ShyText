/** Shared props for the Shyne iOS Live Activity (Lock Screen + Dynamic Island). */
export type ShyneLiveActivityProps = {
  venueId: string;
  venueName: string;
  /** Epoch ms — start of the current idle window (for timer + progress). */
  startedAt: number;
  /** Epoch ms when the idle window ends. */
  expiresAt: number;
  status: 'active' | 'ended';
  /** Small status eyebrow, e.g. "Shyning here". */
  title: string;
  /** Caption under the countdown, e.g. "left". */
  remainingLabel: string;
  extendLabel: string;
  shyOutLabel: string;
  endedLabel: string;
  extendUrl: string;
  shyOutUrl: string;
  /** Deep link when the banner / island itself is tapped. */
  openUrl: string;
  /**
   * file:// URI in the App Group widgets directory for the brand flame.
   * Empty string when unavailable — layout falls back to SF Symbol.
   */
  logoUri: string;
};

export const SHYNE_LIVE_ACTIVITY_NAME = 'ShyneActivity';

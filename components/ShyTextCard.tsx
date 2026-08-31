import { ApproachableUserCard } from './ApproachableUserCard';
import { ShyTextPost } from '../types/shytext';
import { Theme } from '../theme';

/** @deprecated Use ApproachableUserCard. Kept so older screens still compile. */
export function ShyTextCard({
  post,
  theme,
  onHello,
  onReport,
}: {
  post: ShyTextPost;
  theme: Theme;
  isOwn?: boolean;
  onHello: () => void;
  onReport: () => void;
  onDelete?: () => void;
}) {
  return <ApproachableUserCard post={post} theme={theme} onBreakIce={onHello} onReport={onReport} />;
}

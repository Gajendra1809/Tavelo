import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/theme';

/** Extra space above the system navigation bar / home indicator. */
export function useBottomSafePadding(extra = spacing.xl): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, spacing.sm) + extra;
}

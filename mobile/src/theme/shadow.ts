import type { ViewStyle } from 'react-native';
import { colors } from './colors';
import { radius } from './spacing';

export const shadow: { card: ViewStyle } = {
  card: {
    shadowColor: colors.primaryPressed,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
};

export const surfaceCard: ViewStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.line,
  ...shadow.card,
};

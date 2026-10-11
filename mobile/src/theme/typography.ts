import type { TextStyle } from 'react-native';

export const typography = {
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
} satisfies Record<string, TextStyle>;

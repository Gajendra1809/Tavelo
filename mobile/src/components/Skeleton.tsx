import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

type SkeletonProps = {
  height?: number;
};

export function Skeleton({ height = 92 }: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View accessibilityRole="progressbar">
      <Animated.View style={[styles.block, { height, opacity }]} />
    </View>
  );
}

export function TripListSkeleton() {
  return (
    <View style={styles.list}>
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  block: {
    borderRadius: radius.lg,
    backgroundColor: colors.seafoam,
  },
});

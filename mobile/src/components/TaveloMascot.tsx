import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme';

const MASCOT = require('../../assets/images/mascot-traveler.png');

type TaveloMascotProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Compass-scout idle: a gentle look-around, a sonar ping from the compass, tap to hop. */
export function TaveloMascot({ size = 140, style }: TaveloMascotProps) {
  const bob = useSharedValue(0);
  const tilt = useSharedValue(0);
  const hop = useSharedValue(0);
  const pingA = useSharedValue(0);
  const pingB = useSharedValue(0);
  const reduceMotion = useSharedValue(0);

  const cancelled = useRef(false);

  function stopAll() {
    cancelAnimation(bob);
    cancelAnimation(tilt);
    cancelAnimation(hop);
    cancelAnimation(pingA);
    cancelAnimation(pingB);
    bob.value = 0;
    tilt.value = 0;
    hop.value = 0;
    pingA.value = 0;
    pingB.value = 0;
  }

  function startIdle() {
    if (cancelled.current) {
      return;
    }
    stopAll();
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    tilt.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        withDelay(280, withTiming(-1, { duration: 2600, easing: Easing.inOut(Easing.quad) })),
        withDelay(280, withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })),
        withDelay(1600, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    pingA.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
        withDelay(2600, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
    pingB.value = withRepeat(
      withSequence(
        withDelay(280, withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) })),
        withTiming(0, { duration: 0 }),
        withDelay(2320, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }

  function hopOnce() {
    if (reduceMotion.value) {
      return;
    }
    hop.value = 0;
    hop.value = withSequence(
      withTiming(-size * 0.12, { duration: 160, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 9, stiffness: 220, mass: 0.7 }),
    );
  }

  useEffect(() => {
    cancelled.current = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled.current) {
        return;
      }
      reduceMotion.value = reduce ? 1 : 0;
      if (!reduce) {
        startIdle();
      }
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduce) => {
      reduceMotion.value = reduce ? 1 : 0;
      if (reduce) {
        stopAll();
      } else {
        startIdle();
      }
    });
    return () => {
      cancelled.current = true;
      sub.remove();
      stopAll();
    };
  }, []);

  const figureStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bob.value, [0, 1], [0, -size * 0.045]) + hop.value },
      { rotate: `${interpolate(tilt.value, [-1, 1], [-5.5, 5.5])}deg` },
      { scale: interpolate(bob.value, [0, 1], [1, 1.025]) },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bob.value, [0, 1], [0.22, 0.1]),
    transform: [{ scaleX: interpolate(bob.value, [0, 1], [1, 0.72]) }, { scaleY: 1 }],
  }));

  const pingStyleA = useAnimatedStyle(() => ({
    opacity: reduceMotion.value || pingA.value < 0.02 ? 0 : (1 - pingA.value) * 0.5,
    transform: [{ scale: 0.2 + pingA.value * 1.85 }],
  }));

  const pingStyleB = useAnimatedStyle(() => ({
    opacity: reduceMotion.value || pingB.value < 0.02 ? 0 : (1 - pingB.value) * 0.32,
    transform: [{ scale: 0.2 + pingB.value * 1.85 }],
  }));

  const pingSize = size * 0.42;
  const pingLeft = size * 0.08;
  const pingTop = size * 0.38;

  return (
    <Pressable
      accessibilityRole="image"
      accessibilityLabel="Tavelo traveler"
      accessibilityHint="Plays a short hop"
      onPress={hopOnce}
      style={[styles.wrap, { width: size, height: size * 1.12 }, style]}
    >
      <View style={[styles.stage, { width: size, height: size }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ping,
            {
              width: pingSize,
              height: pingSize,
              borderRadius: pingSize / 2,
              left: pingLeft,
              top: pingTop,
              borderColor: colors.brandAccent,
            },
            pingStyleA,
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ping,
            {
              width: pingSize,
              height: pingSize,
              borderRadius: pingSize / 2,
              left: pingLeft,
              top: pingTop,
              borderColor: colors.primary,
            },
            pingStyleB,
          ]}
        />
        <Animated.View style={figureStyle}>
          <Image
            accessibilityIgnoresInvertColors
            source={MASCOT}
            style={{ width: size, height: size, backgroundColor: 'transparent' }}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
      <Animated.View style={[styles.shadow, { width: size * 0.42, height: size * 0.08 }, shadowStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stage: {
    overflow: 'visible',
  },
  ping: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  shadow: {
    borderRadius: 999,
    backgroundColor: colors.primaryPressed,
    marginTop: -4,
  },
});

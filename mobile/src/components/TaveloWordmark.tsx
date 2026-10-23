import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '@/theme';

const LETTERS = ['t', 'a', 'v', 'e', 'l', 'o'] as const;
const HOP_FIRST_MS = 420;
const HOP_MS = 240;
const WAVE_MS = 560;
const LOOP_PAUSE_MS = 1200;

type TaveloWordmarkProps = {
  height?: number;
  loop?: boolean;
  align?: 'start' | 'center';
  style?: StyleProp<ViewStyle>;
};

function hopDuration(toStop: number): number {
  return toStop === 1 ? HOP_FIRST_MS : HOP_MS;
}

export function TaveloWordmark({ height = 44, loop = false, align = 'start', style }: TaveloWordmarkProps) {
  const fontSize = Math.round(height * 0.36);
  const dotSize = Math.max(6, Math.round(fontSize * 0.28));
  const gap = Math.max(3, Math.round(fontSize * 0.14));
  const hopHeight = fontSize * 0.48;

  const tour = useSharedValue(0);
  const wave = useSharedValue(-1);
  const pulse = useSharedValue(1);
  const ready = useSharedValue(0);
  const xs = useSharedValue<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);

  const letterX = useRef<number[]>(Array.from({ length: LETTERS.length }, () => 0));
  const restX = useRef(0);
  const laidOutLetters = useRef(new Set<number>());
  const started = useRef(false);
  const loopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  function clearLoopTimer() {
    if (loopTimer.current) {
      clearTimeout(loopTimer.current);
      loopTimer.current = null;
    }
  }

  function commitPositions() {
    const next = [restX.current, ...letterX.current, restX.current];
    xs.value = next;
    ready.value = 1;
  }

  function playTour() {
    if (cancelled.current) {
      return;
    }
    cancelAnimation(tour);
    cancelAnimation(wave);
    cancelAnimation(pulse);
    pulse.value = 1;
    wave.value = -1;
    tour.value = 0;
    tour.value = withSequence(
      withTiming(1, { duration: hopDuration(1), easing: Easing.linear }),
      withTiming(2, { duration: hopDuration(2), easing: Easing.linear }),
      withTiming(3, { duration: hopDuration(3), easing: Easing.linear }),
      withTiming(4, { duration: hopDuration(4), easing: Easing.linear }),
      withTiming(5, { duration: hopDuration(5), easing: Easing.linear }),
      withTiming(6, { duration: hopDuration(6), easing: Easing.linear }),
      withTiming(7, { duration: hopDuration(7), easing: Easing.linear }, (finished) => {
        if (!finished) {
          return;
        }
        tour.value = 0;
        wave.value = 0;
        wave.value = withTiming(LETTERS.length - 0.15, { duration: WAVE_MS, easing: Easing.linear }, (done) => {
          if (!done) {
            return;
          }
          wave.value = -1;
          if (loop) {
            runOnJS(queueLoop)();
            return;
          }
          pulse.value = withRepeat(
            withSequence(
              withTiming(1.16, { duration: 520, easing: Easing.inOut(Easing.sin) }),
              withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
          );
        });
      }),
    );
  }

  function queueLoop() {
    clearLoopTimer();
    loopTimer.current = setTimeout(() => {
      playTour();
    }, LOOP_PAUSE_MS);
  }

  function tryStart() {
    if (started.current || cancelled.current) {
      return;
    }
    started.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled.current) {
        return;
      }
      playTour();
    });
  }

  function replay() {
    if (cancelled.current) {
      return;
    }
    clearLoopTimer();
    started.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        return;
      }
      playTour();
    });
  }

  function onLetterLayout(index: number, event: LayoutChangeEvent) {
    const { x, width } = event.nativeEvent.layout;
    letterX.current[index] = x + width / 2 - dotSize / 2;
    if (index === LETTERS.length - 1) {
      restX.current = x + width + gap;
    }
    laidOutLetters.current.add(index);
    if (laidOutLetters.current.size >= LETTERS.length) {
      commitPositions();
      tryStart();
    }
  }

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      clearLoopTimer();
      cancelAnimation(tour);
      cancelAnimation(wave);
      cancelAnimation(pulse);
    };
  }, [pulse, tour, wave]);

  const dotStyle = useAnimatedStyle(() => {
    const stops = xs.value;
    const maxStop = 7;
    const current = Math.min(Math.max(tour.value, 0), maxStop);
    const from = Math.floor(current);
    const to = Math.min(from + 1, maxStop);
    const frac = current - from;
    const x0 = stops[from] ?? 0;
    const x1 = stops[to] ?? x0;
    const x = x0 + (x1 - x0) * frac;
    const y = -Math.sin(frac * Math.PI) * hopHeight;
    const squash = 1 - Math.sin(frac * Math.PI) * 0.12;
    const stretch = 1 + Math.sin(frac * Math.PI) * 0.18;
    const spin = Math.sin(frac * Math.PI) * 18;
    return {
      opacity: ready.value,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${spin}deg` },
        { scaleX: squash },
        { scaleY: stretch * pulse.value },
      ],
    };
  });

  return (
    <Pressable
      accessibilityRole="image"
      accessibilityLabel="tavelo"
      accessibilityHint="Plays a short logo animation"
      onPress={replay}
      style={({ pressed }) => [
        styles.hit,
        align === 'center' ? styles.hitCenter : styles.hitStart,
        {
          height,
          paddingLeft: align === 'center' ? 0 : Math.round(height * 0.24),
        },
        style,
        pressed ? styles.pressed : null,
      ]}
    >
      <Animated.View style={[styles.row, { paddingRight: dotSize + gap }]}>
        {LETTERS.map((letter, index) => (
          <LogoLetter
            key={letter}
            letter={letter}
            index={index}
            fontSize={fontSize}
            tour={tour}
            wave={wave}
            onLayout={(event) => onLetterLayout(index, event)}
          />
        ))}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              bottom: fontSize * 0.1,
            },
            dotStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.shine,
              {
                width: dotSize * 0.35,
                height: dotSize * 0.35,
                borderRadius: dotSize,
                top: dotSize * 0.16,
                left: dotSize * 0.18,
              },
            ]}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function LogoLetter({
  letter,
  index,
  fontSize,
  tour,
  wave,
  onLayout,
}: {
  letter: string;
  index: number;
  fontSize: number;
  tour: SharedValue<number>;
  wave: SharedValue<number>;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const style = useAnimatedStyle(() => {
    const landing = Math.abs(tour.value - (index + 1));
    const hopLift = landing < 0.58 ? Math.cos((landing / 0.58) * (Math.PI / 2)) : 0;
    const waveDist = Math.abs(wave.value - index);
    const waveLift = wave.value >= 0 && waveDist < 1 ? Math.sin((1 - waveDist) * Math.PI) : 0;
    const lift = Math.max(hopLift, waveLift);
    return {
      transform: [
        { translateY: -lift * fontSize * 0.22 },
        { scale: 1 + lift * 0.14 },
      ],
    };
  });

  return (
    <Animated.Text
      onLayout={onLayout}
      style={[
        styles.letter,
        {
          fontSize,
          lineHeight: fontSize * 1.05,
          letterSpacing: fontSize * -0.045,
        },
        style,
      ]}
    >
      {letter}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  hit: {
    justifyContent: 'center',
    overflow: 'visible',
  },
  hitStart: {
    alignSelf: 'flex-start',
  },
  hitCenter: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'visible',
  },
  letter: {
    color: colors.primary,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'AvenirNext-Bold', android: 'sans-serif-medium' }),
    includeFontPadding: false,
  },
  dot: {
    position: 'absolute',
    left: 0,
    backgroundColor: colors.brandAccent,
  },
  shine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});

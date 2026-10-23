import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { colors } from '@/theme';

type Point = { x: number; y: number };

function quadPoint(start: Point, control: Point, end: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
    y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
  };
}

function sampleRoute(start: Point, control: Point, end: Point, count: number) {
  const marks: { x: number; y: number; rotate: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(count - 1, 1);
    const point = quadPoint(start, control, end, t);
    const next = quadPoint(start, control, end, Math.min(1, t + 0.05));
    const heading = (Math.atan2(next.y - point.y, next.x - point.x) * 180) / Math.PI;
    marks.push({ ...point, rotate: `${heading}deg` });
  }
  return marks;
}

export function Atmosphere() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const route = useMemo(() => {
    const planeSize = 24;
    const planeRight = 36;
    const planeTop = insets.top + 96;
    const plane = {
      x: width - planeRight - planeSize,
      y: planeTop,
      size: planeSize,
    };
    const end = { x: plane.x + planeSize / 2 - 6, y: plane.y + planeSize / 2 + 2 };
    const start = { x: width * 0.46, y: plane.y + 78 };
    const control = { x: width * 0.72, y: plane.y + 92 };
    const dashes = sampleRoute(start, control, end, 13).slice(0, -2);

    const echoStart = { x: plane.x - 8, y: plane.y + 28 };
    const echoControl = { x: width - 10, y: plane.y + height * 0.22 };
    const echoEnd = { x: width + 24, y: plane.y + height * 0.38 };
    const echo = sampleRoute(echoStart, echoControl, echoEnd, 9);

    return { plane, dashes, echo };
  }, [height, insets.top, width]);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient
        colors={[colors.sky, colors.ivory, colors.background]}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.wash} />
      {route.dashes.map((mark, index) => (
        <View
          key={`dash-${index}`}
          style={[
            styles.dash,
            {
              left: mark.x - 5,
              top: mark.y - 1,
              opacity: 0.18 + (index / Math.max(route.dashes.length, 1)) * 0.2,
              transform: [{ rotate: mark.rotate }],
            },
          ]}
        />
      ))}
      {route.echo.map((mark, index) => (
        <View
          key={`echo-${index}`}
          style={[
            styles.dot,
            {
              left: mark.x - 1.5,
              top: mark.y - 1.5,
              opacity: 0.16 - index * 0.012,
            },
          ]}
        />
      ))}
      <View
        style={[
          styles.plane,
          {
            top: route.plane.y,
            left: route.plane.x,
            width: route.plane.size,
            height: route.plane.size,
          },
        ]}
      >
        <SymbolView
          name={{ android: 'flight', web: 'flight' }}
          size={22}
          tintColor={colors.primary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.seafoam,
    opacity: 0.28,
    top: -80,
    right: -90,
  },
  dash: {
    position: 'absolute',
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary,
  },
  plane: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.26,
    transform: [{ rotate: '18deg' }],
  },
});

import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';

type TaveloLogoProps = {
  height?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  variant?: 'image' | 'text';
};

const WORDMARK = require('../../assets/images/tavelo-wordmark-transparent.png');
const ASPECT = 1024 / 657;

function TaveloLogoText({ height }: { height: number }) {
  const fontSize = Math.round(height * 0.72);
  return (
    <Text
      accessibilityRole="image"
      accessibilityLabel="tavelo"
      style={[styles.wordmark, { fontSize, lineHeight: height }]}
    >
      <Text style={styles.name}>tavelo</Text>
      <Text style={styles.dot}>.</Text>
    </Text>
  );
}

export function TaveloLogo({ height = 36, style, imageStyle, variant = 'image' }: TaveloLogoProps) {
  if (variant === 'text') {
    return (
      <View style={style}>
        <TaveloLogoText height={height} />
      </View>
    );
  }

  const width = height * ASPECT;
  return (
    <View style={[{ height, width }, style]}>
      <Image
        accessibilityRole="image"
        accessibilityLabel="tavelo"
        source={WORDMARK}
        style={[{ width, height }, imageStyle]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  name: {
    color: colors.primary,
  },
  dot: {
    color: colors.brandAccent,
  },
});

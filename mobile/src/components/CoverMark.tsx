import { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { images } from '@/constants/images';
import { colors, typography } from '@/theme';

type CoverMarkProps = {
  uri?: string | null;
  label: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function CoverMark({ uri, label, style, textStyle }: CoverMarkProps) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const showRemote = Boolean(uri) && !remoteFailed;
  const source: ImageSourcePropType = showRemote
    ? { uri: uri! }
    : images.defaultTripCover;

  const [assetFailed, setAssetFailed] = useState(false);

  if (assetFailed) {
    return (
      <View style={[styles.initialsFallback, style]}>
        <Text style={[styles.text, textStyle]}>{initials(label)}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={`${label} cover`}
        source={source}
        style={[styles.image, StyleSheet.absoluteFillObject]}
        onError={() => {
          if (showRemote) {
            setRemoteFailed(true);
          } else {
            setAssetFailed(true);
          }
        }}
      />
    </View>
  );
}

export function initials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2);
  if (parts.length === 0) {
    return 'T';
  }
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.seafoam,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.line,
  },
  initialsFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successSurface,
  },
  text: {
    ...typography.label,
    color: colors.primary,
    fontSize: 18,
  },
});

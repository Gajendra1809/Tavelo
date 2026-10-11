import { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { initials } from '@/components/CoverMark';
import { images } from '@/constants/images';
import { colors, typography } from '@/theme';

type UserAvatarSize = 'sm' | 'md' | 'lg';

type UserAvatarProps = {
  name: string;
  /** Remote URL when the user sets a custom photo later. */
  uri?: string | null;
  size?: UserAvatarSize;
  style?: StyleProp<ViewStyle>;
};

const sizePx: Record<UserAvatarSize, number> = {
  sm: 36,
  md: 44,
  lg: 88,
};

const fontSize: Record<UserAvatarSize, number> = {
  sm: 12,
  md: 14,
  lg: 28,
};

export function UserAvatar({ name, uri, size = 'md', style }: UserAvatarProps) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [assetFailed, setAssetFailed] = useState(false);
  const dimension = sizePx[size];
  const frame = [
    styles.frame,
    { width: dimension, height: dimension, borderRadius: dimension / 2 },
    style,
  ];

  if (assetFailed) {
    return (
      <View accessibilityLabel={name} style={[frame, styles.initialsFallback]}>
        <Text style={[styles.initials, { fontSize: fontSize[size] }]}>{initials(name)}</Text>
      </View>
    );
  }

  const useRemote = Boolean(uri) && !remoteFailed;

  return (
    <Image
      accessibilityIgnoresInvertColors
      accessibilityLabel={name}
      source={useRemote ? { uri: uri! } : images.defaultAvatar}
      style={[styles.image, frame]}
      onError={() => {
        if (useRemote) {
          setRemoteFailed(true);
        } else {
          setAssetFailed(true);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.successSurface,
  },
  image: {
    backgroundColor: colors.line,
  },
  initialsFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successSurface,
  },
  initials: {
    ...typography.label,
    color: colors.primary,
  },
});

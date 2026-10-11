import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { CachedImage } from '@/components/CachedImage';
import { initials } from '@/components/CoverMark';
import { images } from '@/constants/images';
import { colors, typography } from '@/theme';

type UserAvatarSize = 'sm' | 'md' | 'lg';

type UserAvatarProps = {
  name: string;
  /** Signed URL when the user uploaded a profile photo. */
  uri?: string | null;
  /** Stable id (e.g. user id) for image cache when signed URLs rotate. */
  cacheKey?: string | null;
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

export function UserAvatar({ name, uri, cacheKey, size = 'md', style }: UserAvatarProps) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [defaultFailed, setDefaultFailed] = useState(false);
  const dimension = sizePx[size];
  const trimmedUri = uri?.trim() ?? '';

  useEffect(() => {
    setRemoteFailed(false);
    setDefaultFailed(false);
  }, [trimmedUri]);

  const frameStyle: StyleProp<ViewStyle> = [
    styles.frame,
    { width: dimension, height: dimension, borderRadius: dimension / 2 },
    style,
  ];

  const imageStyle: ImageStyle = {
    width: dimension,
    height: dimension,
    borderRadius: dimension / 2,
    backgroundColor: colors.line,
  };

  const useRemote = Boolean(trimmedUri) && !remoteFailed;
  const useDefaultAsset = !useRemote && !defaultFailed;

  if (!useRemote && !useDefaultAsset) {
    return (
      <View accessibilityLabel={name} style={[frameStyle, styles.initialsFallback]}>
        <Text style={[styles.initials, { fontSize: fontSize[size] }]}>{initials(name)}</Text>
      </View>
    );
  }

  return (
    <View accessibilityLabel={name} style={frameStyle}>
      {useRemote ? (
        <CachedImage
          uri={trimmedUri}
          cacheKey={cacheKey ?? trimmedUri}
          style={imageStyle}
          accessibilityLabel={name}
          onError={() => setRemoteFailed(true)}
        />
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          source={images.defaultAvatar}
          style={imageStyle}
          resizeMode="cover"
          onError={() => setDefaultFailed(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.line,
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

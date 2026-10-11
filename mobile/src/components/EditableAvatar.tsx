import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { UserAvatar } from '@/components/UserAvatar';
import { colors, shadow } from '@/theme';

type EditableAvatarProps = {
  name: string;
  uri?: string | null;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const AVATAR_SIZE = 96;
const BADGE_SIZE = 32;

export function EditableAvatar({ name, uri, disabled = false, onPress, style }: EditableAvatarProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change profile photo"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && !disabled ? styles.pressed : null, style]}
    >
      <UserAvatar name={name} uri={uri} size="lg" />
      <View style={styles.badge}>
        <SymbolView
          name={{ android: 'photo_camera', web: 'photo_camera' }}
          size={16}
          tintColor={colors.onPrimary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
});

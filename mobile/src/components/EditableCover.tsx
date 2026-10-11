import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CoverMark } from '@/components/CoverMark';
import { colors, radius, typography } from '@/theme';

type EditableCoverProps = {
  uri?: string | null;
  label: string;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function EditableCover({ uri, label, disabled = false, onPress, style }: EditableCoverProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change trip cover photo"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, style, pressed && !disabled ? styles.pressed : null]}
    >
      <CoverMark uri={uri} label={label} style={styles.cover} />
      <LinearGradient
        colors={['transparent', 'rgba(30, 41, 59, 0.55)']}
        style={styles.gradient}
        pointerEvents="none"
      />
      <View style={styles.hint} pointerEvents="none">
        <SymbolView
          name={{ android: 'photo_camera', web: 'photo_camera' }}
          size={18}
          tintColor={colors.onPrimary}
        />
        <Text style={styles.hintText}>Change cover</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  pressed: {
    opacity: 0.95,
  },
  cover: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
  },
  gradient: {
    ...StyleSheet.absoluteFill,
  },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  hintText: {
    ...typography.label,
    fontSize: 13,
    color: colors.onPrimary,
  },
});

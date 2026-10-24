import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors, spacing } from '@/theme';

/** Opens the trip Chat tab from the navigation bar. */
export function TripChatHeaderButton() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const onChat = tab === 'chat';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Trip chat"
      accessibilityState={{ selected: onChat }}
      hitSlop={8}
      onPress={() => {
        if (onChat) {
          return;
        }
        router.setParams({ tab: 'chat' });
      }}
      style={({ pressed }) => [styles.hit, pressed && !onChat ? styles.pressed : null]}
    >
      <SymbolView
        name={{ android: 'chat', web: 'chat' }}
        size={24}
        tintColor={onChat ? colors.primary : colors.ink}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  pressed: {
    opacity: 0.75,
  },
});

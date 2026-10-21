import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useBottomSafePadding } from '@/hooks/useBottomSafePadding';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { colors, radius, spacing, typography } from '@/theme';

type BottomFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  onShow?: () => void;
  /** When the keyboard opens, scroll toward the end (better for lower fields). Default scrolls to top. */
  keyboardScrollToEnd?: boolean;
  /** Optional ref to the inner ScrollView (e.g. to scroll on field focus). */
  scrollRef?: RefObject<ScrollView | null>;
};

/** Bottom sheet with scroll + keyboard insets (expenses, itinerary, profile edit). */
export function BottomFormSheet({
  visible,
  onClose,
  title,
  children,
  sheetStyle,
  onShow,
  keyboardScrollToEnd = false,
  scrollRef: scrollRefProp,
}: BottomFormSheetProps) {
  const modalBottomPad = useBottomSafePadding(spacing.lg);
  const keyboardInset = useKeyboardInset();
  const scrollRefLocal = useRef<ScrollView>(null);
  const scrollRef = scrollRefProp ?? scrollRefLocal;

  useEffect(() => {
    if (!visible || keyboardInset <= 0) {
      return;
    }
    const handle = requestAnimationFrame(() => {
      if (keyboardScrollToEnd) {
        scrollRef.current?.scrollToEnd({ animated: true });
      } else {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [keyboardInset, keyboardScrollToEnd, scrollRef, visible]);

  const sheetLift = keyboardInset > 0 ? keyboardInset : 0;
  const scrollBottomPad = modalBottomPad + (keyboardInset > 0 ? spacing.md : 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      onShow={onShow}
      statusBarTranslucent
    >
      <View style={styles.flex}>
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close form"
            style={styles.dismiss}
            onPress={onClose}
          />
          <View
            style={[
              styles.sheet,
              sheetStyle,
              sheetLift > 0 ? { marginBottom: sheetLift } : null,
            ]}
          >
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
            >
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {children}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismiss: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
    zIndex: 1,
  },
  scroll: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    fontSize: 22,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
});

import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useBottomSafePadding } from '@/hooks/useBottomSafePadding';
import { colors, radius, spacing, typography } from '@/theme';

type BottomFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
};

/** Bottom sheet with scroll + keyboard insets (expenses, itinerary, profile edit). */
export function BottomFormSheet({
  visible,
  onClose,
  title,
  children,
  sheetStyle,
}: BottomFormSheetProps) {
  const modalBottomPad = useBottomSafePadding(spacing.lg);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close form"
            style={styles.dismiss}
            onPress={onClose}
          />
          <View style={[styles.sheet, sheetStyle]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.scroll, { paddingBottom: modalBottomPad }]}
            >
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
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

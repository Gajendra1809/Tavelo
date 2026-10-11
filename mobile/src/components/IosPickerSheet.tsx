import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useBottomSafePadding } from '@/hooks/useBottomSafePadding';
import { colors, spacing, surfaceCard, typography } from '@/theme';

type IosPickerSheetProps = {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  children: ReactNode;
};

export function IosPickerSheet({ visible, title, onCancel, onConfirm, children }: IosPickerSheetProps) {
  const bottomPad = useBottomSafePadding(spacing.md);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss picker" style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: bottomPad }]}>
          <View style={styles.toolbar}>
            <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={onConfirm} hitSlop={8}>
              <Text style={styles.confirm}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.pickerWrap}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  sheet: {
    ...surfaceCard,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: {
    ...typography.label,
    color: colors.ink,
  },
  cancel: {
    ...typography.body,
    color: colors.muted,
  },
  confirm: {
    ...typography.label,
    color: colors.primary,
  },
  pickerWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});

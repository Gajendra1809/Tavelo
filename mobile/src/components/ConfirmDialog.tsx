import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Stay',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <SecondaryButton label={cancelLabel} onPress={onCancel} style={styles.action} />
            <PrimaryButton label={confirmLabel} onPress={onConfirm} style={styles.action} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  message: {
    ...typography.body,
    color: colors.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});

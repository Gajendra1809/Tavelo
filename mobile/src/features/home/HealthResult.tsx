import { StyleSheet, Text, View } from 'react-native';
import type { HealthReport } from '@/types/health';
import { colors, radius, spacing, typography } from '@/theme';

type HealthResultProps = {
  report: HealthReport;
};

export function HealthResult({ report }: HealthResultProps) {
  const databaseConnected = report.database === 'connected';

  return (
    <View style={styles.container}>
      <StatusLine label="API" value="Reachable" tone="success" />
      <StatusLine
        label="Database"
        value={databaseConnected ? 'Connected' : 'Not connected'}
        tone={databaseConnected ? 'success' : 'warning'}
      />
      <Text style={styles.time}>
        Checked {new Date(report.timestamp).toLocaleString()}
      </Text>
    </View>
  );
}

function StatusLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning';
}) {
  return (
    <View style={[styles.line, tone === 'success' ? styles.success : styles.warning]}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          styles.value,
          tone === 'success' ? styles.successText : styles.warningText,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  line: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  success: {
    backgroundColor: colors.successSurface,
  },
  warning: {
    backgroundColor: colors.warningSurface,
  },
  label: {
    ...typography.label,
    color: colors.ink,
  },
  value: {
    ...typography.label,
  },
  successText: {
    color: colors.success,
  },
  warningText: {
    color: colors.warning,
  },
  time: {
    ...typography.body,
    color: colors.muted,
    fontSize: 14,
  },
});

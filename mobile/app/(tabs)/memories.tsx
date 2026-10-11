import { StyleSheet, Text } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, typography } from '@/theme';

export default function MemoriesRoute() {
  return (
    <Screen>
      <Text style={styles.title}>Memories</Text>
      <EmptyState
        title="Trip galleries live on each trip"
        message="Open a trip and choose Open trip gallery to view and upload shared photos and videos."
        illustration="travel"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    fontSize: 32,
    color: colors.ink,
  },
});

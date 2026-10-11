import { StyleSheet, Text } from 'react-native';
import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';
import { colors, typography } from '@/theme';

export default function MemoriesRoute() {
  return (
    <Screen>
      <Text style={styles.title}>Memories</Text>
      <ComingSoon
        title="Photos and videos are coming later"
        message="Trip media will be stored outside the database, after membership and privacy controls exist."
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

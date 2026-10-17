import { StyleSheet, View } from 'react-native';
import { NotificationBell } from '@/components/NotificationBell';
import { TaveloLogo } from '@/components/TaveloLogo';
import { spacing } from '@/theme';

/** Logo and notifications row — scrolls with screen content (not sticky). */
export function AppTopBar() {
  return (
    <View style={styles.row}>
      <TaveloLogo height={34} />
      <NotificationBell />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    marginHorizontal: -spacing.xs,
  },
});

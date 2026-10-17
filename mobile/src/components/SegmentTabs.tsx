import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

export type SegmentTab<T extends string> = {
  id: T;
  label: string;
};

type SegmentTabsProps<T extends string> = {
  tabs: SegmentTab<T>[];
  active: T;
  onChange: (id: T) => void;
};

export function SegmentTabs<T extends string>({ tabs, active, onChange }: SegmentTabsProps<T>) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(tab.id)}
              style={[styles.chip, selected ? styles.chipActive : null]}
            >
              <Text style={[styles.label, selected ? styles.labelActive : null]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.seafoam,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  label: {
    ...typography.label,
    fontSize: 14,
    color: colors.primary,
  },
  labelActive: {
    color: colors.onPrimary,
  },
});

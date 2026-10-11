import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';
import { Atmosphere } from './Atmosphere';

type ScreenProps = {
  children: ReactNode;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
};

export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  refreshing = false,
  onRefresh,
  footer,
}: ScreenProps) {
  return (
    <View style={styles.root}>
      <Atmosphere />
      <SafeAreaView edges={edges} style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.sky,
    overflow: 'hidden',
  },
  safe: {
    flex: 1,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
});

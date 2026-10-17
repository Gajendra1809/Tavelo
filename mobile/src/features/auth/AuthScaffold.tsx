import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaveloLogo } from '@/components/TaveloLogo';
import { colors, radius, shadow, spacing, typography } from '@/theme';

type AuthScaffoldProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthScaffold({ title, subtitle, children, footer }: AuthScaffoldProps) {
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.heroWrap}>
            <Image
              accessibilityIgnoresInvertColors
              source={require('../../../assets/images/auth-road.jpg')}
              style={styles.hero}
            />
            <LinearGradient
              colors={['rgba(250,248,242,0)', colors.ivory]}
              style={styles.fade}
            />
          </View>
          <View style={styles.sheet}>
            <View style={styles.copy}>
              <TaveloLogo height={40} />
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            {children}
            {footer}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    backgroundColor: colors.ivory,
  },
  heroWrap: {
    height: 280,
    backgroundColor: colors.sky,
  },
  hero: {
    width: '100%',
    height: 280,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
  },
  sheet: {
    marginTop: -spacing.xl,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadow.card,
  },
  copy: {
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    fontSize: 32,
    color: colors.ink,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
  },
});

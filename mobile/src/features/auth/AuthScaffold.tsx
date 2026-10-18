import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
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

const HERO_EXPANDED = 220;
const HERO_COMPACT = 96;

export function AuthScaffold({ title, subtitle, children, footer }: AuthScaffoldProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const heroHeight = keyboardVisible ? HERO_COMPACT : HERO_EXPANDED;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? spacing.md : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.content,
            keyboardVisible ? styles.contentKeyboard : null,
          ]}
        >
          <View style={[styles.heroWrap, { height: heroHeight }]}>
            <Image
              accessibilityIgnoresInvertColors
              source={require('../../../assets/images/auth-road.jpg')}
              style={[styles.hero, { height: heroHeight }]}
            />
            <LinearGradient
              colors={['rgba(250,248,242,0)', colors.ivory]}
              style={styles.fade}
            />
          </View>
          <View style={styles.sheet}>
            <View style={styles.copy}>
              <TaveloLogo height={52} />
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
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.ivory,
  },
  contentKeyboard: {
    paddingBottom: spacing.xxl * 2,
  },
  heroWrap: {
    backgroundColor: colors.sky,
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
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

import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorState } from '@/components/ErrorState';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ApiError } from '@/lib/apiClient';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from './AuthProvider';
import { AuthScaffold } from './AuthScaffold';
import { validateLogin } from './validateAuth';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const nextErrors = validateLogin({ email, password });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await login({ email, password });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not sign in. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthScaffold
      title="Welcome back"
      subtitle="Sign in to see the trips you saved."
      footer={
        <Text style={styles.switch}>
          New here? <Link href="/register" style={styles.link}>Create an account</Link>
        </Text>
      }
    >
      <View style={styles.form}>
        <FormField
          label="Email or username"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="you@email.com or your_username"
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
        />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          placeholder="Your password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword((current) => !current)}
              style={styles.toggle}
            >
              <Text style={styles.toggleLabel}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          }
        />
        {formError ? <ErrorState title="Could not sign in" message={formError} /> : null}
        <PrimaryButton
          label="Sign in"
          onPress={() => void submit()}
          loading={saving}
          disabled={saving}
        />
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  toggle: {
    paddingRight: spacing.lg,
  },
  toggleLabel: {
    ...typography.label,
    color: colors.primary,
  },
  switch: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
  },
});

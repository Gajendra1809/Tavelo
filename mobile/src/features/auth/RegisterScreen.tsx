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
import { validateRegister, type RegisterValues } from './validateAuth';

const empty: RegisterValues = { name: '', email: '', password: '', confirmPassword: '' };

export function RegisterScreen() {
  const { register } = useAuth();
  const [values, setValues] = useState<RegisterValues>(empty);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(key: keyof RegisterValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit() {
    const nextErrors = validateRegister(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await register({
        name: values.name,
        email: values.email,
        password: values.password,
      });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Could not create the account. Try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthScaffold
      title="Create your account"
      subtitle="Your trips stay with you. No one else can open them."
      footer={
        <Text style={styles.switch}>
          Already have an account? <Link href="/login" style={styles.link}>Sign in</Link>
        </Text>
      }
    >
      <View style={styles.form}>
        <FormField
          label="Full name"
          value={values.name}
          onChangeText={(value) => update('name', value)}
          error={errors.name}
          placeholder="Your name"
          autoComplete="name"
          textContentType="name"
        />
        <FormField
          label="Email"
          value={values.email}
          onChangeText={(value) => update('email', value)}
          error={errors.email}
          placeholder="you@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <FormField
          label="Password"
          value={values.password}
          onChangeText={(value) => update('password', value)}
          error={errors.password}
          placeholder="At least 8 characters"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
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
        <FormField
          label="Confirm password"
          value={values.confirmPassword}
          onChangeText={(value) => update('confirmPassword', value)}
          error={errors.confirmPassword}
          placeholder="Repeat your password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        {formError ? <ErrorState title="Could not create account" message={formError} /> : null}
        <PrimaryButton
          label="Create account"
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

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomFormSheet } from '@/components/BottomFormSheet';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ApiError } from '@/lib/apiClient';
import { normalizeUsername, validateUsernameFormat } from '@/lib/username';
import { checkProfileUsernameAvailability, updateMyProfile } from '@/services/userService';
import type { AuthUser } from '@/types/auth';
import { colors, spacing, typography } from '@/theme';

type ProfileEditModalProps = {
  visible: boolean;
  user: AuthUser;
  onClose: () => void;
  onSaved: (user: AuthUser) => void;
};

export function ProfileEditModal({ visible, user, onClose, onSaved }: ProfileEditModalProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username ?? '');
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [usernameOk, setUsernameOk] = useState(true);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedUsername = useDebouncedValue(normalizeUsername(username), 400);
  const requestId = useRef(0);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setName(user.name);
    setEmail(user.email);
    setUsername(user.username ?? '');
    setError(null);
    setUsernameHint(null);
    setUsernameOk(true);
  }, [visible, user]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const normalized = debouncedUsername;
    const current = user.username ?? '';
    if (!normalized) {
      setUsernameHint(current ? 'Username cannot be removed.' : 'Optional — add a username friends can search for.');
      setUsernameOk(!current);
      setCheckingUsername(false);
      return;
    }
    if (current && normalized === current) {
      setUsernameHint('This is your current username.');
      setUsernameOk(true);
      setCheckingUsername(false);
      return;
    }
    const formatError = validateUsernameFormat(normalized);
    if (formatError) {
      setUsernameHint(formatError);
      setUsernameOk(false);
      setCheckingUsername(false);
      return;
    }
    const id = ++requestId.current;
    setCheckingUsername(true);
    setUsernameHint('Checking availability…');
    void checkProfileUsernameAvailability(normalized)
      .then((result) => {
        if (requestId.current !== id) {
          return;
        }
        setCheckingUsername(false);
        setUsernameOk(result.available);
        setUsernameHint(result.message);
      })
      .catch((failure) => {
        if (requestId.current !== id) {
          return;
        }
        setCheckingUsername(false);
        setUsernameOk(false);
        setUsernameHint(
          failure instanceof ApiError ? failure.message : 'Could not check username availability.',
        );
      });
  }, [debouncedUsername, user.username, visible]);

  async function save() {
    if (saving) {
      return;
    }
    setError(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const normalized = normalizeUsername(username);
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setError('Enter a valid email.');
      return;
    }
    if (normalized) {
      const formatError = validateUsernameFormat(normalized);
      if (formatError) {
        setError(formatError);
        return;
      }
      if (!usernameOk) {
        setError(usernameHint ?? 'Choose an available username.');
        return;
      }
    } else if (user.username) {
      setError('Username cannot be removed once set.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMyProfile({
        name: trimmedName,
        email: trimmedEmail,
        username: normalized || undefined,
      });
      onSaved(updated);
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  const usernameUnchanged = normalizeUsername(username) === (user.username ?? '');
  const saveDisabled = saving || checkingUsername || (!usernameUnchanged && !usernameOk);

  const hintColor =
    usernameOk || usernameUnchanged ? colors.primary : checkingUsername ? colors.muted : colors.danger;

  return (
    <BottomFormSheet visible={visible} onClose={onClose} title="Edit profile">
      <FormField label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <FormField
        label="Username"
        value={username}
        onChangeText={(value) => {
          setUsername(value.replace(/\s/g, '').replace(/^@+/, ''));
          setError(null);
        }}
        placeholder="your_username"
        autoCapitalize="none"
        autoComplete="username"
        textContentType="username"
      />
      {usernameHint ? <Text style={[styles.hint, { color: hintColor }]}>{usernameHint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <PrimaryButton
          label="Save changes"
          onPress={() => void save()}
          loading={saving}
          disabled={saveDisabled}
        />
        <SecondaryButton label="Cancel" onPress={onClose} disabled={saving} />
      </View>
    </BottomFormSheet>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...typography.body,
    fontSize: 13,
    marginTop: -spacing.sm,
  },
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.danger,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});

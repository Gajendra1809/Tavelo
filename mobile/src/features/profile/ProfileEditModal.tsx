import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useBottomSafePadding } from '@/hooks/useBottomSafePadding';
import { ApiError } from '@/lib/apiClient';
import { normalizeUsername, validateUsernameFormat } from '@/lib/username';
import { checkProfileUsernameAvailability, updateMyProfile } from '@/services/userService';
import type { AuthUser } from '@/types/auth';
import { colors, radius, spacing, typography } from '@/theme';

type ProfileEditModalProps = {
  visible: boolean;
  user: AuthUser;
  onClose: () => void;
  onSaved: (user: AuthUser) => void;
};

export function ProfileEditModal({ visible, user, onClose, onSaved }: ProfileEditModalProps) {
  const modalBottomPad = useBottomSafePadding();
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

  const usernameUnchanged = normalizeUsername(username) === (user.username ?? '');
  const usernameFieldOk =
    usernameUnchanged ||
    (!username.trim() && !user.username) ||
    (usernameOk && normalizeUsername(username) === debouncedUsername);

  const saveDisabled =
    saving || (!usernameUnchanged && checkingUsername) || !usernameFieldOk;

  async function save() {
    if (saveDisabled) {
      return;
    }
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      setError('Enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (user.username && !normalizeUsername(username)) {
      setError('Username cannot be removed once set.');
      return;
    }

    const payload: { name?: string; email?: string; username?: string } = {};
    if (trimmedName !== user.name) {
      payload.name = trimmedName;
    }
    if (trimmedEmail !== user.email) {
      payload.email = trimmedEmail;
    }
    const nextUsername = normalizeUsername(username);
    if (nextUsername && nextUsername !== (user.username ?? '')) {
      payload.username = nextUsername;
    }
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateMyProfile(payload);
      onSaved(updated);
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  const hintColor =
    usernameOk || usernameUnchanged ? colors.primary : checkingUsername ? colors.muted : colors.danger;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close profile editor"
          style={styles.dismiss}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scroll, { paddingBottom: modalBottomPad }]}
          >
            <Text style={styles.title}>Edit profile</Text>
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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismiss: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    zIndex: 1,
  },
  scroll: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.cardTitle,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
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

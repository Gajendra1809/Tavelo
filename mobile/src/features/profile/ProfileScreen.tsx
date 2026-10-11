import { router, useFocusEffect, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { EditableAvatar } from '@/components/EditableAvatar';
import { PhotoActionLinks } from '@/components/PhotoActionLinks';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { profileCache } from '@/lib/cache/profileCache';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import { ApiError } from '@/lib/apiClient';
import { isLoopbackUrl, readApiConfig } from '@/lib/config';
import { applyUserUpdate } from '@/lib/session';
import { deleteAvatar, mimeFromUri, uploadAvatarFromUri } from '@/services/mediaService';
import { colors, spacing, surfaceCard, typography } from '@/theme';
import { HealthResult } from '../home/HealthResult';

export function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const config = readApiConfig();
  const { state, check } = useHealthCheck();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile().catch(() => undefined);
    }, [refreshProfile]),
  );

  async function changePhoto() {
    if (photoBusy) {
      return;
    }
    setPhotoError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Photo library access is required to choose a profile picture.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) {
      return;
    }
    const asset = picked.assets[0];
    const byteSize = asset.fileSize ?? 0;
    if (byteSize <= 0) {
      setPhotoError('Could not read the selected image size.');
      return;
    }
    setPhotoBusy(true);
    try {
      const contentType = asset.mimeType ?? mimeFromUri(asset.uri);
      const updated = await uploadAvatarFromUri(asset.uri, contentType, byteSize);
      profileCache.invalidate();
      await applyUserUpdate(updated);
    } catch (error) {
      setPhotoError(
        error instanceof ApiError ? error.message : 'Could not update your profile photo.',
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (photoBusy) {
      return;
    }
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const updated = await deleteAvatar();
      profileCache.invalidate();
      await applyUserUpdate(updated);
    } catch (error) {
      setPhotoError(
        error instanceof ApiError ? error.message : 'Could not remove your profile photo.',
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  async function signOut() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.profileCard}>
        <EditableAvatar
          name={user?.name ?? 'Traveler'}
          uri={user?.avatarUrl}
          disabled={photoBusy}
          onPress={() => void changePhoto()}
        />
        <Text style={styles.cardTitle}>{user?.name ?? 'Your account'}</Text>
        <Text style={styles.email}>{user?.email ?? 'Signed in'}</Text>
        <PhotoActionLinks
          busy={photoBusy}
          hasPhoto={Boolean(user?.avatarUrl)}
          changeLabel="Choose photo"
          removeLabel="Remove photo"
          onChange={() => void changePhoto()}
          onRemove={() => void removePhoto()}
        />
        {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
      </View>
      <View style={styles.card}>
        <SecondaryButton label="Invitations" onPress={() => router.push('/invitations' as Href)} />
        <SecondaryButton
          label={loggingOut ? 'Signing out…' : 'Log out'}
          onPress={() => setConfirmLogout(true)}
          disabled={loggingOut}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>API connection</Text>
        {'error' in config ? (
          <ErrorState title="Configuration needed" message={config.error} />
        ) : (
          <>
            <Text selectable style={styles.url}>
              {config.baseUrl}
            </Text>
            {isLoopbackUrl(config.baseUrl) ? (
              <Text style={styles.hint}>
                This URL points at this computer. A phone needs your computer’s LAN address
                instead.
              </Text>
            ) : null}
            <PrimaryButton
              label={state.status === 'idle' ? 'Check connection' : 'Check again'}
              loading={state.status === 'loading'}
              onPress={() => void check()}
            />
            {state.status === 'idle' ? (
              <EmptyState
                title="No check yet"
                message="Run a connection check to see whether the API and database are reachable."
              />
            ) : null}
            {state.status === 'loading' ? <LoadingState message="Contacting the API…" /> : null}
            {state.status === 'error' ? <ErrorState message={state.message} /> : null}
            {state.status === 'success' ? <HealthResult report={state.report} /> : null}
          </>
        )}
      </View>
      <ConfirmDialog
        visible={confirmLogout}
        title="Log out?"
        message="You will need to sign in again to see your trips."
        confirmLabel="Log out"
        cancelLabel="Stay"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => void signOut()}
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
  profileCard: {
    ...surfaceCard,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  email: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  card: {
    ...surfaceCard,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  url: {
    ...typography.body,
    fontSize: 14,
    color: colors.ink,
  },
  hint: {
    ...typography.body,
    fontSize: 14,
    color: colors.warning,
  },
  photoError: {
    ...typography.body,
    fontSize: 13,
    color: colors.danger,
  },
});

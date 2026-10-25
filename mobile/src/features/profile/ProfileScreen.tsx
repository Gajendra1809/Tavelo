import { router, useFocusEffect, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { PushAlertsCard } from '@/features/notifications/PushAlertsCard';
import { ProfileEditModal } from '@/features/profile/ProfileEditModal';
import { profileCache } from '@/lib/cache/profileCache';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import { ApiError } from '@/lib/apiClient';
import { isLoopbackUrl, isTetheredPcLanUrl, readApiConfig } from '@/lib/config';
import { applyUserUpdate } from '@/lib/session';
import { logAppError, userFacingMessage } from '@/lib/errorReport';
import { bumpAvatarDisplayGeneration, avatarImageCacheKey } from '@/lib/avatarDisplay';
import { deleteAvatar, mimeFromUri, uploadAvatarFromUri } from '@/services/mediaService';
import { resolveLocalByteSize } from '@/services/storageUpload';
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
  const [editOpen, setEditOpen] = useState(false);

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
    const byteSize = await resolveLocalByteSize(asset.uri, asset.fileSize ?? 0);
    if (byteSize <= 0) {
      setPhotoError('Could not read the selected image size.');
      return;
    }
    setPhotoBusy(true);
    try {
      const contentType = asset.mimeType ?? mimeFromUri(asset.uri);
      const updated = await uploadAvatarFromUri(asset.uri, contentType, byteSize);
      profileCache.invalidate();
      bumpAvatarDisplayGeneration();
      await applyUserUpdate(updated);
      await refreshProfile({ force: true });
    } catch (error) {
      logAppError('profile avatar upload', error);
      setPhotoError(userFacingMessage(error, 'Could not update your profile photo.'));
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
      bumpAvatarDisplayGeneration();
      await applyUserUpdate(updated);
      await refreshProfile({ force: true });
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

  async function handleProfileSaved(updated: Parameters<typeof applyUserUpdate>[0]) {
    profileCache.invalidate();
    await applyUserUpdate(updated);
  }

  return (
    <Screen brandHeader>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.profileCard}>
        {user ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={() => setEditOpen(true)}
            style={({ pressed }) => [styles.editButton, pressed ? styles.editPressed : null]}
          >
            <SymbolView
              name={{ android: 'edit', web: 'edit' }}
              size={20}
              tintColor={colors.primary}
            />
          </Pressable>
        ) : null}
        <EditableAvatar
          name={user?.name ?? 'Traveler'}
          uri={user?.avatarUrl}
          cacheKey={user?.id ? avatarImageCacheKey(user.id, user.avatarUrl) : null}
          disabled={photoBusy}
          onPress={() => void changePhoto()}
        />
        <Text style={styles.cardTitle}>{user?.name ?? 'Your account'}</Text>
        {user?.username ? (
          <Text style={styles.handle}>@{user.username}</Text>
        ) : (
          <Text style={styles.noHandle}>No username yet</Text>
        )}
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
      {user ? (
        <ProfileEditModal
          visible={editOpen}
          user={user}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => void handleProfileSaved(updated)}
        />
      ) : null}
      <PushAlertsCard />
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
                This URL points at this phone. With USB debugging, run adb reverse tcp:4000
                tcp:4000 and use http://127.0.0.1:4000, or use your PC’s Wi‑Fi IP on the same
                router as the phone.
              </Text>
            ) : null}
            {isTetheredPcLanUrl(config.baseUrl) ? (
              <Text style={styles.hint}>
                This looks like a hotspot or USB-tether address (172.x). Many phones cannot
                reach a PC on that network. Connect the PC and phone to the same home Wi‑Fi and
                use the PC’s Wi‑Fi IPv4 from ipconfig (often 192.168.x.x).
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
    position: 'relative',
  },
  editButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.seafoam,
  },
  editPressed: {
    opacity: 0.85,
  },
  handle: {
    ...typography.body,
    fontSize: 15,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  noHandle: {
    ...typography.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
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

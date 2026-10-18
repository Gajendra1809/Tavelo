/** Bumped after avatar upload/delete so expo-image cache keys rotate. */
let avatarDisplayGeneration = 0;

export function bumpAvatarDisplayGeneration(): number {
  avatarDisplayGeneration += 1;
  return avatarDisplayGeneration;
}

export function avatarImageCacheKey(userId: string, uri?: string | null): string {
  const uriKey = uri?.trim() ? uri.trim().slice(-48) : 'none';
  return `avatar:${userId}:g${avatarDisplayGeneration}:${uriKey}`;
}

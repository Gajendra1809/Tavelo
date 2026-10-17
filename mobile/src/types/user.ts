export type UsernameAvailability = {
  username: string;
  available: boolean;
  reason: 'available' | 'taken' | 'invalid';
  message: string;
};

export type UserSearchHit = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  avatarUrl: string | null;
};

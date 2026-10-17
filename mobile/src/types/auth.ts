export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  avatarUrl?: string | null;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

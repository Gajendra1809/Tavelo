export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

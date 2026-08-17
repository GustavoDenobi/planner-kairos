export type PasswordRecoveryCode = {
  id: string;
  userId: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
};

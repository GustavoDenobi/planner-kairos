export type PasswordRecoveryGateway = {
  request(email: string): Promise<void>;
  confirm(email: string, code: string, newPassword: string): Promise<void>;
};

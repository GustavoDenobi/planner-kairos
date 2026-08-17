export type AccessRole = 'owner' | 'admin' | 'member';

export type Membership = {
  id: string;
  organizationId: string;
  userId: string;
  accessRole: AccessRole;
};

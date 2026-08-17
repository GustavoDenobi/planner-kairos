export type GroupInvite = {
  id: string;
  organizationId: string;
  groupId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  redeemedAt: Date | null;
  redeemedByUserId: string | null;
  createdByUserId: string;
};

export type GroupInvitePreview = {
  inviteId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationImageStorageKey: string | null;
  groupId: string;
  groupName: string;
  expiresAt: Date;
};

export type GroupInviteListItem = {
  id: string;
  groupId: string;
  groupName: string;
  token: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  redeemedAt: Date | null;
  createdAt: Date;
};

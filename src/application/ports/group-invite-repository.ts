import type {
  GroupInviteListItem,
  GroupInvitePreview,
} from '@/domain/identity';

export type GroupInviteRepository = {
  previewByToken(token: string): Promise<GroupInvitePreview | null>;
  redeem(token: string): Promise<string>;
  create(groupId: string, expiresAt: Date): Promise<{ inviteId: string; token: string }>;
  revoke(inviteId: string): Promise<void>;
  updateExpires(inviteId: string, expiresAt: Date): Promise<void>;
  listForOrg(organizationId: string): Promise<GroupInviteListItem[]>;
};

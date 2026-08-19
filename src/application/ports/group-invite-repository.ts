import type {
  GroupInviteListItem,
  GroupInvitePreview,
} from '@/domain/identity';

export type RedeemGroupInviteContact = {
  phone?: string | null;
  birthDate?: string | null;
};

export type GroupInviteRepository = {
  previewByToken(token: string): Promise<GroupInvitePreview | null>;
  redeem(token: string, contact?: RedeemGroupInviteContact): Promise<string>;
  create(
    groupId: string,
    expiresAt: Date,
    maxUses?: number,
  ): Promise<{ inviteId: string; token: string }>;
  revoke(inviteId: string): Promise<void>;
  updateExpires(inviteId: string, expiresAt: Date): Promise<void>;
  updateMaxUses(inviteId: string, maxUses: number): Promise<void>;
  listForOrg(organizationId: string): Promise<GroupInviteListItem[]>;
};

import type { GroupInviteRepository } from '@/application/ports';
import type { GroupInviteListItem, GroupInvitePreview } from '@/domain/identity';
import { supabase } from './client';

export function createGroupInviteRepository(): GroupInviteRepository {
  return {
    async previewByToken(token) {
      const { data, error } = await supabase.rpc('get_invite_preview', {
        p_token: token,
      });

      if (error || !data || data.length === 0) {
        return null;
      }

      const row = data[0];
      return {
        inviteId: row.invite_id,
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        organizationSlug: row.organization_slug,
        organizationImageStorageKey: row.organization_image_storage_key ?? null,
        groupId: row.group_id,
        groupName: row.group_name,
        expiresAt: new Date(row.expires_at),
      } satisfies GroupInvitePreview;
    },

    async redeem(token, contact) {
      const { data, error } = await supabase.rpc('redeem_group_invite', {
        p_token: token,
        p_phone: contact?.phone ?? null,
        p_birth_date: contact?.birthDate ?? null,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        throw new Error('redeem_failed');
      }

      return data[0].organization_slug;
    },

    async create(groupId, expiresAt, maxUses = 0) {
      const { data, error } = await supabase.rpc('create_group_invite', {
        p_group_id: groupId,
        p_expires_at: expiresAt.toISOString(),
        p_max_uses: maxUses,
      });

      if (error || !data || data.length === 0) {
        throw new Error(error?.message ?? 'create_invite_failed');
      }

      return { inviteId: data[0].invite_id, token: data[0].token };
    },

    async revoke(inviteId) {
      const { error } = await supabase.rpc('revoke_group_invite', {
        p_invite_id: inviteId,
      });

      if (error) {
        throw new Error(error.message);
      }
    },

    async updateExpires(inviteId, expiresAt) {
      const { error } = await supabase.rpc('update_group_invite_expires', {
        p_invite_id: inviteId,
        p_expires_at: expiresAt.toISOString(),
      });

      if (error) {
        throw new Error(error.message);
      }
    },

    async updateMaxUses(inviteId, maxUses) {
      const { error } = await supabase.rpc('update_group_invite_max_uses', {
        p_invite_id: inviteId,
        p_max_uses: maxUses,
      });

      if (error) {
        throw new Error(error.message);
      }
    },

    async listForOrg(organizationId) {
      const { data, error } = await supabase.rpc('list_group_invites', {
        p_organization_id: organizationId,
      });

      if (error || !data) {
        return [];
      }

      return (data as Array<{
        id: string;
        group_id: string;
        group_name: string;
        token: string | null;
        expires_at: string;
        revoked_at: string | null;
        redeemed_at: string | null;
        created_at: string;
        max_uses: number;
        use_count: number;
        redeemed_musicians: Array<{
          id: string;
          full_name: string;
          email: string | null;
          created_at: string;
        }> | null;
      }>).map(
        (row) =>
          ({
            id: row.id,
            groupId: row.group_id,
            groupName: row.group_name,
            token: row.token ?? null,
            expiresAt: new Date(row.expires_at),
            revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
            redeemedAt: row.redeemed_at ? new Date(row.redeemed_at) : null,
            createdAt: new Date(row.created_at),
            maxUses: row.max_uses,
            useCount: row.use_count,
            redeemedMusicians: (row.redeemed_musicians ?? []).map((musician) => ({
              id: musician.id,
              fullName: musician.full_name,
              email: musician.email,
              createdAt: new Date(musician.created_at),
            })),
          }) satisfies GroupInviteListItem,
      );
    },
  };
}

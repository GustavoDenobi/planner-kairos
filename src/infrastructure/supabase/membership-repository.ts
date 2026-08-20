import type { MembershipRepository } from '@/application/ports';
import type { Membership } from '@/domain/identity';
import { supabase } from './client';

function mapMembership(row: {
  id: string;
  organization_id: string;
  user_id: string;
  access_role: Membership['accessRole'];
}): Membership {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    accessRole: row.access_role,
  };
}

function mapRpcError(message: string): never {
  throw new Error(message);
}

export function createMembershipRepository(): MembershipRepository {
  return {
    async getByUserAndOrg(organizationId, userId) {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, organization_id, user_id, access_role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapMembership(data);
    },

    async grantAdmin(organizationId, userId) {
      const { error } = await supabase.rpc('grant_org_admin', {
        p_organization_id: organizationId,
        p_user_id: userId,
      });

      if (error) {
        mapRpcError(error.message);
      }
    },

    async revokeAdmin(organizationId, userId) {
      const { error } = await supabase.rpc('revoke_org_admin', {
        p_organization_id: organizationId,
        p_user_id: userId,
      });

      if (error) {
        mapRpcError(error.message);
      }
    },
  };
}

import type { OrganizationRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export type SetOrganizationRulesInput = {
  organizationId: string;
  title: string;
  markdown: string;
  requiresAcceptance: boolean;
};

export type SetOrganizationRulesError = 'invalid_title' | 'invalid_markdown';

export async function setOrganizationRules(
  orgRepo: OrganizationRepository,
  input: SetOrganizationRulesInput,
) {
  const title = input.title.trim();
  const markdown = input.markdown.trim();

  if (!title) {
    return Result.fail('invalid_title' as SetOrganizationRulesError);
  }

  if (!markdown) {
    return Result.fail('invalid_markdown' as SetOrganizationRulesError);
  }

  const rules = await orgRepo.updateRules(input.organizationId, {
    title,
    markdown,
    requiresAcceptance: input.requiresAcceptance,
  });

  return Result.ok(rules);
}

export async function getOrganizationRules(orgRepo: OrganizationRepository, organizationId: string) {
  const org = await orgRepo.getById(organizationId);
  if (!org) {
    return Result.fail('not_found');
  }

  return Result.ok(org.rules);
}

export type OrganizationRulesInput = {
  title: string;
  markdown: string;
  requiresAcceptance: boolean;
};

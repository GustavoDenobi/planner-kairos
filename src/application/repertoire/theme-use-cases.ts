import type { PieceThemeRepository } from '@/application/ports/piece-theme-repository';
import type { PieceThemeInput } from '@/domain/repertoire';
import { validatePieceThemeInput } from '@/domain/repertoire';
import { Result } from '@/domain/shared';

export async function listPieceThemes(
  themeRepo: PieceThemeRepository,
  organizationId: string,
) {
  const themes = await themeRepo.listForOrg(organizationId);
  return Result.ok(themes);
}

export async function createPieceTheme(
  themeRepo: PieceThemeRepository,
  organizationId: string,
  input: PieceThemeInput,
) {
  const validationError = validatePieceThemeInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const theme = await themeRepo.create(organizationId, input);
    return Result.ok(theme);
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return Result.fail('duplicate_slug');
    }
    return Result.fail('create_failed');
  }
}

export async function updatePieceTheme(
  themeRepo: PieceThemeRepository,
  organizationId: string,
  themeId: string,
  input: PieceThemeInput,
) {
  const validationError = validatePieceThemeInput(input);
  if (validationError) {
    return Result.fail(validationError);
  }

  try {
    const theme = await themeRepo.update(organizationId, themeId, input);
    return Result.ok(theme);
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return Result.fail('duplicate_slug');
    }
    return Result.fail('update_failed');
  }
}

export async function deletePieceTheme(
  themeRepo: PieceThemeRepository,
  organizationId: string,
  themeId: string,
) {
  try {
    await themeRepo.delete(organizationId, themeId);
    return Result.ok(undefined);
  } catch {
    return Result.fail('delete_failed');
  }
}

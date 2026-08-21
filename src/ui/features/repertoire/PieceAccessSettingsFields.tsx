import type { GroupFileAccessSettings } from '@/domain/ensemble';
import type { PieceFileAccessScope, PieceFileAccessSettingsInput } from '@/domain/repertoire';
import { PIECE_FILE_ACCESS_SCOPE_OPTIONS } from '@/ui/features/repertoire/piece-access-labels';

type GroupFileAccessSettingsFormProps = {
  fileAccessScope: PieceFileAccessScope;
  allowFileDownload: boolean;
  allowPieceAccessOverride: boolean;
  onFileAccessScopeChange: (value: PieceFileAccessScope) => void;
  onAllowFileDownloadChange: (value: boolean) => void;
  onAllowPieceAccessOverrideChange: (value: boolean) => void;
  disabled?: boolean;
};

export function GroupFileAccessSettingsForm({
  fileAccessScope,
  allowFileDownload,
  allowPieceAccessOverride,
  onFileAccessScopeChange,
  onAllowFileDownloadChange,
  onAllowPieceAccessOverrideChange,
  disabled = false,
}: GroupFileAccessSettingsFormProps) {
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-medium text-text">Visibilidade para integrantes e alunos</legend>
        {PIECE_FILE_ACCESS_SCOPE_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm text-text">
            <input
              type="radio"
              name="fileAccessScope"
              value={option.value}
              checked={fileAccessScope === option.value}
              onChange={() => onFileAccessScopeChange(option.value)}
              className="border-border text-primary focus:ring-primary"
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <label className="flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={allowFileDownload}
          onChange={(event) => onAllowFileDownloadChange(event.target.checked)}
          disabled={disabled}
          className="mt-0.5 rounded border-border text-primary focus:ring-primary"
        />
        <span>Permitir download de arquivos</span>
      </label>

      <label className="flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={allowPieceAccessOverride}
          onChange={(event) => onAllowPieceAccessOverrideChange(event.target.checked)}
          disabled={disabled}
          className="mt-0.5 rounded border-border text-primary focus:ring-primary"
        />
        <span>Permitir que regra de acesso da peça sobrescreva regra do grupo</span>
      </label>
    </div>
  );
}

type PieceFileAccessOverrideFormProps = {
  inheritRules: boolean;
  fileAccessScope: PieceFileAccessScope | null;
  allowFileDownload: boolean | null;
  onInheritRulesChange: (inherit: boolean) => void;
  onFileAccessScopeChange: (value: PieceFileAccessScope) => void;
  onAllowFileDownloadChange: (value: boolean) => void;
  disabled?: boolean;
};

export function PieceFileAccessOverrideForm({
  inheritRules,
  fileAccessScope,
  allowFileDownload,
  onInheritRulesChange,
  onFileAccessScopeChange,
  onAllowFileDownloadChange,
  disabled = false,
}: PieceFileAccessOverrideFormProps) {
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={inheritRules}
          onChange={(event) => onInheritRulesChange(event.target.checked)}
          disabled={disabled}
          className="mt-0.5 rounded border-border text-primary focus:ring-primary"
        />
        <span>Usar regra do grupo vinculado</span>
      </label>

      {!inheritRules && (
        <>
          <fieldset className="space-y-2" disabled={disabled}>
            <legend className="text-sm font-medium text-text">Visibilidade para integrantes e alunos</legend>
            {PIECE_FILE_ACCESS_SCOPE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-text">
                <input
                  type="radio"
                  name="pieceFileAccessScope"
                  value={option.value}
                  checked={(fileAccessScope ?? 'own_parts') === option.value}
                  onChange={() => onFileAccessScopeChange(option.value)}
                  className="border-border text-primary focus:ring-primary"
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <label className="flex items-start gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={allowFileDownload ?? true}
              onChange={(event) => onAllowFileDownloadChange(event.target.checked)}
              disabled={disabled}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary"
            />
            <span>Permitir download de arquivos</span>
          </label>
        </>
      )}
    </div>
  );
}

export function toGroupFileAccessInput(settings: GroupFileAccessSettings): GroupFileAccessSettings {
  return settings;
}

export function toPieceAccessSettingsInput(
  inheritRules: boolean,
  fileAccessScope: PieceFileAccessScope | null,
  allowFileDownload: boolean | null,
): PieceFileAccessSettingsInput {
  if (inheritRules) {
    return { fileAccessScope: null, allowFileDownload: null };
  }
  return {
    fileAccessScope: fileAccessScope ?? 'own_parts',
    allowFileDownload: allowFileDownload ?? true,
  };
}

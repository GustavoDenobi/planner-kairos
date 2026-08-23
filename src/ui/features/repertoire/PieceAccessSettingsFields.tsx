import type { GroupFileAccessSettings } from '@/domain/ensemble';
import type { PieceFileAccessScope, PieceFileAccessSettingsInput } from '@/domain/repertoire';
import {
  PIECE_AUDIO_ACCESS_SCOPE_OPTIONS,
  PIECE_FILE_ACCESS_SCOPE_OPTIONS,
} from '@/ui/features/repertoire/piece-access-labels';

type AccessScopeFieldsetProps = {
  legend: string;
  name: string;
  scope: PieceFileAccessScope;
  options: Array<{ value: PieceFileAccessScope; label: string }>;
  onScopeChange: (value: PieceFileAccessScope) => void;
  allowDownload: boolean;
  onAllowDownloadChange: (value: boolean) => void;
  downloadLabel: string;
  disabled?: boolean;
};

function AccessScopeFieldset({
  legend,
  name,
  scope,
  options,
  onScopeChange,
  allowDownload,
  onAllowDownloadChange,
  downloadLabel,
  disabled = false,
}: AccessScopeFieldsetProps) {
  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-medium text-text">{legend}</legend>
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm text-text">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={scope === option.value}
              onChange={() => onScopeChange(option.value)}
              className="border-border text-primary focus:ring-primary"
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <label className="flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={allowDownload}
          onChange={(event) => onAllowDownloadChange(event.target.checked)}
          disabled={disabled}
          className="mt-0.5 rounded border-border text-primary focus:ring-primary"
        />
        <span>{downloadLabel}</span>
      </label>
    </div>
  );
}

type GroupFileAccessSettingsFormProps = {
  fileAccessScope: PieceFileAccessScope;
  allowFileDownload: boolean;
  audioAccessScope: PieceFileAccessScope;
  audioAllowDownload: boolean;
  allowPieceAccessOverride: boolean;
  onFileAccessScopeChange: (value: PieceFileAccessScope) => void;
  onAllowFileDownloadChange: (value: boolean) => void;
  onAudioAccessScopeChange: (value: PieceFileAccessScope) => void;
  onAudioAllowDownloadChange: (value: boolean) => void;
  onAllowPieceAccessOverrideChange: (value: boolean) => void;
  disabled?: boolean;
};

export function GroupFileAccessSettingsForm({
  fileAccessScope,
  allowFileDownload,
  audioAccessScope,
  audioAllowDownload,
  allowPieceAccessOverride,
  onFileAccessScopeChange,
  onAllowFileDownloadChange,
  onAudioAccessScopeChange,
  onAudioAllowDownloadChange,
  onAllowPieceAccessOverrideChange,
  disabled = false,
}: GroupFileAccessSettingsFormProps) {
  return (
    <div className="space-y-4">
      <AccessScopeFieldset
        legend="Partituras"
        name="fileAccessScope"
        scope={fileAccessScope}
        options={PIECE_FILE_ACCESS_SCOPE_OPTIONS}
        onScopeChange={onFileAccessScopeChange}
        allowDownload={allowFileDownload}
        onAllowDownloadChange={onAllowFileDownloadChange}
        downloadLabel="Permitir download de partituras"
        disabled={disabled}
      />

      <AccessScopeFieldset
        legend="Áudios"
        name="audioAccessScope"
        scope={audioAccessScope}
        options={PIECE_AUDIO_ACCESS_SCOPE_OPTIONS}
        onScopeChange={onAudioAccessScopeChange}
        allowDownload={audioAllowDownload}
        onAllowDownloadChange={onAudioAllowDownloadChange}
        downloadLabel="Permitir download de áudios"
        disabled={disabled}
      />

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
  inheritScoreRules: boolean;
  fileAccessScope: PieceFileAccessScope | null;
  allowFileDownload: boolean | null;
  inheritAudioRules: boolean;
  audioAccessScope: PieceFileAccessScope | null;
  audioAllowDownload: boolean | null;
  onInheritScoreRulesChange: (inherit: boolean) => void;
  onFileAccessScopeChange: (value: PieceFileAccessScope) => void;
  onAllowFileDownloadChange: (value: boolean) => void;
  onInheritAudioRulesChange: (inherit: boolean) => void;
  onAudioAccessScopeChange: (value: PieceFileAccessScope) => void;
  onAudioAllowDownloadChange: (value: boolean) => void;
  disabled?: boolean;
};

export function PieceFileAccessOverrideForm({
  inheritScoreRules,
  fileAccessScope,
  allowFileDownload,
  inheritAudioRules,
  audioAccessScope,
  audioAllowDownload,
  onInheritScoreRulesChange,
  onFileAccessScopeChange,
  onAllowFileDownloadChange,
  onInheritAudioRulesChange,
  onAudioAccessScopeChange,
  onAudioAllowDownloadChange,
  disabled = false,
}: PieceFileAccessOverrideFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={inheritScoreRules}
            onChange={(event) => onInheritScoreRulesChange(event.target.checked)}
            disabled={disabled}
            className="mt-0.5 rounded border-border text-primary focus:ring-primary"
          />
          <span>Usar regra do grupo para partituras</span>
        </label>

        {!inheritScoreRules && (
          <AccessScopeFieldset
            legend="Partituras"
            name="pieceFileAccessScope"
            scope={fileAccessScope ?? 'own_parts'}
            options={PIECE_FILE_ACCESS_SCOPE_OPTIONS}
            onScopeChange={onFileAccessScopeChange}
            allowDownload={allowFileDownload ?? true}
            onAllowDownloadChange={onAllowFileDownloadChange}
            downloadLabel="Permitir download de partituras"
            disabled={disabled}
          />
        )}
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={inheritAudioRules}
            onChange={(event) => onInheritAudioRulesChange(event.target.checked)}
            disabled={disabled}
            className="mt-0.5 rounded border-border text-primary focus:ring-primary"
          />
          <span>Usar regra do grupo para áudios</span>
        </label>

        {!inheritAudioRules && (
          <AccessScopeFieldset
            legend="Áudios"
            name="pieceAudioAccessScope"
            scope={audioAccessScope ?? 'own_parts'}
            options={PIECE_AUDIO_ACCESS_SCOPE_OPTIONS}
            onScopeChange={onAudioAccessScopeChange}
            allowDownload={audioAllowDownload ?? true}
            onAllowDownloadChange={onAudioAllowDownloadChange}
            downloadLabel="Permitir download de áudios"
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}

export function toGroupFileAccessInput(settings: GroupFileAccessSettings): GroupFileAccessSettings {
  return settings;
}

export function toPieceAccessSettingsInput(
  inheritScoreRules: boolean,
  fileAccessScope: PieceFileAccessScope | null,
  allowFileDownload: boolean | null,
  inheritAudioRules: boolean,
  audioAccessScope: PieceFileAccessScope | null,
  audioAllowDownload: boolean | null,
): PieceFileAccessSettingsInput {
  return {
    fileAccessScope: inheritScoreRules ? null : (fileAccessScope ?? 'own_parts'),
    allowFileDownload: inheritScoreRules ? null : (allowFileDownload ?? true),
    audioAccessScope: inheritAudioRules ? null : (audioAccessScope ?? 'own_parts'),
    audioAllowDownload: inheritAudioRules ? null : (audioAllowDownload ?? true),
  };
}

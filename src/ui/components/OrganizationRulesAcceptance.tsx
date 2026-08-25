import { MarkdownContent } from '@/ui/components/MarkdownContent';

type OrganizationRulesAcceptanceProps = {
  organizationName: string;
  title: string;
  markdown: string;
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  disabled?: boolean;
  error?: string | null;
};

export function OrganizationRulesAcceptance({
  organizationName,
  title,
  markdown,
  accepted,
  onChange,
  disabled = false,
  error = null,
}: OrganizationRulesAcceptanceProps) {
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <p className="text-sm font-medium text-text">{title}</p>
      <p className="mt-1 text-xs text-muted">{organizationName}</p>
      <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-border bg-surface p-3">
        <MarkdownContent markdown={markdown} />
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={accepted}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          Li e aceito o regulamento de <strong className="text-text">{organizationName}</strong>.
          {error && <span className="mt-1 block text-red-600">{error}</span>}
        </span>
      </label>
    </div>
  );
}

import type { PartWithDivisions } from '@/application/ports/part-repository';
import type { PieceFileOrganization, PiecePartLink } from '@/domain/repertoire';
import type { PartLinkSelection } from '@/ui/features/repertoire/PieceFileUploadEntries';

type PiecePartLinksFieldProps = {
  parts: PartWithDivisions[];
  links: PartLinkSelection[];
  fileOrganization: PieceFileOrganization;
  disabled?: boolean;
  onChange: (links: PartLinkSelection[]) => void;
};

function partLinkKey(link: PiecePartLink): string {
  return `${link.partId}:${link.partDivisionId ?? 'all'}`;
}

function isSelected(
  links: PartLinkSelection[],
  partId: string,
  partDivisionId: string | null,
): boolean {
  return links.some((link) => link.partId === partId && link.partDivisionId === partDivisionId);
}

export function PiecePartLinksField({
  parts,
  links,
  fileOrganization,
  disabled = false,
  onChange,
}: PiecePartLinksFieldProps) {
  function toggle(partId: string, partDivisionId: string | null) {
    const key = partLinkKey({ partId, partDivisionId });
    const exists = links.some((link) => partLinkKey(link) === key);
    onChange(
      exists
        ? links.filter((link) => partLinkKey(link) !== key)
        : [...links, { partId, partDivisionId }],
    );
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-text">Partes desta obra</legend>
      <p className="text-xs text-muted">
        Restringe quem vê a obra no catálogo. Arquivos sem parte própria seguem estas partes.
        Arquivos com partes específicas continuam mais restritos.
      </p>
      {fileOrganization === 'sequential' && (
        <p className="text-xs font-medium text-text">
          Recomendado para métodos (lições sequenciais)
        </p>
      )}
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
        {parts.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma parte cadastrada na organização.</p>
        ) : (
          parts.map((part) => (
            <div key={part.id} className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={isSelected(links, part.id, null)}
                  onChange={() => toggle(part.id, null)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                {part.name}
              </label>
              {part.divisions.map((division) => (
                <label
                  key={division.id}
                  className="ml-6 flex items-center gap-2 text-sm text-muted"
                >
                  <input
                    type="checkbox"
                    checked={isSelected(links, part.id, division.id)}
                    onChange={() => toggle(part.id, division.id)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  {division.name}
                </label>
              ))}
            </div>
          ))
        )}
      </div>
    </fieldset>
  );
}

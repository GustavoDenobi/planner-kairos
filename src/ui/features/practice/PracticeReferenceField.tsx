import { useCallback, useEffect, useState } from "react";
import type { PracticeTaskReferenceInput } from "@/domain/practice";
import type {
  PieceDetail,
  PieceFileTocEntry,
  PieceListItem,
} from "@/domain/repertoire";
import { useRepertoire } from "@/ui/app/AppServicesContext";
import { IconPlus, IconX } from "@/ui/components/icons";
import { EventProgramPiecePicker } from "@/ui/features/agenda/EventProgramPiecePicker";

type PracticeReferenceFieldProps = {
  organizationId: string;
  value: PracticeTaskReferenceInput;
  onChange: (value: PracticeTaskReferenceInput) => void;
  onPieceChange?: (piece: PieceDetail | null) => void;
  disabled?: boolean;
};

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text disabled:opacity-60";

const linkButtonClass =
  "inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline disabled:opacity-50";

type LocationKind = "whole_file" | "toc" | "point";

export function PracticeReferenceField({
  organizationId,
  value,
  onChange,
  onPieceChange,
  disabled = false,
}: PracticeReferenceFieldProps) {
  const repertoire = useRepertoire();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<PieceListItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [piece, setPiece] = useState<PieceDetail | null>(null);
  const [tocEntries, setTocEntries] = useState<PieceFileTocEntry[]>([]);

  const pieceId = value.kind === "none" ? null : value.pieceId;
  const fileId = value.kind === "file" ? value.pieceFileId : null;

  useEffect(() => {
    if (!pieceId) {
      setPiece(null);
      return;
    }
    let cancelled = false;
    void repertoire.getPiece(organizationId, pieceId).then((result) => {
      if (!cancelled) {
        setPiece(result.ok ? result.value : null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, pieceId, repertoire]);

  useEffect(() => {
    onPieceChange?.(piece);
  }, [onPieceChange, piece]);

  useEffect(() => {
    if (!fileId) {
      setTocEntries([]);
      return;
    }
    let cancelled = false;
    void repertoire
      .listPieceFileTocEntries(organizationId, fileId)
      .then((result) => {
        if (!cancelled) {
          const entries = result.ok ? result.value : [];
          setTocEntries([...entries].sort((a, b) => a.sortOrder - b.sortOrder));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, organizationId, repertoire]);

  const searchPieces = useCallback(
    async (query: string) => {
      setIsSearching(true);
      const result = await repertoire.searchPieces(organizationId, {
        query: query || undefined,
      });
      setSearchResults(result.ok ? result.value : []);
      setIsSearching(false);
    },
    [organizationId, repertoire],
  );

  const scoreFiles = (piece?.files ?? [])
    .filter((file) => file.kind === "score")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function selectFile(nextFileId: string) {
    if (!pieceId) {
      return;
    }
    if (!nextFileId) {
      onChange({ kind: "piece", pieceId });
      return;
    }
    onChange({
      kind: "file",
      pieceId,
      pieceFileId: nextFileId,
      location: { kind: "whole_file" },
    });
  }

  function selectLocationKind(kind: LocationKind) {
    if (value.kind !== "file") {
      return;
    }
    if (kind === "whole_file") {
      onChange({ ...value, location: { kind: "whole_file" } });
    } else if (kind === "toc") {
      const first = tocEntries[0];
      if (first) {
        onChange({ ...value, location: { kind: "toc", tocEntryId: first.id } });
      }
    } else {
      const page = value.location.kind === "point" ? value.location.page : 1;
      onChange({ ...value, location: { kind: "point", page } });
    }
  }

  if (value.kind === "none") {
    return (
      <>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
          className={linkButtonClass}
        >
          <IconPlus className="h-4 w-4" />
          Vincular a uma obra
        </button>
        <EventProgramPiecePicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          pieces={searchResults}
          onSearch={(query) => void searchPieces(query)}
          isSearching={isSearching}
          onSelect={(selectedPieceId) =>
            onChange({ kind: "piece", pieceId: selectedPieceId })
          }
        />
      </>
    );
  }

  const locationKind: LocationKind | null =
    value.kind === "file" ? value.location.kind : null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-bg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted">Obra</p>
          <p className="truncate text-sm font-medium text-text">
            {piece?.title ?? "Carregando…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ kind: "none" })}
          disabled={disabled}
          aria-label="Remover obra"
          className="rounded-lg p-1 text-muted hover:bg-surface hover:text-text"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      {scoreFiles.length > 0 ? (
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Partitura</span>
          <select
            value={fileId ?? ""}
            onChange={(event) => selectFile(event.target.value)}
            disabled={disabled}
            className={fieldClass}
          >
            <option value="">Obra inteira (sem indicar partitura)</option>
            {scoreFiles.map((file) => (
              <option key={file.id} value={file.id}>
                {file.title}
              </option>
            ))}
          </select>
        </label>
      ) : piece ? (
        <p className="text-xs text-muted">
          Esta obra não tem partituras cadastradas.
        </p>
      ) : null}

      {value.kind === "file" ? (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="mb-1 text-xs text-muted">Trecho</legend>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="radio"
              name="practice-location"
              checked={locationKind === "whole_file"}
              onChange={() => selectLocationKind("whole_file")}
            />
            Partitura inteira
          </label>
          {tocEntries.length > 0 ? (
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-text">
                <input
                  type="radio"
                  name="practice-location"
                  checked={locationKind === "toc"}
                  onChange={() => selectLocationKind("toc")}
                />
                Item do sumário
              </label>
              {value.location.kind === "toc" ? (
                <div className="pl-6">
                  <select
                    value={value.location.tocEntryId}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        location: {
                          kind: "toc",
                          tocEntryId: event.target.value,
                        },
                      })
                    }
                    className={fieldClass}
                  >
                    {tocEntries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label} (p. {entry.targetPageNumber})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="radio"
                name="practice-location"
                checked={locationKind === "point"}
                onChange={() => selectLocationKind("point")}
              />
              A partir da página
            </label>
            {value.location.kind === "point" ? (
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={value.location.page}
                onChange={(event) => {
                  const page = Math.max(
                    1,
                    Math.floor(Number(event.target.value) || 1),
                  );
                  onChange({ ...value, location: { kind: "point", page } });
                }}
                aria-label="Página"
                className={`${fieldClass} w-20`}
              />
            ) : null}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

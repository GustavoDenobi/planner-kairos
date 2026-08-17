import { useState } from 'react';

type InviteLinkCopyProps = {
  token: string;
};

export function InviteLinkCopy({ token }: InviteLinkCopyProps) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/convite/${token}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        readOnly
        value={url}
        className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
      />
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text hover:bg-surface"
      >
        {copied ? 'Copiado!' : 'Copiar link'}
      </button>
    </div>
  );
}

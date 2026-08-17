import { useState } from 'react';

type InviteCopyButtonProps = {
  token: string;
  className?: string;
};

export function InviteCopyButton({ token, className }: InviteCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/convite/${token}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ??
        'rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg'
      }
    >
      {copied ? 'Copiado!' : 'Copiar link'}
    </button>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>',
    );
}

export function renderSimpleMarkdown(markdown: string, compact = false): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let inList = false;
  const headingClass = compact
    ? 'mt-1 font-semibold text-text first:mt-0'
    : 'mt-3 font-semibold text-text first:mt-0';
  const listClass = compact ? 'list-disc space-y-0 pl-5' : 'list-disc space-y-1 pl-5';

  function closeList() {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
      html.push(
        `<${tag} class="${headingClass}">${inlineMarkdown(heading[2])}</${tag}>`,
      );
      continue;
    }

    const listItem = trimmed.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      if (!inList) {
        html.push(`<ul class="${listClass}">`);
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(listItem[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }

  closeList();
  return html.join('');
}

type MarkdownContentProps = {
  markdown: string;
  className?: string;
  compact?: boolean;
};

export function MarkdownContent({
  markdown,
  className = '',
  compact = false,
}: MarkdownContentProps) {
  return (
    <div
      className={`select-text text-muted ${
        compact ? 'space-y-1 text-xs leading-snug' : 'space-y-2 text-sm leading-relaxed'
      } ${className}`}
      dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(markdown, compact) }}
    />
  );
}

function clickDownloadLink(href: string, filename?: string) {
  const link = document.createElement('a');
  link.href = href;
  if (filename) {
    link.download = filename;
  }
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}

export async function downloadFromUrl(url: string, filename?: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Download failed');
  }

  downloadBlob(await response.blob(), filename);
}

export function downloadBlob(blob: Blob, filename?: string): void {
  const objectUrl = URL.createObjectURL(blob);
  try {
    clickDownloadLink(objectUrl, filename);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

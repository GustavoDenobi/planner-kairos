import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadFromUrl } from './download-url';

describe('downloadFromUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches the file and triggers a local download', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(blob),
      }),
    );

    const click = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreate(tagName);
      if (tagName === 'a') {
        element.click = click;
      }
      return element;
    });
    URL.createObjectURL = vi.fn(() => 'blob:download');
    URL.revokeObjectURL = vi.fn();

    await downloadFromUrl('https://example.com/file.pdf', 'obra.pdf');

    expect(fetch).toHaveBeenCalledWith('https://example.com/file.pdf');
    expect(click).toHaveBeenCalledOnce();
  });

  it('throws when the download request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    await expect(downloadFromUrl('https://example.com/missing.pdf')).rejects.toThrow(
      'Download failed',
    );
  });
});

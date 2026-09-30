import { describe, expect, it } from 'vitest';
import { resolvePlaylistItemOpenPage } from './reading-playlist';

const base = {
  startPage: 20,
  pieceFileTocEntryId: 'toc-1',
  pieceFileTocEntryTargetPage: 3,
  navigationShortcutId: 'sc-1',
  navigationShortcutTargetPage: 10,
  notes: 'começar no refrão · Abrir na p. 12',
};

describe('resolvePlaylistItemOpenPage', () => {
  it('uses the index page when the reference is a toc entry', () => {
    expect(
      resolvePlaylistItemOpenPage({
        ...base,
        referenceKind: 'toc',
      }),
    ).toBe(3);
  });

  it('uses the shortcut page when the reference is a shortcut', () => {
    expect(
      resolvePlaylistItemOpenPage({
        ...base,
        referenceKind: 'shortcut',
        pieceFileTocEntryId: null,
      }),
    ).toBe(10);
  });

  it('uses the stored start page when the reference is a page range', () => {
    expect(
      resolvePlaylistItemOpenPage({
        ...base,
        referenceKind: 'page',
        pieceFileTocEntryId: null,
        navigationShortcutId: null,
      }),
    ).toBe(20);
  });

  it('returns no page when the index or shortcut was removed', () => {
    expect(
      resolvePlaylistItemOpenPage({
        ...base,
        referenceKind: 'toc',
        pieceFileTocEntryId: null,
      }),
    ).toBeNull();

    expect(
      resolvePlaylistItemOpenPage({
        ...base,
        referenceKind: 'toc',
        pieceFileTocEntryTargetPage: null,
      }),
    ).toBeNull();

    expect(
      resolvePlaylistItemOpenPage({
        ...base,
        referenceKind: 'shortcut',
        navigationShortcutId: null,
      }),
    ).toBeNull();
  });

  it('prefers a live lookup over the page stored on the item', () => {
    expect(
      resolvePlaylistItemOpenPage(
        { ...base, referenceKind: 'toc' },
        { tocTargetPage: 7 },
      ),
    ).toBe(7);
  });

  it('reads the page from legacy notes when the item has no reference kind', () => {
    expect(resolvePlaylistItemOpenPage({ notes: base.notes })).toBe(12);
    expect(resolvePlaylistItemOpenPage({ referenceKind: null, notes: base.notes })).toBeNull();
  });
});

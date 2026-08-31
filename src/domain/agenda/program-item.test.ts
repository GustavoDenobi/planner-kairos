import { describe, expect, it } from 'vitest';
import {
  resolveProgramUnitEndPage,
  resolveProgramUnitStartPage,
} from './program-item';

describe('resolveProgramUnitStartPage', () => {
  it('prioritizes TOC over shortcut and pages', () => {
    expect(
      resolveProgramUnitStartPage({
        pieceFileTocEntryId: 'toc-1',
        pieceFileTocEntryTargetPage: 3,
        navigationShortcutId: 'sc-1',
        navigationShortcutTargetPage: 10,
        startPage: 20,
      }),
    ).toBe(3);
  });

  it('falls back to shortcut then start page', () => {
    expect(
      resolveProgramUnitStartPage({
        pieceFileTocEntryId: null,
        pieceFileTocEntryTargetPage: null,
        navigationShortcutId: 'sc-1',
        navigationShortcutTargetPage: 10,
        startPage: 20,
      }),
    ).toBe(10);

    expect(
      resolveProgramUnitStartPage({
        pieceFileTocEntryId: null,
        pieceFileTocEntryTargetPage: null,
        navigationShortcutId: null,
        navigationShortcutTargetPage: null,
        startPage: 20,
      }),
    ).toBe(20);
  });
});

describe('resolveProgramUnitEndPage', () => {
  it('prefers unit end page over TOC end page', () => {
    expect(
      resolveProgramUnitEndPage({
        endPage: 8,
        pieceFileTocEntryId: 'toc-1',
        pieceFileTocEntryEndPage: 5,
      }),
    ).toBe(8);
  });

  it('uses TOC end page when unit has none', () => {
    expect(
      resolveProgramUnitEndPage({
        endPage: null,
        pieceFileTocEntryId: 'toc-1',
        pieceFileTocEntryEndPage: 5,
      }),
    ).toBe(5);
  });
});

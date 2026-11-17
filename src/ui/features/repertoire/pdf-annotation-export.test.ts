import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { PdfAnnotation } from '@/domain/repertoire';
import {
  applyPageMatrix,
  buildAnnotatedPdf,
  pageDisplayFrame,
  parseRgbColor,
  selectVisibleAnnotations,
} from '@/ui/features/repertoire/pdf-annotation-export';

function annotation(overrides: Partial<PdfAnnotation>): PdfAnnotation {
  return {
    id: 'a1',
    organizationId: 'org',
    pieceFileId: 'file',
    pageNumber: 1,
    layer: 'personal',
    type: 'stroke',
    geometry: { points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }], strokeWidth: 0.004 },
    color: '#2563eb',
    authorUserId: 'user',
    sectionId: null,
    annotationSetId: null,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

async function blankPdf(rotation = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  if (rotation) {
    const { degrees } = await import('pdf-lib');
    page.setRotation(degrees(rotation));
  }
  page.drawText('original');
  return doc.save();
}

function pageContent(page: ReturnType<PDFDocument['getPages']>[number]): string {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray
    ? contents.asArray().map((ref) => page.doc.context.lookup(ref))
    : [contents];
  return streams
    .filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
    .map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode()))
    .join('\n');
}

describe('pageDisplayFrame', () => {
  const box = { x: 0, y: 0, width: 600, height: 800 };

  it('maps the top-left display corner for every rotation', () => {
    expect(applyPageMatrix(pageDisplayFrame(box, 0).matrix, 0, 0)).toEqual({ x: 0, y: 800 });
    expect(applyPageMatrix(pageDisplayFrame(box, 90).matrix, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(applyPageMatrix(pageDisplayFrame(box, 180).matrix, 0, 0)).toEqual({ x: 600, y: 0 });
    expect(applyPageMatrix(pageDisplayFrame(box, 270).matrix, 0, 0)).toEqual({ x: 600, y: 800 });
  });

  it('swaps the displayed size on quarter turns', () => {
    expect(pageDisplayFrame(box, 90)).toMatchObject({ width: 800, height: 600 });
    expect(pageDisplayFrame(box, -90)).toMatchObject({ width: 800, height: 600 });
  });
});

describe('parseRgbColor', () => {
  it('reads hex colors', () => {
    expect(parseRgbColor('#ffffff')).toEqual([1, 1, 1]);
    expect(parseRgbColor('#f00')).toEqual([1, 0, 0]);
  });
});

describe('selectVisibleAnnotations', () => {
  it('keeps only annotations from visible layers', () => {
    const annotations = [
      annotation({ id: 'p', layer: 'personal' }),
      annotation({ id: 's', layer: 'section' }),
      annotation({ id: 'd1', layer: 'directed', annotationSetId: 'set-1' }),
      annotation({ id: 'd2', layer: 'directed', annotationSetId: 'set-2' }),
    ];
    const visible = selectVisibleAnnotations(annotations, {
      personal: true,
      section: false,
      directed: { 'set-1': true },
    });
    expect(visible.map((item) => item.id)).toEqual(['p', 'd1']);
  });
});

describe('buildAnnotatedPdf', () => {
  it('draws strokes, covers and highlights into the page content', async () => {
    const output = await buildAnnotatedPdf(await blankPdf(), [
      annotation({ id: 'pen' }),
      annotation({
        id: 'cover',
        type: 'cover',
        geometry: { x: 0.2, y: 0.2, width: 0.1, height: 0.1 },
      }),
      annotation({
        id: 'hl',
        type: 'highlight',
        geometry: { points: [{ x: 0.3, y: 0.3 }, { x: 0.6, y: 0.3 }], strokeWidth: 0.02 },
      }),
    ]);

    const doc = await PDFDocument.load(output);
    const content = pageContent(doc.getPage(0));
    expect(content).toMatch(/ Tj\n/);
    expect(content).toMatch(/600 0 0 -800 0 800 cm/);
    expect(content).toMatch(/ c\n/);
    expect(content).toMatch(/ re\n/);
    expect(content).toMatch(/ gs\n/);
  });

  it('adds notes as native text annotations', async () => {
    const output = await buildAnnotatedPdf(await blankPdf(90), [
      annotation({
        id: 'note',
        type: 'note',
        color: 'note',
        geometry: { x: 0.5, y: 0.5, title: 'Respirar', body: 'Antes do compasso 12' },
      }),
    ]);

    const doc = await PDFDocument.load(output);
    const annots = doc.getPage(0).node.Annots();
    expect(annots?.size()).toBe(1);
    const note = annots!.lookup(0, PDFDict);
    expect(note.get(PDFName.of('Subtype'))).toEqual(PDFName.of('Text'));
    const contents = note.lookup(PDFName.of('Contents'), PDFHexString);
    expect(contents.decodeText()).toBe('Respirar\n\nAntes do compasso 12');
  });

  it('returns an untouched copy when there is nothing to draw', async () => {
    const output = await buildAnnotatedPdf(await blankPdf(), []);
    const doc = await PDFDocument.load(output);
    expect(doc.getPageCount()).toBe(1);
  });
});

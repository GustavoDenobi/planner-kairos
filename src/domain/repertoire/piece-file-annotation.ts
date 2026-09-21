export type AnnotationLayer = 'personal' | 'section' | 'directed';

export type AnnotationType = 'stroke' | 'highlight' | 'text' | 'cover';

export type NormalizedPoint = {
  x: number;
  y: number;
};

export type StrokeGeometry = {
  points: NormalizedPoint[];
  strokeWidth: number;
};

export type HighlightGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

import type { TextFontFamily } from './text-font-families';

export type TextFontWeight = 'bold';
export type TextFontStyle = 'italic';
export type { TextFontFamily };

export type TextGeometry = {
  x: number;
  y: number;
  content: string;
  fontSize: number;
  fontFamily?: TextFontFamily;
  fontWeight?: TextFontWeight;
  fontStyle?: TextFontStyle;
};

export type AnnotationGeometry = StrokeGeometry | HighlightGeometry | TextGeometry;

export const TEXT_ANNOTATION_MAX_LENGTH = 200;

export type PdfAnnotation = {
  id: string;
  organizationId: string;
  pieceFileId: string;
  pageNumber: number;
  layer: AnnotationLayer;
  type: AnnotationType;
  geometry: AnnotationGeometry;
  color: string;
  authorUserId: string;
  sectionId: string | null;
  annotationSetId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePdfAnnotationInput = {
  pieceFileId: string;
  pageNumber: number;
  layer: AnnotationLayer;
  type: AnnotationType;
  geometry: AnnotationGeometry;
  color: string;
  sectionId?: string | null;
  annotationSetId?: string | null;
};

export type UpdatePdfAnnotationInput = {
  geometry?: AnnotationGeometry;
  color?: string;
};

/** Stored color token for opaque paper-tone cover annotations. */
export const COVER_ANNOTATION_COLOR = 'paper';

export const ANNOTATION_COLORS = {
  personal: '#2563eb',
  section: '#e11a37',
  directed: '#9333ea',
} as const;

/** Light mode: soft yellow applied with multiply — tints paper, preserves ink. */
export const HIGHLIGHT_COLORS = {
  personal: '#fde68a',
  section: '#4ade80',
  directed: '#c4b5fd',
} as const;

/** Dark mode (inverted PDF): inverted hue, applied with screen — subtle lighten, preserves ink. */
export const HIGHLIGHT_COLORS_INVERTED = {
  personal: '#0a2fff',
  section: '#b5217f',
  directed: '#6c2a02',
} as const;

export function resolveHighlightColor(layer: AnnotationLayer, inverted: boolean): string {
  const palette = inverted ? HIGHLIGHT_COLORS_INVERTED : HIGHLIGHT_COLORS;
  return palette[layer];
}

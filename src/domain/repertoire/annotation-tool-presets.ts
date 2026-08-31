import type { AnnotationType, PdfAnnotation } from './piece-file-annotation';
import { resolveHighlightColor } from './piece-file-annotation';

export type AnnotationToolPreset = {
  id: string;
  label: string;
  light: string;
  inverted: string;
};

export type StrokeWidthRange = {
  min: number;
  max: number;
  default: number;
  step: number;
};

export const ANNOTATION_PRESET_PREFIX = 'preset:';

export const PEN_STROKE_WIDTH: StrokeWidthRange = {
  min: 0.0005,
  max: 0.008,
  default: 0.0015,
  step: 0.0005,
};

export const HIGHLIGHT_STROKE_WIDTH: StrokeWidthRange = {
  min: 0.005,
  max: 0.05,
  default: 0.015,
  step: 0.0025,
};

export const LASER_STROKE_WIDTH = PEN_STROKE_WIDTH.default;

export const LASER_DEFAULT_PRESET_ID = 'red';

/** Time at full opacity after pointer-up before the fade-out begins. */
export const LASER_FADE_MS = 3000;

/** Duration of the opacity fade-out before removal. */
export const LASER_FADE_OUT_MS = 500;

/** Pen inside CSS invert — inverted values pre-compensate the filter. */
export const PEN_COLOR_PRESETS: AnnotationToolPreset[] = [
  { id: 'blue', label: 'Azul', light: '#2563eb', inverted: '#d96214' },
  { id: 'red', label: 'Vermelho', light: '#e11a37', inverted: '#18e5c8' },
  { id: 'black', label: 'Preto', light: '#1f2937', inverted: '#1a1a1a' },
  { id: 'green', label: 'Verde', light: '#16a34a', inverted: '#e95cb5' },
  { id: 'purple', label: 'Roxo', light: '#9333ea', inverted: '#6ccc15' },
  { id: 'orange', label: 'Laranja', light: '#ea580c', inverted: '#15a7f3' },
];

/** Highlight outside CSS invert — pairs tuned for multiply / screen blend. */
export const HIGHLIGHT_COLOR_PRESETS: AnnotationToolPreset[] = [
  { id: 'yellow', label: 'Amarelo', light: '#fde68a', inverted: '#0a2fff' },
  { id: 'green', label: 'Verde', light: '#4ade80', inverted: '#b5217f' },
  { id: 'pink', label: 'Rosa', light: '#fbcfe8', inverted: '#043017' },
  { id: 'blue', label: 'Azul', light: '#bfdbfe', inverted: '#402001' },
  { id: 'purple', label: 'Lilás', light: '#c4b5fd', inverted: '#6c2a02' },
  { id: 'orange', label: 'Laranja', light: '#fed7aa', inverted: '#012885' },
];

export type AnnotationAppearance = {
  stroke: string;
  blendMode?: 'multiply' | 'screen';
};

function presetsForType(type: AnnotationType): AnnotationToolPreset[] {
  return type === 'stroke' ? PEN_COLOR_PRESETS : HIGHLIGHT_COLOR_PRESETS;
}

export function formatPresetColor(id: string): string {
  return `${ANNOTATION_PRESET_PREFIX}${id}`;
}

export function parsePresetColor(color: string): string | null {
  if (!color.startsWith(ANNOTATION_PRESET_PREFIX)) {
    return null;
  }
  const id = color.slice(ANNOTATION_PRESET_PREFIX.length);
  return id.length > 0 ? id : null;
}

export function findPreset(type: AnnotationType, id: string): AnnotationToolPreset {
  const presets = presetsForType(type);
  return presets.find((preset) => preset.id === id) ?? presets[0]!;
}

function parseHexChannel(value: string): number {
  return Number.parseInt(value, 16);
}

/** Channel-wise RGB invert (matches CSS filter: invert). */
export function invertRgbHex(hex: string): string {
  const normalized = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return hex;
  }

  const r = 255 - parseHexChannel(normalized.slice(1, 3));
  const g = 255 - parseHexChannel(normalized.slice(3, 5));
  const b = 255 - parseHexChannel(normalized.slice(5, 7));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function resolvePresetStroke(
  type: AnnotationType,
  presetId: string,
  inverted: boolean,
): string {
  const preset = findPreset(type, presetId);
  return inverted ? preset.inverted : preset.light;
}

/** Perceived color for UI swatches; pen in inverted mode sits behind CSS invert. */
export function resolvePresetVisualStroke(
  type: AnnotationType,
  presetId: string,
  inverted: boolean,
): string {
  const stroke = resolvePresetStroke(type, presetId, inverted);
  if (type === 'stroke' && inverted) {
    return invertRgbHex(stroke);
  }
  return stroke;
}

export function resolvePresetAppearance(
  type: AnnotationType,
  presetId: string,
  inverted: boolean,
): AnnotationAppearance {
  const stroke = resolvePresetStroke(type, presetId, inverted);
  if (type === 'highlight') {
    return { stroke, blendMode: inverted ? 'screen' : 'multiply' };
  }
  return { stroke };
}

export function resolveAnnotationAppearance(
  annotation: Pick<PdfAnnotation, 'type' | 'color' | 'layer'>,
  inverted: boolean,
): AnnotationAppearance {
  const presetId = parsePresetColor(annotation.color);
  if (presetId) {
    return resolvePresetAppearance(annotation.type, presetId, inverted);
  }

  if (annotation.type === 'stroke') {
    return { stroke: annotation.color };
  }

  return {
    stroke: resolveHighlightColor(annotation.layer, inverted),
    blendMode: inverted ? 'screen' : 'multiply',
  };
}

export function clampStrokeWidth(value: number, range: StrokeWidthRange): number {
  if (!Number.isFinite(value)) {
    return range.default;
  }
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const steps = Math.round((clamped - range.min) / range.step);
  return Number((range.min + steps * range.step).toFixed(6));
}

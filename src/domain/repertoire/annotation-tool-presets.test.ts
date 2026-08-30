import { describe, expect, it } from 'vitest';
import {
  ANNOTATION_PRESET_PREFIX,
  clampStrokeWidth,
  findPreset,
  formatPresetColor,
  HIGHLIGHT_STROKE_WIDTH,
  parsePresetColor,
  PEN_COLOR_PRESETS,
  PEN_STROKE_WIDTH,
  resolveAnnotationAppearance,
  resolvePresetAppearance,
  resolvePresetStroke,
  resolvePresetVisualStroke,
} from './annotation-tool-presets';

describe('annotation-tool-presets', () => {
  it('formats and parses preset color ids', () => {
    expect(formatPresetColor('blue')).toBe(`${ANNOTATION_PRESET_PREFIX}blue`);
    expect(parsePresetColor(`${ANNOTATION_PRESET_PREFIX}blue`)).toBe('blue');
    expect(parsePresetColor('#2563eb')).toBeNull();
    expect(parsePresetColor(`${ANNOTATION_PRESET_PREFIX}`)).toBeNull();
  });

  it('finds preset by id or falls back to first', () => {
    expect(findPreset('stroke', 'red').label).toBe('Vermelho');
    expect(findPreset('stroke', 'unknown').id).toBe(PEN_COLOR_PRESETS[0]!.id);
  });

  it('resolves pen preset stroke per invert mode', () => {
    expect(resolvePresetAppearance('stroke', 'blue', false).stroke).toBe('#2563eb');
    expect(resolvePresetAppearance('stroke', 'blue', true).stroke).toBe('#d96214');
    expect(resolvePresetAppearance('stroke', 'blue', true).blendMode).toBeUndefined();
  });

  it('pre-compensates black pen for CSS invert and shows light gray visually', () => {
    expect(resolvePresetStroke('stroke', 'black', true)).toBe('#1a1a1a');
    expect(resolvePresetVisualStroke('stroke', 'black', true)).toBe('#e5e5e5');
  });

  it('resolves highlight preset stroke and blend mode', () => {
    expect(resolvePresetAppearance('highlight', 'yellow', false)).toEqual({
      stroke: '#fde68a',
      blendMode: 'multiply',
    });
    expect(resolvePresetAppearance('highlight', 'yellow', true)).toEqual({
      stroke: '#0a2fff',
      blendMode: 'screen',
    });
  });

  it('resolves preset-based annotations', () => {
    expect(
      resolveAnnotationAppearance(
        { type: 'stroke', color: formatPresetColor('green'), layer: 'personal' },
        false,
      ).stroke,
    ).toBe('#16a34a');
  });

  it('falls back to legacy highlight colors by layer', () => {
    expect(
      resolveAnnotationAppearance(
        { type: 'highlight', color: '#ignored', layer: 'personal' },
        false,
      ),
    ).toEqual({ stroke: '#fde68a', blendMode: 'multiply' });
    expect(
      resolveAnnotationAppearance(
        { type: 'highlight', color: '#ignored', layer: 'section' },
        true,
      ).stroke,
    ).toBe('#b5217f');
  });

  it('falls back to raw hex for legacy pen strokes', () => {
    expect(
      resolveAnnotationAppearance(
        { type: 'stroke', color: '#ff0000', layer: 'personal' },
        true,
      ).stroke,
    ).toBe('#ff0000');
  });

  it('clamps stroke width to range steps', () => {
    expect(clampStrokeWidth(0.003, PEN_STROKE_WIDTH)).toBe(0.003);
    expect(clampStrokeWidth(0.0001, PEN_STROKE_WIDTH)).toBe(PEN_STROKE_WIDTH.min);
    expect(clampStrokeWidth(999, HIGHLIGHT_STROKE_WIDTH)).toBe(HIGHLIGHT_STROKE_WIDTH.max);
    expect(clampStrokeWidth(Number.NaN, PEN_STROKE_WIDTH)).toBe(PEN_STROKE_WIDTH.default);
  });
});

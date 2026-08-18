import {
  CATEGORY_HUE_LIGHTNESS,
  CATEGORY_HUE_SATURATION,
  categoryBackgroundColor,
  contrastingTextColor,
} from '@/ui/features/repertoire/category-color';

type CategoryHuePickerProps = {
  hue: number;
  onChange: (hue: number) => void;
  previewLabel?: string;
};

export function CategoryHuePicker({ hue, onChange, previewLabel }: CategoryHuePickerProps) {
  const safeHue = Math.min(360, Math.max(0, Math.round(hue)));
  const previewBackground = categoryBackgroundColor(safeHue);
  const previewText = contrastingTextColor(safeHue);

  return (
    <div className="space-y-3">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-text">Cor</span>
        <input
          type="range"
          min={0}
          max={360}
          value={safeHue}
          onChange={(event) => onChange(Number(event.target.value))}
          className="category-hue-slider h-3 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, 
              hsl(0 ${CATEGORY_HUE_SATURATION}% ${CATEGORY_HUE_LIGHTNESS}%),
              hsl(60 ${CATEGORY_HUE_SATURATION}% ${CATEGORY_HUE_LIGHTNESS}%),
              hsl(120 ${CATEGORY_HUE_SATURATION}% ${CATEGORY_HUE_LIGHTNESS}%),
              hsl(180 ${CATEGORY_HUE_SATURATION}% ${CATEGORY_HUE_LIGHTNESS}%),
              hsl(240 ${CATEGORY_HUE_SATURATION}% ${CATEGORY_HUE_LIGHTNESS}%),
              hsl(300 ${CATEGORY_HUE_SATURATION}% ${CATEGORY_HUE_LIGHTNESS}%),
              hsl(360 ${CATEGORY_HUE_SATURATION}% ${CATEGORY_HUE_LIGHTNESS}%))`,
          }}
        />
      </label>
      {previewLabel && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Prévia:</span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: previewBackground, color: previewText }}
          >
            {previewLabel}
          </span>
        </div>
      )}
    </div>
  );
}

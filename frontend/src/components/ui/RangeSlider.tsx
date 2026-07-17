interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
  formatValue?: (value: number) => string;
  label: string;
}

/**
 * Dual-handle range slider built on two overlapping native
 * `<input type="range">` elements -- no extra dependency needed, and native
 * ranges come with keyboard support (arrow keys) and screen-reader
 * semantics for free. Each thumb's pointer-events are handled by the
 * browser natively; the "which handle is closer" ambiguity when both sit at
 * the same value is resolved by nudging z-index toward whichever thumb the
 * user is dragging via onMouseDown, which is unnecessary here since the two
 * inputs already stack correctly as long as min-thumb has a lower z-index
 * than max-thumb (set in CSS).
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  onChange,
  formatValue = (v) => String(v),
  label,
}: RangeSliderProps) {
  const fillLeft = ((valueMin - min) / (max - min)) * 100;
  const fillRight = ((valueMax - min) / (max - min)) * 100;

  return (
    <div>
      <div className="range-slider__values">
        <span>{label}</span>
        <span>
          {formatValue(valueMin)} &ndash; {formatValue(valueMax)}
        </span>
      </div>
      <div className="range-slider">
        <div className="range-slider__track" />
        <div
          className="range-slider__fill"
          style={{ left: `${fillLeft}%`, width: `${Math.max(0, fillRight - fillLeft)}%` }}
        />
        <input
          type="range"
          aria-label={`${label} minimum`}
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={(e) => onChange(Math.min(Number(e.target.value), valueMax - step), valueMax)}
          style={{ zIndex: 2 }}
        />
        <input
          type="range"
          aria-label={`${label} maximum`}
          min={min}
          max={max}
          step={step}
          value={valueMax}
          onChange={(e) => onChange(valueMin, Math.max(Number(e.target.value), valueMin + step))}
          style={{ zIndex: 3 }}
        />
      </div>
    </div>
  );
}

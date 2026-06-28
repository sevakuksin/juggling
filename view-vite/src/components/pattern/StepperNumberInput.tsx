import { useCallback, useEffect, useRef } from "react";

interface StepperNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  step: number;
  min?: number;
  max?: number;
  /** Decimal places shown in the input (display only). */
  decimals?: number;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
  /** Parse raw text; return null to ignore. */
  parse?: (raw: string) => number | null;
  format?: (value: number) => string;
}

const HOLD_DELAY_MS = 350;
const REPEAT_MS = 70;

function defaultFormat(value: number, decimals: number): string {
  if (decimals <= 0) return String(Math.round(value));
  return value.toFixed(decimals);
}

export function StepperNumberInput({
  value,
  onChange,
  step,
  min,
  max,
  decimals = 0,
  className = "",
  inputClassName = "",
  ariaLabel,
  parse,
  format,
}: StepperNumberInputProps) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clamp = useCallback(
    (v: number) => {
      let out = v;
      if (min != null) out = Math.max(min, out);
      if (max != null) out = Math.min(max, out);
      return out;
    },
    [min, max],
  );

  const display = format ? format(value) : defaultFormat(value, decimals);

  const stopHold = useCallback(() => {
    if (holdTimeout.current != null) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
    if (holdInterval.current != null) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  }, []);

  useEffect(() => stopHold, [stopHold]);

  const onInput = useCallback(
    (raw: string) => {
      const parsed = parse ? parse(raw) : parseFloat(raw);
      if (parsed == null || !Number.isFinite(parsed)) return;
      onChange(clamp(parsed));
    },
    [parse, onChange, clamp],
  );

  const stepBy = useCallback(
    (delta: number) => {
      const next = clamp(valueRef.current + delta);
      if (next === valueRef.current) {
        stopHold();
        return;
      }
      onChange(next);
    },
    [onChange, clamp, stopHold],
  );

  const startHold = useCallback(
    (delta: number) => {
      stopHold();
      stepBy(delta);
      holdTimeout.current = setTimeout(() => {
        holdInterval.current = setInterval(() => stepBy(delta), REPEAT_MS);
      }, HOLD_DELAY_MS);
    },
    [stepBy, stopHold],
  );

  const onStepPointerDown = (delta: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startHold(delta);
  };

  const onStepPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    stopHold();
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className={`stepper-input ${className}`.trim()}>
      <button
        type="button"
        className="stepper-btn"
        onPointerDown={onStepPointerDown(-step)}
        onPointerUp={onStepPointerUp}
        onPointerCancel={onStepPointerUp}
        aria-label={ariaLabel ? `${ariaLabel} decrease` : "Decrease"}
      >
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        className={`stepper-input-field ${inputClassName}`.trim()}
        value={display}
        aria-label={ariaLabel}
        onChange={(e) => onInput(e.target.value)}
      />
      <button
        type="button"
        className="stepper-btn"
        onPointerDown={onStepPointerDown(step)}
        onPointerUp={onStepPointerUp}
        onPointerCancel={onStepPointerUp}
        aria-label={ariaLabel ? `${ariaLabel} increase` : "Increase"}
      >
        +
      </button>
    </div>
  );
};

/**
 * The arithmetic behind dragging a slider by its cap (islands/ui/thumbDrag.ts): where the cap
 * sits along its slot, and which step a drag lands on. Kept apart from the DOM so it can be tested.
 *
 * A range input's cap travels from half a cap in from one end of the slot to half a cap in from
 * the other, so a value's position is `half + (length − 2 × half) × fraction`.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How far along its range a value sits, from 0 to 1. */
export function fraction(value: number, min: number, max: number): number {
  return max === min ? 0 : (clamp(value, min, max) - min) / (max - min);
}

/** The cap's centre, measured from the slot's start (the left, or the bottom of an upright fader). */
export function capCentre(value: number, min: number, max: number, length: number, half: number): number {
  return half + Math.max(0, length - 2 * half) * fraction(value, min, max);
}

/** The nearest step to `raw`, inside the range. */
export function snap(raw: number, min: number, max: number, step: number): number {
  if (!(step > 0)) return clamp(raw, min, max);
  const steps = Math.round((clamp(raw, min, max) - min) / step);
  return clamp(Number((min + steps * step).toFixed(6)), min, max);
}

export interface Range {
  min: number;
  max: number;
  step: number;
}

/**
 * Where a drag lands: the value the cap had when it was grabbed, moved by the distance dragged
 * (towards the slot's end is positive) over the cap's travel, then snapped to a step. Moving by
 * the distance, not to the finger, means grabbing the cap off-centre doesn't make it jump.
 */
export function dragTo(startValue: number, moved: number, travel: number, { min, max, step }: Range): number {
  if (!(travel > 0)) return snap(startValue, min, max, step);
  return snap(startValue + (moved / travel) * (max - min), min, max, step);
}

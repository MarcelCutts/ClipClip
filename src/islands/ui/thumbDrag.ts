/**
 * On a touch screen, a fader moves only when you drag its cap. A swipe that starts anywhere else
 * on the slider scrolls the page and leaves the fader where it was: a browser moves a range input
 * to wherever a finger lands, so a scroll that happened to start on one used to change a lab, and
 * the words beside it then disagreed with what it showed.
 *
 * ui/Fader puts it on its track, round the one range input. With a coarse pointer it takes the fader's input out
 * of the way of touches (pointer-events: none, so a touch on the slot reaches the page and
 * scrolls it) and lays a transparent grip, a 44 px target, over the cap. Dragging the grip moves
 * the value by the distance dragged, step by step, through the input's own `input` event, so the
 * fader's binding, its readout and the lab all hear it as usual. The fader's −/+ keys, the
 * keyboard and screen readers are untouched, and with a mouse nothing changes at all.
 *
 * Client-only, like every action.
 */
import type { Action } from 'svelte/action';
import { capCentre, dragTo } from '../../lib/thumb';

export interface ThumbDrag {
  /** The slider's value, so the grip can follow the cap when something else moves it. */
  value: number;
  /** An upright fader: up is louder. */
  vertical?: boolean;
}

/** The grip's size: a comfortable target for a finger, whatever the cap's size. */
const GRIP_PX = 44;

export const thumbDrag: Action<HTMLElement, ThumbDrag> = (node, initial) => {
  let options = initial;
  const input = node.querySelector<HTMLInputElement>('input[type="range"]');
  if (!input || !window.matchMedia('(pointer: coarse)').matches) return {};

  const restore = { pointer: input.style.pointerEvents, position: node.style.position };
  input.style.pointerEvents = 'none';
  if (getComputedStyle(node).position === 'static') node.style.position = 'relative';

  const grip = document.createElement('span');
  grip.setAttribute('aria-hidden', 'true');
  Object.assign(grip.style, {
    position: 'absolute',
    zIndex: '1',
    touchAction: 'none',
    background: 'transparent',
  } satisfies Partial<CSSStyleDeclaration>);
  node.append(grip);

  const range = () => ({
    min: Number(input.min || 0),
    max: Number(input.max || 100),
    step: Number(input.step) > 0 ? Number(input.step) : 1,
  });

  /** Half the cap's length along the slot: the fader's --cap-short, in px. */
  function half(): number {
    const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const cap = Number.parseFloat(getComputedStyle(input as HTMLElement).getPropertyValue('--cap-short')) || 1.15;
    return (cap * root) / 2;
  }

  function place() {
    const box = node.getBoundingClientRect();
    const slot = input!.getBoundingClientRect();
    const { min, max } = range();
    const value = Number(input!.value);
    const along = options.vertical ? slot.height : slot.width;
    const size = Math.min(GRIP_PX, along);
    const centre = capCentre(value, min, max, along, half());
    const from = Math.min(Math.max(centre - size / 2, 0), along - size);
    if (options.vertical) {
      Object.assign(grip.style, {
        left: `${slot.left - box.left}px`,
        top: `${slot.bottom - box.top - from - size}px`,
        width: `${slot.width}px`,
        height: `${size}px`,
      });
    } else {
      Object.assign(grip.style, {
        left: `${slot.left - box.left + from}px`,
        top: `${slot.top - box.top}px`,
        width: `${size}px`,
        height: `${slot.height}px`,
      });
    }
  }

  let drag: { id: number; from: number; value: number; travel: number; moved: boolean } | null = null;

  function down(event: PointerEvent) {
    if (event.pointerType === 'mouse' || drag || input!.disabled) return;
    event.preventDefault();
    grip.setPointerCapture(event.pointerId);
    const slot = input!.getBoundingClientRect();
    const along = options.vertical ? slot.height : slot.width;
    drag = {
      id: event.pointerId,
      from: options.vertical ? event.clientY : event.clientX,
      value: Number(input!.value),
      travel: along - 2 * half(),
      moved: false,
    };
    input!.focus({ preventScroll: true });
  }

  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    const at = options.vertical ? event.clientY : event.clientX;
    const moved = options.vertical ? drag.from - at : at - drag.from;
    const next = dragTo(drag.value, moved, drag.travel, range());
    if (next === Number(input!.value)) return;
    input!.value = String(next);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    drag.moved = true;
    place();
  }

  function up(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) input!.dispatchEvent(new Event('change', { bubbles: true }));
    drag = null;
    if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
  }

  grip.addEventListener('pointerdown', down);
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);

  const resize = new ResizeObserver(place);
  resize.observe(node);
  resize.observe(input);
  place();

  return {
    update(next: ThumbDrag) {
      options = next;
      place();
    },
    destroy() {
      resize.disconnect();
      grip.remove();
      input.style.pointerEvents = restore.pointer;
      node.style.position = restore.position;
    },
  };
};

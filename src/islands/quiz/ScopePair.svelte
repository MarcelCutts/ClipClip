<script lang="ts">
  /**
   * Before and after, on two small oscilloscope screens with one fixed scale and the mixer's
   * ceiling drawn in both:
   *   left:  a channel pushed past the mixer's ceiling, tops cut flat;
   *   right: the same signal after the record level comes down 12 dB. A quarter of the
   *          height, well under the ceiling, and still flat.
   * The right-hand screen always rests at its true size, so a still frame (no JavaScript, a
   * screenshot, reduced motion) tells the truth. As the reveal appears, it plays the turn-down
   * once: the wave starts at the left-hand size and shrinks, and the flat tops survive it.
   */
  import { dbToGain } from '../../lib/dsp/db';
  import { drawClipped, PREDICT_SCOPE, pictureSource, TURN_DOWN_DB } from '../../lib/quiz/predict';
  import { scopeY } from '../../lib/viz/scope';

  const g = PREDICT_SCOPE;
  const source = pictureSource();
  const before = drawClipped(source);
  const after = drawClipped(source, { gainDb: TURN_DOWN_DB });
  const mid = g.height / 2;
  const top = scopeY(1, g);
  const bottom = scopeY(-1, g);
  const grow = 1 / dbToGain(TURN_DOWN_DB);
  const down = `${Math.abs(TURN_DOWN_DB)} dB`;

  let turned = $state<SVGGElement>();
  let late = $state<SVGTextElement>();

  // The knob turning, once, in answer to the reveal. The delay lets a phone finish scrolling
  // the reveal into view first. Web Animations leave no trace: when they end (or never run),
  // the markup's own state, the true −12 dB picture, is what shows.
  $effect(() => {
    const wave = turned;
    if (!wave || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const shrink = wave.animate([{ transform: `scaleY(${grow})` }, { transform: 'scaleY(1)' }], {
      duration: 1100,
      delay: 700,
      easing: 'cubic-bezier(0.45, 0, 0.2, 1)',
      fill: 'backwards',
    });
    const label = late?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 1750, fill: 'backwards' });
    return () => {
      shrink.cancel();
      label?.cancel();
    };
  });
</script>

<div class="wrap">
<div class="pair">
  <figure class="scope">
    <figcaption>Channel in the red</figcaption>
    <svg
      class="screen"
      viewBox="0 0 {g.width} {g.height}"
      role="img"
      aria-label="Inside the mixer: the wave’s tops are cut flat at the mixer’s ceiling."
    >
      <line class="axis" x1="0" x2={g.width} y1={mid} y2={mid} />
      <line class="ceiling" x1="0" x2={g.width} y1={top} y2={top} />
      <line class="ceiling" x1="0" x2={g.width} y1={bottom} y2={bottom} />
      <path class="cap" d={before.cap} />
      <path class="ghost" d={before.ghost} />
      <path class="signal" d={before.signal} />
      <path class="flat" d={before.flats} />
      <text class="note" x={g.width - 6} y={top - 5} text-anchor="end">mixer’s ceiling</text>
    </svg>
  </figure>

  <figure class="scope">
    <figcaption>Record level down {down}</figcaption>
    <svg
      class="screen"
      viewBox="0 0 {g.width} {g.height}"
      role="img"
      aria-label="After the record level comes down: {down} quieter, well under the mixer’s ceiling, with the same flat tops."
    >
      <line class="axis" x1="0" x2={g.width} y1={mid} y2={mid} />
      <line class="ceiling" x1="0" x2={g.width} y1={top} y2={top} />
      <line class="ceiling" x1="0" x2={g.width} y1={bottom} y2={bottom} />
      <g class="turned" bind:this={turned}>
        <path class="cap" d={after.cap} />
        <path class="ghost" d={after.ghost} />
        <path class="signal" d={after.signal} />
        <path class="flat" d={after.flats} />
      </g>
      <text class="note" x={g.width - 6} y={top - 5} text-anchor="end">mixer’s ceiling</text>
      <text class="note" x={after.label.x} y={scopeY(after.label.value, g) - 9} text-anchor="middle" bind:this={late}>
        still flat
      </text>
    </svg>
  </figure>
</div>
</div>

<style>
  .wrap {
    container-type: inline-size;
  }

  .pair {
    display: grid;
    gap: 0.9rem;
  }

  /* Side by side once each screen can be at least ~16rem wide; stacked on phones. */
  @container (min-width: 34rem) {
    .pair {
      grid-template-columns: 1fr 1fr;
    }
  }

  .scope {
    margin: 0;
    min-width: 0;
  }

  figcaption {
    margin-bottom: 0.35rem;
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--hw-label);
  }

  svg {
    width: 100%;
    height: auto;
    overflow: hidden;
  }

  .axis {
    stroke: var(--screen-axis);
    stroke-width: 1;
  }

  .ceiling {
    stroke: var(--screen-text);
    stroke-width: 1.25;
    stroke-dasharray: 5 4;
  }

  .signal,
  .ghost,
  .cap,
  .flat {
    fill: none;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .signal {
    stroke: var(--sig);
    stroke-width: 1.5;
  }

  .ghost {
    stroke: var(--dmg);
    stroke-width: 1.25;
    stroke-dasharray: 3 3;
  }

  .cap {
    fill: color-mix(in oklab, var(--dmg) 16%, transparent);
    stroke: none;
  }

  .flat {
    stroke: var(--dmg);
    stroke-width: 3;
  }

  /* 12 viewBox units: about 11px with the screens side by side, 13px stacked on a phone. Any
     larger and "mixer’s ceiling" runs into the second cut-off peak on the left-hand screen. */
  .note {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 700;
    fill: var(--screen-text);
  }

  /* The knob turning scales the wave about the centre line, the way a level change would. */
  .turned {
    transform-box: view-box;
    transform-origin: 50% 50%;
  }

  @media (forced-colors: active) {
    .signal {
      stroke: CanvasText;
    }

    .flat,
    .ghost {
      stroke: Highlight;
    }
  }
</style>

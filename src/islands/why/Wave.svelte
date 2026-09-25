<script lang="ts">
  /**
   * The loudest kick of the set, as it sits in the file, on a fixed scale: the dashed lines are the
   * top of the file (0 dBFS), drawn like every ceiling on the site. Never auto-scaled, so a quiet
   * recording looks small and a normalised one nearly reaches the lines. When the file has been
   * turned up or down, the recording as it was stays behind as a faint trace, and anything the top
   * of the file cut off shows as a red ghost.
   */
  import { dbToGain } from '../../lib/dsp/db';
  import { RECORD_RANGE, recorded, scaled, type Zone } from '../../lib/headroom/model';
  import { type ScopeGeometry, scopePath, scopeY } from '../../lib/viz/scope';

  interface Props {
    /** The music at the level it "wanted", peaking at 1.0. */
    music: Float32Array;
    /** Recording level, dBFS. */
    peak: number;
    /** Gain on the whole file being shown, dB. */
    gain: number;
    zone: Zone;
    caption: string;
  }

  let { music, peak, gain, zone, caption }: Props = $props();

  const uid = $props.id();
  // Tall enough for the ghost at the slider's top (6 dB over, ×2) to show whole, with room to spare,
  // as on the lab's screens. scopeY pins anything past the range to the edge, which would read as
  // a second clip.
  const GEO: ScopeGeometry = { width: 300, height: 100, range: dbToGain(RECORD_RANGE.max) * 1.1 };

  const file = $derived(recorded(peak, music));
  const now = $derived(Math.abs(gain) > 0.01 ? scaled(file, gain) : file);
  const path = $derived(scopePath(now, GEO));
  const before = $derived(Math.abs(gain) > 0.05 ? scopePath(file, GEO) : '');
  // What the top of the file cut off: the music as it wanted to be, beyond the flat tops.
  const ghost = $derived(zone === 'over' ? scopePath(scaled(music, peak + gain), GEO) : '');
  const flatTop = $derived(dbToGain(gain));
  const ceilingPct = (v: number) => `${((scopeY(v, GEO) / GEO.height) * 100).toFixed(2)}%`;
</script>

<figure class="wave">
  <div class="screen scope" aria-hidden="true">
    <span class="tag" style:top={ceilingPct(1)}>0&nbsp;dBFS</span>
    <svg viewBox="0 0 {GEO.width} {GEO.height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line class="ceiling" x1="0" x2={GEO.width} y1={scopeY(1, GEO)} y2={scopeY(1, GEO)} />
      <line class="ceiling" x1="0" x2={GEO.width} y1={scopeY(-1, GEO)} y2={scopeY(-1, GEO)} />
      {#if ghost}
        <defs>
          <clipPath id="{uid}-beyond">
            <rect x="0" y="0" width={GEO.width} height={scopeY(flatTop, GEO)} />
            <rect x="0" y={scopeY(-flatTop, GEO)} width={GEO.width} height={GEO.height - scopeY(-flatTop, GEO)} />
          </clipPath>
        </defs>
        <path class="ghost" d={ghost} clip-path="url(#{uid}-beyond)" />
      {/if}
      {#if before}
        <path class="before" d={before} />
      {/if}
      <path class="now" d={path} />
    </svg>
  </div>
  <figcaption>{caption}</figcaption>
</figure>

<style>
  .wave {
    display: grid;
    gap: 0.35rem;
    margin: 0;
  }

  /* Tall enough that the wave at 0 dBFS still spans a good part of the screen on the wide scale. */
  .scope {
    position: relative;
    height: 9.5rem;
    overflow: hidden;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  path,
  line {
    fill: none;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .now {
    stroke: var(--sig);
    stroke-width: 1.75;
  }

  .before {
    stroke: color-mix(in oklab, var(--sig) 38%, transparent);
    stroke-width: 1.25;
  }

  .ghost {
    stroke: var(--dmg);
    stroke-width: 1.25;
    stroke-dasharray: 3 2;
  }

  /* As on the lab's screens: dashed, in the screen's text colour. Red is for the damage. */
  .ceiling {
    stroke: var(--screen-text);
    stroke-width: 1.25;
    stroke-dasharray: 6 4;
  }

  /* On a chip of screen, so the ghost of a clipped peak can't run through the words. */
  .tag {
    position: absolute;
    z-index: 1;
    right: 0.35rem;
    translate: 0 calc(-100% - 1px);
    padding: 0.1rem 0.25rem;
    background: var(--screen);
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    color: var(--screen-text);
  }

  figcaption {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--hw-label);
  }

  @media (forced-colors: active) {
    .now,
    .ghost {
      stroke: CanvasText;
    }

    .ceiling {
      stroke: CanvasText;
    }
  }
</style>

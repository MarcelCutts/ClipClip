<script lang="ts">
  /**
   * One screen of the reveal: a single kick drum, zoomed in, on a fixed vertical scale. The
   * mixer's ceiling is a dashed line where it really is (±1), so a clipped kick at the mixer's
   * level has its flat tops on the line, and one turned down to match has them below it.
   * Flat tops (where the ceiling sliced the peaks off) are stroked in the damage colour over the
   * waveform. With no `view` it draws the idle screen: the ceiling and a flat trace, waiting for
   * an answer, so nothing on it moves when the answer lands. The key naming the line sits with the
   * rest of the key under the screens (HearIt), where it keeps its size on a phone.
   *
   * Given `onplay`, the caption carries its own Play key, so on a phone you can hear each version
   * right above its waveform. The wide layout hides it: the main transport sits beside the screens.
   */
  import type { ScopeView } from '../../lib/hear/model';
  import { type ScopeGeometry, scopeY } from '../../lib/viz/scope';
  import ListenKey from '../ui/ListenKey.svelte';

  interface Props {
    /** Unique id for this screen, so the figure can be named by its letter and title. */
    id: string;
    /** "A" or "B", as on the play buttons. */
    letter: string;
    /** What this one is: "Clean", "Clipped, turned down to match". Empty while waiting. */
    title?: string;
    /** The claim the picture makes, for screen readers. */
    label?: string;
    view?: ScopeView | null;
    /** Shown on the idle screen. */
    waiting?: string;
    geometry: ScopeGeometry;
    /** Whether this version is the one sounding (lights the key, which then offers Stop). */
    playing?: boolean;
    /** Play or stop this version. Without it the caption shows just the letter. */
    onplay?: (() => void) | undefined;
  }

  let { id, letter, title = '', label = '', view = null, waiting = '', geometry, playing = false, onplay }: Props = $props();

  /** The mixer's ceiling, top and bottom: sample value ±1 on the fixed scale. */
  const ceilings = $derived([scopeY(1, geometry), scopeY(-1, geometry)]);
</script>

<!-- Named "A Clean", not by the whole caption: the Play key in it has a name of its own. -->
<figure class="scope" aria-hidden={view ? undefined : 'true'} aria-labelledby="{id}-letter {id}-title">
  <figcaption>
    {#if onplay}
      <span class="play">
        <ListenKey {playing} onclick={onplay} label="Play">
          <span class="big">{letter}</span>
        </ListenKey>
      </span>
    {/if}
    <span class="letter" id="{id}-letter" class:paired={onplay !== undefined}>{letter}</span>
    <span class="title" id="{id}-title">{title}</span>
  </figcaption>
  <div class="frame">
    <svg
      class="screen"
      viewBox="0 0 {geometry.width} {geometry.height}"
      role={view ? 'img' : undefined}
      aria-label={view ? label : undefined}
    >
      <line class="axis" x1="0" x2={geometry.width} y1={geometry.height / 2} y2={geometry.height / 2} />
      <!-- Under the wave, so at the mixer's level the flat tops paint over the line they sit on. -->
      {#each ceilings as y, i (i)}
        <line class="ceiling" x1="0" x2={geometry.width} y1={y} y2={y} />
      {/each}
      {#if view}
        <path class="wave" d={view.path} />
        {#each view.flats as flat, i (i)}
          <line class="flat" x1={flat.x1} x2={flat.x2} y1={flat.y} y2={flat.y} />
        {/each}
      {/if}
    </svg>
    {#if !view && waiting}
      <p class="waiting">{waiting}</p>
    {/if}
  </div>
</figure>

<style>
  .scope {
    display: grid;
    gap: 0.45rem;
    min-width: 0;
    margin: 0;
  }

  figcaption {
    display: flex;
    align-items: baseline;
    gap: 0.55rem;
    min-height: 1.4rem;
    color: var(--hw-label);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.25;
  }

  /* With a key, the caption is a row of kit: the key, then what this version is. */
  figcaption:has(.play) {
    align-items: center;
    gap: 0.75rem;
  }

  /* The key keeps its size; a long title wraps beside it instead (two lines fit its height). */
  .play {
    flex: none;
  }

  .play :global(.listen-key) {
    white-space: nowrap;
  }

  .big,
  .letter {
    font-family: var(--font-display);
    font-weight: 700;
    line-height: 0.8;
  }

  .big {
    margin-left: 0.15rem;
    font-size: 1.5rem;
    vertical-align: -0.1em;
  }

  .letter {
    font-size: 1.6rem;
    color: var(--hw-bright);
  }

  /* The key already shows the letter. */
  .letter.paired {
    display: none;
  }

  .frame {
    position: relative;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .axis {
    stroke: var(--screen-axis);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  /* As in the two-ceilings lab. Non-scaling, so the dashes keep their size on a phone. */
  .ceiling {
    stroke: var(--screen-text);
    stroke-width: 1.25;
    stroke-dasharray: 6 4;
    vector-effect: non-scaling-stroke;
  }

  .wave {
    fill: none;
    stroke: var(--sig);
    stroke-width: 1.6;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .flat {
    stroke: var(--dmg);
    stroke-width: 4;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }

  /* Sits just above the flat trace, like a message on the scope's own display. */
  .waiting {
    position: absolute;
    inset: auto 0 50%;
    margin: 0 0 0.6rem;
    text-align: center;
    font-size: var(--text-sm);
    color: var(--screen-text);
  }

  /* Wide panel: the transport sits right beside the screens, so the screens don't need keys. */
  @container hear (min-width: 54rem) {
    .play {
      display: none;
    }

    .letter.paired {
      display: inline;
    }

    figcaption:has(.play) {
      align-items: baseline;
      gap: 0.55rem;
    }
  }

  @media (forced-colors: active) {
    svg {
      background: Canvas;
      outline: 1px solid CanvasText;
    }

    .wave {
      stroke: CanvasText;
    }

    .flat {
      stroke: Highlight;
    }

    .axis,
    .ceiling {
      stroke: GrayText;
    }

    .waiting {
      color: CanvasText;
    }
  }
</style>

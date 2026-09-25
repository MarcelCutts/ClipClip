<script lang="ts">
  /**
   * The XDJ-RX2's meter section, the centre of the lab: CH1, the scale, the stereo MASTER meter
   * with CLIP, the scale again, CH2. The channel meters show each deck before its fader; only
   * MASTER shows the mix, so its LEDs are the widest on the plate. Built from the shared LedMeter,
   * so each reading also reaches screen readers as text.
   *
   * Sized from the lab's mixer (the `mixer` container): as big as a phone allows between the two
   * faders, and bigger again once there's room. From a 360 px phone up, the LEDs sit 24 px apart,
   * so each one is a full-size target for the guess.
   *
   * The guess: while `guessing`, every MASTER LED is a native radio to tap (arrow keys move it).
   * The reader's pick keeps a white outline, which stays beside the real peak after guessing ends.
   */
  import type { ClipState } from '../../lib/blend/model';
  import { METER_SEGMENTS, type MeterSegment } from '../../lib/xdj';
  import LedMeter from '../ui/LedMeter.svelte';

  interface Props {
    ch1: number;
    master: number;
    ch2: number;
    clip: ClipState;
    /** The reader's guess at MASTER's peak, as one LED's dB mark, or null. */
    guess?: number | null;
    /** The guess is open: every MASTER LED is a radio. */
    guessing?: boolean;
    /** The radios' name, unique on the page. */
    guessName?: string;
    /** The radios' legend. */
    guessLegend?: string;
    /** One LED's radio in words, for screen readers. */
    guessSpot?: (db: number) => string;
    onguess?: (db: number) => void;
  }

  let {
    ch1,
    master,
    ch2,
    clip,
    guess = null,
    guessing = false,
    guessName = 'guess',
    guessLegend = '',
    guessSpot = (db) => String(db),
    onguess,
  }: Props = $props();

  /** Top LED first, as the radios read down the meter: ArrowUp moves the guess up. */
  const spots: readonly MeterSegment[] = [...METER_SEGMENTS].reverse();
</script>

<!-- biome-ignore lint/a11y/useSemanticElements: meters are not form fields, so a fieldset would be the wrong element; role="group" names the set -->
<div class="bridge" role="group" aria-label="Level meters">
  <span class="name hw-label" aria-hidden="true">CH1</span>
  <span class="name master hw-label" aria-hidden="true">Master</span>
  <span class="name hw-label" aria-hidden="true">CH2</span>
  <div class="ch"><LedMeter label="CH1" level={ch1} scale="right" /></div>
  <div class="mid">
    <LedMeter label="MASTER" level={master} stereo {clip} scale="none" />
    {#if guessing}
      <fieldset class="guess open">
        <legend class="visually-hidden">{guessLegend}</legend>
        {#each spots as s (s.db)}
          <label class="spot" class:picked={guess === s.db}>
            <input
              type="radio"
              name={guessName}
              value={s.db}
              checked={guess === s.db}
              onchange={() => onguess?.(s.db)}
            />
            <span class="visually-hidden">{guessSpot(s.db)}</span>
          </label>
        {/each}
      </fieldset>
    {:else if guess !== null}
      <div class="guess" aria-hidden="true">
        {#each spots as s (s.db)}
          <span class="spot" class:picked={guess === s.db}></span>
        {/each}
      </div>
    {/if}
  </div>
  <div class="ch"><LedMeter label="CH2" level={ch2} scale="left" /></div>
</div>

<style>
  /*
   * One well for all three meters, like the black window on the unit: the one box on the panel
   * besides the waveform's screen, flat, with a moulded edge. The shared meters bring their own
   * names and plates: the names move to one row above, the plates merge into ours.
   */
  .bridge {
    /* The smallest phones: just fits between the faders on a 320 px screen. */
    --ch-w: 0.8rem;
    --master-w: 1.1rem;
    --led-h: 0.62rem;
    --row-gap: 4px;
    --tick-size: 0.66rem;
    display: grid;
    grid-template-columns: repeat(3, auto);
    column-gap: 0.35rem;
    row-gap: 0.4rem;
    align-items: end;
    justify-items: center;
    justify-content: center;
    width: max-content;
    max-width: 100%;
    margin-inline: auto;
    padding: 0.6rem 0.5rem 0.6rem;
    border: 1px solid var(--hw-edge);
    border-radius: var(--radius-control);
    background: var(--hw-sunk);
  }

  /* Phones from 360 px: half as tall again as the old bridge, MASTER half as wide again as CH1. */
  @container mixer (min-width: 18rem) {
    .bridge {
      --ch-w: 1.05rem;
      --master-w: 1.5rem;
      --led-h: 0.95rem;
      --row-gap: calc(24px - 0.95rem);
      --tick-size: 0.7rem;
    }
  }

  @container mixer (min-width: 20rem) {
    .bridge {
      --ch-w: 1.15rem;
      --master-w: 1.65rem;
    }
  }

  /* Tablets and wide panels: about twice the old bridge. */
  @container mixer (min-width: 28rem) {
    .bridge {
      --ch-w: 1.85rem;
      --master-w: 2.6rem;
      --led-h: 1rem;
      --row-gap: calc(24px - 1rem);
      --tick-size: 0.78rem;
      column-gap: 0.55rem;
      row-gap: 0.5rem;
      padding: 0.8rem 0.8rem 0.8rem;
    }
  }

  .name {
    font-size: 0.72rem;
  }

  /* The pair the challenge is about, printed brightest. */
  .name.master {
    color: var(--hw-bright);
  }

  @container mixer (min-width: 28rem) {
    .name {
      font-size: 0.8rem;
    }
  }

  /* Grids, so each meter is a grid item and no line box adds space under it. */
  .ch,
  .mid {
    display: grid;
    justify-items: center;
  }

  .mid {
    position: relative;
  }

  .bridge :global(.meter) {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: none;
    box-shadow: none;
    gap: 0.45rem;
    --led-gap: var(--row-gap);
  }

  .bridge :global(.meter > .name) {
    display: none;
  }

  .bridge :global(.row) {
    min-height: 0;
    gap: 4px;
  }

  .bridge :global(.tick) {
    font-size: var(--tick-size);
  }

  .bridge :global(.clip) {
    font-size: 0.72rem;
  }

  .ch :global(.meter) {
    --led-w: var(--ch-w);
  }

  .mid :global(.meter) {
    --led-w: var(--master-w);
  }

  /*
   * The guess sits over MASTER's twelve LEDs, one spot per LED, each reaching half a gap above
   * and below it, so the spots tile the ladder with no dead space between them.
   */
  .guess {
    position: absolute;
    right: -0.25rem;
    bottom: calc(var(--row-gap) / -2);
    left: -0.25rem;
    display: flex;
    flex-direction: column;
    height: calc(12 * (var(--led-h) + var(--row-gap)));
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  /* Open: a dashed frame says the meter can be tapped. */
  .guess.open {
    outline: 1.5px dashed var(--hw-label-2);
    outline-offset: 1px;
    border-radius: var(--radius-control);
  }

  .spot {
    position: relative;
    flex: 1 1 0;
    border-radius: var(--radius-control);
  }

  label.spot {
    cursor: pointer;
  }

  /* The native radio covers its spot: taps land on it, keys and screen readers find it. */
  .spot input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  label.spot:hover {
    outline: 1.5px solid var(--hw-label);
    outline-offset: -1.5px;
  }

  /* The reader's pick: white and dashed, never an LED colour, since it's a choice, not a level. */
  .spot.picked {
    outline: 2px dashed var(--hw-bright);
    outline-offset: -2px;
  }

  .spot:has(input:focus-visible) {
    outline: 3px solid var(--hw-focus);
    outline-offset: 0;
  }

  /* Too small to tap on the narrowest phones (320 px): no guess there. */
  @container mixer (max-width: 17.99rem) {
    .guess {
      display: none;
    }
  }

  @media (forced-colors: active) {
    .spot:has(input:focus-visible) {
      outline-color: Highlight;
    }
  }
</style>

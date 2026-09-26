<script lang="ts">
  /**
   * One deck's TRIM and LOW. TRIM is set the way a DJ sets it, as where the track peaks on its
   * channel meter, and says so right under its slider ("Peak on CH1"), since the real knob's own
   * gain stops at +9. LOW moves in knob stops with flat in the middle, set off from TRIM by a
   * printed line so the TRIM's note never reads as LOW's heading.
   *
   * The lab puts the two decks side by side straight under the faders and meters, deck 1 under
   * deck 1's fader, so the meters stay on screen while you turn these, even on a phone. On a
   * touch screen the sliders move only by their caps (ui/Fader), so scrolling past never
   * changes them.
   */
  import { trimHint } from '../../lib/blend/copy';
  import { LOW_STEPS, TRIM } from '../../lib/blend/model';
  import { formatDb, speakDb } from '../../lib/dsp/db';
  import Fader from '../ui/Fader.svelte';

  interface Props {
    /** Which deck: 1 or 2. */
    n: 1 | 2;
    /** Where the track peaks on its channel meter with the EQ flat, in meter dB. */
    trim: number;
    /** LOW EQ in dB, one of LOW_STEPS. */
    low: number;
    /** Unique prefix for ids. */
    uid: string;
    /** Draw attention to LOW (the challenge hint). */
    hintLow?: boolean;
  }

  let { n, trim = $bindable(), low = $bindable(), uid, hintLow = false }: Props = $props();

  const id = $derived(`${uid}-deck${n}`);
  const flat = (LOW_STEPS.length - 1) / 2;

  const lowIndex = () => {
    const i = LOW_STEPS.indexOf(low);
    return i === -1 ? flat : i;
  };
  const setLowIndex = (i: number) => {
    low = LOW_STEPS[i] ?? 0;
  };

  const formatLow = (i: number) => formatDb(LOW_STEPS[i] ?? 0);
  const speakLow = (i: number) => {
    const db = LOW_STEPS[i] ?? 0;
    return db === 0 ? 'flat, 0 decibels' : speakDb(db);
  };
</script>

<!-- biome-ignore lint/a11y/useSemanticElements: the name is a drawn hardware label, styled apart from the sliders' own labels; role="group" with aria-labelledby names the pair -->
<div class="knobs" data-deck={n} role="group" aria-labelledby="{id}-knobs">
  <p class="title">
    <span class="key" aria-hidden="true"></span>
    <span class="hw-label" id="{id}-knobs">Deck {n}</span>
  </p>
  <div class="trim">
    <Fader
      id="{id}-trim"
      label="TRIM"
      context="Deck {n}"
      bind:value={trim}
      min={TRIM.min}
      max={TRIM.max}
      step={TRIM.step}
      format={(v) => formatDb(v)}
      speak={(v) => `track peaks at ${speakDb(v)} on the channel meter`}
      hint={trimHint(n)}
    />
  </div>
  <div class="low" class:hinted={hintLow}>
    <Fader
      id="{id}-low"
      label="LOW"
      context="Deck {n}"
      bind:value={lowIndex, setLowIndex}
      min={0}
      max={LOW_STEPS.length - 1}
      step={1}
      format={formatLow}
      speak={speakLow}
    />
  </div>
</div>

<style>
  .knobs {
    display: grid;
    align-content: start;
    gap: 0.6rem;
    min-width: 0;
  }

  /* The deck's name over a printed line, with the same colour key as its fader and waveform. */
  .title {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0;
    padding-bottom: 0.45rem;
    border-bottom: 1px solid var(--hw-edge);
    color: var(--hw-bright);
  }

  .title .hw-label {
    font-size: 0.875rem;
    color: inherit;
    white-space: nowrap;
  }

  .key {
    flex: none;
    width: 1rem;
    height: 3px;
    background: var(--sig);
  }

  /* Dashed, like deck 2's line on the waveform, so the keys never differ by hue alone. */
  [data-deck='2'] .key {
    height: 0;
    border-top: 3px dashed var(--sig-b);
    background: none;
  }

  .knobs :global(.value) {
    font-size: 1rem;
    white-space: nowrap;
  }

  /* "Peak on CH1" says where to set TRIM: tucked under TRIM's slot, at full size, never dim. */
  .trim :global(.fader) {
    row-gap: 0.2rem;
  }

  .trim :global(.hint) {
    font-size: var(--text-sm);
    color: var(--hw-label);
  }

  /* LOW starts after a printed line, so TRIM's note above it can't pass for LOW's heading. */
  .low {
    padding-top: 0.6rem;
    border-top: 1px solid var(--hw-edge);
  }

  /* The hint: a steady printed ring round deck 1's LOW, no animation, beside the hint's words. */
  .low.hinted {
    outline: 2px solid var(--hw-label);
    outline-offset: 4px;
    border-radius: var(--radius-control);
  }

  @media (forced-colors: active) {
    .low.hinted {
      outline-color: Highlight;
    }

    .key {
      background: CanvasText;
    }

    [data-deck='2'] .key {
      border-top-color: CanvasText;
      background: none;
    }
  }
</style>

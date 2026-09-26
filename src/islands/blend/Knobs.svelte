<script lang="ts">
  /**
   * One deck's TRIM and LOW. TRIM is set the way a DJ sets it, as where the track peaks on its
   * channel meter with LOW flat, since the real knob's own gain stops at +9. Right under its slider
   * it says where the channel peaks now ("CH1 peaks at +7 dB"), so a LOW boost shows as the gap
   * between the two numbers. LOW is the boost half of the EQ's bass knob, flat to +6 (model.ts,
   * LOW), set off from TRIM by a printed line so TRIM's note never reads as LOW's heading.
   *
   * The lab puts the two decks side by side straight under the faders and meters, deck 1 under
   * deck 1's fader, so the meters stay on screen while you turn these, even on a phone. On a
   * touch screen the sliders move only by their caps (ui/Fader), so scrolling past never
   * changes them.
   */
  import { trimHint } from '../../lib/blend/copy';
  import { LOW, TRIM } from '../../lib/blend/model';
  import { formatDb, speakDb } from '../../lib/dsp/db';
  import Fader from '../ui/Fader.svelte';

  interface Props {
    /** Which deck: 1 or 2. */
    n: 1 | 2;
    /** Where the track peaks on its channel meter with LOW flat, in meter dB. */
    trim: number;
    /** LOW EQ in dB, flat (0) to +6. */
    low: number;
    /** Where the channel meter peaks now, LOW included, as the meter shows it. */
    peak: number;
    /** Unique prefix for ids. */
    uid: string;
  }

  let { n, trim = $bindable(), low = $bindable(), peak, uid }: Props = $props();

  const id = $derived(`${uid}-deck${n}`);

  const formatLow = (db: number) => (db === LOW.min ? 'Flat' : formatDb(db));
  const speakLow = (db: number) => (db === LOW.min ? 'flat, 0 decibels' : speakDb(db));
  /** The ends of LOW's slot, printed like the knob's scale: flat at 12 o'clock, +6 fully right. */
  const lowTicks = [
    { at: LOW.min, label: 'Flat' },
    { at: LOW.max, label: formatDb(LOW.max, { unit: '' }) },
  ];
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
      speak={(v) => `track peaks at ${speakDb(v)} on the channel meter with LOW flat`}
      hint={trimHint(n, peak)}
    />
  </div>
  <div class="low">
    <Fader
      id="{id}-low"
      label="LOW"
      context="Deck {n}"
      bind:value={low}
      min={LOW.min}
      max={LOW.max}
      step={LOW.step}
      format={formatLow}
      speak={speakLow}
      ticks={lowTicks}
      hint="The EQ’s bass knob."
    />
  </div>
</div>

<style>
  .knobs {
    container: knobs / inline-size;
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

  /* "CH1 peaks at +3 dB" says where TRIM has put the channel: tucked under TRIM's slot, at full
     size, never dim. */
  .trim :global(.fader) {
    row-gap: 0.2rem;
  }

  .trim :global(.hint) {
    font-size: var(--text-sm);
    color: var(--hw-label);
  }

  /* Past the red the note says "would peak at +17 dB", two lines in a column this narrow. Keep the
     second line's room from the start, so turning LOW never moves LOW's own slider. */
  @container knobs (max-width: 12.5rem) {
    .trim :global(.hint) {
      min-height: calc(2 * 1.4em);
    }
  }

  /* LOW starts after a printed line, so TRIM's note above it can't pass for LOW's heading. */
  .low {
    padding-top: 0.6rem;
    border-top: 1px solid var(--hw-edge);
  }

  @media (forced-colors: active) {
    .key {
      background: CanvasText;
    }

    [data-deck='2'] .key {
      border-top-color: CanvasText;
      background: none;
    }
  }
</style>

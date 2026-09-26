<script lang="ts">
  /**
   * The XDJ-RX2's meter section as one black well: CH1, the printed scale, the stereo MASTER
   * meter with its CLIP light, the scale again, CH2. The channel meters show each deck before its
   * fader; only MASTER shows the mix, so its LEDs are the widest in the well. Used by the blend
   * lab (the centre of the lab) and, smaller, by the meter check's pictures (size="card").
   *
   * It draws its own ladders, not ui/LedMeter's, so that everything lines up in one grid: the
   * three meters' rows, the scale between them and the guess. It prints them as ui/LedMeter does:
   * the unit's colours, and for readers who can't tell green from orange, a break where the
   * colours change (--zone-break, between −3 and 0 and between +9 and +12) and the 0 in bold. The
   * scale prints as the panel does (xdj.ts scaleLabel): −24 … 0, +3 … +12. Each meter's reading
   * also reaches screen readers, as a meter with its level in words.
   *
   * Sized from the lab's mixer (the `mixer` container): as big as a phone allows between the two
   * faders, and bigger again once there's room. From a 360 px phone up the LEDs sit 24 px apart.
   *
   * The guess: while `guessing`, each row of the well is a native radio for MASTER's LED on that
   * row (arrow keys move it), and the tap lands anywhere across the well, not just on the LEDs.
   * The reader's pick keeps a dashed white frame round MASTER's LEDs and the numbers either side,
   * which stays beside the real peak after guessing ends.
   *
   * With `hideMaster`, MASTER stays dark behind a question mark (the meter check asks where it
   * will go); CLIP stays dark too.
   */
  import type { ClipState } from '../../lib/blend/model';
  import { formatDb } from '../../lib/dsp/db';
  import { describeLevel, litCount, METER_SEGMENTS, type MeterSegment, scaleLabel } from '../../lib/xdj';

  interface Props {
    ch1: number;
    master: number;
    ch2: number;
    clip: ClipState;
    /** 'lab' sizes itself from the blend lab's mixer; 'card' is the meter check's small picture. */
    size?: 'lab' | 'card';
    /** Keep MASTER dark behind a question mark until the reader has answered. */
    hideMaster?: boolean;
    /** The reader's guess at MASTER's peak, as one LED's dB mark, or null. */
    guess?: number | null;
    /** The guess is open: every row of the well is a radio for MASTER's LED on it. */
    guessing?: boolean;
    /** The radios' name, unique on the page. */
    guessName?: string;
    /** The radios' group name, for screen readers. */
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
    size = 'lab',
    hideMaster = false,
    guess = null,
    guessing = false,
    guessName = 'guess',
    guessLegend = '',
    guessSpot = (db) => String(db),
    onguess,
  }: Props = $props();

  /** Top LED first, as the ladder reads and as the radios read down it: ArrowDown moves the guess down. */
  const rows: readonly MeterSegment[] = [...METER_SEGMENTS].reverse();
  /** The first row of a new colour, reading down: a printed break sits above it. */
  const breaks = new Set(rows.filter((s, i) => i > 0 && s.zone !== rows[i - 1]!.zone).map((s) => s.db));
  /** Grid row of each LED: the names and CLIP come first. */
  const gridRow = (i: number) => i + 3;

  const lit = $derived({ ch1: litCount(ch1), master: hideMaster ? 0 : litCount(master), ch2: litCount(ch2) });
  const clipShown = $derived(hideMaster ? 'off' : clip);

  /** What each meter says, for screen readers. */
  const spoken = (name: string, level: number) =>
    Number.isFinite(level) ? `${name}: peaks at ${formatDb(level)}, ${describeLevel(level)}` : `${name}: no signal`;
  const valueNow = (level: number) => (Number.isFinite(level) ? Math.max(-30, Math.min(15, level)) : -30);
  const meters = $derived([
    { name: 'CH1', level: ch1, text: spoken('CH1', ch1) },
    {
      name: 'MASTER',
      level: hideMaster ? Number.NEGATIVE_INFINITY : master,
      text: hideMaster ? 'MASTER: hidden until you answer' : spoken('MASTER', master),
    },
    { name: 'CH2', level: ch2, text: spoken('CH2', ch2) },
  ]);
</script>

<!-- biome-ignore lint/a11y/useSemanticElements: meters are not form fields, so a fieldset would be the wrong element; role="group" names the set -->
<div class="bridge" data-size={size} role="group" aria-label="Level meters">
  {#each meters as m (m.name)}
    <!-- biome-ignore lint/a11y/useSemanticElements: a native <meter> can't be drawn as the LED ladder; the drawing is the grid around it -->
    <span
      class="visually-hidden"
      role="meter"
      aria-label="{m.name} level"
      aria-valuemin={-30}
      aria-valuemax={15}
      aria-valuenow={valueNow(m.level)}
      aria-valuetext={m.text}
    ></span>
  {/each}

  <span class="name ch1 hw-label" aria-hidden="true">CH1</span>
  <span class="name master hw-label" aria-hidden="true">Master</span>
  <span class="name ch2 hw-label" aria-hidden="true">CH2</span>
  <span class="clip hw-label" data-state={clipShown} aria-hidden="true">Clip</span>

  {#each rows as seg, i (seg.db)}
    {@const index = METER_SEGMENTS.length - 1 - i}
    {@const cut = breaks.has(seg.db)}
    <span class="led c1" data-zone={seg.zone} data-on={index < lit.ch1} class:cut style:grid-row={gridRow(i)} aria-hidden="true"></span>
    <span class="tick s1" class:zero={seg.db === 0} class:cut style:grid-row={gridRow(i)} aria-hidden="true">{scaleLabel(seg.db)}</span>
    <span class="led ml" data-zone={seg.zone} data-on={index < lit.master} class:cut style:grid-row={gridRow(i)} aria-hidden="true"></span>
    <span class="led mr" data-zone={seg.zone} data-on={index < lit.master} class:cut style:grid-row={gridRow(i)} aria-hidden="true"></span>
    <span class="tick s2" class:zero={seg.db === 0} class:cut style:grid-row={gridRow(i)} aria-hidden="true">{scaleLabel(seg.db)}</span>
    <span class="led c2" data-zone={seg.zone} data-on={index < lit.ch2} class:cut style:grid-row={gridRow(i)} aria-hidden="true"></span>
  {/each}

  {#if hideMaster}
    <span class="unknown" aria-hidden="true">?</span>
  {/if}

  {#if guessing}
    <!-- Not a fieldset: the rows share the well's grid (a subgrid), which a fieldset's rendering
         doesn't allow. role="radiogroup" names the native radios instead. -->
    <div class="guess open" role="radiogroup" aria-label={guessLegend}>
      {#each rows as s, i (s.db)}
        <label class="spot" class:picked={guess === s.db} class:cut={breaks.has(s.db)} style:grid-row={i + 1}>
          <input type="radio" name={guessName} value={s.db} checked={guess === s.db} onchange={() => onguess?.(s.db)} />
          <span class="visually-hidden">{guessSpot(s.db)}</span>
        </label>
      {/each}
    </div>
  {:else if guess !== null}
    <div class="guess" aria-hidden="true">
      {#each rows as s, i (s.db)}
        {#if guess === s.db}
          <span class="spot picked" class:cut={breaks.has(s.db)} style:grid-row={i + 1}></span>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  /*
   * One well for all three meters, like the black window on the unit, with a moulded edge. Six
   * columns: CH1, its scale, MASTER's two LEDs, CH2's scale, CH2. Rows: the names, CLIP, then
   * the twelve LEDs, top down.
   */
  .bridge {
    /* The smallest phones: just fits between the faders on a 320 px screen. */
    --ch-w: 0.8rem;
    --master-w: 1.1rem;
    --led-h: 0.62rem;
    --row-gap: 4px;
    --col-gap: 4px;
    /* The printed break where the colour changes: this much more than the usual gap, as on every
       meter (ui/LedMeter). */
    --zone-break: 3px;
    --tick-size: 0.7rem;
    --name-size: 0.75rem;
    --name-spacing: 0.08em;
    --clip-size: 0.66rem;
    position: relative;
    display: grid;
    grid-template-columns:
      [c1] var(--ch-w) [s1] minmax(1.35em, auto) [ml] var(--master-w) [mr] var(--master-w)
      [s2] minmax(1.35em, auto) [c2] var(--ch-w) [end];
    grid-template-rows: [names] auto [clip] auto [leds] repeat(12, auto) [leds-end];
    column-gap: var(--col-gap);
    row-gap: var(--row-gap);
    align-items: center;
    justify-content: center;
    width: max-content;
    max-width: 100%;
    margin-inline: auto;
    padding: 0.6rem 0.5rem;
    border: 1px solid var(--hw-edge);
    border-radius: var(--radius-control);
    background: var(--hw-sunk);
  }

  /* Phones from 360 px: MASTER half as wide again as CH1, the rows 24 px apart. */
  @container mixer (min-width: 18rem) {
    .bridge[data-size='lab'] {
      --ch-w: 1.05rem;
      --master-w: 1.5rem;
      --led-h: 0.95rem;
      --row-gap: calc(24px - 0.95rem);
      /* The rows sit further apart here, so the break widens with them. */
      --zone-break: 4px;
      --tick-size: 0.75rem;
      --name-size: 0.875rem;
      --name-spacing: 0.1em;
      --clip-size: 0.75rem;
    }
  }

  @container mixer (min-width: 20rem) {
    .bridge[data-size='lab'] {
      --ch-w: 1.15rem;
      --master-w: 1.65rem;
      --name-spacing: 0.14em;
      --clip-size: 0.8125rem;
    }
  }

  /* Tablets and wide panels: about twice the phone's well. */
  @container mixer (min-width: 28rem) {
    .bridge[data-size='lab'] {
      --ch-w: 1.85rem;
      --master-w: 2.6rem;
      --led-h: 1rem;
      --row-gap: calc(24px - 1rem);
      --col-gap: 5px;
      --tick-size: 0.8rem;
      --clip-size: 0.875rem;
      column-gap: var(--col-gap);
      padding: 0.8rem;
    }
  }

  /* The meter check's picture: small, beside the question. */
  .bridge[data-size='card'] {
    --ch-w: 1.1rem;
    --master-w: 1.1rem;
    --led-h: 0.45rem;
    --row-gap: 3px;
    --col-gap: 4px;
    --zone-break: 3px;
    --tick-size: 0.7rem;
    --name-size: 0.75rem;
    --name-spacing: 0.1em;
    --clip-size: 0.66rem;
    padding: 0.7rem 0.6rem 0.6rem;
  }

  /* Names over their meters, overhanging their columns rather than widening them: CH1 and CH2
     from the well's outer edges, MASTER centred between them. */
  .name {
    grid-row: names;
    font-size: var(--name-size);
    letter-spacing: var(--name-spacing, 0.14em);
    white-space: nowrap;
  }

  .name.ch1 {
    grid-column: c1 / ml;
    justify-self: start;
    margin-inline-end: -1.5rem;
  }

  /* The pair the blend is about, printed brightest. */
  .name.master {
    grid-column: ml / s2;
    justify-self: center;
    margin-inline: -1.5rem;
    color: var(--hw-bright);
  }

  .name.ch2 {
    grid-column: s2 / end;
    justify-self: end;
    margin-inline-start: -1.5rem;
  }

  /* The CLIP legend stays readable when unlit, like the red print on the real panel. */
  .clip {
    grid-row: clip;
    grid-column: ml / s2;
    justify-self: center;
    margin-inline: -1rem;
    padding: 0.12rem 0.3rem;
    font-size: var(--clip-size);
    color: color-mix(in oklab, var(--led-r) 45%, var(--hw-label));
    background: var(--led-r-off);
  }

  /* Lit: dark print on the red lamp keeps the word readable (about 5:1). */
  .clip[data-state='slow'],
  .clip[data-state='fast'] {
    color: var(--hw-sunk);
    background: var(--led-r);
    box-shadow: 0 0 0.6rem var(--led-r);
  }

  @media (prefers-reduced-motion: no-preference) {
    /* Blink the glow, not the word, and stop within five seconds (WCAG 2.2.2): the lamp then
       stays lit, like the real CLIP light holding on a sustained overload. */
    .clip[data-state='slow'] {
      animation: blink 1s steps(1, end) 5;
    }

    .clip[data-state='fast'] {
      animation: blink 0.25s steps(1, end) 20;
    }
  }

  @keyframes blink {
    50% {
      box-shadow: none;
    }
  }

  /* LEDs: square-cornered, like the XDJ-RX2's own segments. */
  .led {
    height: var(--led-h);
    opacity: 0.9;
  }

  .c1 {
    grid-column: c1;
  }

  .ml {
    grid-column: ml;
  }

  .mr {
    grid-column: mr;
  }

  .c2 {
    grid-column: c2;
  }

  /* The printed break: the first row of a new colour sits a little further down. */
  .cut {
    margin-block-start: var(--zone-break);
  }

  .led[data-on='true'][data-zone='green'] {
    background: var(--led-g);
    box-shadow: 0 0 0.4rem color-mix(in oklab, var(--led-g) 65%, transparent);
  }

  .led[data-on='true'][data-zone='orange'] {
    background: var(--led-a);
    box-shadow: 0 0 0.4rem color-mix(in oklab, var(--led-a) 65%, transparent);
  }

  .led[data-on='true'][data-zone='red'] {
    background: var(--led-r);
    box-shadow: 0 0 0.55rem var(--led-r);
  }

  /* Unlit LEDs keep a hint of their colour, like the real panel. */
  .led[data-on='false'][data-zone='green'] {
    background: var(--led-g-off);
  }

  .led[data-on='false'][data-zone='orange'] {
    background: var(--led-a-off);
  }

  .led[data-on='false'][data-zone='red'] {
    background: var(--led-r-off);
  }

  /* The scale, printed on the panel like the other silk-screen legends; 0 in bold. */
  .tick {
    font-family: var(--font-label);
    font-size: var(--tick-size);
    font-weight: 650;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: var(--hw-label-2);
    white-space: nowrap;
  }

  .tick.zero {
    font-weight: 800;
    color: var(--hw-label);
  }

  /* Each scale hugs the channel meter beside it. */
  .s1 {
    grid-column: s1;
    justify-self: start;
    padding-inline-end: 0.15rem;
  }

  .s2 {
    grid-column: s2;
    justify-self: end;
    padding-inline-start: 0.15rem;
  }

  /* Hidden until answered: a question mark over MASTER's two columns. */
  .unknown {
    grid-row: leds / leds-end;
    grid-column: ml / s2;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 2.4rem;
    line-height: 1;
    color: var(--hw-label);
  }

  /*
   * The guess shares the well's rows (a subgrid), one spot per row. A spot frames MASTER's LEDs
   * and the numbers either side, and reaches half a gap up and down, so the spots tile the ladder;
   * its tap area runs on across the channel meters too, the whole width of the well.
   */
  .guess {
    grid-row: leds / leds-end;
    grid-column: c1 / end;
    display: grid;
    grid-template-rows: subgrid;
    grid-template-columns: subgrid;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  /* Out into the gaps beside the numbers, so the frame's dashes never cross a number. */
  .spot {
    position: relative;
    grid-column: s1 / c2;
    align-self: stretch;
    margin-block: calc(var(--row-gap) / -2);
    margin-inline: calc(var(--col-gap) / -2 - 1px);
    border-radius: var(--radius-control);
  }

  /* The row below a break keeps its LEDs lower, so its spot starts at the break. */
  .spot.cut {
    margin-block-start: calc(var(--row-gap) / -2 + var(--zone-break) / 2);
  }

  label.spot {
    cursor: pointer;
  }

  /* The rest of the well's width, on either side, also takes the tap. */
  label.spot::before {
    content: '';
    position: absolute;
    inset-block: 0;
    inset-inline: calc(-1 * (var(--ch-w) + var(--col-gap) / 2));
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

  /* Open: a dashed frame round MASTER says it can be tapped. */
  .guess.open::before {
    content: '';
    grid-row: 1 / -1;
    grid-column: ml / s2;
    margin: calc(var(--row-gap) / -2 - 2px) -3px;
    outline: 1.5px dashed var(--hw-label-2);
    border-radius: var(--radius-control);
    pointer-events: none;
  }

  @media (hover: hover) {
    label.spot:hover {
      outline: 1.5px solid var(--hw-label);
      outline-offset: -1.5px;
    }
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
    .led[data-on][data-zone] {
      forced-color-adjust: none;
      box-shadow: none;
    }

    .led[data-on='true'][data-zone] {
      background: CanvasText;
    }

    .led[data-on='false'][data-zone] {
      background: Canvas;
      outline: 1px solid CanvasText;
    }

    .clip[data-state='slow'],
    .clip[data-state='fast'] {
      forced-color-adjust: none;
      background: CanvasText;
      color: Canvas;
      box-shadow: none;
    }

    .spot:has(input:focus-visible) {
      outline-color: Highlight;
    }
  }
</style>

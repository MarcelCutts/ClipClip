<script lang="ts">
  /**
   * The headroom ladder: one dBFS scale, from just above the top of the file down past its 24-bit
   * floor. The left side is the file itself (its top, the target band, its floor), which never
   * moves. The right side is what got recorded into it (the music's peaks, the mixer's hiss, the
   * recorder's own noise), which all move together when the file is normalised.
   *
   * The target band means what it means on the crew page: a loud track peaks at up to −12 dBFS
   * (the solid part, the stretch the slider marks), and blends may rise into the lighter part
   * above it, up to −6. The top of the file is drawn like every ceiling on the site, dashed in the
   * screen's text colour; red is for what the ceiling cuts off.
   *
   * Text is HTML laid over the drawing, so it stays the same size at any width. The drawing uses
   * CSS px throughout: the ladder has a fixed height, and each drawn column a fixed width.
   */
  import { formatDb } from '../../lib/dsp/db';
  import {
    FLOOR_24_BIT_DBFS,
    NORMALISE_TO_DBTP,
    type RecordedLevels,
    roomToNoise,
    spreadLabels,
    TARGET_BAND,
    type Zone,
  } from '../../lib/headroom/model';

  interface Props {
    /** Everything recorded, at the gain being shown. */
    levels: RecordedLevels;
    /** The same, as recorded (no gain). Shown as a ghost once the file is turned up or down. */
    asRecorded: RecordedLevels;
    /** Gain being shown, dB. */
    gain: number;
    normalised: boolean;
    zone: Zone;
    /** dB lost off every loud hit, when over. */
    lost: number;
  }

  let { levels, asRecorded, gain, normalised, zone, lost }: Props = $props();

  const uid = $props.id();

  const HEIGHT = 468;
  const PAD_TOP = 34;
  const PAD_BOTTOM = 14;
  const TOP_DB = 6;
  const BOTTOM_DB = -150;
  const RAIL = 34;
  const GUTTER = 14;
  const LABEL = 32;
  const PX_PER_DB = (HEIGHT - PAD_TOP - PAD_BOTTOM) / (TOP_DB - BOTTOM_DB);

  const y = (db: number) => PAD_TOP + (TOP_DB - Math.max(BOTTOM_DB, Math.min(TOP_DB, db))) * PX_PER_DB;
  const dbfs = (db: number, decimals = 0) => formatDb(db, { decimals, unit: 'dBFS' });
  const size = (db: number) => formatDb(db, { signed: false });
  const bare = (db: number) => formatDb(db, { unit: '' });

  /** One notch per bit: every 6 dB from the top of the file to the 24-bit floor. */
  const notches = Array.from({ length: 25 }, (_, i) => -6 * i);

  // The file's own frame: fixed.
  const frame = [
    { id: 'top', at: 0, main: 'Top of the file', sub: dbfs(0) },
    {
      id: 'target',
      at: TARGET_BAND.ideal,
      main: `Target ${bare(TARGET_BAND.ideal)}`,
      sub: `loudest blend ${bare(TARGET_BAND.top)}`,
    },
    { id: 'floor', at: FLOOR_24_BIT_DBFS, main: '24-bit floor', sub: dbfs(FLOOR_24_BIT_DBFS) },
  ];
  const frameY = spreadLabels(
    frame.map((f) => ({ at: y(f.at), size: LABEL })),
    0,
    HEIGHT,
  );

  const showGhost = $derived(Math.abs(gain) > 0.05);
  const room = $derived(roomToNoise(levels));
  const nearestNoise = $derived(Math.max(levels.xdjHiss, levels.howlerTop));

  interface Item {
    id: string;
    at: number;
    main: string;
    sub: string;
    /** Drawn with a connector to its mark. */
    linked: boolean;
  }

  // What's in the recording: moves with the gain.
  const recording = $derived.by((): Item[] => {
    let peaks: { main: string; sub: string };
    if (zone === 'over') {
      peaks = normalised
        ? { main: 'Still flat', sub: `at ${dbfs(levels.peaks, 1)}` }
        : { main: 'Cut flat', sub: `${size(lost)} lost` };
    } else {
      peaks = normalised
        ? { main: 'Normalised', sub: `peaks at ${formatDb(NORMALISE_TO_DBTP, { unit: 'dBTP' })}` }
        : { main: 'Your peaks', sub: dbfs(levels.peaks) };
    }
    const lowRoom = Math.round(room.min);
    const highRoom = Math.round(room.max);
    const items: Item[] = [
      { id: 'peaks', at: y(levels.peaks), ...peaks, linked: true },
      {
        id: 'room',
        at: (y(levels.peaks) + y(nearestNoise)) / 2,
        main: lowRoom === highRoom ? `about ${size(lowRoom)}` : `${lowRoom} to ${size(highRoom)}`,
        sub: 'down to the noise',
        linked: false,
      },
      { id: 'hiss', at: y(levels.xdjHiss), main: 'XDJ-RX2 hiss', sub: `about ${dbfs(levels.xdjHiss)}`, linked: true },
      {
        id: 'howler',
        at: y((levels.howlerTop + levels.howlerBottom) / 2),
        main: 'Howler’s noise',
        sub: 'not published',
        linked: true,
      },
    ];
    if (showGhost) {
      items.push({ id: 'ghost', at: y(asRecorded.peaks), main: 'As recorded', sub: dbfs(asRecorded.peaks), linked: true });
    }
    return items;
  });
  const recordingY = $derived(
    spreadLabels(
      recording.map((r) => ({ at: r.at, size: LABEL })),
      PAD_TOP - 6,
      HEIGHT,
    ),
  );

  /** A soft S from one side of a gutter to the other. */
  const link = (fromY: number, toY: number) =>
    `M0 ${fromY.toFixed(1)}C${GUTTER / 2} ${fromY.toFixed(1)} ${GUTTER / 2} ${toY.toFixed(1)} ${GUTTER} ${toY.toFixed(1)}`;

  const lostTop = $derived(zone === 'over' ? y(levels.music) : 0);
</script>

<div class="ladder screen" style:height="{HEIGHT}px" style:--rail="{RAIL}px" style:--gutter="{GUTTER}px" aria-hidden="true">
  <div class="col frame-col">
    <span class="heading">The file</span>
    {#each frame as f, i (f.id)}
      <span class="label" data-id={f.id} style:top="{frameY[i]}px"><span class="main">{f.main}</span><span class="sub">{f.sub}</span></span>
    {/each}
  </div>

  <svg class="gutter left" viewBox="0 0 {GUTTER} {HEIGHT}" width={GUTTER} height={HEIGHT} aria-hidden="true">
    {#each frame as f, i (f.id)}
      <path d={link(frameY[i]!, y(f.at))} />
    {/each}
  </svg>

  <svg class="rail" viewBox="0 0 {RAIL} {HEIGHT}" width={RAIL} height={HEIGHT} aria-hidden="true">
    <defs>
      <linearGradient id="{uid}-noise" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="currentColor" stop-opacity="0" />
        <stop offset="0.5" stop-color="currentColor" stop-opacity="0.6" />
        <stop offset="1" stop-color="currentColor" stop-opacity="0" />
      </linearGradient>
    </defs>

    <rect class="track" x="0" y={y(TOP_DB) - 4} width={RAIL} height={y(BOTTOM_DB) - y(TOP_DB) + 8} rx="4" />
    <rect class="over-zone" x="0" y={y(TOP_DB)} width={RAIL} height={y(0) - y(TOP_DB)} />
    {#each notches as n (n)}
      <line class="notch" x1="0" x2={n % 24 === 0 ? 9 : 5} y1={y(n)} y2={y(n)} />
    {/each}

    <!-- The file's frame -->
    <rect class="blend-room" x="0" y={y(TARGET_BAND.top)} width={RAIL} height={y(TARGET_BAND.ideal) - y(TARGET_BAND.top)} />
    <rect class="target" x="0" y={y(TARGET_BAND.ideal)} width={RAIL} height={y(TARGET_BAND.bottom) - y(TARGET_BAND.ideal)} />
    <line class="target-mid" x1="0" x2={RAIL} y1={y(TARGET_BAND.ideal)} y2={y(TARGET_BAND.ideal)} />
    <line class="ceiling" x1="-3" x2={RAIL + 3} y1={y(0)} y2={y(0)} />
    <line class="floor" x1="-3" x2={RAIL + 3} y1={y(FLOOR_24_BIT_DBFS)} y2={y(FLOOR_24_BIT_DBFS)} />

    <!-- The recording -->
    <rect
      class="howler"
      x="3"
      y={y(levels.howlerTop)}
      width={RAIL - 6}
      height={y(levels.howlerBottom) - y(levels.howlerTop)}
      fill="url(#{uid}-noise)"
    />
    <line class="span" x1={RAIL / 2} x2={RAIL / 2} y1={y(levels.peaks)} y2={y(levels.xdjHiss)} />
    <rect class="hiss" x="6" y={y(levels.xdjHiss) - 1.5} width={RAIL - 12} height="3" rx="1.5" />
    {#if zone === 'over'}
      <rect class="lost" x="5" y={lostTop} width={RAIL - 10} height={Math.max(0, y(levels.peaks) - lostTop)} />
    {/if}
    {#if showGhost}
      <rect class="ghost" x="2.5" y={y(asRecorded.peaks) - 2.5} width={RAIL - 5} height="5" rx="1.5" />
    {/if}
    <rect class="peaks" x="2" y={y(levels.peaks) - 2.5} width={RAIL - 4} height="5" rx="1.5" />
  </svg>

  <svg class="gutter right" viewBox="0 0 {GUTTER} {HEIGHT}" width={GUTTER} height={HEIGHT} aria-hidden="true">
    {#each recording as r, i (r.id)}
      {#if r.linked}<path d={link(r.at, recordingY[i]!)} />{/if}
    {/each}
  </svg>

  <div class="col recording-col">
    <span class="heading">In the recording</span>
    {#each recording as r, i (r.id)}
      <span class="label" data-id={r.id} style:top="{recordingY[i]}px"><span class="main">{r.main}</span><span class="sub">{r.sub}</span></span>
    {/each}
  </div>
</div>

<style>
  .ladder {
    container-type: inline-size;
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) var(--gutter) var(--rail) var(--gutter) minmax(0, 1.08fr);
    column-gap: 2px;
    padding-inline: 0.5rem;
    font-size: 0.78rem;
    line-height: 1.2;
    color: var(--screen-text);
  }

  .heading {
    position: absolute;
    top: 0.55rem;
    font-size: 0.75rem;
    font-weight: 700;
    white-space: nowrap;
    color: var(--screen-text);
  }

  .frame-col .heading {
    right: 0.3rem;
  }

  .recording-col .heading {
    left: 0.3rem;
  }

  .col {
    position: relative;
    min-width: 0;
  }

  .label {
    position: absolute;
    display: grid;
    translate: 0 -50%;
    white-space: nowrap;
  }

  .frame-col .label {
    right: 0.3rem;
    text-align: right;
  }

  .recording-col .label {
    left: 0.3rem;
  }

  .main {
    font-weight: 700;
    color: var(--hw-label);
  }

  .sub {
    font-variant-numeric: tabular-nums;
  }

  .label[data-id='peaks'] .main {
    color: var(--hw-bright);
  }

  /* Ink like every other chart label: the blue span line beside it carries the colour. */
  .label[data-id='room'] .main {
    font-size: 0.95rem;
    color: var(--hw-bright);
  }

  .label[data-id='ghost'] {
    opacity: 0.8;
  }

  .label[data-id='ghost'] .main {
    font-weight: 400;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .gutter path {
    fill: none;
    stroke: var(--screen-axis);
    stroke-width: 1;
  }

  .track {
    fill: color-mix(in oklab, var(--screen-grid) 70%, var(--screen));
  }

  .over-zone {
    fill: color-mix(in oklab, var(--dmg) 14%, transparent);
  }

  .notch {
    stroke: var(--screen-axis);
    stroke-width: 1;
  }

  .target {
    fill: color-mix(in oklab, var(--sig) 26%, transparent);
  }

  /* Room for blends above a loud track's target, up to the loudest blend. */
  .blend-room {
    fill: color-mix(in oklab, var(--sig) 11%, transparent);
  }

  .target-mid {
    stroke: color-mix(in oklab, var(--sig) 70%, var(--hw-bright));
    stroke-width: 1;
    stroke-dasharray: 2 2;
  }

  /* As on every scope: a dashed line in the screen's text colour. Red is for the damage. */
  .ceiling {
    stroke: var(--screen-text);
    stroke-width: 1.25;
    stroke-dasharray: 6 4;
  }

  .floor {
    stroke: var(--screen-text);
    stroke-width: 1.5;
  }

  .howler {
    color: var(--screen-text);
  }

  .span {
    stroke: color-mix(in oklab, var(--sig) 45%, transparent);
    stroke-width: 2;
  }

  .hiss {
    fill: var(--screen-text);
  }

  .peaks {
    fill: var(--sig);
    stroke: var(--screen);
    stroke-width: 1;
  }

  .ghost {
    fill: none;
    stroke: color-mix(in oklab, var(--sig) 75%, transparent);
    stroke-width: 1.25;
    stroke-dasharray: 3 2;
  }

  .lost {
    fill: color-mix(in oklab, var(--dmg) 22%, transparent);
    stroke: var(--dmg);
    stroke-width: 1.25;
    stroke-dasharray: 3 2;
  }

  /* Small phones: a touch smaller, so the longest label still fits its column. */
  @container (max-width: 17rem) {
    .label,
    .heading {
      font-size: 0.7rem;
    }

    .label[data-id='room'] .main {
      font-size: 0.85rem;
    }
  }

  @media (forced-colors: active) {
    .peaks,
    .hiss {
      fill: CanvasText;
    }

    .target {
      fill: none;
      stroke: CanvasText;
      stroke-dasharray: 2 2;
    }

    .blend-room {
      fill: none;
      stroke: CanvasText;
      stroke-dasharray: 1 4;
    }

    .ceiling,
    .floor,
    .notch,
    .gutter path {
      stroke: CanvasText;
    }
  }
</style>

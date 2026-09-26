<script lang="ts">
  /**
   * W1, "Which knob touches what": the rig from the decks to the speakers, the booth monitors and
   * the recorder. Every knob, meter, socket and box is a radio button in one group, so the drawing
   * is one Tab stop and the arrow keys walk it along the signal. Picking a part lights the path it
   * affects (or, for a meter or a box, the path that feeds it) and says so in words. The graph, the
   * words and the geometry all live in src/lib/rig.ts; this component only draws them.
   *
   * One page can show both views (the guide does), so the ids and the radios' name come from
   * $props.id(). Complete at rest: the server renders the default pick with its path lit.
   *
   * On a phone the drawing is taller than the screen, so the readout (what the pick is, and what it
   * reaches) rides along the bottom of the screen while the drawing scrolls under it: whichever
   * part you tap, its explanation is in sight. Part names are 15 px or more at every width.
   */
  import {
    accessibleName,
    captionFor,
    flowOrder,
    highlightFor,
    idleCaption,
    layoutFor,
    modelNote,
    NODES,
    type NodeId,
    resolveSelection,
    type Summary,
    summaryFor,
    TALL_HIT_PAD,
    tapeFor,
    type Variant,
    VIEW_NAME,
    WHOSE,
  } from '../lib/rig';
  import NodeGlyph from './signal-path/NodeGlyph.svelte';
  import Wires from './signal-path/Wires.svelte';

  interface Props {
    /** 'dj' hides the DriveRack's insides, drops the lead names and says whose each knob is. */
    variant?: Variant | undefined;
    /**
     * What starts picked. Defaults to the recorder in the full view and MASTER LEVEL in the DJ
     * view; pass null to start with nothing picked.
     */
    initialSelection?: NodeId | null | undefined;
  }

  let { variant = 'full', initialSelection }: Props = $props();

  const uid = $props.id();
  const BANDS = ['HI', 'MID', 'LOW'] as const;

  /** The readout's height, so focus scrolling keeps a part clear of it where it rides along. */
  let readoutH = $state(0);

  // Seeded from the props, then owned by the reader.
  let selected: NodeId | null = $derived(resolveSelection(initialSelection, variant));

  const order = $derived(flowOrder(variant));
  const tall = $derived(layoutFor('tall', variant));
  const wide = $derived(layoutFor('wide', variant));
  const focus = $derived(selected ? highlightFor(selected, variant) : null);
  const caption = $derived(selected ? captionFor(selected, variant) : idleCaption(variant));
  const summary = $derived(selected ? summaryFor(selected, variant) : null);
  /** Every readout the view can show, to size the readout by its longest (see the markup). */
  const sizers = $derived([
    { id: 'idle', caption: idleCaption(variant), summary: null },
    ...order.map((id) => ({ id, caption: captionFor(id, variant), summary: summaryFor(id, variant) })),
  ]);

  function stateOf(id: NodeId): 'rest' | 'selected' | 'on' | 'off' {
    if (!focus) return 'rest';
    if (id === selected) return 'selected';
    return focus.nodes.has(id) ? 'on' : 'off';
  }

  /** The arrow keys are the browser's own. Home and End pick the first and last part. */
  function jump(event: KeyboardEvent) {
    if (event.key !== 'Home' && event.key !== 'End') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const id = event.key === 'Home' ? order[0] : order.at(-1);
    if (!id) return;
    event.preventDefault();
    selected = id;
    document.getElementById(`${uid}-${id}`)?.focus();
  }
</script>

<section
  class="signal-path panel"
  data-variant={variant}
  aria-label={VIEW_NAME[variant]}
  style:--readout-h={readoutH > 0 ? `${readoutH}px` : undefined}
>
  <div class="head">
    {#if variant === 'dj'}
      <!-- Whose knobs are whose, taped as on the real gear. -->
      <dl class="whose">
        <div>
          <dt><span class="gaffer">Yours</span></dt>
          <dd>{WHOSE.yours}</dd>
        </div>
        <div>
          <dt><span class="gaffer">Crew</span></dt>
          <dd>{WHOSE.crew}</dd>
        </div>
      </dl>
    {/if}
    <ul class="key">
      <li class="pick" id="{uid}-pick">
        <svg class="swatch path" viewBox="0 0 26 12" aria-hidden="true" focusable="false">
          <path class="line" d="M1.5 6H19" />
          <path class="head" d="M25 6 18.5 2.4V9.6Z" />
        </svg>
        Pick any part to light up its path
      </li>
      <li><span class="swatch ceiling" aria-hidden="true"></span>Ceiling, where the sound can clip</li>
    </ul>
  </div>

  {#snippet words(said: { text: string }, sum: Summary | null)}
    <p class="text">{said.text}</p>
    {#if sum}
      <dl class="summary">
        <dt>{sum.label}</dt>
        <dd>{sum.items}</dd>
        {#if sum.notLabel && sum.notItems}
          <dt>{sum.notLabel}</dt>
          <dd>{sum.notItems}</dd>
        {/if}
      </dl>
    {/if}
  {/snippet}

  <div class="body">
    <div class="readout" bind:offsetHeight={readoutH}>
      <div class="card">
        <p class="title">{caption.title}</p>
        <div class="details" aria-live="polite" aria-atomic="true">{@render words(caption, summary)}</div>
      </div>
      <!-- Every readout the view can show, stacked unseen in the same place: the readout is always as
           tall as its longest, so a new pick never moves the drawing, or the page under it. -->
      {#each sizers as s (s.id)}
        <div class="card sizer" aria-hidden="true">
          <p class="title">{s.caption.title}</p>
          <div class="details">{@render words(s.caption, s.summary)}</div>
        </div>
      {/each}
    </div>

    <div
      class="stage"
      role="radiogroup"
      aria-labelledby="{uid}-pick"
      style:--tall-w={tall.width}
      style:--tall-h={tall.height}
      style:--wide-w={wide.width}
      style:--wide-h={wide.height}
      style:--hit-x={TALL_HIT_PAD.x}
      style:--hit-y={TALL_HIT_PAD.y}
    >
      <div class="layer" data-layout="tall"><Wires layout={tall} lit={focus?.edges ?? null} /></div>
      <div class="layer" data-layout="wide"><Wires layout={wide} lit={focus?.edges ?? null} /></div>

      {#each order as id (id)}
        {@const node = NODES[id]}
        {@const t = tall.rects[id]!}
        {@const w = wide.rects[id]!}
        {@const tape = tapeFor(id, variant)}
        <label
          class="node"
          data-kind={node.kind}
          data-glyph={node.glyph}
          data-state={stateOf(id)}
          data-ceiling={node.ceiling}
          style:--tx={t.x}
          style:--ty={t.y}
          style:--tw={t.w}
          style:--th={t.h}
          style:--wx={w.x}
          style:--wy={w.y}
          style:--ww={w.w}
          style:--wh={w.h}
        >
          <!-- The real radio covers the part: invisible, but it takes the taps, the focus and the arrow keys. -->
          <input
            type="radio"
            id="{uid}-{id}"
            name="{uid}-part"
            value={id}
            checked={selected === id}
            aria-label={accessibleName(id, variant)}
            onchange={() => (selected = id)}
            onkeydown={jump}
          />
          {#if node.glyph === 'eq'}
            <span class="bands" aria-hidden="true">
              {#each BANDS as band (band)}
                <span class="band"><NodeGlyph glyph="knob" /><span class="hw-label">{band}</span></span>
              {/each}
            </span>
          {:else}
            <NodeGlyph glyph={node.glyph} angle={node.angle ?? 0} lightCap={id === 'trim1' || id === 'trim2'} />
            <span class="words" aria-hidden="true">
              <span class="name" class:hw-label={node.printed}>{node.label}</span>
              {#if node.ceiling}
                {' '}<span class="sub ceiling">Ceiling {node.ceiling}</span>
              {:else if node.sub}
                {' '}<span class="sub">{node.sub}</span>
              {/if}
            </span>
          {/if}
          {#if tape}
            <span class="tapemark" aria-hidden="true">{tape}</span>
          {/if}
        </label>
      {/each}
    </div>
  </div>

  <p class="note">{modelNote(variant)}</p>
</section>

<style>
  .signal-path {
    container: sp / inline-size;
    display: grid;
    gap: 1rem;
  }

  /* ---- Key, and in the DJ view whose knobs are whose ---- */

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: 0.75rem 2rem;
  }

  /* Tapes in one column, knobs in the next, so the two lists line up. */
  .whose {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.5rem 0.9rem;
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.35;
    color: var(--hw-label);
  }

  .whose div {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
  }

  .whose dd {
    margin: 0;
  }

  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-sm);
    line-height: 1.35;
    color: var(--hw-label);
  }

  .key li {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .swatch {
    flex: none;
  }

  /* A ceiling, drawn as on the parts: a dashed ring in the screen's lettering. Red is for damage done. */
  .swatch.ceiling {
    width: 1.6rem;
    height: 0.95rem;
    border: 1.5px dashed var(--screen-text);
    border-radius: var(--radius-control);
  }

  /* A lit wire, drawn as in the drawing. */
  .swatch.path {
    width: 1.6rem;
    height: 0.95rem;
    overflow: visible;
  }

  .swatch.path .line {
    fill: none;
    stroke: var(--sig);
    stroke-width: 2.8;
    stroke-linecap: round;
  }

  .swatch.path .head {
    fill: var(--sig);
  }

  /* Gaffer tape with torn ends, like the tags crew stick on the gear. */
  .gaffer,
  .tapemark {
    background: var(--tape);
    color: var(--tape-ink);
    font-family: var(--font-stencil);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1;
    clip-path: polygon(0 8%, 4% 0, 100% 0, 97% 30%, 100% 62%, 96% 100%, 3% 100%, 0 70%, 3% 38%);
  }

  .gaffer {
    display: inline-block;
    padding: 0.25rem 0.5rem 0.2rem;
    font-size: 0.8rem;
    rotate: -3deg;
  }

  /* ---- The drawing ---- */

  .body {
    display: grid;
    grid-template-areas: 'readout' 'stage';
    gap: 1rem;
    align-items: start;
  }

  .stage {
    grid-area: stage;
    /* One drawing unit, in pixels: the layouts are drawn in these units and scale together. */
    --W: var(--tall-w);
    --u: calc(100cqi / var(--W));
    /* Part names: never under 15 px (DESIGN.md), a touch larger where the drawing is. rig.ts draws
       each layout with room for them at its narrowest. */
    --name-size: max(15px, calc(14 * var(--u)));
    position: relative;
    container-type: inline-size;
    width: min(100%, 22.5rem);
    margin-inline: auto;
    aspect-ratio: var(--tall-w) / var(--tall-h);
  }

  .layer {
    position: absolute;
    inset: 0;
  }

  .layer[data-layout='wide'] {
    display: none;
  }

  /* Each part is a block in the diagram: one flat face and a printed edge, square-cornered like
     the keys. Its little drawing sits over its name, centred, in every layout. */
  .node {
    position: absolute;
    left: calc(var(--tx) * var(--u));
    top: calc(var(--ty) * var(--u));
    width: calc(var(--tw) * var(--u));
    height: calc(var(--th) * var(--u));
    --glyph: 1.3em;
    --ladder: 1.6em;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15em;
    margin: 0;
    padding: 0.2em 0.15em;
    border: 1px solid var(--hw-edge);
    border-radius: var(--radius-control);
    background: var(--hw-2);
    color: var(--hw-label);
    /* Hardware labels take the node's colour, so they dim and brighten with it. */
    --hw-label-color: currentColor;
    font-family: var(--font-body);
    font-size: var(--name-size);
    font-weight: 700;
    line-height: 1.1;
    text-align: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  /* The radio covers the part, over its drawing too (a faded drawing paints in a layer of its own).
     The page's scroll padding keeps focus clear of its tab strip (global.css). */
  .node input {
    position: absolute;
    z-index: 1;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: inherit;
    /* Room for the focus ring under a part scrolled up from below. */
    scroll-margin-bottom: 1rem;
  }

  .node:has(input:focus-visible) {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
    z-index: 1;
  }

  @media (hover: hover) {
    .node:hover {
      background: var(--hw-3);
    }

    .node:hover .sub {
      color: var(--hw-label);
    }
  }

  .words {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }

  .name {
    font-size: 1em;
  }

  /* Names printed on the gear, in its silk-screen lettering, at the size of the others. */
  .name.hw-label {
    font-size: 1em;
    line-height: 1.1;
    letter-spacing: 0.03em;
  }

  /* The second line: the socket, the model, which ceiling. */
  .sub {
    font-size: max(13px, 0.87em);
    font-weight: 400;
    color: var(--hw-label-2);
  }

  /* The picked and hovered backgrounds are lighter, so the grey second line brightens to keep 4.5:1. */
  .node[data-state='selected'] .sub {
    color: var(--hw-label);
  }

  /* A ceiling: a dashed ring 4px outside the part, its corners concentric with the part's, in the
     screen's lettering like every ceiling line on the site. Red is kept for damage done. */
  .node[data-ceiling]::after {
    content: '';
    position: absolute;
    inset: -5px;
    border: 1.5px dashed var(--screen-text);
    border-radius: calc(var(--radius-control) + 4px);
    pointer-events: none;
  }

  /* The tall drawing is small on narrow phones, so each part also catches taps just past its edge.
     rig.ts sets the reach and keeps neighbours' areas apart. */
  @container sp (max-width: 899.98px) {
    .node::before {
      content: '';
      position: absolute;
      /* Measured from inside the 1px border, so add it back. */
      inset: calc(-1px - var(--hit-y) * var(--u)) calc(-1px - var(--hit-x) * var(--u));
    }
  }

  .node[data-kind='meter'] {
    padding-inline: 0;
  }

  /* HI, MID and LOW, a knob and its name a line, like the channel strip. */
  .bands {
    display: grid;
    gap: 0.05em;
  }

  .band {
    --glyph: 1.15em;
    display: flex;
    align-items: center;
    gap: 0.35em;
  }

  .band .hw-label {
    font-size: 1em;
    line-height: 1.1;
    letter-spacing: 0.03em;
  }

  .tapemark {
    position: absolute;
    top: -0.6em;
    right: -0.4em;
    padding: 0.2em 0.45em 0.12em;
    font-size: 0.8em;
    rotate: 5deg;
  }

  /* ---- Picked, on the path, off it ---- */

  /* On the path: a blue edge, and the name printed brightest. */
  .node[data-state='on'] {
    border-color: var(--sig);
    color: var(--hw-bright);
  }

  /* Picked: a heavier edge in the panel's white. The second pixel is drawn inside, so the name
     keeps the room rig.ts gave it. */
  .node[data-state='selected'] {
    border-color: var(--hw-bright);
    box-shadow: inset 0 0 0 1px var(--hw-bright);
    background: var(--hw-3);
    color: var(--hw-bright);
  }

  /* Off the path: the part sinks into the panel and its drawing fades, but its name stays in the
     panel's main lettering, since it can still be picked. */
  .node[data-state='off'] {
    background: var(--hw);
    border-color: color-mix(in oklab, var(--hw-edge) 70%, var(--hw));
    color: var(--hw-label);
  }

  .node[data-state='off'] :global(.glyph) {
    opacity: 0.45;
  }

  .node[data-state='off']::after {
    opacity: 0.6;
  }

  @media (prefers-reduced-motion: no-preference) {
    .node {
      transition:
        background-color 0.15s ease-out,
        border-color 0.15s ease-out,
        color 0.15s ease-out;
    }
  }

  /* ---- The readout: what the pick is, and what it reaches ---- */

  /* Printed straight on the panel like the rest of the lettering, under a rule: no card. The
     readouts all share one grid cell; only the current one is seen. */
  .readout {
    grid-area: readout;
    display: grid;
    color: var(--hw-label);
  }

  .card {
    grid-area: 1 / 1;
    display: grid;
    gap: 0.45rem;
    align-content: start;
  }

  .sizer {
    visibility: hidden;
  }

  .title {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.25rem;
    line-height: 1.2;
    color: var(--hw-bright);
    text-wrap: balance;
  }

  .details {
    display: grid;
    gap: 0.6rem;
    align-content: start;
  }

  .text {
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--hw-bright);
    text-wrap: pretty;
  }

  /* Two aligned columns, like a spec sheet: "Set by" on the left, the controls on the right. */
  .summary {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.25rem 0.6em;
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--hw-label);
  }

  .summary dt {
    font-weight: 700;
    color: var(--hw-label-2);
  }

  .summary dt::after {
    content: ':';
  }

  .summary dd {
    margin: 0;
  }

  .note {
    padding-top: 0.75rem;
    border-top: 1px solid var(--hw-edge);
    font-size: var(--text-xs);
    line-height: 1.5;
    color: var(--hw-label-2);
  }

  /* Phones: the drawing runs down the page, taller than the screen, so the readout rides along the
     bottom of the screen while the drawing scrolls under it, and sits under the drawing once it's
     all been scrolled past. Whichever part you tap, what it does is in sight. It sits over the
     page's Stop bar while sound plays (--sound-bar, set by SoundBar). Only on a screen tall enough
     to show some drawing above it: on a sideways phone or at 300–400% zoom the readout stays over
     the drawing and scrolls with the page. */
  @container sp (max-width: 599.98px) {
    .title {
      font-size: 1.125rem;
    }

    @media (min-height: 36rem) {
      .body {
        grid-template-areas: 'stage' 'readout';
        row-gap: 0;
      }

      .readout {
        position: sticky;
        bottom: var(--sound-bar, 0px);
        z-index: 2;
        margin: 0.75rem -0.5rem 0;
        padding: 0.6rem 0.5rem 0.7rem;
        border-top: 2px solid var(--hw-edge);
        background: var(--hw);
      }

      .card {
        gap: 0.3rem;
      }

      .details {
        gap: 0.35rem;
      }

      .text {
        line-height: 1.4;
      }

      .node input {
        /* Focus scrolling keeps a part clear of the readout riding below it (up to about 17rem tall
           on a 320px phone, before it has been measured). */
        scroll-margin-bottom: calc(var(--readout-h, 17rem) + 1rem);
      }
    }
  }

  /* Tablets: drawing on the left, the readout beside it, riding down with you as you scroll. */
  @container sp (min-width: 600px) and (max-width: 899.98px) {
    .body {
      grid-template-columns: minmax(0, 21rem) minmax(0, 1fr);
      grid-template-areas: 'stage readout';
      column-gap: 1.5rem;
    }

    .stage {
      width: 100%;
    }

    .readout {
      position: sticky;
      top: calc(1rem + var(--sticky-top, 0px));
      padding-top: 0.6rem;
      border-top: 1px solid var(--hw-edge);
    }
  }

  /* Wide (from rig.ts's WIDE_FROM_PX): the signal runs left to right, readout underneath. */
  @container sp (min-width: 900px) {
    .body {
      grid-template-areas: 'stage' 'readout';
      row-gap: 1.25rem;
    }

    .stage {
      --W: var(--wide-w);
      --name-size: max(15px, calc(15 * var(--u)));
      width: 100%;
      aspect-ratio: var(--wide-w) / var(--wide-h);
    }

    .layer[data-layout='tall'] {
      display: none;
    }

    .layer[data-layout='wide'] {
      display: block;
    }

    .node {
      left: calc(var(--wx) * var(--u));
      top: calc(var(--wy) * var(--u));
      width: calc(var(--ww) * var(--u));
      height: calc(var(--wh) * var(--u));
    }

    .readout {
      padding-top: 0.85rem;
      border-top: 1px solid var(--hw-edge);
    }

    .card {
      grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
      column-gap: 2rem;
    }

    .card .title {
      grid-column: 1 / -1;
    }

    .details {
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
      row-gap: 0.5rem;
    }

    .summary {
      align-content: start;
      padding-top: 0.15rem;
    }
  }

  @media print {
    .signal-path {
      background: white;
      color: black;
      border-color: black;
      break-inside: avoid;
    }

    .signal-path .key,
    .signal-path .whose,
    .signal-path .note,
    .signal-path .title,
    .signal-path .text,
    .signal-path .summary,
    .signal-path .summary dt {
      color: black;
    }

    /* Paper doesn't scroll, and an instruction to pick means nothing. */
    .signal-path .key .pick {
      display: none;
    }

    .signal-path .readout {
      position: static;
      background: none;
    }

    .signal-path .node,
    .signal-path .node[data-state] {
      background: white;
      border: 1px solid gray;
      color: black;
    }

    .signal-path .node[data-state='on'],
    .signal-path .node[data-state='selected'] {
      border: 2px solid black;
    }

    .signal-path .node[data-ceiling]::after,
    .signal-path .swatch.ceiling {
      border-color: black;
    }

    .signal-path .sub,
    .signal-path .node[data-state='selected'] .sub,
    .signal-path .node[data-state='off'] .sub {
      color: inherit;
    }
  }

  @media (forced-colors: active) {
    .node {
      border-color: ButtonText;
    }

    .node[data-state='on'] {
      border-color: Highlight;
    }

    /* Box shadows go in forced colours, so the picked part keeps a heavier edge as an outline. */
    .node[data-state='selected'] {
      border-color: Highlight;
      outline: 2px solid Highlight;
      outline-offset: 0;
    }

    .node[data-state='off'] {
      color: CanvasText;
      border-color: CanvasText;
      border-style: dotted;
    }

    .node[data-ceiling]::after,
    .swatch.ceiling {
      border-color: CanvasText;
    }

    .readout {
      border-top-color: CanvasText;
    }

    /* The tape loses its colour too: an outlined tag instead of torn tape. */
    .gaffer,
    .tapemark {
      clip-path: none;
      border: 1px solid CanvasText;
    }

    .swatch.path .line {
      stroke: Highlight;
    }

    .swatch.path .head {
      fill: Highlight;
    }
  }
</style>

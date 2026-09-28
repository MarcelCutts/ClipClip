<script lang="ts">
  /**
   * A crew checklist, set as a quick reference handbook's checklist card: a black title strip with the
   * list's code and title, when to run it, then each line as a challenge and its response joined by
   * leader dots, the response in the action colour. Every list is read-and-do, for one person: no
   * completion call and no time budget. Native checkboxes, a live "3 of 7 done" count and a Clear ticks
   * key you can undo until the next tick. Under a line, what to do if it isn't so, and the drill that
   * covers it: "If they are below red, go to F1." A consequence to know first is a plain sentence
   * above its line. It's a printed card, not a piece of the rig, so it wears the page's colours: white
   * by day, the cockpit display by night.
   *
   * Ticks are kept on this device for as long as one run of the list lasts (checklistTimes.ts), so a
   * reload or a locked phone doesn't lose them, and an old run never passes for this one. A finished
   * Changeover you come back to leads with when it ran and a key to start the next. Storage is a
   * convenience: without it the list still works. Printed, it becomes a card of empty boxes.
   *
   * The boxes work before the island wakes up. Whatever is ticked by then is kept: bind:checked takes
   * each box's state as it hydrates, load() reads the boxes and adds the saved run, and the styles read
   * the boxes too, so the count and the ticked lines can't disagree with them.
   *
   * A line can come with a drawing (its `figures`). The page hands each drawing in as a slot named for
   * it, already drawn on the server, and the card sets it before the line it serves. A pilot's list
   * confirms what a flow has done; here the drawings are the flow, and the lines confirm it.
   */
  import { onMount, type Snippet, tick } from 'svelte';
  import {
    CHECKLISTS,
    type ChecklistId,
    type FigureId,
    progressText,
    serialiseTicks,
    storageKey,
  } from '../lib/checklists';
  import {
    clockTime,
    lifetimeText,
    NEXT_RUN,
    readSaved,
    type SavedRun,
    startingTicks,
    TICK_LIFETIMES,
  } from '../lib/checklistTimes';
  import { drillPath } from '../lib/fixes';
  import { href } from '../lib/url';

  type Figures = Partial<Record<FigureId, Snippet>>;

  interface Props extends Figures {
    /** The drawings arrive as named slots; the page's markup counts them as children. */
    children?: Snippet;
    /** Which list: 'doors', 'changeover', 'after' or 'files'. */
    list: ChecklistId;
    /** Heading level for the list's title, to fit the page's outline. */
    headingLevel?: 2 | 3 | 4;
  }

  let { list: listId, headingLevel = 3, children: _children, ...figures }: Props = $props();

  const uid = $props.id();
  const list = $derived(CHECKLISTS[listId]);
  const total = $derived(list.items.length);
  const lifetime = $derived(TICK_LIFETIMES[listId]);
  const nextRun = $derived(NEXT_RUN[listId]);

  /** Each box, bound both ways, so the count can't disagree with the boxes. */
  let ticked = $state<Record<string, boolean>>({});
  /** When the ticks last changed. Their lifetime runs from here; null with nothing ticked. */
  let at = $state<number | null>(null);
  /** A repeating list's finished run, found when you arrive: when it finished. */
  let lastRun = $state<number | null>(null);
  /** What was cleared, while Undo is on offer: until the next tick, or until those ticks would have gone. */
  let undo = $state.raw<{ done: string[]; at: number | null; lastRun: number | null } | null>(null);
  /** Whether this device keeps ticks. The line that says so waits for the island. */
  let kept = $state(true);
  let awake = $state(false);

  let card = $state<HTMLElement>();
  let resetKey = $state<HTMLButtonElement>();
  let undoKey = $state<HTMLButtonElement>();

  const done = $derived(list.items.filter((item) => ticked[item.id]).map((item) => item.id));
  const count = $derived(done.length);
  const complete = $derived(count === total);

  /** The items ticked on the page right now, whether or not the island knew about them. */
  function ticksOnPage(): Set<string> {
    const boxes = card?.querySelectorAll<HTMLInputElement>('input.box:checked') ?? [];
    return new Set([...boxes].flatMap((box) => box.getAttribute('data-item') ?? []));
  }

  function show(ids: Iterable<string>): void {
    const on = new Set(ids);
    ticked = Object.fromEntries(list.items.map((item) => [item.id, on.has(item.id)]));
  }

  function settle(ids: Iterable<string>, when: number | null, finished: number | null): void {
    show(ids);
    at = when;
    lastRun = finished;
  }

  /** The run saved on this device: null if there's none, undefined if storage can't be read. */
  function read(now: number): SavedRun | null | undefined {
    try {
      const saved = readSaved(localStorage.getItem(storageKey(listId)), list, now);
      kept = true;
      return saved;
    } catch {
      kept = false;
      return undefined;
    }
  }

  function write(ids: readonly string[], when: number | null): void {
    try {
      const key = storageKey(listId);
      if (ids.length && when !== null) localStorage.setItem(key, serialiseTicks(ids, when));
      else localStorage.removeItem(key);
      kept = true;
    } catch {
      kept = false;
    }
  }

  /** A repeating list's finished run is the last run, not this one: when it finished. */
  function finishedAt(run: { done: ReadonlySet<string>; at: number | null }): number | null {
    return nextRun && run.done.size === total ? run.at : null;
  }

  function load(): void {
    const now = Date.now();
    const start = startingTicks(list, read(now) ?? null, ticksOnPage(), now);
    settle(start.done, start.at, start.save ? null : finishedAt(start));
    if (start.save) write([...start.done], start.at);
    awake = true;
  }

  /** Take Undo off offer. If it had the focus, Clear ticks takes it back. */
  async function dropUndo(): Promise<void> {
    if (!undo) return;
    const focused = document.activeElement === undoKey;
    undo = null;
    if (focused) {
      await tick();
      resetKey?.focus();
    }
  }

  /** Back on the page (a locked phone, another tab, the back button), or a lifetime has run out. */
  function refresh(): void {
    if (!awake) return;
    const now = Date.now();
    // Cleared ticks can't come back once they'd have gone anyway.
    if (undo && undo.at !== null && now - undo.at > lifetime) void dropUndo();
    const saved = kept ? read(now) : undefined;
    if (saved === undefined) {
      // Nothing saved to go by, but ticks on the page still go stale.
      if (at !== null && now - at > lifetime) settle([], null, null);
      return;
    }
    const run = saved ?? { done: new Set<string>(), at: null };
    if (run.at === at && run.done.size === count) {
      // Nothing changed while you were away, but a finished run that repeats now leads with when it ran.
      lastRun = finishedAt(run);
      return;
    }
    // Ticked elsewhere, in another tab: what was cleared here is out of date.
    void dropUndo();
    settle(run.done, run.at, finishedAt(run));
  }

  function changed(id: string, value: boolean): void {
    ticked[id] = value;
    undo = null;
    lastRun = null;
    at = count ? Date.now() : null;
    write(done, at);
  }

  /** Clear every tick, keeping them for Undo. */
  function clear(): void {
    if (!count) return;
    undo = { done, at, lastRun };
    settle([], null, null);
    write([], null);
  }

  async function reset(): Promise<void> {
    const focused = document.activeElement === resetKey;
    clear();
    // Undo takes Clear ticks' place, so the focus goes with it.
    if (undo && focused) {
      await tick();
      undoKey?.focus();
    }
  }

  async function startNext(): Promise<void> {
    clear();
    await tick();
    card?.querySelector<HTMLInputElement>('input.box')?.focus();
  }

  async function restore(): Promise<void> {
    if (!undo) return;
    const focused = document.activeElement === undoKey;
    settle(undo.done, undo.at, undo.lastRun);
    write(undo.done, undo.at);
    undo = null;
    if (focused) {
      await tick();
      resetKey?.focus();
    }
  }

  // Ticks go when their lifetime runs out, even on a page that stays open, and so does the offer to
  // bring back cleared ones. Undo has no timer of its own: it stays until the next tick.
  $effect(() => {
    const since = at ?? undo?.at ?? null;
    if (since === null) return;
    const timer = setTimeout(refresh, Math.max(0, since + lifetime - Date.now()) + 1_000);
    return () => clearTimeout(timer);
  });

  onMount(load);
</script>

<svelte:document
  onvisibilitychange={() => {
    if (document.visibilityState === 'visible') refresh();
  }}
/>
<svelte:window
  onpageshow={(event) => {
    if (event.persisted) refresh();
  }}
/>

<!-- Unnamed on purpose, so it isn't a landmark: the page's sections already are. The heading and the
     labelled list name the checklist. The id is where links from the group chat land, such as
     /night/#changeover. -->
<section class="checklist" class:awake id={list.anchor} data-list={listId} bind:this={card}>
  <header class="strip">
    <svelte:element this={`h${headingLevel}`} class="title" id="{uid}-title"
      ><span class="code">{list.code}</span> {list.title}</svelte:element
    >
  </header>

  <div class="body">
    <p class="when">{list.when}</p>

    {#if nextRun && lastRun !== null && complete}
      <div class="last-run">
        <p class="ran">Last run <time datetime={new Date(lastRun).toISOString()}>{clockTime(lastRun)}</time></p>
        <button type="button" class="key primary" onclick={startNext}>{nextRun}</button>
      </div>
    {/if}

    <ul class="items" aria-labelledby="{uid}-title">
      {#each list.items as item (item.id)}
        {@const inputId = `${uid}-${item.id}`}
        <li class="item">
          {#if item.group}<p class="group">{item.group}</p>{/if}
          {#each item.figures ?? [] as name (name)}
            {@const figure = (figures as Figures)[name]}
            {#if figure}<div class="figure">{@render figure()}</div>{/if}
          {/each}
          {#if item.before}
            <!-- What doing the line costs, said before it at full strength, outside the row's label. -->
            <p class="before">{item.before}</p>
          {/if}
          <label class="row" for={inputId}>
            <input
              class="box"
              type="checkbox"
              id={inputId}
              data-item={item.id}
              bind:checked={ticked[item.id]}
              aria-describedby={item.note || item.drill || item.help ? `${inputId}-note` : undefined}
              onchange={(event) => changed(item.id, event.currentTarget.checked)}
            />
            <svg class="tick" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M3.4 8.6l3 3 6.2-7.2" />
            </svg>
            <!-- The comma gives screen readers the pause the leader dots give the eye. -->
            <span class="text">
              <span class="check">{item.check}</span><span class="visually-hidden">,</span>
              <span class="leader" aria-hidden="true"></span>
              <span class="target">{item.target}</span>
            </span>
          </label>
          {#if item.note || item.drill || item.help}
            <!-- What to do if the line isn't so: the note, then the drill that covers it. The link
                 sits outside the row's label, so following it never ticks the box. -->
            <p class="item-note" id="{inputId}-note">
              <!-- Each drill starts a sentence of its own, so it's set apart from what comes before it. -->
              {#if item.note}{item.note}{/if}{#each [item.drill ?? []].flat() as ref (ref.id)}{' '}{ref.if},
                <a class="ref" href={href(drillPath(ref.id))}>go to {ref.code}</a>.{/each}
              {#if item.help}{' '}<a class="ref" href={href(item.help.path)}>{item.help.label}</a>.{/if}
            </p>
          {/if}
        </li>
      {/each}
    </ul>

    <footer class="foot">
      <p class="count" role="status">{progressText(count, total)}</p>
      <div class="keys">
        <!-- In the page from the start, so screen readers announce it when it fills. -->
        <p class="cleared" role="status">{#if undo}Ticks cleared.{/if}</p>
        <!-- The space sits outside the hidden span: Svelte trims whitespace at the edges of an element. -->
        {#if undo}
          <button type="button" class="key" bind:this={undoKey} onclick={restore}>
            Undo <span class="visually-hidden">clear ticks, {list.title}</span>
          </button>
        {:else}
          <button type="button" class="key" bind:this={resetKey} onclick={reset}>
            Clear ticks<span class="visually-hidden">, {list.title}</span>
          </button>
        {/if}
      </div>
      <p class="kept">
        {kept ? `Ticks stay on this device for ${lifetimeText(lifetime)}.` : 'Ticks last until you leave this page.'}
      </p>
    </footer>
  </div>
</section>

<style>
  /* A section of a long list: its name set as a small strip's would be, so the eye finds the break. */
  .group {
    margin: 0.35rem 0 0;
    padding-block: 0.55rem 0.35rem;
    border-bottom: 2px solid var(--ink);
    font-family: var(--font-display);
    font-size: var(--text-rule);
    font-weight: 700;
    color: var(--ink-bright);
  }

  .item:has(> .group) {
    border-top: 0;
  }

  /* A drawing before the line it serves, with a hairline under it so the line reads as the next thing. */
  .figure {
    padding-block: 0.6rem 0.35rem;
    border-bottom: 1px solid var(--rule);
  }
  /* A printed checklist card: a 2px frame, a title strip, hairlines between the lines. */
  .checklist {
    display: grid;
    border: 2px solid var(--ink);
    background: var(--paper);
    color: var(--ink);
  }

  /* Black by day; by night a raised display header, never a glaring white bar. */
  .strip {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 0.8rem;
    background: var(--strip);
    color: var(--on-strip);
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-rule);
    font-weight: 700;
    line-height: 1.3;
    color: inherit;
    text-wrap: balance;
  }

  .code {
    margin-inline-end: 0.3em;
  }

  .body {
    display: grid;
    gap: 0.8rem;
    padding: 0.75rem 0.8rem 0.9rem;
  }

  /* When to run it: read before starting, so as strong as any instruction. */
  .when {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.5;
    color: var(--ink);
  }

  /* What doing the next line costs: a plain sentence at full strength, before the box, never in a note. */
  .before {
    margin: 0.55rem 0 0 2.25rem;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.5;
    color: var(--ink);
    text-wrap: pretty;
  }

  /* A finished run you came back to: when it ran, and the way on. */
  .last-run {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem 1rem;
    padding: 0.5rem 0.5rem 0.5rem 0.8rem;
    background: var(--paper-2);
  }

  .ran {
    margin: 0;
    color: var(--ink-2);
  }

  .ran time {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }

  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    border-bottom: 1px solid var(--rule);
  }

  .item {
    border-top: 1px solid var(--rule);
    padding-block: 0.15rem 0.55rem;
  }

  /* The whole row is the target, not just the box. */
  .row {
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr);
    grid-template-areas: 'box text';
    column-gap: 0.75rem;
    align-items: start;
    min-height: 2.75rem;
    padding-block: 0.55rem 0;
    cursor: pointer;
  }

  /* With a note underneath, the row is tall enough to hit already: no padding gap before the note. */
  .item:has(.item-note) .row {
    min-height: 0;
  }

  .box {
    grid-area: box;
    appearance: none;
    width: 1.5rem;
    height: 1.5rem;
    margin: 0;
    border: 2px solid var(--ink);
    border-radius: var(--radius-control);
    background: var(--paper);
    cursor: pointer;
  }

  .box:checked {
    background: var(--ink);
  }

  .box:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 3px;
  }

  .tick {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tick {
    grid-area: box;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0.2rem;
    color: var(--paper);
    visibility: hidden;
    pointer-events: none;
  }

  .box:checked + .tick {
    visibility: visible;
  }

  /* Challenge, leader dots, response. A response too long for the check's line takes its own line,
     at the right, as on a printed checklist, and the dots run to the end of the first. */
  .text {
    grid-area: text;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 0.4rem;
    line-height: 1.35;
    padding-top: 0.05rem;
  }

  .check {
    font-weight: 700;
    color: var(--ink);
  }

  .leader {
    flex: 1 1 2.5rem;
    min-width: 2.5rem;
    border-bottom: 2px dotted var(--ink-4);
    translate: 0 -0.3em;
  }

  /* The state to leave it in: what to do, so it takes the action colour. */
  .target {
    margin-inline-start: auto;
    font-weight: 700;
    color: var(--action);
    text-align: right;
    text-wrap: balance;
  }

  /* How or why, read before doing the line: the same size and strength as any instruction. */
  .item-note {
    margin: 0.3rem 0 0 2.25rem;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--ink-2);
    text-wrap: pretty;
  }

  /* "go to F1": a link to the drill, underlined like any link on the page. */
  .ref {
    font-weight: 700;
    white-space: normal;
  }

  /* A ticked line steps back, so the eye lands on the next one. The styles read the box itself, so
     they're right before the island wakes too. An unticked line keeps full strength. */
  .item:has(.box:checked) .check,
  .item:has(.box:checked) .target,
  .item:has(.box:checked) .item-note {
    color: var(--ink-3);
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
  }

  .count {
    margin: 0;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
  }

  .keys {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem 0.75rem;
    margin-left: auto;
  }

  .cleared {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--ink-2);
  }

  .kept {
    flex-basis: 100%;
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-3);
  }

  /* Keys, printed like the card: an outlined one for Reset and Undo, a filled one for the way on. */
  .key {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    padding: 0.5rem 1rem;
    border: 2px solid var(--ink);
    border-radius: var(--radius-control);
    background: var(--paper);
    color: var(--ink);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.2;
    cursor: pointer;
  }

  .key:hover {
    background: var(--paper-2);
  }

  .key.primary {
    background: var(--strip);
    color: var(--on-strip);
  }

  .key.primary:hover {
    background: color-mix(in srgb, var(--strip) 82%, var(--on-strip));
  }

  .key:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  /* Before the island wakes: the server's "0 of 7 done" can't follow the boxes, so it gives way once
     one is ticked, and the line about keeping ticks isn't true yet. Both keep their space. */
  .checklist:not(.awake):has(.box:checked) .count,
  .checklist:not(.awake) .kept {
    visibility: hidden;
  }

  @media (forced-colors: active) {
    .strip {
      forced-color-adjust: none;
      background: CanvasText;
      color: Canvas;
    }

    .box:checked {
      background: Highlight;
      border-color: Highlight;
    }

    .tick {
      color: HighlightText;
    }

    /* System colours flatten both keys to one look, so the way on keeps a heavier edge. */
    .key.primary {
      border-width: 3px;
    }
  }

  /* On paper: black on white, empty boxes, nothing that only makes sense on a screen. */
  @media print {
    .item {
      break-inside: avoid-page;
    }

    .checklist {
      border: 0.3mm solid CanvasText;
      break-inside: avoid;
    }

    .strip {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .box,
    .box:checked {
      border-color: CanvasText;
      background: none;
    }

    .tick,
    .last-run,
    .foot {
      display: none;
    }
  }
  @media screen and (max-width: 40rem) {
    .text { display: grid; gap: 0.15rem; text-align: left; }
    .leader { display: none; }
    .target { margin-inline-start: 0; text-align: left; text-wrap: pretty; }
  }
</style>

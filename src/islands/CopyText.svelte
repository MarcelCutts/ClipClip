<script lang="ts">
  /**
   * A message to paste into the group chat: a preview of how WhatsApp will show it, and a copy
   * button. If the clipboard is off limits (an in-app browser, an old phone, no permission), the
   * raw text appears in a read-only box, already selected, with how to copy it by hand.
   */
  import { tick } from 'svelte';
  import { type Inline, parseMessage } from '../lib/messages';

  interface Props {
    /** The message, exactly as it should be pasted. */
    text: string;
    /** Names the message for screen readers: "Copy message: DJ briefing". */
    name?: string;
    /** Show the formatted preview. Turn off when the page shows the text itself. */
    preview?: boolean;
  }

  let { text, name, preview = true }: Props = $props();

  /** When the copy fails: what happened, then how to copy it by hand on a computer or a phone. */
  const BY_HAND = 'Could not copy. Select the message and press Ctrl+C (⌘C on a Mac), or long-press it.';

  const uid = $props.id();
  const blocks = $derived(parseMessage(text));

  let status = $state('');
  let manual = $state(false);
  let box: HTMLTextAreaElement | undefined = $state();
  let clear: ReturnType<typeof setTimeout> | undefined;

  async function copy(): Promise<void> {
    clearTimeout(clear);
    status = '';
    try {
      // Called straight from the click, so the browser counts it as the user's own action.
      if (!navigator.clipboard?.writeText) throw new Error('No clipboard');
      await navigator.clipboard.writeText(text);
      manual = false;
      status = 'Copied';
      clear = setTimeout(() => {
        status = '';
      }, 4000);
    } catch {
      manual = true;
      status = BY_HAND;
      await tick();
      box?.focus();
      box?.setSelectionRange(0, text.length);
    }
  }
</script>

{#snippet inlines(parts: Inline[])}
  {#each parts as part, i (i)}
    {#if part.kind === 'bold'}
      <strong>{part.text}</strong>
    {:else if part.kind === 'italic'}
      <em>{part.text}</em>
    {:else if part.kind === 'link'}
      <a href={part.text}>{part.text}</a>
    {:else}
      {part.text}
    {/if}
  {/each}
{/snippet}

<div class="copy">
  {#if preview}
    <div class="bubble">
      {#each blocks as block, i (i)}
        {#if block.kind === 'list'}
          <ul>
            {#each block.items as item, j (j)}
              <li>{@render inlines(item)}</li>
            {/each}
          </ul>
        {:else}
          <p>{@render inlines(block.inlines)}</p>
        {/if}
      {/each}
    </div>
  {/if}

  <div class="actions">
    <!-- The name starts with the visible words, so voice control users can say what they see. -->
    <button
      type="button"
      class="button"
      aria-label={name ? `Copy message: ${name}` : undefined}
      onclick={copy}
    >
      Copy message
    </button>
    <p class="status" class:ok={status === 'Copied'} role="status">
      {#if status === 'Copied'}
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.4 8.6l3 3 6.2-7.2" /></svg>
      {/if}{status}
    </p>
  </div>

  {#if manual}
    <label class="manual-label" for="{uid}-text">Message text</label>
    <textarea
      bind:this={box}
      class="manual"
      id="{uid}-text"
      readonly
      rows={Math.min(12, text.split('\n').length + Math.ceil(text.length / 45))}
      value={text}
      onfocus={(event) => event.currentTarget.select()}
    ></textarea>
  {/if}
</div>

<style>
  .copy {
    display: grid;
    gap: 0.75rem;
    justify-items: start;
    max-width: 34rem;
  }

  /* A chat bubble: flat, one tighter corner where the tail would be, on the site's two radii. It
     fills the column rather than shrinking to its text, so bubbles side by side on the print page
     end on one edge. */
  .bubble {
    display: grid;
    justify-self: stretch;
    gap: 0.3rem;
    padding: 0.8rem 1rem 0.9rem;
    border-radius: 0 var(--radius-panel) var(--radius-panel) var(--radius-panel);
    background: var(--paper-2);
    color: var(--ink);
    font-size: var(--text-sm);
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .bubble p,
  .bubble ul {
    margin: 0;
  }

  .bubble ul {
    display: grid;
    gap: 0.2rem;
    padding-left: 1.2rem;
  }

  .bubble strong {
    font-weight: 700;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
  }

  /* Without JavaScript the button could never work, so it goes, like the page's print button. */
  @media (scripting: none) {
    .actions {
      display: none;
    }
  }

  .button {
    min-height: 2.75rem;
    padding: 0.55rem 1.1rem;
    border: 0;
    border-radius: var(--radius-control);
    background: var(--ink);
    color: var(--paper);
    font-weight: 700;
    cursor: pointer;
  }

  .button:hover {
    background: color-mix(in oklab, var(--ink) 86%, var(--paper));
  }

  .button:active {
    translate: 0 1px;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--ink-2);
  }

  .status.ok {
    color: var(--ink);
  }

  .status svg {
    width: 1.1rem;
    height: 1.1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .manual-label {
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .manual {
    width: 100%;
    margin-top: -0.4rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius-control);
    background: var(--paper);
    color: var(--ink);
    font-size: var(--text-sm);
    line-height: 1.45;
    field-sizing: content;
  }

  @media (prefers-reduced-motion: reduce) {
    .button:active {
      translate: none;
    }
  }

  @media (forced-colors: active) {
    .button {
      border: 1px solid ButtonText;
    }

    .bubble {
      border: 1px solid CanvasText;
    }
  }

  @media print {
    .copy {
      display: none;
    }
  }
</style>

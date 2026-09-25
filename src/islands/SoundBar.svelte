<script lang="ts">
  /**
   * While any demo is playing, a bar pinned to the bottom of the screen says what's playing and
   * keeps volume and Stop one tap away, wherever you've scrolled. It also says why sound stopped
   * when the device interrupted it.
   */
  import { audio } from '../lib/audio/engine.svelte';

  let height = $state(0);
  const playing = $derived(audio.owner !== null);

  // Keep focused elements from hiding behind the bar (WCAG 2.4.11), including the control that
  // just started the sound when the bar opens on top of it.
  $effect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.style.scrollPaddingBottom = playing ? `${height + 16}px` : '';
    if (playing && height > 0) {
      // Scroll padding can't scroll past the end of the page, so leave room for the bar there too,
      // or the footer's links sit under it. The bar's own padding already covers the safe area.
      body.style.paddingBottom = `${height}px`;
      const el = document.activeElement;
      if (el instanceof HTMLElement && el.getBoundingClientRect().bottom > window.innerHeight - height) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
    return () => {
      root.style.scrollPaddingBottom = '';
      body.style.paddingBottom = '';
    };
  });

  // Let a notice sit for a while, then clear it.
  $effect(() => {
    if (!audio.notice) return;
    const t = window.setTimeout(() => {
      audio.notice = null;
    }, 8000);
    return () => window.clearTimeout(t);
  });
</script>

<!-- offsetHeight, not clientHeight: the room kept for the bar must include its top border. -->
<div class="sound-bar" bind:offsetHeight={height} hidden={!playing}>
  <p class="what">Playing{audio.ownerLabel ? `: ${audio.ownerLabel}` : ''}</p>
  <label class="volume">
    <span class="volume-label">Volume</span>
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      value={audio.volume}
      aria-valuetext={`${audio.volume} per cent`}
      oninput={(e) => audio.setVolume(Number(e.currentTarget.value))}
    />
  </label>
  <button type="button" class="stop" onclick={() => audio.stop()}>Stop</button>
</div>

<p class="notice" role="status">{audio.notice ?? ''}</p>

<style>
  .sound-bar {
    --focus: var(--hw-focus);
    position: fixed;
    inset: auto 0 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    padding: 0.6rem var(--gutter) calc(0.6rem + env(safe-area-inset-bottom, 0px));
    background: var(--hw);
    color: var(--hw-label);
    border-top: 1px solid var(--panel-edge);
  }

  .sound-bar[hidden] {
    display: none;
  }

  .what {
    margin: 0;
    margin-right: auto;
    font-weight: 700;
    color: var(--hw-bright);
  }

  .volume {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  /* The site's own control, not a name printed on the mixer, so plain words (DESIGN.md). */
  .volume-label {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--hw-label);
  }

  /* As tall as the Stop button, so the whole row is the target; the native track and thumb stay
     centred in it. */
  .volume input {
    width: 8rem;
    height: 2.75rem;
    margin: 0;
    accent-color: var(--hw-label);
  }

  /* Lit like the Listen key that started the sound: the sound is on until this is pressed. */
  .stop {
    min-height: 2.75rem;
    padding: 0.5rem 1.2rem;
    border: 1px solid var(--hw-label);
    border-radius: var(--radius-control);
    background: var(--hw-label);
    color: var(--hw-sunk);
    font-weight: 700;
    cursor: pointer;
  }

  .stop:focus-visible,
  .volume input:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
  }

  .notice {
    position: fixed;
    inset: auto var(--gutter) calc(1rem + env(safe-area-inset-bottom, 0px));
    z-index: 21;
    margin: 0;
    max-width: 26rem;
    padding: 0.7rem 0.9rem;
    /* A slip of the same panel as the bar, not a white card: nothing on the page dazzles. */
    border: 1px solid var(--panel-edge);
    border-radius: var(--radius-panel);
    background: var(--hw);
    color: var(--hw-bright);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  /* Stays in the accessibility tree when empty, so the announcement fires when text arrives. */
  .notice:empty {
    padding: 0;
    border: 0;
    background: none;
  }

  @media print {
    .sound-bar,
    .notice {
      display: none;
    }
  }
</style>

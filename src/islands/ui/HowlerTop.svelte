<script lang="ts">
  /**
   * The Howler Recorder+Streamer MK1 seen from above, drawn as a manual would: a flat line drawing
   * of the real box, not a picture of it. Proportions follow Howler's published size (88 × 63 mm)
   * and the layout in Howler's own manual (howler-audio.com/pages/manual-mk1): a finned aluminium
   * case with an end plate at each end, the big RECORD push button on top, the BATTERY and LEVEL
   * lights side by side above it, the name printed beside it, and RCA sockets on both ends (IN on
   * the left, the thru OUT on the right). The lights are drawn larger than life so they read.
   *
   * Only LEVEL is ever lit: it's the one light that says anything about the recording level, and the
   * site's lit colours only mean a signal state. RECORD stays unlit too: here it's part of the
   * drawing, not a key to press. Decorative, so hidden from screen readers: whoever uses it says
   * the light's state in words beside it.
   */
  interface Props {
    /** The LEVEL light: dark, blinking green (fine) or blinking red (too hot). */
    light: 'off' | 'green' | 'red';
    /**
     * Blink a few times after each change, as the real light blinks all the time. Off by default:
     * a scene that shows a state holds it still.
     */
    blink?: boolean;
  }

  let { light, blink = false }: Props = $props();

  /** The fins along both long sides, as grooves across the top. */
  const FINS = [17, 21, 25, 29, 105, 109, 113, 117];
</script>

<svg class="howler-top" data-blink={blink || undefined} viewBox="0 0 200 134" aria-hidden="true" focusable="false">
  <!-- RCA sockets: IN on the left end, the thru OUT on the right. -->
  {#each [54, 86] as y (y)}
    <rect class="socket" x="4" y={y - 5} width="8" height="10" />
    <line class="detail" x1="7.5" x2="7.5" y1={y - 5} y2={y + 5} />
  {/each}
  {#each [46, 77] as y (y)}
    <rect class="socket" x="188" y={y - 5} width="8" height="10" />
    <line class="detail" x1="192.5" x2="192.5" y1={y - 5} y2={y + 5} />
  {/each}

  <!-- The case, 88 × 63 mm, with its end plates and fins. -->
  <rect class="case" x="12" y="4" width="176" height="126" rx="5" />
  <line class="detail" x1="16" x2="16" y1="6" y2="128" />
  <line class="detail" x1="184" x2="184" y1="6" y2="128" />
  {#each FINS as y (y)}
    <line class="detail" x1="22" x2="178" y1={y} y2={y} />
  {/each}

  <!-- The name, printed large on the lid. -->
  <text class="name" x="22" y="76.5" textLength="78" lengthAdjust="spacingAndGlyphs">HOWLER</text>

  <!-- BATTERY and LEVEL, side by side above RECORD. -->
  <!-- Fixed lengths, so the legends keep their places whatever face draws them. -->
  <text class="legend" x="114" y="42" text-anchor="end" textLength="46" lengthAdjust="spacingAndGlyphs">BATTERY</text>
  <text class="legend" x="146.5" y="42" textLength="31" lengthAdjust="spacingAndGlyphs">LEVEL</text>
  <circle class="bezel" cx="123.5" cy="38" r="4.8" />
  <circle class="lamp" cx="123.5" cy="38" r="3.4" />
  <circle class="bezel" cx="136.5" cy="38" r="4.8" />
  <!-- Keyed, so a change of colour starts a fresh blink. -->
  {#key light}
    <g class="level" data-light={light}>
      <circle class="halo" cx="136.5" cy="38" r="8" />
      <circle class="lamp" cx="136.5" cy="38" r="3.4" />
    </g>
  {/key}

  <!-- RECORD: the big push button, in its collar, unlit. -->
  <circle class="collar" cx="130" cy="70" r="19" />
  <circle class="button" cx="130" cy="70" r="12.5" />
  <circle class="lamp" cx="130" cy="70" r="3.2" />
</svg>

<style>
  .howler-top {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  /* One grey for surfaces, a light line for the outline, a dimmer one for details (brief 3.9). */
  .case {
    fill: var(--hw-sunk);
    stroke: var(--hw-label-2);
    stroke-width: 1.5;
  }

  .detail {
    stroke: color-mix(in oklab, var(--hw-label-2) 42%, var(--hw-sunk));
    stroke-width: 1;
  }

  .socket {
    fill: var(--hw-3);
    stroke: var(--hw-label-2);
    stroke-width: 1;
  }

  .collar {
    fill: var(--hw-2);
    stroke: var(--hw-label-2);
    stroke-width: 1.25;
  }

  .button {
    fill: var(--hw-3);
    stroke: color-mix(in oklab, var(--hw-label-2) 60%, var(--hw-3));
    stroke-width: 1;
  }

  .bezel {
    fill: var(--hw-sunk);
    stroke: color-mix(in oklab, var(--hw-label-2) 42%, var(--hw-sunk));
    stroke-width: 1;
  }

  .lamp {
    fill: var(--led-off);
  }

  .halo {
    fill: transparent;
  }

  /* Lettered like every other hardware legend (.hw-label). */
  .legend,
  .name {
    font-family: var(--font-label);
    text-transform: uppercase;
  }

  .legend {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    fill: var(--hw-label-2);
  }

  /* The name is printed big on the lid; drawn quieter than the legends, as it tells you nothing. */
  .name {
    font-size: 19px;
    font-weight: 800;
    letter-spacing: 0.06em;
    fill: color-mix(in oklab, var(--hw-label-2) 55%, var(--hw-sunk));
  }

  .level[data-light='green'] .lamp {
    fill: var(--led-g);
  }

  .level[data-light='green'] .halo {
    fill: color-mix(in oklab, var(--led-g) 32%, transparent);
  }

  .level[data-light='red'] .lamp {
    fill: var(--led-r);
  }

  .level[data-light='red'] .halo {
    fill: color-mix(in oklab, var(--led-r) 36%, transparent);
  }

  /* The real light blinks all the time. Here it blinks for under 5 seconds after each change,
     then holds steady (WCAG 2.2.2), and not at all with reduced motion. The words say "blinking". */
  @media (prefers-reduced-motion: no-preference) {
    [data-blink] .level[data-light='green'],
    [data-blink] .level[data-light='red'] {
      animation: blink 0.8s steps(1, end) 6;
    }
  }

  @keyframes blink {
    50% {
      opacity: 0.18;
    }
  }

  /* A lit light is solid, a dark one hollow; the halo goes, the words beside it stay. */
  @media (forced-colors: active) {
    .case,
    .socket,
    .collar,
    .button,
    .bezel,
    .lamp {
      fill: Canvas;
      stroke: CanvasText;
    }

    .detail {
      stroke: CanvasText;
    }

    .legend,
    .name {
      fill: CanvasText;
    }

    .halo,
    .level[data-light] .halo {
      fill: Canvas;
    }

    .level[data-light='green'] .lamp,
    .level[data-light='red'] .lamp {
      fill: CanvasText;
    }
  }
</style>

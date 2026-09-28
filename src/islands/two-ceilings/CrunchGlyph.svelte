<script lang="ts">
  /**
   * A tiny wave beside the Crunch readout: whole when clean, flat-topped when crunchy, the same
   * picture as the scopes. Decorative (the word next to it carries the state), so it's hidden
   * from screen readers.
   */
  import type { Crunch } from '../../lib/lab/ceilings';

  interface Props {
    crunch: Crunch;
  }

  let { crunch }: Props = $props();

  const W = 40;
  const H = 20;
  const AMP = 8;
  /** Where the tops get cut, as a share of the wave's height. Tips cut shaves only the very top. */
  const CUT: Record<Crunch, number> = { clean: 1, tips: 0.9, crunch: 0.55 };

  const POINTS = 80;
  const at = (i: number) => ({ x: (i / POINTS) * W, s: Math.sin((i / POINTS) * 4 * Math.PI) });

  const shape = $derived.by(() => {
    const level = CUT[crunch];
    const yOf = (v: number) => (H / 2 - v * AMP).toFixed(2);
    let wave = '';
    let flats = '';
    let runStart = -1;
    for (let i = 0; i <= POINTS; i++) {
      const { x, s } = at(i);
      const cut = Math.abs(s) > level;
      wave += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${yOf(cut ? Math.sign(s) * level : s)}`;
      if (cut && runStart < 0) runStart = i;
      const closes = runStart >= 0 && (!cut || i === POINTS);
      if (closes) {
        const first = at(runStart);
        const y = yOf(Math.sign(first.s) * level);
        const lastX = cut ? x : at(i - 1).x;
        flats += `M${first.x.toFixed(2)} ${y}L${lastX.toFixed(2)} ${y}`;
        runStart = -1;
      }
    }
    return { wave, flats };
  });
</script>

<svg viewBox="0 0 {W} {H}" width={W} height={H} aria-hidden="true">
  <path class="wave" d={shape.wave} />
  <path class="flat" d={shape.flats} />
</svg>

<style>
  svg {
    display: inline-block;
    flex: none;
    overflow: visible;
  }

  .wave,
  .flat {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .wave {
    stroke: var(--sig);
    stroke-width: 1.5;
  }

  .flat {
    stroke: var(--dmg);
    stroke-width: 2.5;
  }

  @media (forced-colors: active) {
    .wave {
      stroke: CanvasText;
    }

    .flat {
      stroke: Highlight;
    }
  }
</style>

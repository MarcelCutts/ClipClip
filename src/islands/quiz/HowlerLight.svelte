<script lang="ts">
  /**
   * The recorder as the crew see it on the night: the Howler from above (ui/HowlerTop), its LEVEL
   * light lit. Green means the recording had room; red means it was too hot (Howler's own manual).
   * Drawn still: the scene shows a state, it doesn't blink at the reader.
   */
  import HowlerTop from '../ui/HowlerTop.svelte';

  interface Props {
    light: 'green' | 'red';
  }

  let { light }: Props = $props();
</script>

<div class="howler" role="img" aria-label="The Howler recorder, its LEVEL light {light}.">
  <HowlerTop {light} />
</div>

<style>
  .howler {
    width: min(100%, 12rem);
  }
</style>

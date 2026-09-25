<script lang="ts">
  /**
   * The steps as a static read-then-do list, set like a quick reference handbook's checklist: each
   * step's challenge, a dotted leader and its response in the action colour, then how to do it.
   * Readable before (or instead of) practising, and in the server-rendered page. It sits on the
   * page, not in the panel, so it's set in page text; the practice panel under it repeats each
   * line on its step.
   */
  import { ROOM_NOTE, STEPS } from '../../lib/record/flow';
</script>

<div class="procedure">
  <!-- The numbers are set by hand, so role="list" keeps the list for Safari's screen reader. -->
  <!-- biome-ignore lint/a11y/noRedundantRoles: list-style: none drops the list role in Safari -->
  <ol class="steps" role="list">
    {#each STEPS as s, i (s.id)}
      <li>
        <p class="line">
          <span class="num">{i + 1}</span>
          <!-- The leader joins challenge and response by eye; the hidden comma does it by ear. -->
          <strong class="challenge">{s.label}<span class="visually-hidden">,</span></strong>
          <span class="leader" aria-hidden="true"></span>
          <span class="response">{s.target}</span>
        </p>
        <p class="how">{s.instruction}</p>
      </li>
    {/each}
  </ol>
  <p class="room">{ROOM_NOTE}</p>
</div>

<style>
  .procedure {
    display: grid;
    gap: 1rem;
    max-width: var(--measure);
    color: var(--ink);
  }

  .steps {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps > li {
    display: grid;
    gap: 0.25rem;
    padding-block: 0.7rem;
    border-top: 1px solid var(--rule);
  }

  .steps > li:last-child {
    border-bottom: 1px solid var(--rule);
  }

  /* Challenge ........ response, as on a printed checklist. The response drops under the leader
     on a phone when the two can't share a line. */
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 0.5rem;
    margin: 0;
  }

  .num {
    flex: none;
    width: 1.4rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .challenge {
    font-weight: 700;
  }

  .leader {
    flex: 1 1 2rem;
    min-width: 2rem;
    border-bottom: 2px dotted var(--ink-4);
    translate: 0 -0.3em;
  }

  .response {
    margin-left: auto;
    font-weight: 700;
    text-align: right;
    color: var(--action);
  }

  .how {
    margin: 0 0 0 1.9rem;
    color: var(--ink-2);
  }

  .room {
    margin: 0;
  }
</style>

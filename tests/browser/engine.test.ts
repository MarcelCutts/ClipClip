import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SoundBar from '../../src/islands/SoundBar.svelte';
import { AudioEngine, audio } from '../../src/lib/audio/engine.svelte';
import { LoopPlayer } from '../../src/lib/audio/loopPlayer';

afterEach(() => audio.stop());

// The audio thread takes its own time to resume or suspend, longer when the output device has to
// wake up, so wait for the state rather than for a fixed time.
const settled = { timeout: 3000, interval: 20 };
const running = (ctx: AudioContext | null) => expect.poll(() => ctx?.state, settled).toBe('running');

const tone = (sr: number) => Float32Array.from({ length: sr }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr));

test('volume maps to a bounded gain', () => {
  expect(AudioEngine.gainFor(0)).toBe(0);
  expect(AudioEngine.gainFor(100)).toBeCloseTo(0.7, 6);
  expect(AudioEngine.gainFor(150)).toBeCloseTo(0.7, 6);
});

test('only one demo plays at a time, and the first is told it stopped', async () => {
  let aStopped = 0;
  const a = new LoopPlayer('a', () => aStopped++);
  const b = new LoopPlayer('b', () => {});
  expect(await a.start(tone)).toBe(true);
  expect(audio.owner).toBe('a');
  expect(await b.start(tone)).toBe(true);
  expect(audio.owner).toBe('b');
  expect(aStopped).toBe(1);
  expect(a.playing).toBe(false);
  b.stop();
  expect(audio.owner).toBeNull();
});

test('Escape stops whatever is playing', async () => {
  let stopped = false;
  const p = new LoopPlayer('esc', () => {
    stopped = true;
  });
  await p.start(tone);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(stopped).toBe(true);
  expect(audio.owner).toBeNull();
});

test('stopping suspends the context shortly after', async () => {
  const p = new LoopPlayer('sus', () => {});
  await p.start(tone);
  await running(audio.context);
  p.stop();
  await expect.poll(() => audio.context?.state, settled).toBe('suspended');
});

test('a demo started just as the engine suspends after a Stop keeps playing', async () => {
  const first = new LoopPlayer('first', () => {});
  await first.start(tone);
  await running(audio.context);
  const ctx = audio.context;
  if (!ctx) throw new Error('no audio context');
  let secondStopped = false;
  const second = new LoopPlayer('second', () => {
    secondStopped = true;
  });
  // Press Listen on another demo the moment the engine's delayed suspend() goes out, so the
  // context's "suspended" event arrives after the new demo has claimed the speakers.
  const suspend = ctx.suspend.bind(ctx);
  let started: Promise<boolean> | undefined;
  ctx.suspend = () => {
    const done = suspend();
    started ??= second.start(tone);
    return done;
  };
  try {
    first.stop();
    await expect.poll(() => started, settled).toBeDefined();
  } finally {
    Reflect.deleteProperty(ctx, 'suspend');
  }
  expect(await started).toBe(true);
  // Mistaking our own suspend for an interruption would stop the demo and leave the context
  // suspended, so it never reads "running" here.
  await running(ctx);
  expect(secondStopped).toBe(false);
  expect(audio.owner).toBe('second');
  expect(audio.notice).toBeNull();
  expect(ctx.state).toBe('running');
});

test('an interruption stops the demo at once and says how to start again', async () => {
  let stopped = false;
  const p = new LoopPlayer('interrupted', () => {
    stopped = true;
  });
  await p.start(tone);
  await running(audio.context);
  const ctx = audio.context;
  if (!ctx) throw new Error('no audio context');
  const stop = vi.spyOn(AudioBufferSourceNode.prototype, 'stop');
  try {
    // Stands in for the system pausing audio, as a phone call does.
    await ctx.suspend();
    await expect.poll(() => stopped, settled).toBe(true);
    expect(audio.owner).toBeNull();
    expect(ctx.state).toBe('suspended');
    // The source's stop is due now, not 80 ms ahead on a clock that has stopped.
    expect(stop).toHaveBeenCalled();
    for (const [when = 0] of stop.mock.calls) expect(when).toBeLessThanOrEqual(ctx.currentTime);
  } finally {
    stop.mockRestore();
  }
  // Every demo can act on the notice: the listening test has no Listen button.
  expect(audio.notice).toMatch(/interrupted/);
  expect(audio.notice).not.toMatch(/Listen/);
});

test('the Stop bar tells screen readers what started playing, and that it stopped', async () => {
  const screen = await render(SoundBar);
  // A polite status of its own, apart from the visible notice.
  const status = screen.container.querySelector('[data-sound-status]')!;
  expect(status.getAttribute('role')).toBe('status');
  expect(status.textContent).toBe('');
  const p = new LoopPlayer('announced', () => {}, 'Two ceilings lab');
  await p.start(tone);
  await expect.poll(() => status.textContent, settled).toBe('Playing: Two ceilings lab');
  await expect.poll(() => document.documentElement.style.getPropertyValue('--sound-bar'), settled).toMatch(/px$/);
  p.stop();
  await expect.poll(() => status.textContent, settled).toBe('Sound stopped');
  expect(document.documentElement.style.getPropertyValue('--sound-bar')).toBe('');
});

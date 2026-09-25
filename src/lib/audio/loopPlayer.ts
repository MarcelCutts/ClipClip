import { audio } from './engine.svelte';

/**
 * Plays a looping buffer through the shared engine and swaps it smoothly when the demo's
 * settings change. Every source is tracked, so stopping always silences all of them.
 */

/** Renders one loop of mono audio at the given sample rate. */
export type LoopRenderer = (sampleRate: number) => Float32Array;

/** Crossfade time constant. Equal-gain exponential fades, so the sum never bumps. */
const CROSSFADE_TAU = 0.01;
/** Schedule changes slightly ahead: Firefox clicks when automation starts at currentTime. */
const LOOKAHEAD = 0.02;
/** At most one new buffer per this many ms while a slider is being dragged. */
const REFRESH_MS = 60;

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class LoopPlayer {
  readonly id: string;
  /** What's playing, in a few words, for the page-wide Stop bar. */
  readonly label: string | undefined;
  #render: LoopRenderer | null = null;
  #onStopped: () => void;
  #ctx: AudioContext | null = null;
  #bus: GainNode | null = null;
  #voices: Voice[] = [];
  #current: Voice | null = null;
  #lastRefresh = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #playing = false;
  /** When each source started and from which point in the loop, to find the playhead. */
  #startTimes = new WeakMap<AudioBufferSourceNode, { at: number; offset: number }>();

  constructor(id: string, onStopped: () => void, label?: string) {
    this.id = id;
    this.label = label;
    this.#onStopped = onStopped;
  }

  get playing(): boolean {
    return this.#playing;
  }

  /** Start playing. Resolves false if the browser couldn't make sound. */
  async start(render: LoopRenderer): Promise<boolean> {
    this.#render = render;
    const claimed = await audio.claim({
      id: this.id,
      stopped: () => this.#stopped(),
      ...(this.label ? { label: this.label } : {}),
    });
    // Something may have taken over while we waited.
    if (!claimed || audio.owner !== this.id) return false;
    this.#ctx = claimed.ctx;
    this.#bus = claimed.bus;
    this.#playing = true;
    this.#lastRefresh = 0;
    this.#swap();
    return true;
  }

  /** New settings: re-render and crossfade, at most every REFRESH_MS. */
  update(render: LoopRenderer): void {
    this.#render = render;
    if (!this.#playing) return;
    const wait = REFRESH_MS - (performance.now() - this.#lastRefresh);
    if (wait > 0) {
      this.#timer ??= setTimeout(() => {
        this.#timer = null;
        this.update(this.#render ?? render);
      }, wait);
      return;
    }
    this.#swap();
  }

  stop(): void {
    audio.release(this.id);
  }

  #swap(): void {
    const ctx = this.#ctx;
    const bus = this.#bus;
    const render = this.#render;
    if (!ctx || !bus || !render || !this.#playing) return;
    this.#lastRefresh = performance.now();

    const data = render(ctx.sampleRate);
    const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    const t = ctx.currentTime + LOOKAHEAD;
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, t);
    gain.gain.setTargetAtTime(1, t, CROSSFADE_TAU);
    source.connect(gain).connect(bus);
    const voice: Voice = { source, gain };
    source.onended = () => this.#forget(voice);

    // Start the new loop where the old one will have got to, so a change doesn't restart the beat.
    const previous = this.#current;
    const offset = previous ? this.#position(previous, t) : 0;
    source.start(t, offset);
    this.#startTimes.set(source, { at: t, offset });
    this.#voices.push(voice);
    this.#current = voice;

    if (previous) {
      previous.gain.gain.cancelScheduledValues(t);
      previous.gain.gain.setTargetAtTime(0, t, CROSSFADE_TAU);
      try {
        previous.source.stop(t + CROSSFADE_TAU * 8);
      } catch {
        this.#forget(previous);
      }
    }
  }

  /** Where in its loop a voice will be at context time `at`. */
  #position(voice: Voice, at: number): number {
    const info = this.#startTimes.get(voice.source);
    const duration = voice.source.buffer?.duration ?? 0;
    if (!info || duration === 0) return 0;
    return (((info.offset + at - info.at) % duration) + duration) % duration;
  }

  #forget(voice: Voice): void {
    this.#voices = this.#voices.filter((v) => v !== voice);
    if (this.#current === voice) this.#current = null;
    try {
      voice.source.disconnect();
      voice.gain.disconnect();
    } catch {
      // Already disconnected.
    }
  }

  /** The engine stopped us (another demo started, the tab was hidden, or stop() was called). */
  #stopped(): void {
    this.#playing = false;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    // While the clock runs, each voice rides out the engine's fade, then ends and is forgotten.
    // A stopped clock (the system interrupted us, or Stop came before the sound started) can't
    // reach a stop time ahead of it, so stop them at once: they end the moment it runs again.
    // They stay connected until then, because WebKit never ends a source cut off before its stop.
    const ctx = this.#ctx;
    const running = ctx !== null && ctx.state === 'running';
    for (const voice of this.#voices) {
      try {
        voice.source.stop(running ? ctx.currentTime + 0.08 : 0);
      } catch {
        this.#forget(voice);
      }
    }
    if (!running) this.#voices = [];
    this.#current = null;
    this.#bus = null;
    this.#onStopped();
  }
}

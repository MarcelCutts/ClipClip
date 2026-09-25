/**
 * One audio engine for the whole page.
 *
 * - Nothing makes a sound until a button press calls `claim()`.
 * - Only one demo plays at a time: claiming stops whoever was playing, on this page and in
 *   other tabs of the site.
 * - Everything runs through one master gain, so stopping fades the lot out in one move, then
 *   suspends the context so nothing can leak through.
 * - Hiding the tab, leaving the page, pressing Escape, or the system interrupting audio (a call)
 *   stops playback, and an interrupted demo never restarts by itself.
 *
 * Level is bounded by construction: every demo's buffers stay within ±1 and the master gain
 * never exceeds MAX_GAIN, so the output peaks at about −3 dBFS at most. No limiter needed.
 */

/** Every GitHub Pages project site of one owner shares an origin, so keys carry the site's name. */
const NAMESPACE = 'out-of-the-red';
const VOLUME_KEY = `${NAMESPACE}:volume`;
const CHANNEL = `${NAMESPACE}:audio`;
/** Schedule changes slightly ahead: Firefox clicks when automation starts at currentTime. */
const LOOKAHEAD = 0.02;
/** Time constant for fades. After about six of these the level is below −50 dB. */
const FADE_TAU = 0.012;
const FADE_DONE_MS = 140;
/** The loudest the master gain may go, whatever the volume slider says. */
const MAX_GAIN = 0.7;

interface Owner {
  id: string;
  /** Called when something else takes over or the engine stops, so the owner can reset its UI. */
  stopped: () => void;
  /** What is playing, in a few words, for the page-wide Stop bar. */
  label?: string;
}

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/** Click-free move of any AudioParam, in every engine (schedule ahead, glide exponentially). */
export function glide(param: AudioParam, value: number, ctx: BaseAudioContext, tau = 0.015): void {
  const t = ctx.currentTime + LOOKAHEAD;
  param.cancelScheduledValues(t);
  param.setTargetAtTime(value, t, tau);
}

class AudioEngine {
  /** Id of the demo that is currently playing, if any. */
  owner = $state<string | null>(null);
  /** What the current demo said it is, for the Stop bar. */
  ownerLabel = $state<string | null>(null);
  /** Listening volume, 0–100. Mapped to gain on a squared curve. */
  volume = $state(45);
  /** Set when the browser can't make sound at all. */
  unavailable = $state(false);
  /** A short message about why sound stopped by itself, if it did. */
  notice = $state<string | null>(null);

  #ctx: AudioContext | null = null;
  #master: GainNode | null = null;
  #current: Owner | null = null;
  #bus: GainNode | null = null;
  /** How many resume() calls are still in flight. */
  #resuming = 0;
  #channel: BroadcastChannel | null = null;
  #tabId = Math.random().toString(36).slice(2);

  constructor() {
    if (typeof window === 'undefined') return;
    try {
      const saved = Number(localStorage.getItem(VOLUME_KEY));
      if (saved > 0 && saved <= 100) this.volume = saved;
    } catch {
      // Storage can be blocked; the default volume is fine.
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
    });
    window.addEventListener('pagehide', () => {
      this.stop();
      this.#closeChannel();
    });
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) this.stop();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.owner) return;
      if (document.querySelector('dialog[open], :popover-open')) return;
      this.stop();
    });
  }

  get context(): AudioContext | null {
    return this.#ctx;
  }

  /** Master gain for a volume setting. */
  static gainFor(volume: number): number {
    return MAX_GAIN * (Math.max(0, Math.min(100, volume)) / 100) ** 2;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // Not remembered, that's all.
    }
    if (this.#ctx && this.#master && this.owner) glide(this.#master.gain, AudioEngine.gainFor(volume), this.#ctx, 0.03);
  }

  #ensure(): AudioContext | null {
    if (this.#ctx) return this.#ctx;
    const Ctor = window.AudioContext;
    if (!Ctor) {
      this.unavailable = true;
      return null;
    }
    // On iPhone, "playback" lets the demos sound even with the ringer switch on silent. It applies
    // asynchronously, so set it before the context exists.
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (session) {
      try {
        session.type = 'playback';
      } catch {
        // Older Safari: the ringer switch will mute us, and the UI says so.
      }
    }
    try {
      this.#ctx = new Ctor();
    } catch {
      this.unavailable = true;
      return null;
    }
    const ctx = this.#ctx;
    this.#master = ctx.createGain();
    this.#master.gain.value = 0;
    this.#master.connect(ctx.destination);
    ctx.addEventListener('statechange', () => {
      if (!this.#current) return;
      const state = ctx.state as AudioContextState | 'interrupted';
      // A "suspended" event while a claim is resuming can be the tail of our own suspend(), when
      // Listen comes just as a Stop takes effect. claim() checks the state once it has resumed.
      if (state === 'interrupted' || (state === 'suspended' && this.#resuming === 0)) this.#interrupted(ctx);
    });
    return ctx;
  }

  /** The system paused us (a call, another app). */
  #interrupted(ctx: AudioContext): void {
    // Stop, and suspend so the context stays suspended when the interruption ends instead of
    // carrying on by itself.
    this.stop();
    // Every demo names its start button differently ("Listen", "Play A"), so name none.
    this.notice = 'Sound stopped because your device interrupted it. Press play to start again.';
    ctx.suspend().catch(() => {});
  }

  #openChannel(): void {
    if (this.#channel || typeof BroadcastChannel === 'undefined') return;
    // Only open while playing: an open channel keeps the page out of the back/forward cache.
    try {
      this.#channel = new BroadcastChannel(CHANNEL);
      this.#channel.onmessage = (e: MessageEvent<{ type: string; tab: string }>) => {
        if (e.data?.type === 'play' && e.data.tab !== this.#tabId) this.stop();
      };
      this.#channel.postMessage({ type: 'play', tab: this.#tabId });
    } catch {
      this.#channel = null;
    }
  }

  #closeChannel(): void {
    this.#channel?.close();
    this.#channel = null;
  }

  /**
   * Take over the speakers for a demo. Call it straight from a click or tap. Stops whatever else
   * is playing and returns a fresh bus to connect sources to, or null if there's no sound.
   */
  async claim(owner: Owner): Promise<{ ctx: AudioContext; bus: GainNode } | null> {
    const ctx = this.#ensure();
    if (!ctx || !this.#master) return null;
    if (this.#current && this.#current.id !== owner.id) this.#release(true);
    else if (this.#current) this.#release(false);

    this.#current = owner;
    this.owner = owner.id;
    this.ownerLabel = owner.label ?? null;
    this.notice = null;
    const bus = ctx.createGain();
    bus.connect(this.#master);
    this.#bus = bus;

    // Resume inside the user's gesture, and don't wait for it before scheduling: the context
    // clock simply starts when it's running.
    this.#resuming++;
    ctx.resume().then(
      () => {
        this.#resuming--;
        // The state reads "running" once resume() resolves, unless something paused us while it
        // was resuming. The statechange handler waits for this check, so make it now.
        if (this.#current === owner && ctx.state !== 'running') this.#interrupted(ctx);
      },
      () => {
        this.#resuming--;
        if (this.#current === owner) {
          this.notice = 'Your browser blocked the sound. Try again.';
          this.stop();
        }
      },
    );
    glide(this.#master.gain, AudioEngine.gainFor(this.volume), ctx, FADE_TAU);
    if (this.#channel) this.#channel.postMessage({ type: 'play', tab: this.#tabId });
    else this.#openChannel();
    return { ctx, bus };
  }

  /** Stop the demo with this id, if it is the one playing. */
  release(ownerId: string): void {
    if (this.#current?.id === ownerId) this.stop();
  }

  /** Stop everything: fade out, drop the current bus, suspend. */
  stop(): void {
    if (!this.#current) return;
    this.#release(true);
    const ctx = this.#ctx;
    const master = this.#master;
    if (!ctx || !master) return;
    glide(master.gain, 0, ctx, FADE_TAU);
    window.setTimeout(() => {
      if (this.#current) return;
      this.#closeChannel();
      if (ctx.state === 'running') ctx.suspend().catch(() => {});
    }, FADE_DONE_MS);
  }

  #release(notify: boolean): void {
    const owner = this.#current;
    const bus = this.#bus;
    this.#current = null;
    this.#bus = null;
    this.owner = null;
    this.ownerLabel = null;
    if (bus && this.#ctx) {
      glide(bus.gain, 0, this.#ctx, FADE_TAU);
      window.setTimeout(() => bus.disconnect(), FADE_DONE_MS);
    }
    if (notify) owner?.stopped();
  }
}

export const audio = new AudioEngine();
export { AudioEngine };

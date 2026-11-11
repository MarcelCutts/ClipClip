import { describe, expect, it } from 'vitest';
import { encodeWav24, type ReadBytes, readWavInfo } from './wav';

const SR = 48000;

const reader =
  (bytes: Uint8Array): ReadBytes =>
  async (offset, length) =>
    bytes.subarray(offset, Math.min(bytes.length, offset + length));

const infoOf = (file: Uint8Array) => readWavInfo(reader(file), file.length);

const text = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

function join(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const u32 = (n: number): Uint8Array => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
};

/**
 * One chunk: its name, its size, its bytes. `size` is what the header says. An odd body takes a pad
 * byte unless `pad` is off.
 */
function chunk(id: string, body: Uint8Array, { size = body.length, pad = true } = {}): Uint8Array {
  return join(text(id), u32(size), body, new Uint8Array(pad ? body.length % 2 : 0));
}

const wav = (...chunks: Uint8Array[]): Uint8Array => {
  const body = join(text('WAVE'), ...chunks);
  return join(text('RIFF'), u32(body.length), body);
};

/**
 * A format chunk for PCM, 24-bit stereo unless told otherwise. A frame is its samples' size unless
 * `blockAlign` says so.
 */
function fmt(fields: { channels?: number; sampleRate?: number; bits?: number; blockAlign?: number } = {}): Uint8Array {
  const { channels = 2, sampleRate = SR, bits = 24 } = fields;
  const blockAlign = fields.blockAlign ?? (channels * bits) / 8;
  const b = new Uint8Array(16);
  const v = new DataView(b.buffer);
  v.setUint16(0, 1, true);
  v.setUint16(2, channels, true);
  v.setUint32(4, sampleRate, true);
  v.setUint32(8, sampleRate * blockAlign, true);
  v.setUint16(12, blockAlign, true);
  v.setUint16(14, bits, true);
  return chunk('fmt ', b);
}

/**
 * Sample bytes for `frames` of a quiet tone, 24-bit stereo (or mono). Its top bytes are never
 * letters, as a chunk's name is.
 */
function tone(frames: number, channels = 2): Uint8Array {
  const samples = Float32Array.from({ length: frames * channels }, (_, i) => {
    const n = Math.floor(i / channels);
    return 0.1 * Math.sin((2 * Math.PI * 100 * n) / SR);
  });
  return encodeWav24(samples, channels, SR).subarray(44);
}

const tags = chunk('LIST', text('INFOISFT'));

describe('the format chunk', () => {
  it('reads a plain 24-bit stereo header', async () => {
    const info = await infoOf(wav(fmt(), chunk('data', tone(100))));
    expect(info).toMatchObject({ channels: 2, sampleRate: SR, bits: 24, blockAlign: 6, frames: 100, truncated: false });
  });

  it('says plainly when the header gives no channels or no sample rate', async () => {
    const noChannels = wav(fmt({ channels: 0, blockAlign: 6 }), chunk('data', tone(100)));
    await expect(infoOf(noChannels)).rejects.toThrow('it gives no channels');
    const noRate = wav(fmt({ sampleRate: 0 }), chunk('data', tone(100)));
    await expect(infoOf(noRate)).rejects.toThrow('it gives no sample rate');
  });

  it('says plainly when a frame is not the size of its samples', async () => {
    for (const blockAlign of [0, 8]) {
      const file = wav(fmt({ blockAlign }), chunk('data', tone(100)));
      await expect(infoOf(file)).rejects.toThrow(`a frame of ${blockAlign} bytes does not hold 2 × 24-bit samples`);
    }
  });

  it('says plainly when the format chunk is cut short', async () => {
    const short = wav(chunk('fmt ', new Uint8Array(8)), chunk('data', tone(100)));
    await expect(infoOf(short)).rejects.toThrow('format chunk is cut short');
    // The file ends part of the way through the chunk.
    const cut = wav(fmt()).subarray(0, 30);
    await expect(infoOf(cut)).rejects.toThrow('format chunk is cut short');
  });
});

describe('how long the samples run', () => {
  it('says plainly when a file has no samples', async () => {
    // A header and nothing after it: what a recorder leaves when the power goes as it starts.
    await expect(infoOf(wav(fmt(), chunk('data', new Uint8Array(0))))).rejects.toThrow('has no samples');
    // The same with tags after the empty data chunk: the tags are not samples.
    await expect(infoOf(wav(fmt(), chunk('data', new Uint8Array(0)), tags))).rejects.toThrow('has no samples');
  });

  it('reads to the end of a file that holds more than its header says', async () => {
    // The header was written a second in, and the recording went on for another.
    const file = wav(fmt(), chunk('data', tone(2 * SR), { size: SR * 6 }));
    const info = await infoOf(file);
    expect(info.frames).toBe(2 * SR);
    expect(info.truncated).toBe(true);
  });

  it('reads a RIFF over 4 GB to its end, where its 32-bit length has wrapped round', async () => {
    // 4.5 GB of silence, never written to disk: the header's bytes, then noughts.
    const dataBytes = 750_000_000 * 6;
    const head = wav(fmt(), chunk('data', new Uint8Array(0), { size: dataBytes % 2 ** 32 }));
    const fileSize = head.length + dataBytes;
    const read: ReadBytes = async (offset, length) => {
      const out = new Uint8Array(Math.max(0, Math.min(length, fileSize - offset)));
      if (offset < head.length) out.set(head.subarray(offset, offset + out.length));
      return out;
    };
    const info = await readWavInfo(read, fileSize);
    expect(info.frames).toBe(750_000_000);
    expect(info.truncated).toBe(true);
  });

  it('keeps to the header’s length where a chunk follows the samples', async () => {
    const after = await infoOf(wav(fmt(), chunk('data', tone(100)), tags));
    expect(after).toMatchObject({ frames: 100, truncated: false });
    // An odd number of bytes (mono, 24-bit), with the pad byte it should take and without it.
    const mono = fmt({ channels: 1 });
    const padded = await infoOf(wav(mono, chunk('data', tone(101, 1)), tags));
    expect(padded).toMatchObject({ frames: 101, truncated: false });
    const unpadded = await infoOf(wav(mono, chunk('data', tone(101, 1), { pad: false }), tags));
    expect(unpadded).toMatchObject({ frames: 101, truncated: false });
    // A few stray bytes at the end are not a recording that ran on.
    const stray = await infoOf(join(wav(fmt(), chunk('data', tone(100))), new Uint8Array(5).fill(0x7f)));
    expect(stray).toMatchObject({ frames: 100, truncated: false });
  });

  it('takes an RF64 file’s length from its ds64 chunk, and says plainly when the file ends inside it', async () => {
    const samples = tone(100);
    const ds64 = new Uint8Array(28);
    new DataView(ds64.buffer).setBigUint64(8, BigInt(samples.length), true);
    const file = wav(chunk('ds64', ds64), fmt(), chunk('data', samples, { size: 0xffffffff }));
    file.set(text('RF64'));
    expect(await infoOf(file)).toMatchObject({ frames: 100, truncated: false });
    await expect(infoOf(file.subarray(0, 30))).rejects.toThrow('has no samples');
  });
});

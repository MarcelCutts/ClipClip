/**
 * Reading WAV files as they come off a recorder: the header, then the samples as numbers from −1
 * to 1. It works on bytes, so the command line and a browser can both use it.
 *
 * Handles PCM at 8, 16, 24 and 32 bits and float at 32 and 64, in plain RIFF, in
 * WAVE_FORMAT_EXTENSIBLE and in RF64 (files over 4 GB). A recording cut off by a power cut often
 * never gets its data size written; then the samples run to the end of the file.
 */

export interface WavInfo {
  sampleRate: number;
  channels: number;
  /** Bits per sample as stored: 8, 16, 24, 32 or 64. */
  bits: number;
  float: boolean;
  /** Bytes per frame: one sample for every channel. */
  blockAlign: number;
  /** Where the samples start, in bytes from the start of the file. */
  dataOffset: number;
  /** Bytes of samples, whole frames only. */
  dataBytes: number;
  /** Samples per channel. */
  frames: number;
  /** The header's data size was missing or longer than the file, so the samples run to the end. */
  truncated: boolean;
  /** When the recording started, if the recorder wrote a Broadcast WAV (bext) chunk. */
  started?: { date: string; time: string };
}

/** Reads `length` bytes from `offset` (fewer at the end of the file). */
export type ReadBytes = (offset: number, length: number) => Promise<Uint8Array>;

const PCM = 1;
const FLOAT = 3;
const EXTENSIBLE = 0xfffe;
const UNKNOWN_SIZE = 0xffffffff;

const ascii = (bytes: Uint8Array, from: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(from, from + length));

const view = (bytes: Uint8Array): DataView => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** Reads a WAV file's header. Throws with a plain reason if the file isn't one it can read. */
export async function readWavInfo(read: ReadBytes, fileSize: number): Promise<WavInfo> {
  const head = await read(0, 12);
  const riff = ascii(head, 0, 4);
  if (head.length < 12 || !['RIFF', 'RF64', 'BW64'].includes(riff) || ascii(head, 8, 4) !== 'WAVE') {
    throw new Error('Not a WAV file: it does not start with a RIFF/WAVE header.');
  }

  let format: Omit<WavInfo, 'dataOffset' | 'dataBytes' | 'frames' | 'truncated' | 'started'> | undefined;
  let started: WavInfo['started'];
  let ds64DataSize: number | undefined;
  let offset = 12;

  while (offset + 8 <= fileSize) {
    const chunk = await read(offset, 8);
    if (chunk.length < 8) break;
    const id = ascii(chunk, 0, 4);
    const size = view(chunk).getUint32(4, true);
    const body = offset + 8;

    if (id === 'ds64') {
      const d = view(await read(body, 28));
      ds64DataSize = Number(d.getBigUint64(8, true));
    } else if (id === 'fmt ') {
      const f = view(await read(body, Math.min(size, 40)));
      let code = f.getUint16(0, true);
      const bits = f.getUint16(14, true);
      if (code === EXTENSIBLE && size >= 26) code = f.getUint16(24, true);
      if (code !== PCM && code !== FLOAT) throw new Error(`Unsupported WAV encoding (format ${code}).`);
      const float = code === FLOAT;
      if (float ? bits !== 32 && bits !== 64 : ![8, 16, 24, 32].includes(bits)) {
        throw new Error(`Unsupported sample size: ${bits}-bit ${float ? 'float' : 'PCM'}.`);
      }
      format = {
        channels: f.getUint16(2, true),
        sampleRate: f.getUint32(4, true),
        blockAlign: f.getUint16(12, true),
        bits,
        float,
      };
    } else if (id === 'bext' && size >= 346) {
      const b = await read(body + 320, 18);
      const date = ascii(b, 0, 10).replace(/\0.*$/, '').trim();
      const time = ascii(b, 10, 8).replace(/\0.*$/, '').trim();
      if (date) started = { date, time };
    } else if (id === 'data') {
      if (!format) throw new Error('The WAV file has no format chunk before its samples.');
      let dataBytes = size === UNKNOWN_SIZE && ds64DataSize !== undefined ? ds64DataSize : size;
      let truncated = false;
      if (dataBytes === 0 || dataBytes === UNKNOWN_SIZE || body + dataBytes > fileSize) {
        dataBytes = fileSize - body;
        truncated = true;
      }
      const frames = Math.floor(dataBytes / format.blockAlign);
      return {
        ...format,
        dataOffset: body,
        dataBytes: frames * format.blockAlign,
        frames,
        truncated,
        ...(started ? { started } : {}),
      };
    }
    offset = body + size + (size & 1);
  }
  throw new Error('The WAV file has no samples (no data chunk).');
}

/**
 * Turns raw sample bytes, whole frames, into numbers from −1 to 1, interleaved as stored. Full
 * scale is 1: a 24-bit file's top code, 8,388,607, becomes just under 1, and its bottom code −1.
 */
export function decodeSamples(
  bytes: Uint8Array,
  info: Pick<WavInfo, 'bits' | 'float'>,
  out?: Float32Array,
): Float32Array {
  const size = info.bits / 8;
  const n = Math.floor(bytes.length / size);
  const samples = out && out.length >= n ? out.subarray(0, n) : new Float32Array(n);
  const v = view(bytes);
  if (info.float) {
    if (info.bits === 32) for (let i = 0; i < n; i++) samples[i] = v.getFloat32(i * 4, true);
    else for (let i = 0; i < n; i++) samples[i] = v.getFloat64(i * 8, true);
  } else if (info.bits === 24) {
    for (let i = 0, j = 0; i < n; i++, j += 3) {
      const u = bytes[j]! | (bytes[j + 1]! << 8) | (bytes[j + 2]! << 16);
      samples[i] = ((u << 8) >> 8) / 8388608;
    }
  } else if (info.bits === 16) {
    for (let i = 0; i < n; i++) samples[i] = v.getInt16(i * 2, true) / 32768;
  } else if (info.bits === 32) {
    for (let i = 0; i < n; i++) samples[i] = v.getInt32(i * 4, true) / 2147483648;
  } else {
    for (let i = 0; i < n; i++) samples[i] = (bytes[i]! - 128) / 128;
  }
  return samples;
}

/** Builds a 24-bit PCM WAV file from interleaved samples: for tests and test signals. */
export function encodeWav24(samples: Float32Array, channels: number, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 3;
  const bytes = new Uint8Array(44 + dataBytes);
  const v = view(bytes);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, PCM, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 3, true);
  v.setUint16(32, channels * 3, true);
  v.setUint16(34, 24, true);
  text(36, 'data');
  v.setUint32(40, dataBytes, true);
  for (let i = 0, j = 44; i < samples.length; i++, j += 3) {
    const code = Math.max(-8388608, Math.min(8388607, Math.round(samples[i]! * 8388608)));
    bytes[j] = code & 0xff;
    bytes[j + 1] = (code >> 8) & 0xff;
    bytes[j + 2] = (code >> 16) & 0xff;
  }
  return bytes;
}

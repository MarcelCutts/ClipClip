// Checks WAV recordings for clipping: the recorder overloading, and flat tops from something earlier
// in the chain, such as the mixer past its red. Reads files of any length a piece at a time. See
// src/lib/clipcheck/analyse.ts for how it decides.
//
//   pnpm clipcheck "/Volumes/HOWLER/Howler recordings/"*.WAV
//   pnpm clipcheck set.wav --minutes    # every minute with a mark, not just the worst
//   pnpm clipcheck set.wav --json       # the findings as JSON, for other tools
import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import { ClipCheck } from '../src/lib/clipcheck/analyse.ts';
import { formatReport } from '../src/lib/clipcheck/report.ts';
import { decodeSamples, readWavInfo } from '../src/lib/clipcheck/wav.ts';

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
const asJson = args.includes('--json');
const allMinutes = args.includes('--minutes');

if (files.length === 0 || args.includes('--help')) {
  console.log('Usage: pnpm clipcheck <file.wav> [more.wav …] [--minutes] [--json]');
  process.exit(files.length === 0 && !args.includes('--help') ? 1 : 0);
}

/** Events kept in the JSON output, per kind. The counts always cover everything. */
const JSON_EVENTS = 500;
const FRAMES_PER_READ = 1 << 16;

for (const path of files) {
  const name = basename(path);
  const handle = await open(path, 'r').catch((error: Error) => {
    console.error(`${name}: ${error.message}`);
    process.exitCode = 1;
  });
  if (!handle) continue;
  try {
    const size = (await handle.stat()).size;
    const read = async (offset: number, length: number) => {
      const bytes = new Uint8Array(length);
      const { bytesRead } = await handle.read(bytes, 0, length, offset);
      return bytes.subarray(0, bytesRead);
    };
    const info = await readWavInfo(read, size);
    const check = new ClipCheck(info.sampleRate, info.channels);
    const chunk = new Uint8Array(FRAMES_PER_READ * info.blockAlign);
    let samples: Float32Array | undefined;
    let shown = -1;
    for (let done = 0; done < info.dataBytes; ) {
      const want = Math.min(chunk.length, info.dataBytes - done);
      const { bytesRead } = await handle.read(chunk, 0, want, info.dataOffset + done);
      const whole = bytesRead - (bytesRead % info.blockAlign);
      if (whole === 0) break;
      samples = decodeSamples(chunk.subarray(0, whole), info, samples);
      check.push(samples);
      done += whole;
      const percent = Math.floor((done / info.dataBytes) * 100);
      if (process.stderr.isTTY && percent !== shown) {
        process.stderr.write(`\r${name}: ${percent}%`);
        shown = percent;
      }
    }
    if (process.stderr.isTTY) process.stderr.write('\r\x1b[K');
    const result = check.finish();
    if (asJson) {
      const { overloads, flatTops, ...rest } = result;
      const trimmed = {
        file: path,
        info,
        ...rest,
        overloads: { ...overloads, events: overloads.events.slice(0, JSON_EVENTS) },
        flatTops: { ...flatTops, events: flatTops.events.slice(0, JSON_EVENTS) },
      };
      console.log(JSON.stringify(trimmed, null, 2));
    } else {
      console.log(`${formatReport(name, info, result, { allMinutes })}\n`);
    }
  } catch (error) {
    console.error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await handle.close();
  }
}

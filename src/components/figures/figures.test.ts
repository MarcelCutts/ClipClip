import { describe, expect, it } from 'vitest';

// The drawings' sources, read as text: the rule below is about what is written, not what is rendered.
const sources = import.meta.glob<string>('./*Figure.astro', { eager: true, query: '?raw', import: 'default' });

/** Classes in Fig.astro that fill a shape. A path with one of them is filled unless it is also `open`. */
const FILLED = ['do', 'see', 'solid', 'pin', 'do-fill'];

/** Every path in a drawing, with its classes and its outline, constants resolved. */
function paths(source: string): { classes: string[]; d: string }[] {
  const constants = new Map(
    [...source.matchAll(/const (\w+) =\s*\n?\s*'([^']+)';/g)].map(([, name, value]) => [name ?? '', value ?? '']),
  );
  return [...source.matchAll(/<path\s+class="([^"]+)"\s+d=(?:"([^"]+)"|\{(\w+)\})/g)].map(([, classes, d, name]) => ({
    classes: (classes ?? '').split(/\s+/),
    d: d ?? constants.get(name ?? '') ?? '',
  }));
}

/** The parts of an outline, each from one "move to" to the next. */
const subpaths = (d: string): string[] => d.split(/(?=[Mm])/).filter((part) => part.trim());

describe('C1’s drawings', () => {
  it('are all read, path by path', () => {
    expect(Object.keys(sources)).toHaveLength(5);
    // Every path written in a source is found, whether its outline is written out or named.
    for (const [file, source] of Object.entries(sources)) {
      expect(paths(source), file).toHaveLength(source.match(/<path\b/g)?.length ?? 0);
    }
    // Only a path can be left open: the drawings use no line or polyline.
    for (const [file, source] of Object.entries(sources)) expect(source, file).not.toMatch(/<(polyline|line)\b/);
  });

  // An open path with a fill is filled across the line between its two ends: a triangle of the page's
  // colour over whatever is under it. The bracket's hid the bolt's washer (the owner, 28 September 2026).
  it('fill only shapes that close: a line that stays open is marked open', () => {
    for (const [file, source] of Object.entries(sources)) {
      for (const { classes, d } of paths(source)) {
        expect(d, `${file}: a path whose outline could not be read`).not.toBe('');
        const filled = classes.some((c) => FILLED.includes(c)) && !classes.includes('open');
        if (!filled) continue;
        for (const part of subpaths(d)) {
          expect(part.trim(), `${file}: a filled path is left open. Close it, or add the class "open"`).toMatch(
            /[Zz]$/,
          );
        }
      }
    }
  });

  it('draws the monitor’s bracket as an open line, at each end and in the bolt’s stack', () => {
    const table = Object.entries(sources).find(([file]) => file.includes('TableFigure'))?.[1] ?? '';
    const open = paths(table).filter((p) => p.classes.includes('open'));
    expect(open).toHaveLength(2);
    for (const { classes, d } of open) {
      expect(classes).toContain('do');
      expect(d).not.toMatch(/[Zz]/);
    }
  });
});

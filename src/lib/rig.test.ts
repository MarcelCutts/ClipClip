import { describe, expect, it } from 'vitest';
import {
  accessibleName,
  arrowHead,
  COPY,
  controlNames,
  controlsFor,
  DEFAULT_SELECTION,
  DRAWING_NAME,
  downstreamOf,
  edgesFor,
  FLOW,
  highlightFor,
  type LayoutName,
  LISTENERS,
  layoutFor,
  listenersReached,
  listText,
  MODEL_NOTE,
  NODES,
  type NodeId,
  type Point,
  type Rect,
  roundedPath,
  summaryFor,
  TALL_HIT_PAD,
  upstreamOf,
  WIDE_FROM_PX,
} from './rig';
import { section } from './sections';

const ALL = Object.keys(NODES) as NodeId[];
const LAYOUTS: LayoutName[] = ['tall', 'wide'];
const CHANNEL_CONTROLS: NodeId[] = ['trim1', 'eq1', 'fader1', 'trim2', 'eq2', 'fader2'];

describe('which knob touches what', () => {
  it('MASTER LEVEL reaches the PA and the Howler, but not the booth monitors', () => {
    expect(listenersReached('masterLevel')).toEqual(['pa', 'howler']);
    expect(downstreamOf('masterLevel').has('monitor')).toBe(false);
  });

  it('BOOTH MONITOR reaches the booth monitors and nothing else', () => {
    expect(listenersReached('booth')).toEqual(['monitor']);
    expect(downstreamOf('booth').has('pa')).toBe(false);
    expect(downstreamOf('booth').has('howler')).toBe(false);
  });

  it('the amps reach the PA alone, so turning the room up never touches the recording', () => {
    expect(listenersReached('amps')).toEqual(['pa']);
    expect(upstreamOf('howler').has('amps')).toBe(false);
    // After the DriveRack and its limiter, right before the speakers.
    expect(upstreamOf('amps').has('driverack')).toBe(true);
    expect(upstreamOf('amps').has('limiter')).toBe(true);
    expect(edgesFor().map((e) => e.id)).toContain('amps>pa');
  });

  it('TRIM, EQ and the faders reach everything', () => {
    for (const id of [...CHANNEL_CONTROLS, 'deck1', 'deck2', 'mix'] as NodeId[]) {
      expect(listenersReached(id), id).toEqual([...LISTENERS]);
    }
  });

  it('lists the controls that set each listener', () => {
    expect(controlsFor('howler')).toEqual([...CHANNEL_CONTROLS, 'masterLevel']);
    expect(controlsFor('monitor')).toEqual([...CHANNEL_CONTROLS, 'booth']);
    expect(controlsFor('pa')).toEqual([...CHANNEL_CONTROLS, 'masterLevel', 'amps']);
  });

  it('keeps the booth and master branches independent', () => {
    expect(downstreamOf('booth').has('masterLevel')).toBe(false);
    expect(downstreamOf('masterLevel').has('boothOut')).toBe(false);
  });
});

describe('meters', () => {
  const meters: NodeId[] = ['meter1', 'meter2', 'masterMeter'];

  it('change nothing downstream', () => {
    for (const m of meters) expect(downstreamOf(m).size).toBe(0);
  });

  it('read each channel before its fader', () => {
    expect([...upstreamOf('meter1')].sort()).toEqual(['deck1', 'eq1', 'trim1']);
    expect([...upstreamOf('meter2')].sort()).toEqual(['deck2', 'eq2', 'trim2']);
    expect(downstreamOf('fader1').has('meter1')).toBe(false);
  });

  it('read the MASTER meters after MASTER LEVEL and never after BOOTH MONITOR or the amps', () => {
    expect(controlsFor('masterMeter')).toEqual([...CHANNEL_CONTROLS, 'masterLevel']);
  });

  it('name blind spots that really are out of sight, on the path the meter watches', () => {
    for (const m of meters) {
      const spots = NODES[m].blindSpots ?? [];
      expect(spots.length).toBeGreaterThan(0);
      const seen = upstreamOf(m);
      for (const spot of spots) {
        expect(seen.has(spot)).toBe(false);
        expect([...seen].some((n) => downstreamOf(n).has(spot))).toBe(true);
      }
    }
  });
});

describe('the DriveRack', () => {
  it('only protects the PA branch', () => {
    expect(listenersReached('driverack')).toEqual(['pa']);
    expect(listenersReached('limiter')).toEqual(['pa']);
    expect(upstreamOf('howler').has('driverack')).toBe(false);
    expect(upstreamOf('monitor').has('driverack')).toBe(false);
  });
});

describe('the wiring table on the setup page', () => {
  it('reads what feeds each box, with the limiter inside the DriveRack', () => {
    const into = (id: NodeId) => edgesFor().find((e) => e.to === id)?.from;
    expect(into('masterLevel')).toBe('mix');
    expect(into('driverack')).toBe('master1');
    expect(into('amps')).toBe('limiter');
    expect(into('limiter')).toBe('driverack');
    expect(into('howler')).toBe('master2');
    expect(into('booth')).toBe('mix');
    expect(into('monitor')).toBe('boothOut');
  });
});

describe('the graph', () => {
  it('opens on the recorder, to see what reaches the file', () => {
    expect(DEFAULT_SELECTION).toBe('howler');
  });

  it('is fed from the decks, with no loops', () => {
    for (const id of ALL) {
      expect(downstreamOf(id).has(id), `${id} loops`).toBe(false);
      if (NODES[id].kind === 'source') continue;
      const up = upstreamOf(id);
      expect(up.has('deck1') || up.has('deck2'), `${id} is fed`).toBe(true);
    }
  });

  it('orders the DOM, and so the arrow keys, along the flow', () => {
    expect([...FLOW].sort()).toEqual([...ALL].sort());
    for (const e of edgesFor()) expect(FLOW.indexOf(e.from), e.id).toBeLessThan(FLOW.indexOf(e.to));
    expect(FLOW.slice(-10)).toEqual([
      'master1',
      'driverack',
      'limiter',
      'amps',
      'pa',
      'master2',
      'howler',
      'booth',
      'boothOut',
      'monitor',
    ]);
  });
});

describe('highlights', () => {
  it('light what a knob touches', () => {
    const h = highlightFor('booth');
    expect(h.direction).toBe('down');
    expect([...h.nodes].sort()).toEqual(['booth', 'boothOut', 'monitor']);
    expect([...h.edges].sort()).toEqual(['booth>boothOut', 'boothOut>monitor']);
    expect([...highlightFor('amps').nodes].sort()).toEqual(['amps', 'pa']);
  });

  it('light what feeds a box, leaving out the knobs that miss it', () => {
    const h = highlightFor('howler');
    expect(h.direction).toBe('up');
    for (const id of [...CHANNEL_CONTROLS, 'deck1', 'deck2', 'mix', 'masterLevel', 'master2'] as NodeId[]) {
      expect(h.nodes.has(id), id).toBe(true);
    }
    for (const id of ['booth', 'boothOut', 'masterMeter', 'meter1', 'master1', 'amps', 'pa'] as NodeId[]) {
      expect(h.nodes.has(id), id).toBe(false);
    }
  });

  it('light what a meter can see', () => {
    expect([...highlightFor('meter1').nodes].sort()).toEqual(['deck1', 'eq1', 'meter1', 'trim1']);
  });

  it('light the whole route through a socket, the mix or the DriveRack', () => {
    const h = highlightFor('master2');
    expect(h.direction).toBe('through');
    expect(h.nodes.has('howler')).toBe(true);
    expect(h.nodes.has('masterLevel')).toBe(true);
    expect(h.nodes.has('master1')).toBe(false);
    expect(highlightFor('mix').nodes.has('meter1')).toBe(false);
    const through = highlightFor('driverack');
    expect(through.nodes.has('masterLevel') && through.nodes.has('amps') && through.nodes.has('pa')).toBe(true);
  });

  it('only light edges between lit nodes', () => {
    for (const id of ALL) {
      const h = highlightFor(id);
      for (const e of edgesFor().filter((x) => h.edges.has(x.id))) {
        expect(h.nodes.has(e.from) && h.nodes.has(e.to)).toBe(true);
      }
    }
  });
});

describe('words', () => {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const all = [...Object.values(COPY).flatMap((c) => [c.title, c.text ?? '']), MODEL_NOTE.text, DRAWING_NAME];

  it('has a title for every part, and a line only where the summary under it leaves something out', () => {
    for (const id of ALL) {
      const { title, text } = COPY[id];
      expect(title.length, id).toBeGreaterThan(0);
      if (!text) continue;
      expect(words(text), `${id}: ${text}`).toBeLessThanOrEqual(12);
      // The summary already says what the part reaches, what sets it and what it shows.
      expect(text, id).not.toMatch(/\breach(es)?\b|\bhears?\b|\bshows?\b|every output/i);
    }
    // The parts whose summary says it all.
    expect(ALL.filter((id) => !COPY[id].text)).toEqual([
      'deck1',
      'trim1',
      'eq1',
      'meter1',
      'fader1',
      'deck2',
      'trim2',
      'eq2',
      'meter2',
      'fader2',
      'masterLevel',
      'masterMeter',
      'pa',
      'monitor',
    ]);
  });

  it('writes like a reference: no ", so" chains, no negative contractions, no question marks', () => {
    for (const s of all) {
      expect(s, s).not.toMatch(/, so\b|n’t\b|\?/);
      expect(s).not.toMatch(/—|!|please|yellow|THD|\s{2}/i);
      expect(s, 'curly apostrophes').not.toMatch(/'/);
      expect(s, s).not.toMatch(/middle meters|record level/);
    }
    for (const id of ALL) {
      const { label, notLabel } = summaryFor(id);
      expect(`${label} ${notLabel ?? ''}`, id).not.toMatch(/n’t\b/);
    }
  });

  it('points to the guide’s one home for what the makers leave out', () => {
    const makers = section('red-top');
    expect(MODEL_NOTE).toEqual({
      text: 'Parts of this drawing are assumptions.',
      link: `See ${makers.number}`,
      href: `#${makers.id}`,
    });
    // Stated there, not here: no "not published" or "we assume" in the drawing's words. The one
    // exception is MASTER ATT's reach, which changes what the crew expect when they switch it.
    const inline = [COPY.master1.text, COPY.master2.text];
    for (const s of all.filter((x) => !inline.includes(x))) expect(s, s).not.toMatch(/publish|we assume|does not say/i);
  });

  it('names the attenuators in UTILITY where they set an output’s level', () => {
    expect(COPY.boothOut.text).toBe('BOOTH ATT, in UTILITY, also sets their level.');
  });

  it('never states that MASTER ATT lowers MASTER 1 or MASTER 2: Pioneer does not say', () => {
    // Pioneer: MASTER ATT "sets the master output attenuator" (manual p. 32), naming no socket.
    for (const id of ['master1', 'master2'] as const) {
      expect(COPY[id].text).toBe('MASTER ATT may lower it too. Pioneer does not say.');
    }
    // The drawing wires only what is published: MASTER LEVEL feeds both sockets.
    expect(controlsFor('master1')).toContain('masterLevel');
    expect(edgesFor().some((e) => /att/i.test(e.from) || /att/i.test(e.to))).toBe(false);
  });

  it('agrees with the graph', () => {
    expect(COPY.howler.text).toBe('Its input is ceiling 2.');
    expect(NODES.howler.ceiling).toBe(2);
    expect(COPY.mix.title).toMatch(/^Ceiling 1/);
    expect(NODES.mix.ceiling).toBe(1);
    expect(COPY.amps.text).toMatch(/set the room’s volume/);
    expect(listenersReached('amps')).toEqual(['pa']);
  });

  it('names every node uniquely, starting with the words on it', () => {
    const names = ALL.map((id) => accessibleName(id));
    expect(new Set(names).size).toBe(names.length);
    for (const id of ALL) {
      const first = NODES[id].glyph === 'eq' ? 'EQ' : NODES[id].label.replace(/ /g, ' ');
      expect(accessibleName(id).startsWith(first), id).toBe(true);
      expect(accessibleName(id)).not.toMatch(/\s,| /);
    }
    expect(accessibleName('trim1')).toBe('TRIM, channel 1');
    expect(accessibleName('howler')).toBe('Howler Ceiling 2, recorder');
    expect(accessibleName('master1')).toBe('MASTER 1 XLR');
    expect(accessibleName('booth')).toBe('BOOTH MONITOR');
    expect(accessibleName('amps')).toBe('Amps QSC GX7');
  });

  it('joins lists the UK way', () => {
    expect(listText([])).toBe('');
    expect(listText(['PA'])).toBe('PA');
    expect(listText(['PA', 'monitor'])).toBe('PA and monitor');
    expect(listText(['a', 'b', 'c'], 'or')).toBe('a, b or c');
    expect(controlNames(['trim1', 'trim2', 'eq1', 'fader2', 'booth', 'amps'])).toEqual([
      'TRIM',
      'EQ',
      'fader',
      'BOOTH MONITOR',
      'amp gain',
    ]);
  });

  it('spells out each highlight as text', () => {
    expect(summaryFor('booth')).toEqual({
      label: 'Reaches',
      items: 'booth monitors',
      notLabel: 'Does not reach',
      notItems: 'PA speakers or recorder',
    });
    expect(summaryFor('masterLevel')).toEqual({
      label: 'Reaches',
      items: 'PA speakers and recorder',
      notLabel: 'Does not reach',
      notItems: 'booth monitors',
    });
    expect(summaryFor('amps')).toEqual({
      label: 'Reaches',
      items: 'PA speakers',
      notLabel: 'Does not reach',
      notItems: 'booth monitors or recorder',
    });
    expect(summaryFor('trim1')).toEqual({ label: 'Reaches', items: 'PA speakers, booth monitors and recorder' });
    expect(summaryFor('howler')).toEqual({
      label: 'Set by',
      items: 'TRIM, EQ, faders and MASTER LEVEL',
      notLabel: 'Not by',
      notItems: 'BOOTH MONITOR or amp gain',
    });
    expect(summaryFor('pa')).toEqual({
      label: 'Set by',
      items: 'TRIM, EQ, faders, MASTER LEVEL and amp gain',
      notLabel: 'Not by',
      notItems: 'BOOTH MONITOR',
    });
    expect(summaryFor('monitor').notItems).toBe('MASTER LEVEL or amp gain');
    // The amps come after MASTER 1, so they go unsaid there rather than listed as "Not by".
    expect(summaryFor('master1').notItems).toBe('BOOTH MONITOR');
    // The drawing taps each channel meter after its EQ (an assumption the guide states).
    expect(summaryFor('meter1')).toEqual({
      label: 'Shows',
      items: 'TRIM and EQ',
      notLabel: 'Cannot see',
      notItems: 'fader',
    });
    expect(summaryFor('masterMeter')).toEqual({
      label: 'Shows',
      items: 'TRIM, EQ, faders and MASTER LEVEL',
      notLabel: 'Cannot see',
      notItems: 'BOOTH MONITOR or amp gain',
    });
    expect(summaryFor('limiter').items).toBe('PA speakers');
  });
});

describe('drawing', () => {
  const inside = (p: Point, r: Rect, pad = 0) =>
    p[0] > r.x + pad && p[0] < r.x + r.w - pad && p[1] > r.y + pad && p[1] < r.y + r.h - pad;
  const onEdge = (p: Point, r: Rect) => {
    const [x, y] = p;
    const withinX = x >= r.x - 0.01 && x <= r.x + r.w + 0.01;
    const withinY = y >= r.y - 0.01 && y <= r.y + r.h + 0.01;
    const onX = Math.abs(x - r.x) < 0.01 || Math.abs(x - (r.x + r.w)) < 0.01;
    const onY = Math.abs(y - r.y) < 0.01 || Math.abs(y - (r.y + r.h)) < 0.01;
    return (onX && withinY) || (onY && withinX);
  };
  const overlap = (a: Rect, b: Rect, gap: number) =>
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
  /** Does an axis-aligned segment pass through the inside of a rect? */
  const crosses = (a: Point, b: Point, r: Rect) => {
    const steps = 40;
    for (let i = 1; i < steps; i++) {
      const p: Point = [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps];
      if (inside(p, r, 1)) return true;
    }
    return false;
  };
  // The narrowest each drawing is shown: the tall one on a 320px phone (a 258px stage), the wide one
  // from WIDE_FROM_PX of panel (SignalPath.svelte's breakpoint). SignalPath.svelte pads the tall
  // drawing's hit areas by TALL_HIT_PAD.
  const NARROWEST_PX: Record<LayoutName, number> = { tall: 258, wide: WIDE_FROM_PX };
  const hitArea = (name: LayoutName, r: Rect): Rect => {
    const pad = name === 'tall' ? TALL_HIT_PAD : { x: 0, y: 0 };
    return { x: r.x - pad.x, y: r.y - pad.y, w: r.w + 2 * pad.x, h: r.h + 2 * pad.y };
  };

  for (const name of LAYOUTS) {
    describe(`the ${name} layout`, () => {
      const layout = layoutFor(name);

      it('places every node once, inside the drawing, without overlaps', () => {
        expect(Object.keys(layout.rects).sort()).toEqual([...ALL].sort());
        for (const id of ALL) {
          const r = layout.rects[id];
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w).toBeLessThanOrEqual(layout.width);
          expect(r.y + r.h).toBeLessThanOrEqual(layout.height);
          // Easy to hit: 44 CSS px each way on the narrowest screen, hit padding included.
          const hit = hitArea(name, r);
          const px = NARROWEST_PX[name] / layout.width;
          expect(hit.w * px, `${id} target width`).toBeGreaterThanOrEqual(44);
          expect(hit.h * px, `${id} target height`).toBeGreaterThanOrEqual(44);
          for (const other of ALL) {
            if (other <= id) continue;
            expect(overlap(r, layout.rects[other], 2), `${id} overlaps ${other}`).toBe(false);
          }
        }
      });

      it('keeps every hit area inside the drawing and clear of its neighbours', () => {
        for (const id of ALL) {
          const hit = hitArea(name, layout.rects[id]);
          expect(hit.x >= 0 && hit.y >= 0, id).toBe(true);
          expect(hit.x + hit.w <= layout.width && hit.y + hit.h <= layout.height, id).toBe(true);
          for (const other of ALL) {
            if (other <= id) continue;
            // Touching is fine, overlapping isn't: a tap there would go to whichever part is drawn last.
            expect(overlap(hit, hitArea(name, layout.rects[other]), 0), `${id} and ${other}`).toBe(false);
          }
        }
      });

      it('draws every connection as an orthogonal wire from its node to the next', () => {
        const edges = edgesFor();
        expect(layout.wires.map((w) => w.edge).sort()).toEqual(edges.map((e) => e.id).sort());
        for (const e of edges) {
          const wire = layout.wires.find((w) => w.edge === e.id)!;
          const { points } = wire;
          expect(points.length).toBeGreaterThanOrEqual(2);
          for (let i = 1; i < points.length; i++) {
            const [a, b] = [points[i - 1]!, points[i]!];
            expect(a[0] === b[0] || a[1] === b[1], `${e.id} segment ${i} is orthogonal`).toBe(true);
          }
          expect(onEdge(points.at(-1)!, layout.rects[e.to]), `${e.id} ends on ${e.to}`).toBe(true);
          if (e.kind === 'tap') {
            // A meter taps the wire leaving its source.
            const main = layout.wires.filter((w) => w.edge !== e.id && w.edge.startsWith(`${e.from}>`));
            const start = points[0]!;
            const onMain = main.some((w) =>
              w.points.some((p, i) => {
                const q = w.points[i + 1];
                if (!q) return false;
                const minX = Math.min(p[0], q[0]);
                const maxX = Math.max(p[0], q[0]);
                const minY = Math.min(p[1], q[1]);
                const maxY = Math.max(p[1], q[1]);
                return start[0] >= minX && start[0] <= maxX && start[1] >= minY && start[1] <= maxY;
              }),
            );
            expect(onMain, `${e.id} starts on its source's wire`).toBe(true);
          } else {
            expect(onEdge(points[0]!, layout.rects[e.from]), `${e.id} starts on ${e.from}`).toBe(true);
          }
          expect(wire.d.startsWith('M')).toBe(true);
          expect(wire.arrow.endsWith('Z')).toBe(true);
        }
      });

      it('never runs a wire through a node it doesn’t connect', () => {
        for (const e of edgesFor()) {
          const { points } = layout.wires.find((w) => w.edge === e.id)!;
          for (const id of ALL) {
            if (id === e.from || id === e.to) continue;
            for (let i = 1; i < points.length; i++) {
              expect(crosses(points[i - 1]!, points[i]!, layout.rects[id]), `${e.id} crosses ${id}`).toBe(false);
            }
          }
        }
      });

      it('keeps the mixer inside the XDJ, with the sockets on its edge', () => {
        const { chassis } = layout;
        // Everything the sockets feed is outboard gear: the DriveRack, the amps, the speakers, the Howler.
        const sockets: NodeId[] = ['master1', 'master2', 'boothOut'];
        for (const id of ALL) {
          const r = layout.rects[id];
          const centre: Point = [r.x + r.w / 2, r.y + r.h / 2];
          const outboard = sockets.some((s) => downstreamOf(s).has(id));
          if (sockets.includes(id)) expect(onEdge(centre, chassis), `${id} on the rear panel`).toBe(true);
          else if (outboard) expect(inside(centre, chassis), `${id} outside the XDJ`).toBe(false);
          else expect(inside(centre, chassis), `${id} inside the XDJ`).toBe(true);
        }
      });

      it('lines the three places the music ends up along one edge', () => {
        const ends = LISTENERS.map((l) => layout.rects[l]);
        const along = name === 'tall' ? (r: Rect) => r.y : (r: Rect) => r.x;
        expect(new Set(ends.map(along)).size).toBe(1);
      });

      it('labels the Howler’s lead', () => {
        expect(layout.labels.map((l) => l.edge)).toEqual(['master2>howler']);
      });
    });
  }
});

describe('path helpers', () => {
  it('rounds corners and ends where the points end', () => {
    expect(roundedPath([])).toBe('');
    expect(
      roundedPath([
        [0, 0],
        [0, 10],
      ]),
    ).toBe('M0 0L0 10');
    const d = roundedPath([
      [0, 0],
      [0, 20],
      [30, 20],
    ]);
    expect(d).toContain('Q0 20');
    expect(d.endsWith('L30 20')).toBe(true);
  });

  it('points the arrowhead along the last segment', () => {
    expect(arrowHead([[0, 0]])).toBe('');
    expect(
      arrowHead([
        [0, 0],
        [0, 20],
      ]),
    ).toBe('M0 20L-3.6 13.5L3.6 13.5Z');
  });
});

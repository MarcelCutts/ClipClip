import { describe, expect, it } from 'vitest';
import {
  accessibleName,
  arrowHead,
  COPY,
  captionFor,
  controlNames,
  controlsFor,
  DEFAULT_SELECTION,
  downstreamOf,
  edgesFor,
  flowOrder,
  highlightFor,
  idleCaption,
  type LayoutName,
  LISTENERS,
  layoutFor,
  listenersReached,
  listText,
  modelNote,
  NODES,
  type NodeId,
  type Point,
  type Rect,
  resolveSelection,
  roundedPath,
  summaryFor,
  TALL_HIT_PAD,
  tapeFor,
  upstreamOf,
  type Variant,
  VIEW_NAME,
  visibleNodes,
  WHOSE,
} from './rig';
import { DJ_RULES } from './rules';

const VARIANTS: Variant[] = ['full', 'dj'];
const LAYOUTS: LayoutName[] = ['tall', 'wide'];
const CHANNEL_CONTROLS: NodeId[] = ['trim1', 'eq1', 'fader1', 'trim2', 'eq2', 'fader2'];

describe('which knob touches what', () => {
  it('MASTER LEVEL reaches the PA and the Howler, but not the booth monitors', () => {
    for (const variant of VARIANTS) {
      expect(listenersReached('masterLevel', variant)).toEqual(['pa', 'howler']);
      expect(downstreamOf('masterLevel', variant).has('monitor')).toBe(false);
    }
  });

  it('BOOTH MONITOR reaches the booth monitors and nothing else', () => {
    for (const variant of VARIANTS) {
      expect(listenersReached('booth', variant)).toEqual(['monitor']);
      expect(downstreamOf('booth', variant).has('pa')).toBe(false);
      expect(downstreamOf('booth', variant).has('howler')).toBe(false);
    }
  });

  it('the amps reach the PA alone, so turning the room up never touches the recording', () => {
    for (const variant of VARIANTS) {
      expect(listenersReached('amps', variant)).toEqual(['pa']);
      expect(upstreamOf('howler', variant).has('amps')).toBe(false);
      // After the DriveRack (and its limiter), right before the speakers.
      expect(upstreamOf('amps', variant).has('driverack')).toBe(true);
      expect(edgesFor(variant).map((e) => e.id)).toContain('amps>pa');
    }
    expect(upstreamOf('amps', 'full').has('limiter')).toBe(true);
  });

  it('TRIM, EQ and the faders reach everything, in both views', () => {
    for (const variant of VARIANTS) {
      for (const id of [...CHANNEL_CONTROLS, 'deck1', 'deck2', 'mix'] as NodeId[]) {
        expect(listenersReached(id, variant), `${id} ${variant}`).toEqual([...LISTENERS]);
      }
    }
  });

  it('lists the controls that set each listener', () => {
    for (const variant of VARIANTS) {
      expect(controlsFor('howler', variant)).toEqual([...CHANNEL_CONTROLS, 'masterLevel']);
      expect(controlsFor('monitor', variant)).toEqual([...CHANNEL_CONTROLS, 'booth']);
      expect(controlsFor('pa', variant)).toEqual([...CHANNEL_CONTROLS, 'masterLevel', 'amps']);
    }
  });

  it('keeps the booth and master branches independent', () => {
    for (const variant of VARIANTS) {
      expect(downstreamOf('booth', variant).has('masterLevel')).toBe(false);
      expect(downstreamOf('masterLevel', variant).has('boothOut')).toBe(false);
    }
  });
});

describe('meters', () => {
  const meters: NodeId[] = ['meter1', 'meter2', 'masterMeter'];

  it('change nothing downstream', () => {
    for (const variant of VARIANTS) {
      for (const m of meters) expect(downstreamOf(m, variant).size).toBe(0);
    }
  });

  it('read each channel before its fader', () => {
    for (const variant of VARIANTS) {
      expect([...upstreamOf('meter1', variant)].sort()).toEqual(['deck1', 'eq1', 'trim1']);
      expect([...upstreamOf('meter2', variant)].sort()).toEqual(['deck2', 'eq2', 'trim2']);
      expect(downstreamOf('fader1', variant).has('meter1')).toBe(false);
    }
  });

  it('read the middle meters after MASTER LEVEL and never after BOOTH MONITOR or the amps', () => {
    for (const variant of VARIANTS) {
      expect(controlsFor('masterMeter', variant)).toEqual([...CHANNEL_CONTROLS, 'masterLevel']);
    }
  });

  it('name blind spots that really are out of sight, on the path the meter watches', () => {
    for (const m of meters) {
      const spots = NODES[m].blindSpots ?? [];
      expect(spots.length).toBeGreaterThan(0);
      for (const variant of VARIANTS) {
        const seen = upstreamOf(m, variant);
        for (const spot of spots) {
          expect(seen.has(spot)).toBe(false);
          const fedBySeen = [...seen].some((n) => downstreamOf(n, variant).has(spot));
          expect(fedBySeen).toBe(true);
        }
      }
    }
  });
});

describe('the DriveRack', () => {
  it('only protects the PA branch', () => {
    for (const variant of VARIANTS) {
      expect(listenersReached('driverack', variant)).toEqual(['pa']);
      expect(upstreamOf('howler', variant).has('driverack')).toBe(false);
      expect(upstreamOf('monitor', variant).has('driverack')).toBe(false);
    }
    expect(listenersReached('limiter')).toEqual(['pa']);
  });

  it('hides its limiter in the DJ view', () => {
    expect(visibleNodes('dj')).not.toContain('limiter');
    expect(visibleNodes('full')).toContain('limiter');
    expect(edgesFor('dj').map((e) => e.id)).toContain('driverack>amps');
    expect(edgesFor('full').map((e) => e.id)).not.toContain('driverack>amps');
  });
});

describe('what starts picked', () => {
  it('opens the full view on the recorder and the DJ view on the crew’s knob', () => {
    expect(DEFAULT_SELECTION).toEqual({ full: 'howler', dj: 'masterLevel' });
    expect(resolveSelection(undefined, 'full')).toBe('howler');
    expect(resolveSelection(undefined, 'dj')).toBe('masterLevel');
  });

  it('keeps a pick the view can show, and swaps one it can’t for the default', () => {
    expect(resolveSelection('booth', 'dj')).toBe('booth');
    expect(resolveSelection('limiter', 'full')).toBe('limiter');
    expect(resolveSelection('limiter', 'dj')).toBe('masterLevel');
    expect(resolveSelection(null, 'dj')).toBe(null);
    for (const variant of VARIANTS) expect(visibleNodes(variant)).toContain(DEFAULT_SELECTION[variant]);
  });
});

describe('the graph', () => {
  it('is fed from the decks, with no loops', () => {
    for (const variant of VARIANTS) {
      for (const id of visibleNodes(variant)) {
        expect(downstreamOf(id, variant).has(id), `${id} loops`).toBe(false);
        if (NODES[id].kind === 'source') continue;
        const up = upstreamOf(id, variant);
        expect(up.has('deck1') || up.has('deck2'), `${id} is fed`).toBe(true);
      }
    }
  });

  it('only connects nodes the view shows', () => {
    for (const variant of VARIANTS) {
      const shown = visibleNodes(variant);
      for (const e of edgesFor(variant)) {
        expect(shown).toContain(e.from);
        expect(shown).toContain(e.to);
      }
    }
  });

  it('orders the DOM, and so the arrow keys, along the flow', () => {
    for (const variant of VARIANTS) {
      const order = flowOrder(variant);
      expect([...order].sort()).toEqual([...visibleNodes(variant)].sort());
      for (const e of edgesFor(variant)) {
        expect(order.indexOf(e.from), e.id).toBeLessThan(order.indexOf(e.to));
      }
    }
    expect(flowOrder('full').slice(-10)).toEqual([
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
    expect(flowOrder('dj').slice(-8)).toEqual([
      'driverack',
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
    expect([...highlightFor('amps', 'dj').nodes].sort()).toEqual(['amps', 'pa']);
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

  it('light the whole route through a socket or the mix', () => {
    const h = highlightFor('master2');
    expect(h.direction).toBe('through');
    expect(h.nodes.has('howler')).toBe(true);
    expect(h.nodes.has('masterLevel')).toBe(true);
    expect(h.nodes.has('master1')).toBe(false);
    expect(highlightFor('mix').nodes.has('meter1')).toBe(false);
    const through = highlightFor('driverack', 'dj');
    expect(through.nodes.has('masterLevel') && through.nodes.has('amps') && through.nodes.has('pa')).toBe(true);
  });

  it('only light edges between lit nodes', () => {
    for (const variant of VARIANTS) {
      const edges = edgesFor(variant);
      for (const id of visibleNodes(variant)) {
        const h = highlightFor(id, variant);
        for (const e of edges.filter((x) => h.edges.has(x.id))) {
          expect(h.nodes.has(e.from) && h.nodes.has(e.to)).toBe(true);
        }
      }
    }
  });
});

describe('words', () => {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

  it('has a title and a short caption for every node and view', () => {
    for (const variant of VARIANTS) {
      for (const id of visibleNodes(variant)) {
        const { title, text } = captionFor(id, variant);
        expect(title.length, id).toBeGreaterThan(0);
        expect(words(text), `${id} ${variant}: ${text}`).toBeLessThanOrEqual(25);
        for (const sentence of text.split(/(?<=[.?])\s+/)) expect(words(sentence)).toBeLessThanOrEqual(20);
      }
    }
    for (const variant of VARIANTS) expect(words(idleCaption(variant).text)).toBeLessThanOrEqual(25);
  });

  it('names the two views apart, so one page can show both', () => {
    expect(VIEW_NAME).toEqual({ full: 'Which knob touches what', dj: 'Whose knob is whose' });
    expect(idleCaption('dj').title).toBe(VIEW_NAME.dj);
    expect(idleCaption('full').title).toBe(VIEW_NAME.full);
  });

  it('gives each view the same titles, so either view can sit anywhere', () => {
    for (const id of visibleNodes('dj')) expect(captionFor(id, 'dj').title).toBe(captionFor(id, 'full').title);
    // Titles name the part as the drawing does.
    expect(captionFor('booth').title).toContain('BOOTH MONITOR');
    expect(captionFor('monitor').title).toContain('booth monitors');
  });

  it('labels the model honestly, and tells crew about the Howler too', () => {
    const mixer = 'Where exactly the XDJ clips inside isn’t published, so the mixer counts as one ceiling.';
    const meters = 'Pioneer doesn’t say whether the channel meters read after the EQ. This drawing assumes they do.';
    expect(modelNote('dj')).toBe(`${mixer} ${meters}`);
    expect(modelNote('full')).toContain(mixer);
    expect(modelNote('full')).toContain('LEVEL light is the only guide');
    expect(modelNote('full')).toContain(meters);
    for (const variant of VARIANTS) {
      // The drawing taps each channel meter after its EQ, so its readout says "Shows TRIM and EQ".
      expect(upstreamOf('meter1', variant).has('eq1')).toBe(true);
      expect(summaryFor('meter1', variant).items).toBe('TRIM and EQ');
      // House style: no colon reveals, and sentences of 20 words or fewer.
      expect(modelNote(variant)).not.toMatch(/:/);
      for (const sentence of modelNote(variant).split(/(?<=\.)\s+/)) {
        expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20);
      }
    }
  });

  it('names the attenuators in UTILITY where crew set an output’s level', () => {
    expect(captionFor('boothOut', 'full').text).toContain('BOOTH MONITOR and BOOTH ATT, in UTILITY');
    expect(captionFor('master1', 'full').text).toContain('MASTER LEVEL and MASTER ATT, in UTILITY');
    // Pioneer names no sockets for MASTER ATT, so the drawing doesn't claim it reaches the recorder.
    expect(captionFor('master2', 'full').text).toContain('Pioneer doesn’t say whether MASTER ATT reaches it');
    // The attenuators turn outputs down too, so no knob "only" sets a level.
    for (const variant of VARIANTS) {
      for (const id of visibleNodes(variant)) {
        expect(captionFor(id, variant).text, id).not.toMatch(/\bonly\b[^.]*\bsets?\b/i);
      }
    }
    // The DJ view's captions leave the attenuators out; its key says UTILITY is the crew's.
    for (const id of visibleNodes('dj')) {
      expect(captionFor(id, 'dj').text, id).not.toMatch(/\bATT\b|UTILITY/);
    }
  });

  it('speaks to crew in the full view and to the DJ in the DJ view', () => {
    for (const id of visibleNodes('full')) {
      expect(captionFor(id, 'full').text).not.toMatch(/\byour (channels|knob)\b/i);
    }
    expect(captionFor('howler', 'dj').text).toContain('your channels');
  });

  it('follows the house style', () => {
    const all = [...Object.values(COPY).flatMap((c) => [c.title, c.text, c.dj ?? '']), ...Object.values(WHOSE)];
    for (const s of all) {
      expect(s).not.toMatch(/—|!|please|yellow|THD|\s{2}/i);
      expect(s, 'units need a no-break space').not.toMatch(/\d dB/);
      expect(s, 'curly apostrophes').not.toMatch(/'/);
      // One wiring, so no before and after.
      expect(s, s).not.toMatch(/\b(now|today|proposed)\b/i);
      // Plain statements: no "Want more? Ask crew." lead-ins, and no fragments like "Your knob."
      expect(s, s).not.toMatch(/\?/);
      expect(s, s).not.toMatch(/^(Your|Crew’s) knobs?\./);
    }
  });

  it('agrees with the graph', () => {
    expect(captionFor('masterLevel').text).toContain('sets the PA and the recording together');
    expect(listenersReached('masterLevel')).toEqual(['pa', 'howler']);
    expect(captionFor('booth').text).toContain('doesn’t reach the PA or the recording');
    expect(listenersReached('booth')).toEqual(['monitor']);
    expect(captionFor('howler').text).toContain('then MASTER LEVEL');
    expect(captionFor('howler').text).toContain('BOOTH MONITOR and the amps don’t reach it');
    expect(captionFor('monitor').text).toContain('MASTER LEVEL and the amps don’t change them');
    expect(controlsFor('monitor')).not.toContain('masterLevel');
    expect(captionFor('pa').text).toContain('BOOTH MONITOR doesn’t reach the PA');
    expect(controlsFor('pa')).not.toContain('booth');
    expect(captionFor('amps').text).toContain('The recording never hears them');
  });

  it('uses the DJ wording where there is one', () => {
    expect(captionFor('booth', 'dj').text).toMatch(/^BOOTH MONITOR is yours, marked MONITOR\./);
    expect(captionFor('masterLevel', 'dj').text).toMatch(/^MASTER LEVEL is the crew’s knob, marked REC\./);
    expect(captionFor('amps', 'dj').text).toMatch(/^The amps’ gain knobs are the crew’s, marked RIG\./);
    expect(captionFor('meter1', 'dj').text).toMatch(/In a blend, watch the middle meters\.$/);
    // The DJ rule's own challenge and response, so the widget and the booth card never disagree.
    const line = (r: (typeof DJ_RULES)[number]) => `${r.challenge}, ${r.response}.`;
    expect(DJ_RULES.some((r) => captionFor('meter1', 'dj').text.endsWith(line(r)))).toBe(true);
    expect(captionFor('meter1', 'full').text).toMatch(/The middle meters show the mix\.$/);
    expect(captionFor('deck1', 'dj')).toEqual(captionFor('deck1', 'full'));
  });

  it('tells DJs which controls are theirs and which are the crew’s', () => {
    for (const id of visibleNodes('dj').filter((n) => NODES[n].kind === 'control')) {
      const { text } = captionFor(id, 'dj');
      // Said first, in the first sentence.
      const first = text.split(/(?<=\.)\s/)[0] ?? '';
      expect(NODES[id].owner, id).toBeDefined();
      if (NODES[id].owner === 'crew') expect(first, id).toMatch(/\bthe crew’s\b/);
      else expect(first, id).toMatch(/\bis yours\b|\bare yours\b|\bis yours,/);
      expect(captionFor(id, 'full').text, id).not.toMatch(/\byours\b|\bcrew’s\b/);
    }
    // The key names the same controls as the graph.
    const mine = visibleNodes('dj').filter((n) => NODES[n].owner === 'yours');
    expect(WHOSE.yours).toBe(listText(controlNames(mine)));
    expect(WHOSE.crew).toMatch(/^MASTER LEVEL, UTILITY and the amps$/);
    expect(visibleNodes('dj').filter((n) => NODES[n].owner === 'crew')).toEqual(['masterLevel', 'amps']);
  });

  it('tapes the DJ view like the real gear: MASTER LEVEL and the amps are the crew’s, BOOTH MONITOR is yours', () => {
    const taped = (variant: Variant) =>
      Object.fromEntries(
        visibleNodes(variant).flatMap((id) => (tapeFor(id, variant) ? [[id, tapeFor(id, variant)]] : [])),
      );
    expect(taped('dj')).toEqual({ masterLevel: 'Crew', booth: 'Yours', amps: 'Crew' });
    expect(taped('full')).toEqual({});
  });

  it('gives DJs the same monitor advice as the guide', () => {
    expect(captionFor('monitor', 'dj').text).toContain('BOOTH MONITOR, your knob');
    expect(captionFor('booth', 'full').text).toContain('it’s the DJ’s knob');
  });

  it('names every node uniquely, starting with the words on it', () => {
    for (const variant of VARIANTS) {
      const names = visibleNodes(variant).map((id) => accessibleName(id, variant));
      expect(new Set(names).size).toBe(names.length);
      for (const id of visibleNodes(variant)) {
        const first = NODES[id].glyph === 'eq' ? 'EQ' : NODES[id].label.replace(/ /g, ' ');
        expect(accessibleName(id, variant).startsWith(first), id).toBe(true);
        expect(accessibleName(id, variant)).not.toMatch(/\s,| /);
      }
    }
    expect(accessibleName('trim1')).toBe('TRIM, channel 1');
    expect(accessibleName('howler')).toBe('Howler Ceiling 2, recorder');
    expect(accessibleName('master1')).toBe('MASTER 1 XLR');
    // The DJ view says whose a taped knob is, as its tape does.
    expect(accessibleName('masterLevel', 'dj')).toBe('MASTER LEVEL, crew’s');
    expect(accessibleName('booth', 'dj')).toBe('BOOTH MONITOR, yours');
    expect(accessibleName('amps', 'dj')).toBe('Amps QSC GX7, crew’s');
    expect(accessibleName('booth', 'full')).toBe('BOOTH MONITOR');
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
      notLabel: 'Doesn’t reach',
      notItems: 'PA speakers or recorder',
    });
    expect(summaryFor('masterLevel')).toEqual({
      label: 'Reaches',
      items: 'PA speakers and recorder',
      notLabel: 'Doesn’t reach',
      notItems: 'booth monitors',
    });
    expect(summaryFor('amps', 'dj')).toEqual({
      label: 'Reaches',
      items: 'PA speakers',
      notLabel: 'Doesn’t reach',
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
    expect(summaryFor('meter1')).toEqual({
      label: 'Shows',
      items: 'TRIM and EQ',
      notLabel: 'Can’t see',
      notItems: 'fader',
    });
    expect(summaryFor('masterMeter')).toEqual({
      label: 'Shows',
      items: 'TRIM, EQ, faders and MASTER LEVEL',
      notLabel: 'Can’t see',
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
  // in a 960px panel (SignalPath.svelte's breakpoint). SignalPath.svelte pads the tall drawing's hit
  // areas by TALL_HIT_PAD.
  const NARROWEST_PX: Record<LayoutName, number> = { tall: 258, wide: 960 };
  const hitArea = (name: LayoutName, r: Rect): Rect => {
    const pad = name === 'tall' ? TALL_HIT_PAD : { x: 0, y: 0 };
    return { x: r.x - pad.x, y: r.y - pad.y, w: r.w + 2 * pad.x, h: r.h + 2 * pad.y };
  };

  for (const name of LAYOUTS) {
    describe(`the ${name} layout`, () => {
      it('places every node once, inside the drawing, without overlaps', () => {
        for (const variant of VARIANTS) {
          const layout = layoutFor(name, variant);
          const ids = visibleNodes(variant);
          expect(Object.keys(layout.rects).sort()).toEqual([...ids].sort());
          for (const id of ids) {
            const r = layout.rects[id]!;
            expect(r.x).toBeGreaterThanOrEqual(0);
            expect(r.y).toBeGreaterThanOrEqual(0);
            expect(r.x + r.w).toBeLessThanOrEqual(layout.width);
            expect(r.y + r.h).toBeLessThanOrEqual(layout.height);
            // Easy to hit: 44 CSS px each way on the narrowest screen, hit padding included.
            const hit = hitArea(name, r);
            const px = NARROWEST_PX[name] / layout.width;
            expect(hit.w * px, `${id} target width`).toBeGreaterThanOrEqual(44);
            expect(hit.h * px, `${id} target height`).toBeGreaterThanOrEqual(44);
            for (const other of ids) {
              if (other <= id) continue;
              expect(overlap(r, layout.rects[other]!, 2), `${id} overlaps ${other}`).toBe(false);
            }
          }
        }
      });

      it('keeps every hit area inside the drawing and clear of its neighbours', () => {
        for (const variant of VARIANTS) {
          const layout = layoutFor(name, variant);
          const ids = visibleNodes(variant);
          for (const id of ids) {
            const hit = hitArea(name, layout.rects[id]!);
            expect(hit.x >= 0 && hit.y >= 0, id).toBe(true);
            expect(hit.x + hit.w <= layout.width && hit.y + hit.h <= layout.height, id).toBe(true);
            for (const other of ids) {
              if (other <= id) continue;
              // Touching is fine, overlapping isn't: a tap there would go to whichever part is drawn last.
              expect(overlap(hit, hitArea(name, layout.rects[other]!), 0), `${id} and ${other}`).toBe(false);
            }
          }
        }
      });

      it('draws every connection as an orthogonal wire from its node to the next', () => {
        for (const variant of VARIANTS) {
          const layout = layoutFor(name, variant);
          const edges = edgesFor(variant);
          expect(layout.wires.map((w) => w.edge).sort()).toEqual(edges.map((e) => e.id).sort());
          for (const e of edges) {
            const wire = layout.wires.find((w) => w.edge === e.id)!;
            const { points } = wire;
            expect(points.length).toBeGreaterThanOrEqual(2);
            for (let i = 1; i < points.length; i++) {
              const [a, b] = [points[i - 1]!, points[i]!];
              expect(a[0] === b[0] || a[1] === b[1], `${e.id} segment ${i} is orthogonal`).toBe(true);
            }
            expect(onEdge(points.at(-1)!, layout.rects[e.to]!), `${e.id} ends on ${e.to}`).toBe(true);
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
              expect(onEdge(points[0]!, layout.rects[e.from]!), `${e.id} starts on ${e.from}`).toBe(true);
            }
            expect(wire.d.startsWith('M')).toBe(true);
            expect(wire.arrow.endsWith('Z')).toBe(true);
          }
        }
      });

      it('never runs a wire through a node it doesn’t connect', () => {
        for (const variant of VARIANTS) {
          const layout = layoutFor(name, variant);
          for (const e of edgesFor(variant)) {
            const { points } = layout.wires.find((w) => w.edge === e.id)!;
            for (const id of visibleNodes(variant)) {
              if (id === e.from || id === e.to) continue;
              for (let i = 1; i < points.length; i++) {
                expect(crosses(points[i - 1]!, points[i]!, layout.rects[id]!), `${e.id} crosses ${id}`).toBe(false);
              }
            }
          }
        }
      });

      it('keeps the mixer inside the XDJ, with the sockets on its edge', () => {
        for (const variant of VARIANTS) {
          const layout = layoutFor(name, variant);
          const { chassis } = layout;
          // Everything the sockets feed is outboard gear: the DriveRack, the amps, the speakers, the Howler.
          const sockets: NodeId[] = ['master1', 'master2', 'boothOut'];
          for (const id of visibleNodes(variant)) {
            const r = layout.rects[id]!;
            const centre: Point = [r.x + r.w / 2, r.y + r.h / 2];
            const outboard = sockets.some((s) => downstreamOf(s, variant).has(id));
            if (sockets.includes(id)) expect(onEdge(centre, chassis), `${id} on the rear panel`).toBe(true);
            else if (outboard) expect(inside(centre, chassis), `${id} outside the XDJ`).toBe(false);
            else expect(inside(centre, chassis), `${id} inside the XDJ`).toBe(true);
          }
        }
      });

      it('lines the three places the music ends up along one edge', () => {
        for (const variant of VARIANTS) {
          const { rects } = layoutFor(name, variant);
          const ends = LISTENERS.map((l) => rects[l]!);
          const along = name === 'tall' ? (r: Rect) => r.y : (r: Rect) => r.x;
          expect(new Set(ends.map(along)).size, variant).toBe(1);
        }
      });

      it('labels the Howler’s lead in the full view only', () => {
        expect(layoutFor(name, 'full').labels.map((l) => l.edge)).toEqual(['master2>howler']);
        expect(layoutFor(name, 'dj').labels).toEqual([]);
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

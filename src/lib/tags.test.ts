import { describe, expect, it } from 'vitest';
import { CHECKLISTS } from './checklists';
import { FIXES } from './fixes';
import { DJ_RULES } from './rules';
import { MASTER_TAG, MONITOR_TAG, REC_TAG, RIG_TAG, SHORT_TAGS } from './tags';

const words = [
  MASTER_TAG.name,
  ...MASTER_TAG.lines,
  MASTER_TAG.where,
  ...SHORT_TAGS.flatMap((t) => [t.name, t.owner, t.where, t.rule ?? '']),
];

describe('knob tags', () => {
  it('lead the MASTER LEVEL tag with what to do', () => {
    // The crew set it by the MASTER meters at soundcheck (C1). The tag names no mark: there is none.
    expect(MASTER_TAG.name).toBe('LEAVE IT AS YOU FIND IT');
    expect(MASTER_TAG.lines[0]).toBe('It sets the speakers and the recording.');
  });

  it('say what the guide says about a louder room, word for word', () => {
    const rule = DJ_RULES.find((r) => r.label === 'RIG');
    expect(MASTER_TAG.lines.at(-1)).toBe(rule?.text);
    expect(MASTER_TAG.lines.at(-1)).toBe('For a louder room, ask the crew.');
  });

  it('say whose each knob is in one form', () => {
    expect([REC_TAG.owner, MONITOR_TAG.owner, RIG_TAG.owner]).toEqual(['crew', 'yours', 'crew']);
  });

  it('say things plainly: no questions, and no negative contractions', () => {
    for (const line of words) {
      expect(line).not.toMatch(/\?/);
      expect(line).not.toMatch(/n’t\b|n't\b/);
    }
  });

  it('give the RIG tag the amps’ limit as the crew can see it: their CLIP lights', () => {
    expect(RIG_TAG.rule).toBe('CLIP lights dark');
    expect(RIG_TAG.where).toBe('On both amps, beside the gain knobs.');
    // The others carry no rule: REC and MONITOR only say whose the knob is.
    expect(SHORT_TAGS.filter((t) => t.rule)).toEqual([RIG_TAG]);
    expect(SHORT_TAGS.filter((t) => t.blanks)).toEqual([]);
  });

  it('are labels nothing depends on: no list or drill names a tag, a tape or a mark', () => {
    // The owner, 28 September 2026: tape tags are not a necessity, and the gear carries no marks.
    const lines = [
      ...Object.values(CHECKLISTS).flatMap((l) => l.items.flatMap((i) => [i.check, i.target, i.note ?? ''])),
      ...FIXES.map((f) => f.objective),
    ];
    // "Marks" the verb is Audacity's, in C4: the guard is for the nouns.
    expect(lines.join(' ')).not.toMatch(/\btags?\b|\b(?:the|REC|RIG) tape\b|\b(?:the|REC|RIG) marks?\b/i);
    expect(words.join(' ')).not.toMatch(/\bmarks?\b/i);
  });
});

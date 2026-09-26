import { describe, expect, it } from 'vitest';
import { CHECKLISTS } from './checklists';
import { DJ_RULES } from './rules';
import { MASTER_TAG, MONITOR_TAG, REC_TAG, RIG_TAG, SHORT_TAGS } from './tags';

const words = [
  MASTER_TAG.name,
  ...MASTER_TAG.lines,
  MASTER_TAG.where,
  ...SHORT_TAGS.flatMap((t) => [t.name, t.owner, t.where]),
];

describe('knob tags', () => {
  it('lead the MASTER LEVEL tag with what to do', () => {
    expect(MASTER_TAG.name).toBe('LEAVE FULLY UP');
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

  it('give the REC tape a blank for each attenuator the night’s checklists compare with it', () => {
    expect(REC_TAG.blanks).toEqual(['MASTER ATT', 'BOOTH ATT']);
    const checks = [...CHECKLISTS.doors.items, ...CHECKLISTS.changeover.items].map((i) => `${i.check} ${i.target}`);
    expect(checks.some((c) => /ATT.*as on the (REC )?tape/.test(c))).toBe(true);
  });
});

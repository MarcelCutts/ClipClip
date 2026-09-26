import { describe, expect, it } from 'vitest';
import { CHECKLISTS } from './checklists';
import { DJ_RULES } from './rules';
import { MASTER_TAG, REC_TAG, SHORT_TAGS } from './tags';

describe('knob tags', () => {
  it('say what the guide says about a louder room, word for word', () => {
    const rule = DJ_RULES.find((r) => r.label === 'RIG');
    expect(MASTER_TAG.lines.at(-1)).toBe(rule?.text);
    expect(MASTER_TAG.lines.at(-1)).toBe('If you want it louder, ask the crew.');
  });

  it('say things plainly: no question-and-answer lead-ins', () => {
    for (const line of [...MASTER_TAG.lines, ...SHORT_TAGS.map((t) => t.where)]) {
      expect(line).not.toMatch(/\?/);
    }
  });

  it('give the REC tape a blank for each attenuator the night’s checklists check against it', () => {
    expect(REC_TAG.blanks).toEqual(['MASTER ATT', 'BOOTH ATT']);
    const checks = [...CHECKLISTS.doors.items, ...CHECKLISTS.changeover.items].map((i) => `${i.check} ${i.target}`);
    expect(checks.some((c) => /ATT.*as on the (REC )?tape/.test(c))).toBe(true);
  });
});

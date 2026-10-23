import { describe, expect, it } from 'vitest';
import { ALL, APPEND, CREATE, DELETE, EDIT, EDIT_APPEND, NONE } from '../src';
import { hasMode } from '../src/modes';

describe('modes', () => {
  it('are distinct bit flags', () => {
    const flags = [CREATE, EDIT, DELETE, APPEND];
    expect(flags).toEqual([1, 2, 4, 8]);
    expect(NONE).toBe(0);
  });

  it('combine into EDIT_APPEND and ALL', () => {
    expect(EDIT_APPEND).toBe(EDIT | APPEND);
    expect(ALL).toBe(CREATE | EDIT | DELETE | APPEND);
  });

  it('hasMode checks whether every bit of a flag is set', () => {
    expect(hasMode(ALL, CREATE)).toBe(true);
    expect(hasMode(CREATE | DELETE, EDIT)).toBe(false);
    expect(hasMode(EDIT, EDIT_APPEND)).toBe(false);
    expect(hasMode(EDIT_APPEND, EDIT_APPEND)).toBe(true);
    expect(hasMode(NONE, CREATE)).toBe(false);
  });
});

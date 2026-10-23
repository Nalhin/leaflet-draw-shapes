import { describe, expect, it } from 'vitest';
import { DrawLayer, Mode } from '../src';
import { hasMode } from '../src/modes';

describe('Mode', () => {
  it('has distinct bit flags', () => {
    const { CREATE, EDIT, DELETE, APPEND } = Mode;
    expect([CREATE, EDIT, DELETE, APPEND]).toEqual([1, 2, 4, 8]);
    expect(Mode.NONE).toBe(0);
    expect(Mode.ALL).toBe(CREATE | EDIT | DELETE | APPEND);
  });

  it('is available on the class', () => {
    expect(DrawLayer.Mode).toBe(Mode);
  });

  it('hasMode checks whether every bit of a flag is set', () => {
    expect(hasMode(Mode.ALL, Mode.CREATE)).toBe(true);
    expect(hasMode(Mode.CREATE | Mode.DELETE, Mode.EDIT)).toBe(false);
    expect(hasMode(Mode.EDIT, Mode.EDIT | Mode.APPEND)).toBe(false);
    expect(hasMode(Mode.NONE, Mode.CREATE)).toBe(false);
  });
});

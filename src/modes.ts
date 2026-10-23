/**
 * Interaction modes. They are bit flags, so they can be combined with `|`
 * (e.g. `Mode.CREATE | Mode.DELETE`) and toggled with `^`.
 */
export const Mode = {
  NONE: 0,
  CREATE: 1,
  EDIT: 2,
  DELETE: 4,
  APPEND: 8,
  ALL: 15,
} as const;

/** A bitmask made of {@link Mode} flags. */
export type Mode = number;

export function hasMode(mode: Mode, flag: Mode): boolean {
  return (mode & flag) === flag;
}
